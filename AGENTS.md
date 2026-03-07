# AGENTS.md

## Project Overview

CLIClaw is an autonomous AI agent loop runner — multi-engine, token-aware, cost-effective. It runs AI coding agents (Kiro, Claude, Cursor, Codex, Aider, Gemini, Copilot) in a continuous loop on any project, building context-aware prompts, tracking costs, rotating engines on failure, and keeping codebases moving forward autonomously.

Written in strict TypeScript. No runtime dependencies — Node.js built-ins only.

## Code Standards

- Strict TypeScript: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` — no `any` type anywhere
- All types must be explicit or inferred, never implicit
- File naming: kebab-case (`my-module.ts`)
- Max 500–1000 lines per file, separation of concerns enforced
- Prefer functional style, early returns, minimal abstractions
- No unnecessary libraries — use Node.js built-ins (`fs`, `path`, `child_process`, `readline`, `crypto`)
- ESM modules (`"type": "module"` in package.json, `.js` extensions in imports)

## Architecture

```
src/
├── index.ts              # Entry point + command router
├── core/                 # Config, state, memory, vectors, ledger, logging, cost, secrets, hooks, snapshots
├── engines/              # Engine registry (7 engines) + process runner
├── prompts/              # Token-aware prompt builder with diff and cleaning
├── cli/                  # CLI commands (cron, setup, personai, memory, audit, etc.)
└── utils/                # Terminal helpers, notifications
tests/                    # Vitest test suite (27 files, 247 tests, ~93% coverage)
```

Key patterns:

- Config cascade: CLI args → project `.cliclaw/config.json` → env vars → defaults
- **`engines` array is the primary config unit** — first entry is primary, all are used for rotation and parallel execution
- Each engine entry has `engine`, `model`, optional `alias` (required for duplicates), optional `focus`
- Lazy initialization (e.g. readline only created when interactive input is needed)
- Engine registry pattern: each engine defines `command`, `buildArgs`, `stdinPrompt`, `model`, `lenientExit`
- Prompt builder strips boilerplate, demotes headers, skips template-only sections, scans for secrets
- Parallel execution uses a file-based task ledger (`src/core/ledger.ts`) for engine coordination
- Semantic memory search via TF-IDF vectors (`src/core/vectors.ts`), no external APIs

### Config Format

```json
{
  "engines": [
    { "engine": "kiro", "model": "claude-opus-4.6" },
    { "engine": "claude", "model": "claude-sonnet-4-20250514" }
  ],
  "tokenBudget": 8000,
  "maxConcurrent": 2,
  "hooks": { "preCycle": [], "postCycle": [], "onSuccess": [], "onFailure": [] }
}
```

## Conventions

- Entry point is `src/index.ts` with a command router dispatching to `src/cli/*.ts` handlers
- All types live in `src/core/types.ts`
- State is JSON-backed (`.cliclaw/state/`), snapshots for rollback
- Logging is dual: human-readable `.log` + machine-readable `.jsonl` in `.cliclaw/logs/`
- Meta files (`.cliclaw/meta/`) follow priority: memory → you → projects → personai
- The Makefile is the development interface; installed users use the `cliclaw` binary directly
- Tests use vitest in `tests/` directory, run with `npm test`

## Do NOT

- Add runtime dependencies without strong justification
- Use `any`, `as any`, or `@ts-ignore`
- Put business logic in `index.ts` — it's only a router
- Create files over 1000 lines
- Modify meta file templates without updating the prompt builder's cleaning logic
- Break the config cascade order (CLI > project config > env > defaults)
- Use top-level `engine`/`model` in config — always use the `engines` array

## Feature Development Rules

Every new feature or change **must**:

1. **Have tests** — write test cases in `tests/` covering the new behaviour. Run `npm test` and confirm all pass before considering the work done.
2. **Be documented** — update `DETAILED.md` with a section describing the feature: what it does, how to use it, any config options, and relevant edge cases. Update `README.md` if it affects user-facing commands. Update `AGENTS.md` if it changes architecture or conventions.
3. **Pass the build** — run `make build` (or `npx tsc --noEmit`) and confirm zero TypeScript errors.

No feature is complete until all three are done.

## Recent Changes

### Command-specific `--help` option
- Each CLI command now has its own help text with relevant options, arguments, and examples
- `cliclaw --help` shows global help with all commands
- `cliclaw <command> --help` shows command-specific help (e.g., `cliclaw cron --help`)
- **Pattern for new commands**: Add a `COMMAND_HELP` constant with usage/options/examples, check for `--help`/`-h` at the start of the command function, and display help before any other logic
- Example:
  ```typescript
  const MY_HELP = `
  cliclaw mycommand — Description
  
  Usage:
    cliclaw mycommand [options]
  
  Options:
    --help, -h             Show this help
  `;
  
  export async function myCommand(args: string[]): Promise<void> {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(MY_HELP);
      return;
    }
    // ... rest of command logic
  }
  ```

### `cliclaw chat` command
- Interactive TUI for documentation and identity management
- Conversation history persists per engine in `.cliclaw/tmp/chat-{engine}.json`
- Memory triggers: "Take note", "Remember...", etc. prompt the agent to update its identity file
- Agent will not print entire markdown files unless explicitly requested
- Per-engine identity files supported via `identity` field in engine config

### `maxLoop` configuration
- Default changed from `500` to `0` (unlimited)
- Interactive prompt when running `cliclaw cron` without `--max-loop` flag or config value
- CLI flag `--max-loop=N` takes priority over config.json
- Loop displays "unlimited" when maxLoop is 0
- Cycle counter shows just the number (e.g., "Cycle 42") instead of "Cycle 42/0" for unlimited loops
