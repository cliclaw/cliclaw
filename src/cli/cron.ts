/**
 * `cliclaw cron` — the main autonomous agent loop.
 * Features: adaptive sleep, engine rotation, parallel, hooks, snapshots, dry-run, notifications.
 */

import { rmSync } from "node:fs";
import { resolveConfig, ensureAllDirs, primaryEngine } from "../core/config.js";
import { initLogger, logInfo, logError, logWarn, logJson } from "../core/logger.js";
import { initState, readState, writeState } from "../core/state.js";
import { initMemory, appendToMemory, extractMemoryAppend } from "../core/memory.js";
import { killPrevious, acquireLock, releaseLock, killAgentProcesses } from "../core/lock.js";
import { buildPrompt, estimatePromptTokens, hashPrompt, logPromptStats } from "../prompts/builder.js";
import { runCycle, runParallelCycles, stopAllAgents } from "../engines/runner.js";
import { formatCost } from "../core/cost.js";
import { saveSnapshot } from "../core/snapshots.js";
import { runPreCycle, runPostCycle, runOnSuccess, runOnFailure, parseAgentSignals } from "../core/hooks.js";
import { sendNotification } from "../utils/notify.js";
import { isEngineAvailable } from "../engines/registry.js";
import type { ClawConfig, EngineEntry } from "../core/types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeSleep(baseSleep: number, stallCycles: number, multiplier: number, cap: number): number {
  if (stallCycles <= 0) return baseSleep;
  return Math.round(baseSleep * Math.min(Math.pow(multiplier, stallCycles), cap));
}

function parseArgs(args: string[]): { focus: string | null; overrides: Partial<ClawConfig> } {
  const overrides: Partial<ClawConfig> = {};
  let focus: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    switch (arg) {
      case "--engine":
        if (next) {
          overrides.engines = [{ engine: next as EngineEntry["engine"], model: "" }];
          i++;
        }
        break;
      case "--model":
        if (next && overrides.engines?.[0]) {
          overrides.engines[0].model = next;
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
      case "--parallel":
        overrides.parallel = true;
        break;
      default:
        if (arg && !arg.startsWith("--")) {
          focus = arg;
        }
        break;
    }
  }

  return { focus, overrides };
}

export async function cronCommand(args: string[]): Promise<void> {
  const { focus, overrides } = parseArgs(args);
  const config = resolveConfig({ ...overrides, focusFilter: focus });
  const { paths } = config;

  // Validate parallel: require aliases for duplicate engines
  if (config.parallel && config.engines.length > 1) {
    const seen = new Set<string>();
    for (const e of config.engines) {
      const alias = e.alias ?? e.engine;
      if (seen.has(alias)) {
        console.error(`Error: Duplicate engine "${e.engine}" requires unique aliases in config.json`);
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
  let activeIdx = 0; // Index into config.engines

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

  const primary = primaryEngine(config);
  const engineList = config.engines.map((e) => e.alias ?? e.engine).join(", ");
  logInfo(`=== Starting CLIClaw Autonomous Agent Loop ===`);
  logInfo(`Primary: ${primary.alias ?? primary.engine} (${primary.model}) | Engines: [${engineList}] | Max: ${config.maxLoop} | Budget: ${config.tokenBudget} tokens`);
  if (config.parallel) logInfo(`Parallel mode: ${config.engines.length} engines, max ${config.maxConcurrent} concurrent`);
  if (config.dryRun) logInfo("DRY RUN mode — prompts will be logged but not sent to agents");
  if (focus) logInfo(`Focus: ${focus}`);

  for (let cycle = 1; cycle <= config.maxLoop; cycle++) {
    if (shutdownRequested) break;

    logInfo(`══════ Cycle ${cycle}/${config.maxLoop} ══════`);

    if (cycle % config.snapshotEvery === 1) saveSnapshot(paths.snapshotsDir, paths.stateFile, cycle, config.maxSnapshots);
    runPreCycle(config.hooks, config.projectRoot, cycle, config.hookTimeout);

    const enableDiff = cycle > 1 && cycle % config.freshSessionEvery !== 0;
    const prompt = buildPrompt(config, enableDiff);
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

    if (config.parallel && config.engines.length > 1) {
      // Parallel: run all engines simultaneously
      const results = await runParallelCycles(config, prompt, cycle, config.engines);
      for (const r of results) {
        totalTokens += r.tokenEstimate;
        totalCost += r.costEstimate;
        if (r.exitCode === 0) success = true;
        combinedOutput += r.stdout;
        const mem = extractMemoryAppend(r.stdout);
        if (mem) memAppend(mem);
      }
    } else {
      // Single: use active engine (may have been rotated)
      const active = config.engines[activeIdx] ?? primary;
      const result = await runCycle(config, prompt, cycle, active.engine, active.model);
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
      logInfo(`Sleeping ${sleepTime}s...`);
      await sleep(sleepTime * 1000);
    } else {
      consecutiveFails++;
      logError(`AGENT_FAILED consecutive=${consecutiveFails} cycle=${cycle}`);

      // Engine rotation after repeated failures
      if (consecutiveFails >= config.engineRotateAfter && !config.parallel && config.engines.length > 1) {
        const nextIdx = (activeIdx + 1) % config.engines.length;
        const next = config.engines[nextIdx]!;
        if (isEngineAvailable(next.engine)) {
          const currentAlias = config.engines[activeIdx]?.alias ?? config.engines[activeIdx]?.engine ?? "unknown";
          const nextAlias = next.alias ?? next.engine;
          logWarn(`Engine rotation: ${currentAlias} → ${nextAlias} (${next.model})`);
          memAppend(`Engine rotation: ${currentAlias} failed ${consecutiveFails}x, switched to ${nextAlias}.`);
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
      logInfo(`Sleeping ${sleepTime}s after failure...`);
      await sleep(sleepTime * 1000);
    }
  }

  logInfo("Autonomous loop terminated.");
  releaseLock(paths.lockDir);
  sendNotification("CLIClaw finished", `Loop completed after ${config.maxLoop} cycles`);
}
