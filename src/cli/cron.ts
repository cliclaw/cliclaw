/**
 * `cliclaw cron` — the main autonomous agent loop.
 * Features: adaptive sleep, engine rotation, parallel, hooks, snapshots, dry-run, notifications.
 */

import { rmSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolveConfig, ensureAllDirs, primaryAgent } from "../core/config.js";
import { initLogger, logInfo, logError, logWarn, logJson } from "../core/logger.js";
import { initState, readState, writeState } from "../core/state.js";
import { initMemory, appendToMemory, extractMemoryAppend } from "../core/memory.js";
import { killPrevious, acquireLock, releaseLock, killAgentProcesses } from "../core/lock.js";
import { buildPrompt, estimatePromptTokens, hashPrompt, logPromptStats } from "../prompts/builder.js";
import { runCycle, runParallelCycles, stopAllAgents } from "../agents/runner.js";
import { formatCost } from "../core/cost.js";
import { saveSnapshot } from "../core/snapshots.js";
import { runPreCycle, runPostCycle, runOnSuccess, runOnFailure, parseAgentSignals } from "../core/hooks.js";
import { sendNotification } from "../utils/notify.js";
import { isAgentAvailable } from "../agents/registry.js";
import type { ClawConfig, AgentEntry } from "../core/types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeSleep(baseSleep: number, stallCycles: number, multiplier: number, cap: number): number {
  if (stallCycles <= 0) return baseSleep;
  return Math.round(baseSleep * Math.min(Math.pow(multiplier, stallCycles), cap));
}

/** Find the most recent agent-input file in tmpDir, optionally filtered by engine/alias */
function findLastPromptFile(tmpDir: string, engineAlias?: string): string | null {
  if (!existsSync(tmpDir)) return null;
  const files = readdirSync(tmpDir)
    .filter((f) => f.startsWith("agent-input-") && f.endsWith(".txt"))
    .filter((f) => !engineAlias || f.endsWith(`-${engineAlias}.txt`))
    .sort((a, b) => {
      const na = parseInt(a.split("-")[2] ?? "0", 10);
      const nb = parseInt(b.split("-")[2] ?? "0", 10);
      return nb - na;
    });
  return files[0] ? `${tmpDir}/${files[0]}` : null;
}

const CRON_HELP = `
cliclaw cron — Start the autonomous agent loop

Usage:
  cliclaw cron [focus] [options]

Arguments:
  focus                  Optional task focus (e.g., "fix tests")

Options:
  --agent <name>        Engine to use (kiro, claude, cursor, etc.)
  --model <name>         Model to use
  --project-root <path>  Project root directory
  --max-loop <n>         Max cycles (0 = unlimited)
  --sleep <seconds>      Sleep between cycles
  --focus <task>         Task focus
  --dry-run              Preview prompts without running
  All non-manual agents run in parallel by default
  --continue             Resume from last prompt
  --help, -h             Show this help

Examples:
  cliclaw cron                           # Start with default config
  cliclaw cron "fix tests"               # Focus on specific task
  cliclaw cron --agent=claude           # Use specific engine
  cliclaw cron --dry-run                 # Preview mode
  cliclaw cron --parallel --max-loop=5   # Parallel mode, 5 cycles
`;

function parseArgs(args: string[]): { focus: string | null; overrides: Partial<ClawConfig>; continueMode: boolean; showHelp: boolean } {
  const overrides: Partial<ClawConfig> = {};
  let focus: string | null = null;
  let continueMode = false;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case "--help":
      case "-h":
        showHelp = true;
        break;
      case "--agent":
        if (next) {
          overrides.agents = [{ agent: next as AgentEntry["agent"], model: "" }];
          i++;
        }
        break;
      case "--model":
        if (next && overrides.agents?.[0]) {
          overrides.agents[0].model = next;
          i++;
        }
        break;
      case "--project-root":
        if (next) { overrides.projectRoot = next; i++; }
        break;
      case "--max-loop":
        if (next) { overrides.maxLoop = parseInt(next, 10); i++; }
        break;
      case "--sleep":
        if (next) { overrides.sleepNormal = parseInt(next, 10); i++; }
        break;
      case "--focus":
        if (next) { focus = next; i++; }
        break;
      case "--dry-run":
        overrides.dryRun = true;
        break;
      case "--continue":
        continueMode = true;
        break;
      default:
        if (arg && !arg.startsWith("--")) {
          focus = arg;
        }
        break;
    }
  }

  return { focus, overrides, continueMode, showHelp };
}

