# CLIClaw Documentation

Complete technical reference for CLIClaw — an autonomous AI agent loop runner.

## Quick Links

- **[Why CLIClaw?](why-cliclaw.md)** — Philosophy, comparison with OpenClaw
- **[Architecture](architecture.md)** — System design and code structure
- **[Configuration](configuration.md)** — Config files, environment variables, project setup
- **[Meta Files](meta-files.md)** — Prompt composition system
- **[Agents](agents.md)** — Agent registry, runner, parallel execution
- **[Autonomous Loop](autonomous-loop.md)** — Loop behavior, adaptive sleep, rotation
- **[Memory](memory.md)** — Vector memory and semantic search
- **[Features](features.md)** — Cost tracking, secrets, boundaries, hooks, snapshots
- **[Commands](commands.md)** — All CLI commands reference
- **[Development](development.md)** — Testing, Makefile, contributing

## Getting Started

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/cliclaw/cliclaw/main/install.sh | bash

# Setup
cliclaw setup

# Start the loop
cliclaw cron
```

## Core Concepts

**Project-driven** — One loop per repo, isolated state and memory

**Multi-agent** — 6 AI CLI tools supported (Kiro, Claude, Cursor, Codex, Gemini, Copilot)

**Zero API keys** — Uses your existing CLI tool subscriptions

**Token-aware** — Builds prompts within budget, tracks costs

**Autonomous** — Adaptive sleep, agent rotation, stall detection

## Quick Reference

| Command          | Purpose                        |
|------------------|--------------------------------|
| `cliclaw cron`   | Start autonomous loop          |
| `cliclaw chat`   | Interactive documentation chat |
| `cliclaw setup`  | Setup wizard                   |
| `cliclaw status` | Show state and stats           |
| `cliclaw memory` | View/search memory             |
| `cliclaw audit`  | Audit report from logs         |

See [Commands](commands.md) for full reference.
