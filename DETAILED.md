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

| Capability         | OpenClaw                                            | CLIClaw                                                                                                 |
|--------------------|-----------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| **LLM access**     | Direct API keys to 12+ providers with model routing | Piggybacks on your existing CLI tools — zero API setup, zero extra billing                              |
| **Messaging**      | Telegram, Discord, WhatsApp, Slack                  | Terminal-native — one project, one loop, full focus. No chat noise, no context switching                |
| **Tool execution** | Sandboxed runtime for browser, files, web           | Delegates to the AI engine itself — Cursor, Claude, Kiro already have tool use built in                 |
| **Multi-channel**  | Manages conversations across platforms              | One persona per project. Each repo gets its own memory, config, and AI personality — isolated by design |
| **Memory**         | Vector-based with embedding APIs                    | File-based TF-IDF vectors — semantic search with zero API calls, zero cost, works offline               |
| **Dashboard**      | Web UI for monitoring                               | `cliclaw status`, `cliclaw audit` — everything in the terminal, scriptable, pipe-friendly               |
| **Deployment**     | Docker, VPS, always-on server                       | `curl \| bash` and done. Runs from your laptop. No infrastructure to maintain                           |

**In short**: OpenClaw is a full autonomous agent platform. CLIClaw is a cron job that makes your existing AI coding tools work harder while you sleep.

## Architecture

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
└── tests/                Vitest test suite (27 files, 247 tests)
```

## Configuration

### Config Resolution Order

1. CLI arguments (`--engine`, `--model`, `--dry-run`, etc.)
2. Project config (`.cliclaw/config.json`)
3. Environment variables (`CLICLAW_*`)
4. Built-in defaults

### Environment Variables

| Variable                 | Default      | Description                               |
|--------------------------|--------------|-------------------------------------------|
| `CLICLAW_ENGINE`         | `kiro`       | Default engine (used when no config file) |
| `CLICLAW_MODEL`          | (per engine) | Model override                            |
| `CLICLAW_PROJECT_ROOT`   | `cwd`        | Project root directory                    |
| `CLICLAW_MAX_LOOP`       | `500`        | Max loop cycles                           |
| `CLICLAW_SLEEP`          | `60`         | Sleep between cycles (seconds)            |
| `CLICLAW_SLEEP_FAIL`     | `90`         | Sleep after failure (seconds)             |
| `CLICLAW_TIMEOUT`        | `3600`      | Agent timeout per cycle (seconds)         |
| `CLICLAW_FRESH_EVERY`    | `3`          | Start fresh session every N cycles        |
| `CLICLAW_TOKEN_BUDGET`   | `8000`       | Max tokens per prompt (0 = unlimited)     |
| `CLICLAW_MAX_CONCURRENT` | `2`          | Max parallel engines                      |
| `CLICLAW_DRY_RUN`        | `false`      | Preview prompts without running agents    |

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
- `identity` — Path to an identity file for this engine, relative to `projectRoot` (e.g. `".cliclaw/meta/identity-reviewer.md"`). Falls back to `meta/identity.md` if omitted.

All other top-level fields are optional and fall back to defaults:

| Field                      | Default | Description                                                          |
|----------------------------|---------|----------------------------------------------------------------------|
| `maxLoop`                  | `500`   | Max cycles before stopping                                           |
| `sleepNormal`              | `60`    | Seconds to sleep after a successful cycle                            |
| `idleBeforeStart`          | `0`     | Seconds to pause before the loop starts (0 = no pause)               |
| `agentTimeout`             | `3600` | Max seconds a single cycle can run before force-kill (24h default)   |
| `outputStallTimeout`       | `600`   | Kill agent if no new output bytes arrive within N seconds (0 = off)  |
| `tokenBudget`              | `8000`  | Max tokens per prompt (0 = unlimited)                                |
| `maxConcurrent`            | `2`     | Max parallel engines when using `--parallel`                         |
| `snapshotEvery`            | `4`     | Save a state snapshot every N cycles                                 |
| `engineRotateAfter`        | `3`     | Consecutive failures before rotating to next engine                  |
| `stallMax`                 | `10`    | Stall cycles before emitting a stall warning                         |
| `stallBackoffMultiplier`   | `1.5`   | Sleep multiplier per stall cycle (`sleep *= multiplier^stallCycles`) |
| `stallBackoffCap`          | `10`    | Maximum backoff multiplier (caps exponential growth)                 |
| `hookTimeout`              | `60000` | Hook execution timeout in milliseconds                               |
| `maxSnapshots`             | `20`    | Max state snapshots to keep on disk                                  |
| `memoryMaxLines`           | `1100`  | Max MEMORY.md lines before trimming                                  |
| `memoryKeepHead`           | `80`    | Lines to preserve from the top when trimming                         |
| `memoryKeepTail`           | `850`   | Lines to preserve from the bottom when trimming                      |
| `promptBudgets.memory`     | `500`   | Token budget for memory section in prompt                            |
| `promptBudgets.you`        | `400`   | Token budget for you.md section                                      |
| `promptBudgets.projects`   | `600`   | Token budget for projects.md section                                 |
| `promptBudgets.boundaries` | `200`   | Token budget for boundaries.md section                               |
| `promptBudgets.identity`   | `200`   | Token budget for identity.md section                                 |
| `promptBudgets.tools`      | `300`   | Token budget for tools.md section                                    |
| `promptBudgets.boot`       | `300`   | Token budget for boot.md section (cycle 1 only)                      |

## Meta Files

CLIClaw builds prompts from meta files in priority order:

| Priority | File                          | Purpose                                  |
|----------|-------------------------------|------------------------------------------|
| 1        | `.cliclaw/memory/MEMORY.md`   | Persistent learned patterns and insights |
| 2        | `.cliclaw/meta/you.md`        | Who you are, your role and tech stack    |
| 3        | `.cliclaw/meta/projects.md`   | Active projects and priorities           |
| 4        | `.cliclaw/meta/boundaries.md` | Hard rules the agent must never violate  |
| 5        | `.cliclaw/meta/identity.md`   | Agent identity: name, role, mission      |
| 6        | `.cliclaw/meta/tools.md`      | Available tools and CLI commands         |
| 7        | `.cliclaw/meta/boot.md`       | Startup instructions — cycle 1 only      |

These are created by `cliclaw setup` and `cliclaw identity`. The prompt builder strips template boilerplate, empty placeholders, and HTML comments before composing the final prompt.

## Prompt Builder

The prompt builder (`src/prompts/builder.ts`) composes a single prompt each cycle:

- Reads all meta files in priority order
- Cleans content: strips `#` title headers, `<!-- -->` comments, empty `- **Key**:` fields, boilerplate descriptions
- Demotes `##` to `###` in meta content to avoid header clashes
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
- `parseOutput(stdout)` — optional; extracts human-readable text from JSON output (cursor, claude, gemini)

