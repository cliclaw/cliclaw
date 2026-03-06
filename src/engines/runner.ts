/**
 * Engine runner — spawns AI agent processes, supports parallel execution.
 */

import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, createReadStream, appendFileSync } from "node:fs";
import { dirname } from "node:path";
import { getEngine } from "./registry.js";
import { killPidTree } from "../core/lock.js";
import { logInfo, logWarn } from "../core/logger.js";
import { estimateCost, estimateTokens } from "../core/cost.js";
import { initLedger, claimTask, completeTask, getLedgerContext } from "../core/ledger.js";
import type { ClawConfig, CycleResult, EngineEntry } from "../core/types.js";

let currentAgentPids: number[] = [];

export function getCurrentAgentPids(): number[] {
  return [...currentAgentPids];
}

export function stopAllAgents(): void {
  for (const pid of currentAgentPids) {
    killPidTree(pid, "SIGTERM");
  }
  setTimeout(() => {
    for (const pid of currentAgentPids) {
      killPidTree(pid, "SIGKILL");
    }
    currentAgentPids = [];
  }, 400);
}

function spawnAgent(
  config: ClawConfig,
  promptText: string,
  cycle: number,
  engineOverride?: string,
  modelOverride?: string,
): Promise<CycleResult> {
  const primary = config.engines[0]!;
  const engineName = (engineOverride ?? primary.engine) as EngineEntry["engine"];
  const model = modelOverride ?? primary.model;
  const engine = getEngine(engineName);
  const resume = cycle > 1 && cycle % config.freshSessionEvery !== 0 && engine.supportsResume;

  const inputFile = `${config.paths.tmpDir}/agent-input-${cycle}-${engineName}.txt`;
  mkdirSync(dirname(inputFile), { recursive: true });
  writeFileSync(inputFile, promptText);

  const args = engine.buildArgs({ prompt: promptText, inputFile, resume, model });

  logInfo(`Running ${engine.command} ${args.slice(0, 3).join(" ")}... (cycle ${cycle}, resume=${resume})`);

  const startTime = Date.now();

  return new Promise<CycleResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputStallTimer: ReturnType<typeof setTimeout> | null = null;

    const child = spawn(engine.command, args, {
      cwd: config.projectRoot,
      stdio: [engine.stdinPrompt ? "pipe" : "ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: `${process.env["HOME"]}/.cliclaw/bin:/usr/local/bin:/opt/homebrew/bin:${process.env["PATH"]}`,
      },
    });

    // For engines that read from stdin (cursor), pipe the input file
    if (engine.stdinPrompt && child.stdin) {
      const stream = createReadStream(inputFile);
      stream.pipe(child.stdin);
    }

    const pid = child.pid;
    if (pid) currentAgentPids.push(pid);

    const stallMs = config.outputStallTimeout > 0 ? config.outputStallTimeout * 1000 : 0;

    const resetOutputStallTimer = (): void => {
      if (!stallMs) return;
      if (outputStallTimer) clearTimeout(outputStallTimer);
      outputStallTimer = setTimeout(() => {
        logWarn(`Agent produced no output for ${config.outputStallTimeout}s — killing (output stall)`);
        timedOut = true;
        if (pid) killPidTree(pid, "SIGTERM");
        setTimeout(() => { if (pid) killPidTree(pid, "SIGKILL"); }, 1000);
      }, stallMs);
    };

    resetOutputStallTimer();

    // Truncate cycleOut at start of cycle so --tail sees only current run
    try { writeFileSync(config.paths.cycleOut, ""); } catch { /* ignore */ }

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      resetOutputStallTimer();
      try { appendFileSync(config.paths.cycleOut, text); } catch { /* ignore */ }
    });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      logWarn(`Agent exceeded timeout (${config.agentTimeout}s) — killing`);
      if (pid) killPidTree(pid, "SIGTERM");
      setTimeout(() => { if (pid) killPidTree(pid, "SIGKILL"); }, 1000);
    }, config.agentTimeout * 1000);

    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const lastLine = stdout.slice(-200).split("\n").pop()?.slice(0, 120) ?? "(no output)";
      process.stderr.write(
        `\r[⏳ ${engineName} ${mins}m${String(secs).padStart(2, "0")}s | ${stdout.length}B | ${lastLine}]`
      );
    }, 10_000);

    child.on("close", (code) => {
      clearTimeout(timer);
      clearInterval(progressInterval);
      if (outputStallTimer) clearTimeout(outputStallTimer);
      process.stderr.write("\n");
      if (pid) currentAgentPids = currentAgentPids.filter((p) => p !== pid);

      let exitCode = code ?? 1;
      if (timedOut) exitCode = 124;

      if (engine.lenientExit && exitCode !== 0) {
        const hasHardError = /panic|fatal|ECONNREFUSED|command not found|No such file/i.test(stderr);
        if (stdout.length > 100 && !hasHardError) {
          logInfo(`${engineName} exited ${exitCode} but produced output — treating as success`);
          exitCode = 0;
        }
      }

      const parsedOutput = engine.parseOutput ? engine.parseOutput(stdout) : stdout;

      try {
        writeFileSync(config.paths.cycleErr, stderr);
        appendFileSync(config.paths.logFile, parsedOutput + "\n");
      } catch { /* ignore */ }

      const inputTokens = estimateTokens(promptText);
      const outputTokens = estimateTokens(parsedOutput);

      resolve({
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
        tokenEstimate: inputTokens + outputTokens,
        costEstimate: estimateCost(model, inputTokens, outputTokens),
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      clearInterval(progressInterval);
      if (outputStallTimer) clearTimeout(outputStallTimer);
      process.stderr.write("\n");
      if (pid) currentAgentPids = currentAgentPids.filter((p) => p !== pid);

      resolve({
        exitCode: 127,
        stdout,
        stderr: stderr + `\nSpawn error: ${err.message}`,
        durationMs: Date.now() - startTime,
        tokenEstimate: estimateTokens(promptText),
        costEstimate: 0,
      });
    });
  });
}

