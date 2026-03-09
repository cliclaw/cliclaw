/**
 * `cliclaw status` — show current state, memory stats, cost, and engine info.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolveConfig } from "../core/config.js";
import { initState, getFullState } from "../core/state.js";
import { getMemoryStats } from "../core/memory.js";
import { isPidAlive } from "../core/lock.js";
import { formatCost } from "../core/cost.js";
import { listSnapshots } from "../core/snapshots.js";

const STATUS_HELP = `
cliclaw status — Show current state and statistics

Usage:
  cliclaw status [options]

Options:
  --help, -h             Show this help

Displays:
  - Loop running status
  - Cycle count and last success
  - Memory stats
  - Cost tracking
  - Available snapshots
`;

export async function statusCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(STATUS_HELP);
    return;
  }

  const config = resolveConfig();
  const { paths } = config;

  console.log("\n📊 CLIClaw Status\n");

  // Lock / running status
  if (existsSync(paths.pidFile)) {
    try {
      const pid = parseInt(readFileSync(paths.pidFile, "utf-8").trim(), 10);
      const running = !Number.isNaN(pid) && isPidAlive(pid);
      console.log(`Loop: ${running ? `🟢 Running (PID ${pid})` : "🔴 Stopped"}`);
    } catch {
      console.log("Loop: 🔴 Stopped");
    }
  } else {
    console.log("Loop: 🔴 Stopped");
  }

  // Config
  const primary = config.agents[0];
  console.log(`Primary: ${primary?.alias ?? primary?.agent ?? "none"} (${primary?.model ?? "none"})`);
  if (config.agents.length > 1) {
    console.log(`Agents: ${config.agents.map((e) => e.alias ?? e.agent).join(", ")}`);
  }
  console.log(`Project: ${config.projectRoot}`);
  console.log(`Token budget: ${config.tokenBudget > 0 ? `${config.tokenBudget} tokens/cycle` : "unlimited"}`);

  // State
  if (existsSync(paths.stateFile)) {
    initState(paths.stateFile);
    const state = getFullState();
    console.log(`\nLast success: ${state.lastSuccess ?? "never"}`);
    console.log(`Total cycles: ${state.totalCycles ?? 0}`);
    console.log(`Total tokens: ~${state.totalTokensEstimate ?? 0}`);
    console.log(`Total cost: ${formatCost((state.totalCostEstimate as number | undefined) ?? 0)}`);
    console.log(`Stall cycles: ${state.stallCycles ?? 0}`);
  }

  // Memory
  const memStats = getMemoryStats(paths.memoryFile);
  console.log(`\nMemory: ${memStats.lines} lines (~${memStats.tokens} tokens)`);

  // Snapshots
  const snapshots = listSnapshots(paths.snapshotsDir);
  console.log(`Snapshots: ${snapshots.length}`);

  // Hooks
  const hookCount = config.hooks.preCycle.length + config.hooks.postCycle.length +
    config.hooks.onSuccess.length + config.hooks.onFailure.length;
  if (hookCount > 0) console.log(`Hooks: ${hookCount} configured`);

  // Meta files
  console.log("\nMeta files:");
  const metaFiles = [
    { name: "you.md", path: paths.youFile },
    { name: "projects.md", path: paths.projectsFile },
    { name: "boundaries.md", path: paths.boundariesFile },
    { name: "identity.md", path: paths.identityFile },
    { name: "tools.md", path: paths.toolsFile },
    { name: "boot.md", path: paths.bootFile },
    { name: "memory.md", path: paths.memoryFile },
    { name: "config.json", path: paths.configFile },
  ];
  for (const f of metaFiles) {
    const exists = existsSync(f.path);
    console.log(`  ${exists ? "✅" : "❌"} ${f.name}`);
  }

  console.log("");
}