### Engine Runner

`src/engines/runner.ts` handles:

- Process spawning with configurable timeout
- stdin-based prompt delivery (for cursor)
- Output parsing — raw JSON decoded to human-readable text (cursor, claude, gemini)
- Exit code handling (lenient — some engines exit non-zero on success)
- Cost estimation per invocation
- Parallel execution with task ledger coordination

### Parallel Execution

When `--parallel` is passed (or `config.parallel` is true), CLIClaw runs all configured engines simultaneously, up to `maxConcurrent` at a time. Each engine gets the base prompt plus its `focus` area and a ledger context showing what other engines are working on. The task ledger (`src/core/ledger.ts`) prevents engines from colliding on the same files.

## Autonomous Loop

The cron loop (`src/cli/cron.ts`) runs this cycle:

1. **Idle** — Optional pause before starting (`idleBeforeStart` seconds)
2. **Lock** — Acquire singleton lock (prevents duplicate instances)
3. **Snapshot** — Save state before the cycle (every `snapshotEvery` cycles)
4. **Hooks** — Run `preCycle` scripts
5. **Build prompt** — Compose from meta files + task focus (boot.md injected on cycle 1 only)
6. **Diff check** — Skip if prompt hash matches last cycle
7. **Execute** — Spawn the AI agent (or log in dry-run mode)
8. **Signals** — Parse agent signals (`[EXIT CLICLAW]`, `[SKIP CYCLE]`, `[STALL RESET]`) from output
9. **Track** — Record cost, tokens, duration
10. **Memory** — Extract and save any `MEMORY_APPEND` blocks from agent output
11. **Hooks** — Run `onSuccess`/`onFailure` + `postCycle` scripts
12. **Sleep** — Adaptive sleep (exponential backoff on stalls, reset on progress)
13. **Rotate** — Switch to next configured engine after `engineRotateAfter` consecutive failures

### Adaptive Sleep

- Normal: `sleepNormal` seconds (default 60)
- After failure: `sleepAfterFailure` seconds (default 90)
- Stall detection: exponential backoff `baseSleep * stallBackoffMultiplier^stallCycles`, capped at `stallBackoffCap`x
- Progress resets the backoff counter

### Engine Rotation

After `engineRotateAfter` consecutive failures (default 3) with the current engine, CLIClaw rotates to the next engine in the configured `engines` array. This prevents getting stuck when one engine is down or rate-limited.

