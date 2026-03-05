/**
 * State snapshots — rollback support by keeping last N state copies.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { logInfo } from "./logger.js";

const MAX_SNAPSHOTS = 20;

export function saveSnapshot(snapshotsDir: string, stateFile: string, cycle: number): void {
  mkdirSync(snapshotsDir, { recursive: true });
  if (!existsSync(stateFile)) return;

  const content = readFileSync(stateFile, "utf-8");
  const name = `state-cycle-${String(cycle).padStart(5, "0")}.json`;
  writeFileSync(join(snapshotsDir, name), content);

  // Prune old snapshots
  const files = readdirSync(snapshotsDir)
    .filter((f) => f.startsWith("state-cycle-") && f.endsWith(".json"))
    .sort();

  while (files.length > MAX_SNAPSHOTS) {
    const oldest = files.shift();
    if (oldest) {
      rmSync(join(snapshotsDir, oldest), { force: true });
    }
  }
}

export function listSnapshots(snapshotsDir: string): string[] {
  if (!existsSync(snapshotsDir)) return [];
  return readdirSync(snapshotsDir)
    .filter((f) => f.startsWith("state-cycle-") && f.endsWith(".json"))
    .sort();
}

export function rollbackTo(snapshotsDir: string, stateFile: string, snapshotName: string): boolean {
  const snapshotPath = join(snapshotsDir, snapshotName);
  if (!existsSync(snapshotPath)) return false;

  const content = readFileSync(snapshotPath, "utf-8");
  writeFileSync(stateFile, content);
  logInfo(`Rolled back state to ${snapshotName}`);
  return true;
}
