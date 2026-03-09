/**
 * Lock management — singleton enforcement via lockdir + PID file.
 */

import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";
import { logInfo, logError } from "./logger.js";

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killPrevious(_lockDir: string, pidFile: string, scriptName: string): void {
  logInfo(`Singleton enforcement: checking for previous instances of ${scriptName}...`);

  if (existsSync(pidFile)) {
    try {
      const oldPid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
      if (!Number.isNaN(oldPid) && oldPid !== process.pid && isPidAlive(oldPid)) {
        logInfo(`Killing previous instance (PID: ${oldPid})`);
        try {
          process.kill(oldPid, "SIGTERM");
        } catch { /* already dead */ }
        // Give it a moment
        execSync("sleep 0.8");
        try {
          process.kill(oldPid, "SIGKILL");
        } catch { /* already dead */ }
      }
    } catch { /* ignore read errors */ }
  }

  // Kill stray agent processes
  killAgentProcesses();

  logInfo("Singleton enforcement complete.");
}

export function acquireLock(lockDir: string, pidFile: string): void {
  mkdirSync(dirname(lockDir), { recursive: true });

  if (existsSync(lockDir)) {
    if (existsSync(pidFile)) {
      try {
        const oldPid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
        if (!Number.isNaN(oldPid) && isPidAlive(oldPid)) {
          logError(`Another cliclaw loop is already running (PID ${oldPid}).`);
          logError(`If stale, run: rm -rf "${lockDir}"`);
          process.exit(1);
        }
      } catch { /* stale */ }
    }
    rmSync(lockDir, { recursive: true, force: true });
  }

  mkdirSync(lockDir, { recursive: true });
  writeFileSync(pidFile, String(process.pid));
  logInfo(`Acquired exclusive lock (PID ${process.pid})`);
}

export function releaseLock(lockDir: string): void {
  try {
    rmSync(lockDir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

export function killAgentProcesses(): void {
  const patterns = [
    "kiro-cli\\s+chat",
    "claude\\s+",
    "codex\\s+",
  ];
  for (const pat of patterns) {
    try {
      execSync(`pkill -f "${pat}" 2>/dev/null || true`, { stdio: "ignore" });
    } catch { /* ignore */ }
  }
}

export function killPidTree(pid: number, signal: NodeJS.Signals = "SIGTERM"): void {
  // Get children first
  try {
    const children = execSync(`pgrep -P ${pid} 2>/dev/null || true`, { encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n));

    for (const child of children) {
      killPidTree(child, signal);
    }
  } catch { /* ignore */ }

  try {
    process.kill(pid, signal);
  } catch { /* already dead */ }
}