### Output Stall Detection

CLIClaw monitors the agent's stdout byte rate. If no new output arrives within `outputStallTimeout` seconds (default 600), the agent is force-killed with `SIGTERM` → `SIGKILL`.

This catches a common failure mode: the agent runs a shell command that hangs silently (e.g. a piped command where the reader never gets EOF), producing no output while the overall `agentTimeout` (24h) would otherwise let it sit indefinitely.

**Root cause of pipe hangs in non-TTY environments:**

AI agents are spawned without a TTY (`stdio: pipe`). When the agent then runs a shell command like `make e2e-bdd 2>&1 | tail -30`, the following can happen:

1. The subprocess (Playwright, make, etc.) detects no TTY and buffers stdout aggressively
2. `tail -30` waits for EOF from the pipe, but the subprocess never closes its end
3. The agent's tool call never returns — the cycle is stuck

**Recommended patterns for your `tools.md`:**

```markdown
## Shell Command Guidelines
- Avoid `cmd | tail -N` or `cmd | head -N` for long-running processes — use `cmd > /tmp/out.txt && tail -N /tmp/out.txt` instead
- Prefer `cmd 2>&1 | tee /tmp/out.txt` over bare pipes when you need to capture and display output
- For test runners, redirect to a file first: `make test > /tmp/test.out 2>&1; tail -50 /tmp/test.out`
```

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

## Boundaries

`.cliclaw/meta/boundaries.md` is the primary safety mechanism for constraining agent behavior. It is injected into every prompt and should be treated as non-negotiable rules.

### What to put in boundaries.md

Effective boundaries are **specific, unambiguous, and cover the blast radius** of autonomous operation. The generated template covers:

**Git & version control**

- No direct pushes to protected branches (`main`, `master`)
- No force-pushes to any remote
- No committing secrets or credentials
- No amending/rebasing already-pushed commits

**Destructive operations**

- No `DROP TABLE` / `TRUNCATE` / unscoped `DELETE` on production databases
- No deleting files outside the project root
- No `git clean -fdx` without explicit confirmation
- No modifying `.env` or secrets files

**Security**

- No hardcoded secrets in source code
- No disabling SSL/TLS verification
- No exposing services to `0.0.0.0` without instruction
- No installing packages from untrusted registries

**Scope**

- No modifying files outside the project root
- No touching CI/CD configs or IaC without explicit instruction

**Ambiguity resolution**

- If an instruction conflicts with a boundary, the boundary wins
- Agent should output `[EXIT CLICLAW]` and explain why

### Token budget

The default `promptBudgets.boundaries` is `200` tokens (~800 chars). If your boundaries file is longer, increase this in `.cliclaw/config.json`:

```json
{ "promptBudgets": { "boundaries": 500 } }
```

Silently truncated boundaries are worse than no boundaries — size the budget to fit your rules.

### Customizing for your project

Add project-specific rules after the generated template. Examples:

```markdown
## Project-Specific Rules
- NEVER modify the `payments/` directory — it requires a separate review process
- NEVER change database migration files that have already been applied
- NEVER remove feature flags without a corresponding ticket reference
```

## State & Snapshots

- **State** (`src/core/state.ts`) — JSON file tracking cycle count, last success, failures, cost, prompt hash
- **Snapshots** (`src/core/snapshots.ts`) — Up to 20 state snapshots saved before each cycle
- **Rollback** (`cliclaw rollback`) — Interactive restore from any snapshot

## Plugin Hooks

Configure in `.cliclaw/config.json` under `hooks`:

| Hook        | When                                            | Env vars        |
|-------------|-------------------------------------------------|-----------------|
| `preCycle`  | Before each cycle starts                        | `CLICLAW_CYCLE` |
| `postCycle` | After each cycle completes (success or failure) | `CLICLAW_CYCLE` |
| `onSuccess` | After a successful cycle                        | `CLICLAW_CYCLE` |
| `onFailure` | After a failed cycle                            | `CLICLAW_CYCLE` |

Each hook is a shell command string executed via `child_process.execSync` with a 60-second timeout. The `CLICLAW_CYCLE` environment variable is set to the current cycle number.

```json
{
  "hooks": {
    "preCycle": ["git fetch --quiet"],
    "postCycle": [],
    "onSuccess": ["git add -A && git commit -m 'cliclaw: auto-commit'", "npm run lint"],
    "onFailure": ["./scripts/notify-slack.sh"]
  }
}
```

## Agent Signals

Agent signals are special directives the AI can embed anywhere in its response to control the CLIClaw loop. They give the AI agency over the loop itself — it can declare work done, skip unnecessary cycles, or clear a stall.

