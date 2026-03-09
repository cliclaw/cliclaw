# Features

CLIClaw includes several features to make autonomous operation safer, more observable, and more controllable.

## Cost Tracking

`src/core/cost.ts` contains per-model pricing (USD per 1M tokens):

- Tracks input/output tokens and estimated cost per cycle
- Cumulative cost displayed in `cliclaw status` and heartbeat
- Cost data persisted in state for audit reports

View costs:

```bash
cliclaw status    # Current cumulative cost
cliclaw audit     # Per-cycle cost breakdown
```

## Secret Scanning

`src/core/secrets.ts` scans prompts before sending to any agent:

- AWS access keys and secret keys
- GitHub tokens (`ghp_`, `gho_`, `ghs_`)
- Generic API keys and bearer tokens
- Private key blocks
- npm tokens, Slack tokens
- Generic password/secret patterns

Detected secrets are redacted before the prompt is sent.

## State & Snapshots

- **State** (`src/core/state.ts`) — JSON file tracking cycle count, last success, failures, cost, prompt hash
- **Snapshots** (`src/core/snapshots.ts`) — Up to 20 state snapshots saved before each cycle
- **Rollback** (`cliclaw rollback`) — Interactive restore from any snapshot

Snapshots are saved every `snapshotEvery` cycles (default 4) and kept up to `maxSnapshots` (default 20).

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

## Singleton Lock

`src/core/lock.ts` uses a lock directory (`.cliclaw/cliclaw.lockdir/`) with a PID file to prevent multiple CLIClaw instances from running on the same project. Stale locks from crashed processes are automatically cleaned up.
