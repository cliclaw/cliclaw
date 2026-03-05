/**
 * Parallel task ledger — prevents engines from colliding on the same work.
 * File-based JSON coordination: engines claim tasks before working, mark done after.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface LedgerTask {
  id: string;
  focus: string;
  claimedBy: string | null;
  claimedAt: string | null;
  status: "pending" | "claimed" | "done" | "failed";
  result?: string;
}

export interface TaskLedger {
  cycle: number;
  updatedAt: string;
  tasks: LedgerTask[];
}

function ledgerPath(tmpDir: string): string {
  return `${tmpDir}/parallel-ledger.json`;
}

function readLedger(tmpDir: string): TaskLedger {
  const path = ledgerPath(tmpDir);
  if (!existsSync(path)) return { cycle: 0, updatedAt: "", tasks: [] };
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as TaskLedger;
  } catch {
    return { cycle: 0, updatedAt: "", tasks: [] };
  }
}

function writeLedger(tmpDir: string, ledger: TaskLedger): void {
  mkdirSync(dirname(ledgerPath(tmpDir)), { recursive: true });
  ledger.updatedAt = new Date().toISOString();
  writeFileSync(ledgerPath(tmpDir), JSON.stringify(ledger, null, 2));
}

/** Create a fresh ledger for a cycle with tasks for each engine */
export function initLedger(
  tmpDir: string,
  cycle: number,
  engines: Array<{ engine: string; focus: string }>,
): TaskLedger {
  const tasks: LedgerTask[] = engines.map((e, i) => ({
    id: `task_${cycle}_${i}`,
    focus: e.focus || "general",
    claimedBy: null,
    claimedAt: null,
    status: "pending",
  }));
  const ledger: TaskLedger = { cycle, updatedAt: "", tasks };
  writeLedger(tmpDir, ledger);
  return ledger;
}

/** Claim a task for an engine. Returns the task focus or null if nothing available. */
export function claimTask(tmpDir: string, engineName: string): LedgerTask | null {
  const ledger = readLedger(tmpDir);
  const available = ledger.tasks.find(
    (t) => t.status === "pending" || (t.focus !== "general" && t.claimedBy === null),
  );
  if (!available) return null;

  available.claimedBy = engineName;
  available.claimedAt = new Date().toISOString();
  available.status = "claimed";
  writeLedger(tmpDir, ledger);
  return available;
}

/** Mark a task as done or failed */
export function completeTask(
  tmpDir: string,
  taskId: string,
  status: "done" | "failed",
  result?: string,
): void {
  const ledger = readLedger(tmpDir);
  const task = ledger.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.status = status;
  if (result) task.result = result;
  writeLedger(tmpDir, ledger);
}

/** Get a summary of the current ledger state for prompt injection */
export function getLedgerContext(tmpDir: string): string {
  const ledger = readLedger(tmpDir);
  if (ledger.tasks.length === 0) return "";

  const lines = ledger.tasks.map((t) => {
    const owner = t.claimedBy ? ` (${t.claimedBy})` : "";
    return `- [${t.status}] ${t.focus}${owner}`;
  });

  return `## Parallel Task Coordination\nOther engines are working on this project simultaneously. Avoid modifying files in their focus areas.\n${lines.join("\n")}`;
}
