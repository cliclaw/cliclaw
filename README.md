<p align="center">
  <img src="logo.jpg" alt="CLIClaw" width="200" />
</p>

# CLIClaw

Autonomous AI agent loop runner — multi-engine, token-aware, cost-effective.

Run AI coding agents (Kiro, Claude, Cursor, Codex, Aider, Gemini, Copilot) in a continuous loop on any project. CLIClaw builds context-aware prompts, tracks costs, rotates engines on failure, and keeps your codebase moving forward autonomously.

## Why CLIClaw?

You already pay for Cursor, Kiro, Claude — CLIClaw just puts them in a loop and points them at your codebase. No extra API keys, no extra billing. See [DETAILED.md](DETAILED.md#why-cliclaw) for the full story and comparison with OpenClaw.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/cliclaw/cliclaw/main/install.sh | bash
```

Requires Node.js 18+ and git. Installs to `~/.cliclaw/bin/`.

## Quick Start

```bash
cd your-project/
cliclaw setup         # One-time interactive setup
cliclaw cron          # Start the autonomous loop
```

That's it. CLIClaw will continuously prompt your chosen AI engine to work on the project, track progress, manage memory, and adapt when things stall.

## Commands

```bash
cliclaw cron [focus]     Start the autonomous agent loop
cliclaw setup            Interactive setup wizard
cliclaw chat             Interactive chat with the AI (documentation/identity only)
cliclaw identity         Configure agent identity (name, role, tone, expertise)
cliclaw memory           View and optimize persistent memory
cliclaw memory search    Search through memory entries
cliclaw memory search --semantic  Semantic search using vector similarity
cliclaw memory reindex   Rebuild the vector index from MEMORY.md
cliclaw status           Show state, cost, and stats
cliclaw audit [n]        Audit report from logs
cliclaw rollback         Restore state from a snapshot
cliclaw logs [n]         View recent log entries
cliclaw logs --tail      Live-tail the log file
cliclaw clean            Remove temp files
cliclaw upgrade          Upgrade to the latest version
cliclaw help             Show all commands
```

### Options

```bash
cliclaw cron --engine claude       # Use a specific engine
cliclaw cron --dry-run             # Preview prompts without running agents
cliclaw cron --parallel            # Run all configured engines simultaneously
cliclaw cron --focus "fix auth"    # Focus on a specific task
cliclaw cron --max-loop 10         # Limit cycle count (0 = unlimited, default)
cliclaw cron --sleep 30            # Set sleep interval between cycles
cliclaw chat --engine=kiro         # Use specific engine for chat
```

## Configuration

CLIClaw uses an `engines` array as the primary config unit. The first engine is the primary; all are available for parallel execution and rotation.

```json
{
  "engines": [
    { "engine": "kiro", "model": "claude-sonnet-4.6", "alias": "kiro1" },
    { "engine": "kiro", "model": "claude-sonnet-4.6", "alias": "kiro2" },
    { "engine": "cursor", "model": "gpt-5.2-high" }
  ],
  "tokenBudget": 8000,
  "maxConcurrent": 2,
  "hooks": {
    "preCycle": [],
    "postCycle": [],
    "onSuccess": ["npm run lint"],
    "onFailure": []
  }
}
```

When you have duplicate engines (e.g. two kiro instances), give each a unique `alias`. The setup wizard handles this automatically.

## Agent Signals

The AI can embed special signals in its response to control the loop:

| Signal           | Effect                                                   |
|------------------|----------------------------------------------------------|
| `[EXIT CLICLAW]` | Gracefully stop the loop — the AI declares work done     |
| `[SKIP CYCLE]`   | Skip hooks and sleep — nothing to do this cycle          |
| `[STALL RESET]`  | Reset the stall/backoff counter — real progress was made |

Teach your AI when to use them via `.cliclaw/meta/identity.md`. See [DETAILED.md](DETAILED.md#agent-signals) for full documentation.

## Supported Engines

| Engine  | CLI        | Default Model            |
|---------|------------|--------------------------|
| kiro    | `kiro-cli` | claude-opus-4.6          |
| claude  | `claude`   | claude-sonnet-4-20250514 |
| cursor  | `agent`    | gpt-5.2-high             |
| codex   | `codex`    | o4-mini                  |
| aider   | `aider`    | sonnet                   |
| gemini  | `gemini`   | gemini-2.5-pro           |
| copilot | `copilot`  | gpt-4.1                  |

> **Kiro note:** `kiro-cli` may spawn subagents which can cause issues in autonomous loops. To disable subagents, create `~/.kiro/agents/Basic.json`:
>
> ```json
> {
>   "name": "Basic",
>   "description": "",
>   "prompt": null,
>   "mcpServers": {},
>   "tools": ["*"],
>   "toolAliases": {},
>   "allowedTools": [],
>   "resources": [],
>   "hooks": {},
>   "toolsSettings": {
>     "subagent": {
>       "availableAgents": [],
>       "trustedAgents": []
>     }
>   },
>   "useLegacyMcpJson": true,
>   "model": null
> }
> ```
>
> Then set it up as the default agent using in your kiro-cli.
>
> See [kiro#6163](https://github.com/kirodotdev/Kiro/issues/6163) for details.

## How It Works

1. **Setup** — `cliclaw setup` creates a `.cliclaw/` directory in your project with config, meta files, and AI persona settings.
2. **Prompt building** — Each cycle, CLIClaw composes a token-aware prompt from your memory, persona, project context, and task focus.
3. **Agent execution** — The prompt is sent to your chosen AI CLI engine, which works on the codebase.
4. **Progress tracking** — CLIClaw monitors output, tracks costs, detects stalls, and saves state snapshots.
5. **Adaptation** — On repeated failures, it backs off with longer sleep intervals and rotates to the next configured engine.
6. **Loop** — Repeat until the max cycle count is reached or you stop it.

## Testing

```bash
npm test                # Run all tests
npm run test:coverage   # Run with coverage report
```

247 tests across 27 test files. Coverage: ~93% statements, ~95% lines.

## Upgrade

```bash
cliclaw upgrade
```

Or re-run the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/cliclaw/cliclaw/main/install.sh | bash
```

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/cliclaw/cliclaw/main/uninstall.sh | bash
```

This removes the `cliclaw` binary. Project-level `.cliclaw/` directories are left untouched.

## Development

```bash
git clone https://github.com/cliclaw/cliclaw.git
cd cliclaw
npm install
make dev help         # Run any command from source
make build            # Compile TypeScript
npm test              # Run tests
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines and [DETAILED.md](DETAILED.md) for full technical documentation.

## License

[MIT](LICENSE)
