# Configuration

CLIClaw uses a cascading configuration system with clear precedence.

## Config Resolution Order

1. CLI arguments (`--engine`, `--model`, `--dry-run`, etc.)
2. Project config (`.cliclaw/config.json`)
3. Environment variables (`CLICLAW_*`)
4. Built-in defaults

## Environment Variables

| Variable                 | Default      | Description                               |
|--------------------------|--------------|-------------------------------------------|
| `CLICLAW_ENGINE`         | `kiro`       | Default engine (used when no config file) |
| `CLICLAW_MODEL`          | (per engine) | Model override                            |
| `CLICLAW_PROJECT_ROOT`   | `cwd`        | Project root directory                    |
| `CLICLAW_MAX_LOOP`       | `0`          | Max loop cycles (0 = unlimited)           |
| `CLICLAW_SLEEP`          | `60`         | Sleep between cycles (seconds)            |
| `CLICLAW_SLEEP_FAIL`     | `90`         | Sleep after failure (seconds)             |
| `CLICLAW_TIMEOUT`        | `3600`       | Agent timeout per cycle (seconds)         |
| `CLICLAW_FRESH_EVERY`    | `3`          | Start fresh session every N cycles        |
| `CLICLAW_TOKEN_BUDGET`   | `8000`       | Max tokens per prompt (0 = unlimited)     |
| `CLICLAW_MAX_CONCURRENT` | `2`          | Max parallel engines                      |
| `CLICLAW_DRY_RUN`        | `false`      | Preview prompts without running agents    |

## Project Config (`.cliclaw/config.json`)

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

### Engine Entry Fields

- `engine` — Engine name (`kiro`, `claude`, `cursor`, `codex`, `aider`, `gemini`, `copilot`)
- `model` — Model to use (defaults to engine's default if omitted)
- `alias` — Unique name for this instance (required when using duplicate engines)
- `focus` — Focus area for parallel execution (e.g. `"frontend"`, `"backend"`)
- `identity` — Path to identity file relative to `projectRoot` (e.g. `".cliclaw/meta/identity-reviewer.md"`)

### Optional Top-Level Fields

| Field                      | Default | Description                                                          |
|----------------------------|---------|----------------------------------------------------------------------|
| `maxLoop`                  | `0`     | Max cycles before stopping (0 = unlimited)                           |
| `sleepNormal`              | `60`    | Seconds to sleep after a successful cycle                            |
| `idleBeforeStart`          | `0`     | Seconds to pause before the loop starts (0 = no pause)               |
| `agentTimeout`             | `3600`  | Max seconds a single cycle can run before force-kill                 |
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
