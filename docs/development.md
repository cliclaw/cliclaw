# Development

Guide for contributing to CLIClaw and working with the codebase.

## Testing

Tests use vitest with v8 coverage:

```bash
npm test                # Run all tests
npm run test:coverage   # Run with coverage report
```

**Stats:** 28 test files, 326 tests, ~93% statement coverage, ~95% line coverage

## Makefile (Development)

When working from source, the Makefile wraps all commands:

| Target                        | Description                            |
|-------------------------------|----------------------------------------|
| `make cron`                   | Start the loop                         |
| `make cron ENGINE=cursor`     | Use a specific engine                  |
| `make cron DRY_RUN=1`         | Dry-run mode                           |
| `make cron FOCUS="task"`      | Focus on a task                        |
| `make setup`                  | Setup wizard                           |
| `make identity`               | Agent identity config                  |
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

## Code Standards

- **Strict TypeScript**: `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` — no `any` type anywhere
- **File naming**: kebab-case (`my-module.ts`)
- **Max file size**: 500–1000 lines per file
- **Style**: Functional, early returns, minimal abstractions
- **Dependencies**: Node.js built-ins only (`fs`, `path`, `child_process`, `readline`, `crypto`)
- **Modules**: ESM (`"type": "module"` in package.json, `.js` extensions in imports)

## Feature Development Rules

Every new feature or change **must**:

1. **Have tests** — Write test cases in `tests/` covering the new behavior. Run `npm test` and confirm all pass.
2. **Be documented** — Update `docs/` with relevant sections. Update `README.md` if it affects user-facing commands. Update `AGENTS.md` if it changes architecture or conventions.
3. **Pass the build** — Run `make build` (or `npx tsc --noEmit`) and confirm zero TypeScript errors.

No feature is complete until all three are done.

## Adding a New Command

1. Create `src/cli/my-command.ts`
2. Add help text constant:

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

3. Register in `src/index.ts`:

   ```typescript
   import { myCommand } from "./cli/my-command.js";

   const commands: Record<string, CommandFn> = {
     // ...
     mycommand: myCommand,
   };
   ```

4. Add to help text in `src/index.ts`
5. Write tests in `tests/cli/my-command.test.ts`
6. Document in `docs/commands.md`

## Project Structure

See [Architecture](architecture.md) for full directory structure.

Key files:

- `src/index.ts` — Entry point + command router (keep minimal)
- `src/core/types.ts` — All type definitions
- `src/core/config.ts` — Configuration cascade
- `src/engines/registry.ts` — Engine definitions
- `src/prompts/builder.ts` — Prompt composition

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
