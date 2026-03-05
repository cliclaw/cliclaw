/**
 * Plugin hooks — run pre/post cycle scripts.
 */

import { execSync } from "node:child_process";
import { logInfo, logWarn } from "./logger.js";
import type { HooksConfig } from "./types.js";

export function runHooks(hooks: string[], phase: string, cwd: string, env: Record<string, string> = {}, timeout = 60_000): void {
  if (hooks.length === 0) return;

  for (const hook of hooks) {
    logInfo(`Running ${phase} hook: ${hook}`);
    try {
      execSync(hook, {
        cwd,
        stdio: "inherit",
        timeout,
        env: { ...process.env, ...env },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logWarn(`${phase} hook failed: ${msg}`);
    }
  }
}

export function runPreCycle(hooks: HooksConfig, cwd: string, cycle: number, timeout?: number): void {
  runHooks(hooks.preCycle, "pre-cycle", cwd, { CLICLAW_CYCLE: String(cycle) }, timeout);
}

export function runPostCycle(hooks: HooksConfig, cwd: string, cycle: number, timeout?: number): void {
  runHooks(hooks.postCycle, "post-cycle", cwd, { CLICLAW_CYCLE: String(cycle) }, timeout);
}

export function runOnSuccess(hooks: HooksConfig, cwd: string, cycle: number, timeout?: number): void {
  runHooks(hooks.onSuccess, "on-success", cwd, { CLICLAW_CYCLE: String(cycle) }, timeout);
}

export function runOnFailure(hooks: HooksConfig, cwd: string, cycle: number, timeout?: number): void {
  runHooks(hooks.onFailure, "on-failure", cwd, { CLICLAW_CYCLE: String(cycle) }, timeout);
}

export interface AgentSignals {
  /** Agent requested graceful loop termination */
  exit: boolean;
  /** Agent requested this cycle be skipped (no hooks, no sleep) */
  skipCycle: boolean;
  /** Agent requested stall counter reset */
  stallReset: boolean;
}

/**
 * Parse agent signals embedded in output text.
 * Signals are directives the AI writes to control the CLIClaw loop.
 */
export function parseAgentSignals(output: string): AgentSignals {
  return {
    exit: output.includes("[EXIT CLICLAW]"),
    skipCycle: output.includes("[SKIP CYCLE]"),
    stallReset: output.includes("[STALL RESET]"),
  };
}
