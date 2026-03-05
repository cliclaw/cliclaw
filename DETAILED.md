# CLIClaw — Technical Documentation

Detailed reference for CLIClaw internals, configuration, and architecture.

## Why CLIClaw?

CLIClaw was born out of a simple frustration: I already pay for Cursor Pro and Kiro — why should I need *another* LLM API key and *another* billing account just to run an autonomous coding loop?

OpenClaw is a powerful autonomous agent framework, but it operates at the LLM provider level. You bring your own API keys (OpenAI, Anthropic, etc.), configure model routing, manage token budgets across providers, and run it as a general-purpose agent runtime. It connects to messaging platforms (Telegram, Discord, WhatsApp), supports tool sandboxing, browser automation, and multi-channel orchestration. It's designed to be a full AI assistant platform.

CLIClaw is not that. CLIClaw is a **project-driven production tool**.

The idea is dead simple: you already have AI CLI tools installed and authenticated — `cursor`, `kiro-cli`, `claude`, `codex`, `aider`, `gemini`, `copilot`. You're already paying for them. CLIClaw just puts them in a loop and points them at your codebase.

### What makes CLIClaw different

- **Zero API keys needed** — CLIClaw piggybacks on your existing CLI tool subscriptions. If `kiro-cli` or `cursor` works in your terminal, CLIClaw can use it. No provider setup, no API key management, no separate billing.
- **Project-first, not platform-first** — CLIClaw doesn't try to be a general AI assistant. It does one thing: run coding agents against your repo in a loop until work gets done. Every feature (memory, persona, cost tracking, hooks) exists to make that loop smarter.
- **Multi-engine out of the box** — 7 engines supported. If one goes down or gets rate-limited, CLIClaw rotates to the next. Run them in parallel on different parts of your codebase.
- **Lightweight and local** — No Docker, no server, no database. One `curl | bash` install, runs from your terminal. State is plain JSON and Markdown files in `.cliclaw/`.
- **Cost-aware without being the billing layer** — CLIClaw estimates costs per cycle based on token counts and model pricing, but it doesn't manage API spend — your CLI tools handle that. You get visibility without complexity.
- **File-based vector memory** — Semantic search over your memory entries using TF-IDF, stored as plain JSON. No embedding APIs, no vector databases. `cliclaw memory search "query" --semantic` finds relevant entries by meaning, not just keyword matching.

### CLIClaw vs OpenClaw

OpenClaw is a full autonomous agent platform — and a great one. Here's how CLIClaw takes a different approach to similar problems:

| Capability | OpenClaw | CLIClaw |
|-----------|----------|---------|
| **LLM access** | Direct API keys to 12+ providers with model routing | Piggybacks on your existing CLI tools — zero API setup, zero extra billing |
| **Messaging** | Telegram, Discord, WhatsApp, Slack | Terminal-native — one project, one loop, full focus. No chat noise, no context switching |
| **Tool execution** | Sandboxed runtime for browser, files, web | Delegates to the AI engine itself — Cursor, Claude, Kiro already have tool use built in |
| **Multi-channel** | Manages conversations across platforms | One persona per project. Each repo gets its own memory, config, and AI personality — isolated by design |
| **Memory** | Vector-based with embedding APIs | File-based TF-IDF vectors — semantic search with zero API calls, zero cost, works offline |
| **Dashboard** | Web UI for monitoring | `cliclaw status`, `cliclaw audit` — everything in the terminal, scriptable, pipe-friendly |
| **Deployment** | Docker, VPS, always-on server | `curl \| bash` and done. Runs from your laptop. No infrastructure to maintain |

**In short**: OpenClaw is a full autonomous agent platform. CLIClaw is a cron job that makes your existing AI coding tools work harder while you sleep.

## Architecture

```
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
│   ├── heartbeat.ts      Periodic status updates
│   ├── cost.ts           Per-model pricing + cost estimation
│   ├── secrets.ts        Secret scanning + redaction
│   ├── snapshots.ts      State snapshot + rollback
│   └── hooks.ts          Plugin lifecycle hooks
├── engines/
│   ├── registry.ts       Engine definitions (7 engines)
│   └── runner.ts         Process spawning + parallel execution
├── prompts/
│   └── builder.ts        Token-aware prompt composition + diff
├── cli/
│   ├── cron.ts           Autonomous loop (adaptive sleep, rotation)
│   ├── setup.ts          Setup wizard
│   ├── personai.ts       Persona configuration
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
└── tests/                Vitest test suite (27 files, 247 tests)
```

## Configuration

### Config Resolution Order