/** Run a single engine cycle */
export async function runCycle(
  config: ClawConfig,
  promptText: string,
  cycle: number,
  engineOverride?: string,
  modelOverride?: string,
): Promise<CycleResult> {
  return spawnAgent(config, promptText, cycle, engineOverride, modelOverride);
}

/** Run multiple engines in parallel with task coordination */
export async function runParallelCycles(
  config: ClawConfig,
  promptText: string,
  cycle: number,
  entries: EngineEntry[],
  buildEnginePrompt?: (entry: EngineEntry) => string,
): Promise<CycleResult[]> {
  const maxConcurrent = config.maxConcurrent;
  const results: CycleResult[] = [];

  initLedger(config.paths.tmpDir, cycle, entries.map((e) => ({
    engine: e.alias ?? e.engine,
    focus: e.focus ?? "",
  })));

  for (let i = 0; i < entries.length; i += maxConcurrent) {
    const batch = entries.slice(i, i + maxConcurrent);
    const batchPromises = batch.map((entry) => {
      const alias = entry.alias ?? entry.engine;
      const task = claimTask(config.paths.tmpDir, alias);
      const ledgerContext = getLedgerContext(config.paths.tmpDir);
      const basePrompt = buildEnginePrompt ? buildEnginePrompt(entry) : promptText;
      const focusedPrompt = entry.focus
        ? `${basePrompt}\n\n## Focus\nFocus on: ${entry.focus}\nDo NOT modify files outside your focus area.\n${ledgerContext}`
        : `${basePrompt}\n${ledgerContext}`;

      return spawnAgent(config, focusedPrompt, cycle, entry.engine, entry.model).then((result) => {
        if (task) {
          completeTask(config.paths.tmpDir, task.id, result.exitCode === 0 ? "done" : "failed");
        }
        return result;
      });
    });
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}
