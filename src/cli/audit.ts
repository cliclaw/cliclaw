/**
 * `cliclaw audit` — summarize agent activity from JSONL logs.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolveConfig } from "../core/config.js";
import { formatCost } from "../core/cost.js";

const AUDIT_HELP = `
cliclaw audit — Audit report from JSONL logs

Usage:
  cliclaw audit [n] [options]

Arguments:
  n                      Number of recent events (default: 50)

Options:
  --help, -h             Show this help

Examples:
  cliclaw audit          # Last 50 events
  cliclaw audit 100      # Last 100 events
`;

interface AuditEntry {
  timestamp: string;
  event?: string;
  cycle?: number;
  tokens?: number;
  cost?: number;
  exit_code?: number;
  consecutive_fails?: number;
  reason?: string;
  [key: string]: string | number | undefined;
}

export async function auditCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(AUDIT_HELP);
    return;
  }

  const config = resolveConfig();
  const jsonlPath = config.paths.logJsonl;

  if (!existsSync(jsonlPath)) {
    console.log("No audit data found. Run `make cron` first.");
    return;
  }

  const lines = readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);
  const entries: AuditEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch { /* skip malformed */ }
  }

  const limit = parseInt(args[0] ?? "50", 10) || 50;
  const recent = entries.slice(-limit);

  let totalTokens = 0;
  let totalCost = 0;
  let successes = 0;
  let failures = 0;

  console.log("\n🔍 CLIClaw Audit Report\n");
  console.log("─".repeat(80));

  for (const entry of recent) {
    const event = entry.event ?? entry["message"] ?? "unknown";
    const ts = (entry.timestamp ?? "").slice(0, 19);

    if (event === "cycle_complete") {
      successes++;
      const tokens = entry.tokens ?? 0;
      const cost = entry.cost ?? 0;
      totalTokens += tokens;
      totalCost += cost;
      console.log(`  ✅ ${ts} | cycle ${entry.cycle ?? "?"} | ${tokens} tokens | ${formatCost(cost)}`);
    } else if (event === "cycle_failed") {
      failures++;
      console.log(`  ❌ ${ts} | cycle ${entry.cycle ?? "?"} | fails: ${entry.consecutive_fails ?? "?"}`);
    } else if (event === "loop_stopped") {
      console.log(`  🛑 ${ts} | stopped: ${entry.reason ?? "unknown"}`);
    }
  }

  console.log("─".repeat(80));
  console.log(`\nSummary (last ${recent.length} events):`);
  console.log(`  Successes: ${successes}`);
  console.log(`  Failures: ${failures}`);
  console.log(`  Total tokens: ~${totalTokens}`);
  console.log(`  Total cost: ${formatCost(totalCost)}`);
  console.log(`  Success rate: ${successes + failures > 0 ? Math.round((successes / (successes + failures)) * 100) : 0}%`);
  console.log("");
}