| Signal           | Effect                                                                                          |
|------------------|-------------------------------------------------------------------------------------------------|
| `[EXIT CLICLAW]` | Gracefully terminate the loop after the current cycle completes (runs `onSuccess` hooks first)  |
| `[SKIP CYCLE]`   | Skip hooks and sleep for this cycle — useful when the agent detects nothing to do               |
| `[STALL RESET]`  | Reset the stall counter — use when the agent has made real progress that the loop didn't detect |

**How to use them:** Instruct the AI in your `.cliclaw/meta/identity.md` or project prompt when to emit these signals. For example:

```markdown
When you have completed all outstanding tasks and there is nothing left to do,
write [EXIT CLICLAW] at the end of your response.

If you inspect the codebase and find no actionable work this cycle,
write [SKIP CYCLE] to avoid unnecessary hooks and sleep delay.
```

Signals are detected in the parsed text output (after JSON decoding for engines like cursor/claude/gemini), so they work across all engines.

## Logging

- **File log** — Human-readable log at `.cliclaw/logs/autonomous.log`
- **JSONL log** — Machine-readable at `.cliclaw/logs/autonomous.jsonl`
- **Live tail** — `cliclaw logs --tail` streams decoded agent output in real-time (decodes stream-json for cursor/claude/gemini, plain text for others)

## Singleton Lock

`src/core/lock.ts` uses a lock directory (`.cliclaw/cliclaw.lockdir/`) with a PID file to prevent multiple CLIClaw instances from running on the same project. Stale locks from crashed processes are automatically cleaned up.

## Testing

Tests use vitest with v8 coverage:

```bash
npm test                # Run all tests
npm run test:coverage   # Run with coverage report
```

27 test files, 317 tests. Coverage: ~93% statements, ~95% lines.

## `cliclaw chat`

An interactive TUI chat session with the configured AI engine. Unlike `cliclaw cron` which autonomously executes tasks, `chat` is for **documentation and identity management only** — the agent will not write code or suggest implementations.

```bash
cliclaw chat                  # Use primary engine
cliclaw chat --engine=kiro    # Use specific engine by alias or name
```

### Behaviour

- Loads all meta files on every turn (identity, memory, boundaries, you, projects, tools) — same context as cron
- Conversation history persists to `.cliclaw/tmp/chat-{engine}.json` and auto-resumes on next session
- Agent decides autonomously when to update `identity.md` — outputs a fenced ` ```identity ``` ` block only when something changed
- Streams agent output live to the terminal with a spinner while waiting for the first token
- Agent label uses the name from `identity.md` (`**Name**: X`)

### Slash commands

| Command    | Description                                    |
|------------|------------------------------------------------|
| `/clear`   | Wipe conversation history (keeps meta context) |
| `/history` | Show timestamped conversation log              |
| `/help`    | List available commands                        |
| `/exit`    | Exit chat                                      |

### History summarization

To keep prompts within token budget across long sessions, history is split:

- Last `RECENT_TURNS * 2` messages (20) are fed verbatim
- Older messages are collapsed into a single digest line of user topics

### Agent restrictions

The chat agent is **documentation-only**:

- May discuss, update, or clarify any `.cliclaw` meta file content
- Will **not** write code, pseudocode, or implementation suggestions
- Redirects implementation questions to `cliclaw cron`

### Hot-reload

`cliclaw cron` reads all `.cliclaw` meta files fresh on every cycle — changes made via `cliclaw chat` (or manually) take effect on the next cron cycle with no restart needed.

## Makefile (Development)

When working from source, the Makefile wraps all commands:

| Target                        | Description                            |
|-------------------------------|----------------------------------------|
| `make cron`                   | Start the loop                         |
| `make cron ENGINE=cursor`     | Use a specific engine                  |
| `make cron DRY_RUN=1`         | Dry-run mode                           |
| `make cron FOCUS="task"`      | Focus on a task                        |
| `make setup`                  | Setup wizard                           |
| `cliclaw identity`            | Agent identity config                  |
| `make memory`                 | View memory                            |
| `make memory-search TERM="x"` | Search memory                          |
| `make status`                 | Show status                            |
| `make audit`                  | Audit report                           |
| `make rollback`               | Rollback state                         |
| `make logs`                   | View logs                              |
| `make clean`                  | Cleanup                                |
| `make dry-run`                | Dry-run shortcut                       |
| `make build`                  | Compile TypeScript                     |
| `make install-global`         | Build and install to `~/.cliclaw/bin/` |
| `make dev <cmd>`              | Run any command via tsx                |
