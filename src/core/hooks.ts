/**
 * Plugin hooks — run pre/post cycle scripts.
 */

import { execSync } from "node:child_process";
import { logInfo, logWarn } from "./logger.js";
import type { HooksConfig } from "./types.js";

export function runHooks(hooks: string[], phase: string, cwd: string, env: Record<string, string> = {}): void {
  if (hooks.length === 0) return;

  for (const hook of hooks) {
    logInfo(`Running ${phase} hook: ${hook}`);
    try {
      execSync(hook, {
        cwd,
        stdio: "inherit",
        timeout: 60_000,
        env: { ...process.env, ...env },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logWarn(`${phase} hook failed: ${msg}`);
    }
  }
}

export function runPreCycle(hooks: HooksConfig, cwd: string, cycle: number): void {
  runHooks(hooks.preCycle, "pre-cycle", cwd, { CLICLAW_CYCLE: String(cycle) });
}

export function runPostCycle(hooks: HooksConfig, cwd: string, cycle: number): void {
  runHooks(hooks.postCycle, "post-cycle", cwd, { CLICLAW_CYCLE: String(cycle) });
}

export function runOnSuccess(hooks: HooksConfig, cwd: string, cycle: number): void {
  runHooks(hooks.onSuccess, "on-success", cwd, { CLICLAW_CYCLE: String(cycle) });
}

export function runOnFailure(hooks: HooksConfig, cwd: string, cycle: number): void {
  runHooks(hooks.onFailure, "on-failure", cwd, { CLICLAW_CYCLE: String(cycle) });
}
