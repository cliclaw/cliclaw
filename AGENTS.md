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
├── core/                 # Config, state, memory, logging, cost, secrets, hooks, snapshots
├── engines/              # Engine registry (7 engines) + process runner
├── prompts/              # Token-aware prompt builder with diff and cleaning
├── cli/                  # CLI commands (cron, setup, personai, memory, audit, etc.)
└── utils/                # Terminal helpers, notifications
```

Key patterns:
- Config cascade: CLI args → project `.cliclaw/config.json` → env vars → defaults
- Lazy initialization (e.g. readline only created when interactive input is needed)
- Engine registry pattern: each engine defines `command`, `buildArgs`, `stdinPrompt`, `defaultModel`
- Prompt builder strips boilerplate, demotes headers, skips template-only sections, scans for secrets

## Conventions

- Entry point is `src/index.ts` with a command router dispatching to `src/cli/*.ts` handlers
- All types live in `src/core/types.ts`
- State is JSON-backed (`.cliclaw/state/`), snapshots for rollback
- Logging is dual: human-readable `.log` + machine-readable `.jsonl`
- Meta files (`.cliclaw/meta/`) follow priority: memory → you → projects → personai
- The Makefile is the development interface; installed users use the `cliclaw` binary directly

## Do NOT

- Add runtime dependencies without strong justification
- Use `any`, `as any`, or `@ts-ignore`
- Put business logic in `index.ts` — it's only a router
- Create files over 1000 lines
- Modify meta file templates without updating the prompt builder's cleaning logic
- Break the config cascade order (CLI > project config > env > defaults)
