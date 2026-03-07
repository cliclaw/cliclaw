# Engines

CLIClaw supports 7 AI CLI engines: Kiro, Claude, Cursor, Codex, Aider, Gemini, and Copilot.

## Engine Registry

Each engine in `src/engines/registry.ts` defines:

- `command` — CLI binary name (e.g. `kiro-cli`, `claude`, `agent`)
- `buildArgs(opts)` — constructs CLI arguments from prompt, model, resume flag
- `stdinPrompt` — whether the engine accepts prompts via stdin (cursor) vs arguments
- `model` — default model name
- `lenientExit` — whether non-zero exit codes with output should be treated as success
- `supportsResume` — whether the engine supports `--resume`/`--continue` flags
- `parseOutput(stdout)` — optional; extracts human-readable text from JSON output (cursor, claude, gemini)

## Engine Runner

`src/engines/runner.ts` handles:

- Process spawning with configurable timeout
- stdin-based prompt delivery (for cursor)
- Output parsing — raw JSON decoded to human-readable text (cursor, claude, gemini)
- Exit code handling (lenient — some engines exit non-zero on success)
- Cost estimation per invocation
- Parallel execution with task ledger coordination

## Parallel Execution

When `--parallel` is passed (or `config.parallel` is true), CLIClaw runs all configured engines simultaneously, up to `maxConcurrent` at a time.

Each engine gets:

- The base prompt
- Its `focus` area (if specified)
- A ledger context showing what other engines are working on

The task ledger (`src/core/ledger.ts`) prevents engines from colliding on the same files:

- Creates a task entry per engine at the start of each parallel cycle
- Engines claim tasks before working, preventing collisions
- Task status (pending/claimed/done/failed) is injected into each engine's prompt
- File-based JSON coordination in `.cliclaw/tmp/parallel-ledger.json`
