/**
 * Heartbeat — periodic status updates written to HEARTBEAT.md
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getMemoryStats } from "../core/memory.js";
import { getFullState } from "../core/state.js";
import { formatCost } from "../core/cost.js";
import { logInfo } from "../core/logger.js";
import type { ClawConfig } from "../core/types.js";

export function writeHeartbeat(config: ClawConfig, cycle: number, consecutiveFails: number): void {
  const { paths } = config;
  mkdirSync(dirname(paths.heartbeatFile), { recursive: true });

  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const memStats = getMemoryStats(paths.memoryFile);
  const state = getFullState();
  const cost = (state.totalCostEstimate as number | undefined) ?? 0;

  const entry = [
    "",
    `## ${now}`,
    `- Engine: ${config.engines.map((e) => `${e.alias ?? e.engine}(${e.model})`).join(", ")}`,
    `- Cycle: ${cycle}/${config.maxLoop}`,
    `- Consecutive failures: ${consecutiveFails}`,
    `- Memory: ${memStats.lines} lines (~${memStats.tokens} tokens)`,
    `- Total tokens: ~${state.totalTokensEstimate ?? 0}`,
    `- Total cost: ${formatCost(cost)}`,
    `- Last success: ${state.lastSuccess ?? "never"}`,
    "",
  ].join("\n");

  appendFileSync(paths.heartbeatFile, entry);
  logInfo("Heartbeat updated");
}
