# Agents

CLIClaw supports 6 AI CLI agents: Kiro, Claude, Cursor, Codex, Gemini, and Copilot.

## Agent Registry

Each agent in `src/agents/registry.ts` defines:

- `command` — CLI binary name (e.g. `kiro-cli`, `claude`, `agent`)
- `buildArgs(opts)` — constructs CLI arguments from prompt, model, resume flag
- `stdinPrompt` — whether the agent accepts prompts via stdin (cursor) vs arguments
- `model` — default model name
- `lenientExit` — whether non-zero exit codes with output should be treated as success
- `supportsResume` — whether the agent supports `--resume`/`--continue` flags
- `parseOutput(stdout)` — optional; extracts human-readable text from JSON output (cursor, claude, gemini)

## Agent Runner

`src/agents/runner.ts` handles:

- Process spawning with configurable timeout
- stdin-based prompt delivery (for cursor)
- Output parsing — raw JSON decoded to human-readable text (cursor, claude, gemini)
- Exit code handling (lenient — some agents exit non-zero on success)
- Cost estimation per invocation
- Parallel execution with task ledger coordination

## Parallel Execution

When `all non-manual agents run in parallel by default` is passed (or `config.parallel` is true), CLIClaw runs all configured agents simultaneously, up to `maxConcurrent` at a time.

Each agent gets:

- The base prompt
- Its `focus` area (if specified)
- A ledger context showing what other agents are working on

The task ledger (`src/core/ledger.ts`) prevents agents from colliding on the same files:

- Creates a task entry per agent at the start of each parallel cycle
- Agents claim tasks before working, preventing collisions
- Task status (pending/claimed/done/failed) is injected into each agent's prompt
- File-based JSON coordination in `.cliclaw/tmp/parallel-ledger.json`
