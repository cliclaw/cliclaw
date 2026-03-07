/**
 * `cliclaw rollback` — restore state from a previous snapshot.
 */

import { resolveConfig } from "../core/config.js";
import { listSnapshots, rollbackTo } from "../core/snapshots.js";
import { select, closePrompt } from "../utils/prompt.js";

const ROLLBACK_HELP = `
cliclaw rollback — Restore state from a snapshot

Usage:
  cliclaw rollback [options]

Options:
  --help, -h             Show this help

Interactive:
  - Lists available snapshots
  - Select one to restore
`;

export async function rollbackCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(ROLLBACK_HELP);
    return;
  }

  const config = resolveConfig();
  const { paths } = config;

  const snapshots = listSnapshots(paths.snapshotsDir);

  if (snapshots.length === 0) {
    console.log("No snapshots available. Snapshots are created during cron cycles.");
    return;
  }

  console.log("\n⏪ CLIClaw Rollback\n");

  const idx = await select("Select a snapshot to restore:", snapshots);
  const chosen = snapshots[idx];

  if (!chosen) {
    console.log("Invalid selection.");
    closePrompt();
    return;
  }

  const success = rollbackTo(paths.snapshotsDir, paths.stateFile, chosen);
  if (success) {
    console.log(`✅ Rolled back to ${chosen}`);
  } else {
    console.log(`❌ Failed to rollback to ${chosen}`);
  }

  closePrompt();
}