export async function cronCommand(args: string[]): Promise<void> {
  const { focus, overrides, continueMode, showHelp } = parseArgs(args);
  
  if (showHelp) {
    console.log(CRON_HELP);
    return;
  }
  
  const config = resolveConfig({ ...overrides, focusFilter: focus });
  const { paths } = config;

  // Interactive prompt for maxLoop if not set via CLI or config
  if (config.maxLoop === 0 && !overrides.maxLoop) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question("How many loops? (0 = unlimited, default: 0): ", resolve);
    });
    rl.close();
    const parsed = parseInt(answer.trim(), 10);
    config.maxLoop = isNaN(parsed) ? 0 : parsed;
  }

  // Validate parallel: require aliases for duplicate engines
  if (false && config.agents.length > 1) {
    const seen = new Set<string>();
    for (const e of config.agents) {
      const alias = e.alias ?? e.agent;
      if (seen.has(alias)) {
        console.error(`Error: Duplicate engine "${e.agent}" requires unique aliases in config.json`);
        process.exit(1);
      }
      seen.add(alias);
    }
  }

  ensureAllDirs(paths);
  initLogger(paths.logFile, paths.logJsonl);
  initState(paths.stateFile);
  initMemory(paths.memoryFile);

  const memAppend = (entry: string): void =>
    appendToMemory(paths.memoryFile, entry, config.memoryMaxLines, config.memoryKeepHead, config.memoryKeepTail);

  killPrevious(paths.lockDir, paths.pidFile, "cliclaw");
  acquireLock(paths.lockDir, paths.pidFile);

  let shutdownRequested = false;
  let consecutiveFails = 0;
  let activeIdx = 0; // Index into config.agents

  const shutdown = (): void => {
    if (shutdownRequested) return;
    shutdownRequested = true;
    logInfo("=== Graceful shutdown initiated ===");
    stopAllAgents();
    killAgentProcesses();
    releaseLock(paths.lockDir);
    try { rmSync(paths.cycleOut, { force: true }); } catch { /* ignore */ }
    try { rmSync(paths.cycleErr, { force: true }); } catch { /* ignore */ }
    logInfo("Graceful shutdown completed.");
    process.exit(130);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGQUIT", shutdown);

  const primary = primaryAgent(config);
  const engineList = config.agents.map((e) => e.alias ?? e.agent).join(", ");
  logInfo(`=== Starting CLIClaw Autonomous Agent Loop ===`);
  const maxLoopDisplay = config.maxLoop === 0 ? "unlimited" : config.maxLoop.toString();
  logInfo(`Primary: ${primary.alias ?? primary.agent} (${primary.model}) | Engines: [${engineList}] | Max: ${maxLoopDisplay} | Budget: ${config.tokenBudget} tokens`);
  if (false) logInfo(`Parallel mode: ${config.agents.length} engines, max ${config.maxConcurrent} concurrent`);
  if (config.dryRun) logInfo("DRY RUN mode — prompts will be logged but not sent to agents");
  if (focus) logInfo(`Focus: ${focus}`);

  if (config.idleBeforeStart > 0) {
    logInfo(`Idle pause: waiting ${config.idleBeforeStart}s before starting...`);
    await sleep(config.idleBeforeStart * 1000);
  }

  // Track per-agent last-run timestamps for individual sleep intervals
  const lastRunAt = new Map<string, number>();

  for (let cycle = 1; config.maxLoop === 0 || cycle <= config.maxLoop; cycle++) {
    if (shutdownRequested) break;

    const cycleDisplay = config.maxLoop === 0 ? cycle.toString() : `${cycle}/${config.maxLoop}`;
    logInfo(`══════ Cycle ${cycleDisplay} ══════`);

    if (cycle % config.snapshotEvery === 1) saveSnapshot(paths.snapshotsDir, paths.stateFile, cycle, config.maxSnapshots);
    runPreCycle(config.hooks, config.projectRoot, cycle, config.hookTimeout);

    const enableDiff = cycle > 1 && cycle % config.freshSessionEvery !== 0;
    const active = config.agents[activeIdx] ?? primary;

    let prompt: string;
    if (continueMode && cycle === 1) {
      const alias = active.alias ?? active.agent;
      const lastFile = findLastPromptFile(paths.tmpDir, alias) ?? findLastPromptFile(paths.tmpDir);
      if (lastFile) {
        prompt = readFileSync(lastFile, "utf-8");
        logInfo(`--continue: reusing prompt from ${lastFile}`);
      } else {
        logWarn("--continue: no previous prompt file found, building fresh prompt");
        prompt = buildPrompt(config, false, cycle, active);
      }
    } else {
      prompt = buildPrompt(config, enableDiff, cycle, active);
    }
    logPromptStats(prompt);

    if (config.dryRun) {
      logInfo(`[DRY RUN] Prompt (${estimatePromptTokens(prompt)} tokens):`);
      logInfo(prompt.slice(0, 500) + (prompt.length > 500 ? "..." : ""));
      runPostCycle(config.hooks, config.projectRoot, cycle, config.hookTimeout);
      await sleep(config.sleepNormal * 1000);
      continue;
    }

    let totalTokens = 0;
    let totalCost = 0;
    let success = false;
    let combinedOutput = "";

    // Determine which agents to run:
    // - If --agent specified: run only that specific agent (including manual ones)
    // - Otherwise: run all non-manual agents whose sleep interval has elapsed
    const specificAgent = overrides.agents?.[0];
    const now = Date.now();
    const agentsToRun = specificAgent
      ? config.agents.filter(a => (a.alias ?? a.agent) === (specificAgent.alias ?? specificAgent.agent))
      : config.agents.filter(a => {
          if (a.manual) return false;
          const key = a.alias ?? a.agent;
          const interval = (a.sleepNormal ?? config.sleepNormal) * 1000;
          const last = lastRunAt.get(key) ?? 0;
          return now - last >= interval;
        });

    if (agentsToRun.length === 0) {
      // No agents due yet — sleep until the nearest one is ready
      const nonManual = config.agents.filter(a => !a.manual);
      const nextDue = Math.min(...nonManual.map(a => {
        const key = a.alias ?? a.agent;
        const interval = (a.sleepNormal ?? config.sleepNormal) * 1000;
        const last = lastRunAt.get(key) ?? 0;
        return Math.max(0, interval - (now - last));
      }));
      const waitSec = Math.max(1, Math.ceil(nextDue / 1000));
      logInfo(`No agents due — sleeping ${waitSec}s until next agent is ready...`);
      await sleep(nextDue || 1000);
      continue;
    }

    logInfo(`Running: ${agentsToRun.map(a => a.alias ?? a.agent).join(", ")}`);

    if (agentsToRun.length > 1) {
      // Parallel: each agent gets its own prompt (respects per-agent identity)
      const results = await runParallelCycles(config, prompt, cycle, agentsToRun, (entry) =>
        buildPrompt(config, enableDiff, cycle, entry)
      );
      for (const r of results) {
        totalTokens += r.tokenEstimate;
        totalCost += r.costEstimate;
        if (r.exitCode === 0) success = true;
        combinedOutput += r.stdout;
        const mem = extractMemoryAppend(r.stdout);
        if (mem) memAppend(mem);
      }
    } else {
      // Single: use the one agent (either specified via --agent or the only non-manual one)
      const active = agentsToRun[0] ?? config.agents[activeIdx] ?? primary;
      const result = await runCycle(config, prompt, cycle, active.agent, active.model);
      if (shutdownRequested) break;
      totalTokens = result.tokenEstimate;
      totalCost = result.costEstimate;
      success = result.exitCode === 0;
      combinedOutput = result.stdout;
      if (success) {
        const mem = extractMemoryAppend(result.stdout);
        if (mem) memAppend(mem);
      } else if (result.stderr) {
        logError(`STDERR (tail): ${result.stderr.slice(-500)}`);
      }
    }

    const signals = parseAgentSignals(combinedOutput);

    if (signals.skipCycle) {
      logInfo(`Agent signal: [SKIP CYCLE] — skipping hooks and sleep for cycle ${cycle}`);
      continue;
    }

    runPostCycle(config.hooks, config.projectRoot, cycle, config.hookTimeout);

    if (success) {
      logInfo(`AGENT_OK cycle=${cycle} tokens~${totalTokens} cost=${formatCost(totalCost)}`);
      consecutiveFails = 0;
      writeState("lastSuccess", new Date().toISOString());
      writeState("lastPromptHash", hashPrompt(prompt));

      const prevTokens = (readState("totalTokensEstimate") as number | undefined) ?? 0;
      const prevCost = (readState("totalCostEstimate") as number | undefined) ?? 0;
      writeState("totalTokensEstimate", prevTokens + totalTokens);
      writeState("totalCostEstimate", Math.round((prevCost + totalCost) * 10000) / 10000);
      writeState("totalCycles", ((readState("totalCycles") as number | undefined) ?? 0) + 1);

      let stallCycles = (readState("stallCycles") as number | undefined) ?? 0;
      if (signals.stallReset && stallCycles > 0) {
        logInfo(`Agent signal: [STALL RESET] — stall counter cleared (was ${stallCycles})`);
        stallCycles = 0;
      }
      writeState("stallCycles", 0);

      runOnSuccess(config.hooks, config.projectRoot, cycle, config.hookTimeout);
      logJson("cycle_complete", { cycle, tokens: totalTokens, cost: totalCost, exit_code: 0 });

      if (signals.exit) {
        logInfo(`Agent signal: [EXIT CLICLAW] — graceful termination requested`);
        logJson("loop_stopped", { reason: "agent_exit_signal", cycle });
        break;
      }

      const sleepTime = computeSleep(config.sleepNormal, stallCycles, config.stallBackoffMultiplier, config.stallBackoffCap);
      // Record last-run time for agents that ran
      const ranAt = Date.now();
      for (const a of agentsToRun) lastRunAt.set(a.alias ?? a.agent, ranAt);
      logInfo(`Sleeping ${sleepTime}s...`);
      await sleep(sleepTime * 1000);
    } else {
      consecutiveFails++;
      logError(`AGENT_FAILED consecutive=${consecutiveFails} cycle=${cycle}`);

      // Engine rotation after repeated failures
      if (consecutiveFails >= config.agentRotateAfter && !false && config.agents.length > 1) {
        const nextIdx = (activeIdx + 1) % config.agents.length;
        const next = config.agents[nextIdx]!;
        if (isAgentAvailable(next.agent)) {
          const currentAlias = config.agents[activeIdx]?.alias ?? config.agents[activeIdx]?.agent ?? "unknown";
          const nextAlias = next.alias ?? next.agent;
          logWarn(`Agent rotation: ${currentAlias} → ${nextAlias} (${next.model})`);
          memAppend(`Agent rotation: ${currentAlias} failed ${consecutiveFails}x, switched to ${nextAlias}.`);
          activeIdx = nextIdx;
          consecutiveFails = 0;
        }
      }

      runOnFailure(config.hooks, config.projectRoot, cycle, config.hookTimeout);
      logJson("cycle_failed", { cycle, consecutive_fails: consecutiveFails });

      if (consecutiveFails >= config.maxConsecutiveFailures) {
        logError("MAX consecutive failures reached — stopping.");
        logJson("loop_stopped", { reason: "max_consecutive_failures", cycle });
        sendNotification("CLIClaw stopped", `Max failures reached at cycle ${cycle}`);
        break;
      }

      const stallCycles = ((readState("stallCycles") as number | undefined) ?? 0) + 1;
      writeState("stallCycles", stallCycles);

      if (stallCycles >= config.stallMax) {
        logWarn(`STALL DETECTED (${stallCycles} cycles)`);
        memAppend(`Stall warning: ${stallCycles} cycles with no progress.`);
        sendNotification("CLIClaw stall", `${stallCycles} cycles with no progress`);
      }

      const sleepTime = computeSleep(config.sleepAfterFailure, stallCycles, config.stallBackoffMultiplier, config.stallBackoffCap);
      // Record last-run time even on failure
      const ranAt = Date.now();
      for (const a of agentsToRun) lastRunAt.set(a.alias ?? a.agent, ranAt);
      logInfo(`Sleeping ${sleepTime}s after failure...`);
      await sleep(sleepTime * 1000);
    }
  }

  logInfo("Autonomous loop terminated.");
  releaseLock(paths.lockDir);
  const finalMessage = config.maxLoop === 0 ? "Loop stopped" : `Loop completed after ${config.maxLoop} cycles`;
  sendNotification("CLIClaw finished", finalMessage);
}
