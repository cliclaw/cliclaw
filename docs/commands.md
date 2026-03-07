# Commands

Complete reference for all CLIClaw CLI commands.

## Global Help

```bash
cliclaw --help                # Show all commands
cliclaw -h                    # Same as above
```

Each command supports `--help` for command-specific documentation.

## `cliclaw cron`

Start the autonomous agent loop.

```bash
cliclaw cron [focus] [options]
```

**Arguments:**

- `focus` — Optional task focus (e.g., "fix tests")

**Options:**

- `--engine <name>` — Engine to use (kiro, claude, cursor, etc.)
- `--model <name>` — Model to use
- `--project-root <path>` — Project root directory
- `--max-loop <n>` — Max cycles (0 = unlimited)
- `--sleep <seconds>` — Sleep between cycles
- `--focus <task>` — Task focus
- `--dry-run` — Preview prompts without running
- `--parallel` — Run all configured engines in parallel
- `--continue` — Resume from last prompt

**Examples:**

```bash
cliclaw cron                           # Start with default config
cliclaw cron "fix tests"               # Focus on specific task
cliclaw cron --engine=claude           # Use specific engine
cliclaw cron --dry-run                 # Preview mode
cliclaw cron --parallel --max-loop=5   # Parallel mode, 5 cycles
```

## `cliclaw chat`

Interactive TUI chat session for documentation and identity management.

```bash
cliclaw chat [options]
```

**Options:**

- `--engine <name>` — Use specific engine by alias or name

**Interface:**

```
╭────────────────────────────────────────────────────────────╮
│  🤖 CLIClaw Chat                                            │
│  engine: kiro                                              │
│  history: .cliclaw/tmp/chat-kiro.json                      │
╰────────────────────────────────────────────────────────────╯
  Type /help for commands, /exit or Ctrl+C to quit.

  you> Remember to add E2E tests with Cucumber

  AgentName> Got it. Adding E2E BDD with Cucumber + Gherkin.
```

**Slash Commands:**

- `/clear` — Wipe conversation history
- `/history` — Show timestamped conversation log
- `/help` — List available commands
- `/exit` — Exit chat

**Behavior:**

- Loads all meta files on every turn
- Conversation history persists and auto-resumes
- Agent updates identity file autonomously when needed
- Memory triggers: "Take note", "Remember...", "Don't forget..."
- Documentation-only — will not write code

**Per-engine identity files:**

```json
{
  "engines": [
    { "engine": "kiro", "identity": ".cliclaw/meta/identity-dev.md" },
    { "engine": "claude", "identity": ".cliclaw/meta/identity-reviewer.md" }
  ]
}
```

## `cliclaw setup`

Interactive setup wizard.

```bash
cliclaw setup
```

- Detects available AI CLI tools
- Configures engines and models
- Sets up meta files
- Creates initial configuration

## `cliclaw identity`

Configure agent identity interactively.

```bash
cliclaw identity
```

Prompts for:

- Agent name, role, mission
- Tone and expertise
- Response style
- Coding preferences

Writes to `.cliclaw/meta/identity.md`.

## `cliclaw memory`

View and manage persistent memory.

```bash
cliclaw memory [command] [options]
```

**Commands:**

- `(none)` — View memory contents and stats
- `search <term>` — Text search through memory
- `search <term> --semantic` — Semantic vector search
- `reindex` — Rebuild vector index from MEMORY.md

**Examples:**

```bash
cliclaw memory                        # View memory
cliclaw memory search "bug fix"       # Text search
cliclaw memory search "testing" --semantic  # Semantic search
cliclaw memory reindex                # Rebuild index
```

## `cliclaw status`

Show current state and statistics.

```bash
cliclaw status
```

**Displays:**

- Loop running status
- Cycle count and last success
- Memory stats
- Cost tracking
- Available snapshots

## `cliclaw audit`

Audit report from JSONL logs.

```bash
cliclaw audit [n]
```

**Arguments:**

- `n` — Number of recent events (default: 50)

**Examples:**

```bash
cliclaw audit          # Last 50 events
cliclaw audit 100      # Last 100 events
```

## `cliclaw logs`

View log entries.

```bash
cliclaw logs [n] [options]
```

**Arguments:**

- `n` — Number of recent lines (default: 50)

**Options:**

- `--tail` — Live-tail the log file (Ctrl+C to stop)
- `--json` — Show JSONL log instead of text log

**Examples:**

```bash
cliclaw logs           # Last 50 lines
cliclaw logs 100       # Last 100 lines
cliclaw logs --tail    # Live tail
cliclaw logs --json    # View JSONL log
```

## `cliclaw rollback`

Restore state from a snapshot.

```bash
cliclaw rollback
```

Interactive:

- Lists available snapshots
- Select one to restore

## `cliclaw clean`

Remove temp files and logs.

```bash
cliclaw clean
```

Interactive:

- Removes temp files
- Optionally removes logs
- Optionally removes state

## `cliclaw upgrade`

Upgrade to latest version.

```bash
cliclaw upgrade
```

Runs: `curl -fsSL https://raw.githubusercontent.com/cliclaw/cliclaw/main/install.sh | bash`
