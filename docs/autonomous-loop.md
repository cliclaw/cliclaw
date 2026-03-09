# Autonomous Loop

The cron loop (`src/cli/cron.ts`) is the heart of CLIClaw's autonomous operation.

## Cycle Flow

1. **Idle** — Optional pause before starting (`idleBeforeStart` seconds)
2. **Lock** — Acquire singleton lock (prevents duplicate instances)
3. **Snapshot** — Save state before the cycle (every `snapshotEvery` cycles)
4. **Hooks** — Run `preCycle` scripts
5. **Build prompt** — Compose from meta files + task focus (boot.md injected on cycle 1 only)
6. **Diff check** — Skip if prompt hash matches last cycle
7. **Execute** — Spawn the AI agent (or log in dry-run mode)
8. **Signals** — Parse agent signals (`[EXIT CLICLAW]`, `[SKIP CYCLE]`, `[STALL RESET]`) from output
9. **Track** — Record cost, tokens, duration
10. **Memory** — Extract and save any `MEMORY_APPEND` blocks from agent output
11. **Hooks** — Run `onSuccess`/`onFailure` + `postCycle` scripts
12. **Sleep** — Adaptive sleep (exponential backoff on stalls, reset on progress)
13. **Rotate** — Switch to next configured agent after `agentRotateAfter` consecutive failures

## Adaptive Sleep

- **Normal**: `sleepNormal` seconds (default 60)
- **After failure**: `sleepAfterFailure` seconds (default 90)
- **Stall detection**: exponential backoff `baseSleep * stallBackoffMultiplier^stallCycles`, capped at `stallBackoffCap`x
- **Progress resets** the backoff counter

## Agent Rotation

After `agentRotateAfter` consecutive failures (default 3) with the current agent, CLIClaw rotates to the next agent in the configured `agents` array. This prevents getting stuck when one agent is down or rate-limited.

## Output Stall Detection

CLIClaw monitors the agent's stdout byte rate. If no new output arrives within `outputStallTimeout` seconds (default 600), the agent is force-killed with `SIGTERM` → `SIGKILL`.

This catches a common failure mode: the agent runs a shell command that hangs silently (e.g. a piped command where the reader never gets EOF), producing no output while the overall `agentTimeout` (24h) would otherwise let it sit indefinitely.

### Root cause of pipe hangs in non-TTY environments

AI agents are spawned without a TTY (`stdio: pipe`). When the agent then runs a shell command like `make e2e-bdd 2>&1 | tail -30`, the following can happen:

1. The subprocess (Playwright, make, etc.) detects no TTY and buffers stdout aggressively
2. `tail -30` waits for EOF from the pipe, but the subprocess never closes its end
3. The agent's tool call never returns — the cycle is stuck

### Recommended patterns for `tools.md`

```markdown
## Shell Command Guidelines
- Avoid `cmd | tail -N` or `cmd | head -N` for long-running processes — use `cmd > /tmp/out.txt && tail -N /tmp/out.txt` instead
- Prefer `cmd 2>&1 | tee /tmp/out.txt` over bare pipes when you need to capture and display output
- For test runners, redirect to a file first: `make test > /tmp/test.out 2>&1; tail -50 /tmp/test.out`
```

## Agent Signals

Agent signals are special directives the AI can embed anywhere in its response to control the CLIClaw loop. They give the AI agency over the loop itself — it can declare work done, skip unnecessary cycles, or clear a stall.

| Signal           | Effect                                                                                          |
|------------------|-------------------------------------------------------------------------------------------------|
| `[EXIT CLICLAW]` | Gracefully terminate the loop after the current cycle completes (runs `onSuccess` hooks first)  |
| `[SKIP CYCLE]`   | Skip hooks and sleep for this cycle — useful when the agent detects nothing to do               |
| `[STALL RESET]`  | Reset the stall counter — use when the agent has made real progress that the loop didn't detect |

### How to use them

Instruct the AI in your `.cliclaw/meta/identity.md` or project prompt when to emit these signals:

```markdown
When you have completed all outstanding tasks and there is nothing left to do,
write [EXIT CLICLAW] at the end of your response.

If you inspect the codebase and find no actionable work this cycle,
write [SKIP CYCLE] to avoid unnecessary hooks and sleep delay.
```

Signals are detected in the parsed text output (after JSON decoding for agents like cursor/claude/gemini), so they work across all agents.