1. CLI arguments (`--engine`, `--model`, `--dry-run`, etc.)
2. Project config (`.cliclaw/config.json`)
3. Environment variables (`CLICLAW_*`)
4. Built-in defaults

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLICLAW_ENGINE` | `kiro` | Default engine (used when no config file) |
| `CLICLAW_MODEL` | (per engine) | Model override |
| `CLICLAW_PROJECT_ROOT` | `cwd` | Project root directory |
| `CLICLAW_MAX_LOOP` | `500` | Max loop cycles |
| `CLICLAW_SLEEP` | `60` | Sleep between cycles (seconds) |
| `CLICLAW_SLEEP_FAIL` | `90` | Sleep after failure (seconds) |
| `CLICLAW_TIMEOUT` | `86400` | Agent timeout per cycle (seconds) |
| `CLICLAW_FRESH_EVERY` | `3` | Start fresh session every N cycles |
| `CLICLAW_TOKEN_BUDGET` | `8000` | Max tokens per prompt (0 = unlimited) |
| `CLICLAW_MAX_CONCURRENT` | `2` | Max parallel engines |
| `CLICLAW_DRY_RUN` | `false` | Preview prompts without running agents |

### Project Config (`.cliclaw/config.json`)

The `engines` array is the primary config unit. The first entry is the primary engine; all entries are available for parallel execution and rotation on failure.

```json
{
  "engines": [
    { "engine": "claude", "model": "claude-sonnet-4-20250514" },
    { "engine": "kiro", "model": "claude-sonnet-4.6", "alias": "kiro-frontend", "focus": "frontend" },
    { "engine": "kiro", "model": "claude-sonnet-4.6", "alias": "kiro-backend", "focus": "backend" }
  ],
  "tokenBudget": 8000,
  "maxConcurrent": 2,
  "hooks": {
    "preCycle": [],
    "postCycle": ["npm run lint"],
    "onSuccess": ["git add -A && git commit -m 'cliclaw: auto-commit'"],
    "onFailure": []
  }
}
```

Each engine entry supports:
- `engine` — Engine name (`kiro`, `claude`, `cursor`, `codex`, `aider`, `gemini`, `copilot`)
- `model` — Model to use (defaults to engine's default if omitted in env/CLI)
- `alias` — Unique name for this instance (required when using duplicate engines, auto-generated by setup wizard)
- `focus` — Focus area for parallel execution (e.g. `"frontend"`, `"backend"`)

## Meta Files

CLIClaw builds prompts from meta files in priority order:

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `.cliclaw/memory/MEMORY.md` | Persistent learned patterns and insights |
| 2 | `.cliclaw/meta/you.md` | Who you are, your role and tech stack |
| 3 | `.cliclaw/meta/projects.md` | Active projects and priorities |
| 4 | `.cliclaw/meta/personai.md` | AI persona (tone, expertise, style) |

These are created by `cliclaw setup` and `cliclaw personai`. The prompt builder strips template boilerplate, empty placeholders, and HTML comments before composing the final prompt.

## Prompt Builder

The prompt builder (`src/prompts/builder.ts`) composes a single prompt each cycle:

- Reads all meta files in priority order
- Cleans content: strips `# ` title headers, `<!-- -->` comments, empty `- **Key**: ` fields, boilerplate descriptions
- Demotes `## ` to `### ` in meta content to avoid header clashes
- Skips sections that contain only template content (no user data)
- Filters template rules from memory snippets
- Applies token budget — truncates if the composed prompt exceeds the limit
- Computes a hash for prompt diffing — skips sending if identical to last cycle
- Runs secret scanning before sending to the agent

## Engine System

### Engine Registry

Each engine in `src/engines/registry.ts` defines:

- `command` — CLI binary name (e.g. `kiro-cli`, `claude`, `agent`)
- `buildArgs(opts)` — constructs CLI arguments from prompt, model, resume flag
- `stdinPrompt` — whether the engine accepts prompts via stdin (cursor) vs arguments
- `model` — default model name
- `lenientExit` — whether non-zero exit codes with output should be treated as success
- `supportsResume` — whether the engine supports `--resume`/`--continue` flags

### Engine Runner

`src/engines/runner.ts` handles:

- Process spawning with configurable timeout
- stdin-based prompt delivery (for cursor)
- Real-time stdout streaming to log file
- Exit code handling (lenient — some engines exit non-zero on success)
- Cost estimation per invocation
- Parallel execution with task ledger coordination

### Parallel Execution

When `--parallel` is passed (or `config.parallel` is true), CLIClaw runs all configured engines simultaneously, up to `maxConcurrent` at a time. Each engine gets the base prompt plus its `focus` area and a ledger context showing what other engines are working on. The task ledger (`src/core/ledger.ts`) prevents engines from colliding on the same files.

## Autonomous Loop

The cron loop (`src/cli/cron.ts`) runs this cycle:

