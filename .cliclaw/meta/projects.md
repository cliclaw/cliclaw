# Projects

## This Project: CLIClaw

CLIClaw is itself the project being developed. It is an autonomous AI agent loop runner — multi-engine, token-aware, cost-effective — written in TypeScript.

### Folder Structure

```txt
.cliclaw/          # Runtime config, memory, meta, state, logs
src/
  cli/             # CLI command handlers (cron, setup, memory, status, audit, logs, etc.)
  core/            # Core primitives (config, types, memory, vectors, ledger, cost, hooks, lock, secrets, snapshots, state, logger)
  engines/         # Engine registry and runner
  prompts/         # Prompt builder
  utils/           # Notify, prompt helpers
tests/             # Vitest test suite mirroring src/
Makefile
package.json
tsconfig.json
vitest.config.ts
README.md
DETAILED.md
AGENTS.md
project.md
```

### Build & Test

```bash
npm run build          # Compile TypeScript
npm test               # Run all tests (vitest)
npm run test:coverage  # Coverage report
npm run lint           # Type-check only (tsc --noEmit)
make dev help          # Run any command from source via tsx
```

### Vision

CLIClaw aims to be the first open-source project that makes a codebase truly self-driving — freestyle autonomy that no existing tool has attempted. Features should push that boundary.

### Active Branch

All new feature work lives on `matic-feature`. Do NOT push to origin — owner reviews locally.

### Conventions

- TypeScript strict mode
- ESM modules (`"type": "module"`)
- Tests live in `tests/` mirroring `src/` structure
- No extra dependencies unless absolutely necessary
- Keep each source file focused and minimal
