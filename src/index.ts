#!/usr/bin/env node

/**
 * CLIClaw — autonomous AI agent loop runner
 * Multi-engine, token-aware, cost-effective.
 */

import { cronCommand } from "./cli/cron.js";
import { identityCommand } from "./cli/personai.js";
import { memoryCommand } from "./cli/memory.js";
import { setupCommand } from "./cli/setup.js";
import { statusCommand } from "./cli/status.js";
import { cleanCommand } from "./cli/clean.js";
import { logsCommand } from "./cli/logs.js";
import { auditCommand } from "./cli/audit.js";
import { rollbackCommand } from "./cli/rollback.js";
import { upgradeCommand } from "./cli/upgrade.js";
import { chatCommand } from "./cli/chat.js";
import { trackerCommand } from "./cli/tracker.js";

const HELP = `
CLIClaw — Autonomous AI Agent Loop Runner

Usage:
  cliclaw <command> [options]

Commands:
  cron [focus]           Start the autonomous agent loop (all non-manual agents run in parallel)
                         Options: --agent, --model, --dry-run, --focus, --max-loop, --sleep
  chat                   Interactive chat that updates agent identity
                         Options: --agent=<alias|name>
  setup                  Interactive setup wizard with identity templates
  identity               Configure agent identity interactively
  tracker                Start the tracker web UI (install via setup)
  memory                 View and optimize persistent memory
  memory search <term>   Search through memory entries
  memory search <term> --semantic  Semantic search using vector similarity
  memory reindex         Rebuild the vector index from MEMORY.md
  status                 Show current state, cost, and stats
  audit [n]              Audit report from JSONL logs (default: last 50 events)
  rollback               Restore state from a previous snapshot
  logs [n] [--json]      View recent log entries (default: 50)
  logs --tail             Live-tail the log file (Ctrl+C to stop)
  clean                  Remove temp files, optionally logs/state
  upgrade                Upgrade CLIClaw to the latest version
  help                   Show this help

Agents: kiro | claude | cursor | codex | gemini | copilot
`;

type CommandFn = (args: string[]) => Promise<void>;

const commands: Record<string, CommandFn> = {
  cron: cronCommand,
  chat: chatCommand,
  setup: setupCommand,
  identity: identityCommand,
  tracker: trackerCommand,
  memory: memoryCommand,
  status: statusCommand,
  clean: cleanCommand,
  logs: logsCommand,
  audit: auditCommand,
  rollback: rollbackCommand,
  upgrade: upgradeCommand,
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] ?? "help";
  const commandArgs = args.slice(1);

  // Show global help only if no command or help command
  if (command === "help" || (command === "--help" || command === "-h") && args.length === 1) {
    console.log(HELP);
    return;
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.log(HELP);
    process.exit(1);
  }

  try {
    await handler(commandArgs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nError: ${message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
