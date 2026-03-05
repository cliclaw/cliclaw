# Contributing to CLIClaw

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/cliclaw/cliclaw.git
cd cliclaw
npm install
```

## Development

```bash
make dev <command>    # Run any command via tsx (no build needed)
make build            # Compile TypeScript to dist/
npm run lint          # Type-check without emitting
npm test              # Run tests
npm run test:coverage # Run tests with coverage report
```

## Project Structure

- `src/core/` — Config, state, memory, vectors, ledger, logging, cost, secrets, hooks, snapshots
- `src/engines/` — Engine registry and process runner
- `src/prompts/` — Token-aware prompt builder
- `src/cli/` — CLI commands (cron, setup, personai, memory, audit, etc.)
- `src/utils/` — Terminal helpers, notifications
- `tests/` — Vitest test suite (mirrors `src/` structure)

## Guidelines

- **TypeScript strict mode** — no `any`, all types must be explicit or inferred.
- **File naming** — kebab-case (e.g. `my-module.ts`).
- **File size** — keep files under 500 lines. Split if needed.
- **No unnecessary deps** — only add a dependency if there's no reasonable built-in alternative.
- **Test your changes** — run `npm test` and `npm run lint` before submitting.
- **Config uses `engines` array** — no top-level `engine`/`model`. The first entry in `engines` is the primary.

## Pull Requests

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run `npm run lint` and `npm test` to ensure everything passes.
4. Open a PR with a clear description of what changed and why.

## Adding a New Engine

1. Add the engine name to `EngineName` in `src/core/types.ts`.
2. Add default model to `DEFAULT_MODELS` in `src/core/config.ts`.
3. Add the engine name to `ALL_ENGINES` in `src/core/config.ts`.
4. Add the engine config to `src/engines/registry.ts` (command, buildArgs, model, flags).
5. Add the CLI command name to `ENGINE_COMMANDS` in `src/cli/setup.ts`.
6. Add pricing to `PRICING` in `src/core/cost.ts`.
7. Add tests in `tests/engines/registry.test.ts`.
8. Run `npm run lint` and `npm test` to verify.

## Reporting Issues

Open an issue with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your Node.js version (`node -v`)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