1. **Lock** — Acquire singleton lock (prevents duplicate instances)
2. **Snapshot** — Save state before the cycle
3. **Hooks** — Run `preCycle` scripts
4. **Build prompt** — Compose from meta files + task focus
5. **Diff check** — Skip if prompt hash matches last cycle
6. **Execute** — Spawn the AI agent (or log in dry-run mode)
7. **Track** — Record cost, tokens, duration
8. **Memory** — Extract and save any `MEMORY_APPEND` blocks from agent output
9. **Hooks** — Run `onSuccess`/`onFailure` + `postCycle` scripts
10. **Heartbeat** — Update `HEARTBEAT.md` with status
11. **Sleep** — Adaptive sleep (exponential backoff on stalls, reset on progress)
12. **Rotate** — Switch to next configured engine after 3 consecutive failures

### Adaptive Sleep

- Normal: `sleepNormal` seconds (default 60)
- After failure: `sleepAfterFailure` seconds (default 90)
- Stall detection: exponential backoff `baseSleep * 1.5^stallCycles`, capped at 10x
- Progress resets the backoff counter

### Engine Rotation

After 3 consecutive failures with the current engine, CLIClaw rotates to the next engine in the configured `engines` array (not the full registry — only engines you've configured). This prevents getting stuck when one engine is down or rate-limited.

## Vector Memory

`src/core/vectors.ts` provides TF-IDF-based semantic search over memory entries:

- **No external dependencies** — pure math on strings, stored as JSON in `.cliclaw/memory/vectors.json`
- **Auto-indexed** — new memory entries are indexed on append
- **Semantic search** — `cliclaw memory search "query" --semantic` finds entries by meaning
- **Rebuild** — `cliclaw memory reindex` rebuilds the full index from MEMORY.md

## Task Ledger

`src/core/ledger.ts` coordinates parallel engine execution:

- Creates a task entry per engine at the start of each parallel cycle
- Engines claim tasks before working, preventing collisions
- Task status (pending/claimed/done/failed) is injected into each engine's prompt
- File-based JSON coordination in `.cliclaw/tmp/parallel-ledger.json`

## Cost Tracking

`src/core/cost.ts` contains per-model pricing (USD per 1M tokens):

- Tracks input/output tokens and estimated cost per cycle
- Cumulative cost displayed in `cliclaw status` and heartbeat
- Cost data persisted in state for audit reports

## Secret Scanning

`src/core/secrets.ts` scans prompts for:

- AWS access keys and secret keys
- GitHub tokens (`ghp_`, `gho_`, `ghs_`)
- Generic API keys and bearer tokens
- Private key blocks
- npm tokens, Slack tokens
- Generic password/secret patterns

Detected secrets are redacted before the prompt is sent to any engine.

## State & Snapshots

- **State** (`src/core/state.ts`) — JSON file tracking cycle count, last success, failures, cost, prompt hash
- **Snapshots** (`src/core/snapshots.ts`) — Up to 20 state snapshots saved before each cycle
- **Rollback** (`cliclaw rollback`) — Interactive restore from any snapshot

## Plugin Hooks

Configure in `.cliclaw/config.json` under `hooks`:

| Hook | When |
|------|------|
| `preCycle` | Before each cycle starts |
| `postCycle` | After each cycle completes |
| `onSuccess` | After a successful cycle |
| `onFailure` | After a failed cycle |

Each hook is a shell command string executed via `child_process.execSync` with a 60-second timeout. The `CLICLAW_CYCLE` environment variable is set to the current cycle number.

## Logging

- **File log** — Human-readable log at `.cliclaw/logs/autonomous.log`
- **JSONL log** — Machine-readable at `.cliclaw/logs/autonomous.jsonl`
- **Heartbeat** — `.cliclaw/state/HEARTBEAT.md`, updated every 4 cycles
- **Live tail** — `cliclaw logs --tail` watches the log file in real-time

## Singleton Lock

`src/core/lock.ts` uses a lock directory (`.cliclaw/cliclaw.lockdir/`) with a PID file to prevent multiple CLIClaw instances from running on the same project. Stale locks from crashed processes are automatically cleaned up.

## Testing

Tests use vitest with v8 coverage:

```bash
npm test                # Run all tests
npm run test:coverage   # Run with coverage report
```

27 test files, 247 tests. Coverage: ~93% statements, ~95% lines.

## Makefile (Development)

When working from source, the Makefile wraps all commands:

| Target | Description |
|--------|-------------|
| `make cron` | Start the loop |
| `make cron ENGINE=cursor` | Use a specific engine |
| `make cron DRY_RUN=1` | Dry-run mode |
| `make cron FOCUS="task"` | Focus on a task |
| `make setup` | Setup wizard |
| `make personai` | Persona config |
| `make memory` | View memory |
| `make memory-search TERM="x"` | Search memory |
| `make status` | Show status |
| `make audit` | Audit report |
| `make rollback` | Rollback state |
| `make logs` | View logs |
| `make clean` | Cleanup |
| `make dry-run` | Dry-run shortcut |
| `make build` | Compile TypeScript |
| `make install-global` | Build and install to `~/.cliclaw/bin/` |
| `make dev <cmd>` | Run any command via tsx |
