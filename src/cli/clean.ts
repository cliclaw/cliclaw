/**
 * `cliclaw clean` — remove temp files, logs, and optionally state.
 */

import { rmSync, existsSync } from "node:fs";
import { resolveConfig } from "../core/config.js";
import { releaseLock } from "../core/lock.js";
import { confirm, closePrompt } from "../utils/prompt.js";

const CLEAN_HELP = `
cliclaw clean — Remove temp files and logs

Usage:
  cliclaw clean [options]

Options:
  --help, -h             Show this help

Interactive:
  - Removes temp files
  - Optionally removes logs
  - Optionally removes state
`;

export async function cleanCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(CLEAN_HELP);
    return;
  }

  const config = resolveConfig();
  const { paths } = config;

  console.log("\n🧹 CLIClaw Clean\n");

  // Always clean temp
  if (existsSync(paths.tmpDir)) {
    rmSync(paths.tmpDir, { recursive: true, force: true });
    console.log("  ✓ Removed tmp/");
  }

  // Always release stale lock
  releaseLock(paths.lockDir);
  console.log("  ✓ Released lock");

  // Ask about logs
  if (existsSync(paths.logFile) || existsSync(paths.logJsonl)) {
    const cleanLogs = await confirm("Remove log files?", false);
    if (cleanLogs) {
      rmSync(paths.logFile, { force: true });
      rmSync(paths.logJsonl, { force: true });
      console.log("  ✓ Removed logs");
    }
  }

  // Ask about state
  if (existsSync(paths.stateFile)) {
    const cleanState = await confirm("Reset state (cycle counts, tokens)?", false);
    if (cleanState) {
      rmSync(paths.stateFile, { force: true });
      console.log("  ✓ Reset state");
    }
  }

  console.log("\n✅ Clean complete.\n");
  closePrompt();
}
