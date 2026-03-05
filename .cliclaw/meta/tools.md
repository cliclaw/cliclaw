# Available Tools

## Version Control

- `git` — standard git CLI
- Active branch: `matic-feature` (do NOT push to origin)

## Build & Test

- `npm run build` — compile TypeScript to `dist/`
- `npm test` — run full Vitest suite
- `npm run test:coverage` — coverage report
- `npm run lint` — type-check only
- `make dev <cmd>` — run any cliclaw command from source via `tsx`

## Runtime

- `node` 18+
- `tsx` for direct TypeScript execution
- `cliclaw` binary (if installed) at `~/.cliclaw/bin/cliclaw`

## Environment Notes

- macOS
- ESM-only project (`"type": "module"` in package.json)
- No `.env` file — config lives in `.cliclaw/config.json`
