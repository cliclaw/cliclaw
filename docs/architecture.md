# Architecture

CLIClaw is built in strict TypeScript with zero runtime dependencies — Node.js built-ins only.

## Directory Structure

```txt
src/
├── index.ts              Entry point + command router
├── core/
│   ├── types.ts          All type definitions
│   ├── config.ts         Configuration builder + project config
│   ├── logger.ts         Structured logging (file + JSONL)
│   ├── state.ts          JSON-backed persistent state
│   ├── lock.ts           Singleton lock management
│   ├── memory.ts         Memory read/write/trim
│   ├── vectors.ts        TF-IDF vector memory (semantic search)
│   ├── ledger.ts         Parallel task ledger (engine coordination)
│   ├── cost.ts           Per-model pricing + cost estimation
│   ├── secrets.ts        Secret scanning + redaction
│   ├── snapshots.ts      State snapshot + rollback
│   └── hooks.ts          Plugin lifecycle hooks + agent signals
├── engines/
│   ├── registry.ts       Engine definitions (7 engines)
│   └── runner.ts         Process spawning + parallel execution
├── prompts/
│   └── builder.ts        Token-aware prompt composition + diff
├── cli/
│   ├── cron.ts           Autonomous loop (adaptive sleep, rotation)
│   ├── setup.ts          Setup wizard
│   ├── personai.ts       Agent identity configuration (writes identity.md)
│   ├── memory.ts         Memory viewer/optimizer/search
│   ├── status.ts         Status + cost display
│   ├── audit.ts          Audit report from JSONL
│   ├── rollback.ts       State rollback
│   ├── upgrade.ts        Self-upgrade via install script
│   ├── logs.ts           Log viewer + live tail
│   └── clean.ts          Cleanup command
├── utils/
│   ├── prompt.ts         Interactive terminal helpers (lazy readline)
│   └── notify.ts         macOS desktop notifications
└── tests/                Vitest test suite (28 files, 326 tests)
```

## Key Patterns

**Config cascade** — CLI args → project `.cliclaw/config.json` → env vars → defaults

**Lazy initialization** — readline only created when interactive input is needed

**Engine registry** — Each engine defines `command`, `buildArgs`, `stdinPrompt`, `model`, `lenientExit`

**Prompt builder** — Strips boilerplate, demotes headers, skips template-only sections, scans for secrets

**Parallel execution** — File-based task ledger (`src/core/ledger.ts`) for engine coordination

**Semantic memory** — TF-IDF vectors (`src/core/vectors.ts`), no external APIs

## State Management

- **State** (`src/core/state.ts`) — JSON file tracking cycle count, last success, failures, cost, prompt hash
- **Snapshots** (`src/core/snapshots.ts`) — Up to 20 state snapshots saved before each cycle
- **Lock** (`src/core/lock.ts`) — Singleton lock directory with PID file prevents duplicate instances

## Logging

- **File log** — Human-readable at `.cliclaw/logs/autonomous.log`
- **JSONL log** — Machine-readable at `.cliclaw/logs/autonomous.jsonl`
- **Live tail** — `cliclaw logs --tail` streams decoded agent output in real-time
