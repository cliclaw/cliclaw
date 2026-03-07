# Why CLIClaw?

CLIClaw was born out of a simple frustration: I already pay for Cursor Pro and Kiro — why should I need *another* LLM API key and *another* billing account just to run an autonomous coding loop?

OpenClaw is a powerful autonomous agent framework, but it operates at the LLM provider level. You bring your own API keys (OpenAI, Anthropic, etc.), configure model routing, manage token budgets across providers, and run it as a general-purpose agent runtime. It connects to messaging platforms (Telegram, Discord, WhatsApp), supports tool sandboxing, browser automation, and multi-channel orchestration. It's designed to be a full AI assistant platform.

CLIClaw is not that. CLIClaw is a **project-driven production tool**.

The idea is dead simple: you already have AI CLI tools installed and authenticated — `cursor`, `kiro-cli`, `claude`, `codex`, `aider`, `gemini`, `copilot`. You're already paying for them. CLIClaw just puts them in a loop and points them at your codebase.

## What makes CLIClaw different

- **Zero API keys needed** — CLIClaw piggybacks on your existing CLI tool subscriptions. If `kiro-cli` or `cursor` works in your terminal, CLIClaw can use it. No provider setup, no API key management, no separate billing.
- **Project-first, not platform-first** — CLIClaw doesn't try to be a general AI assistant. It does one thing: run coding agents against your repo in a loop until work gets done. Every feature (memory, persona, cost tracking, hooks) exists to make that loop smarter.
- **Multi-engine out of the box** — 7 engines supported. If one goes down or gets rate-limited, CLIClaw rotates to the next. Run them in parallel on different parts of your codebase.
- **Lightweight and local** — No Docker, no server, no database. One `curl | bash` install, runs from your terminal. State is plain JSON and Markdown files in `.cliclaw/`.
- **Cost-aware without being the billing layer** — CLIClaw estimates costs per cycle based on token counts and model pricing, but it doesn't manage API spend — your CLI tools handle that. You get visibility without complexity.
- **File-based vector memory** — Semantic search over your memory entries using TF-IDF, stored as plain JSON. No embedding APIs, no vector databases. `cliclaw memory search "query" --semantic` finds relevant entries by meaning, not just keyword matching.

## CLIClaw vs OpenClaw

OpenClaw is a full autonomous agent platform — and a great one. Here's how CLIClaw takes a different approach to similar problems:

| Capability         | OpenClaw                                            | CLIClaw                                                                                                 |
|--------------------|-----------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| **LLM access**     | Direct API keys to 12+ providers with model routing | Piggybacks on your existing CLI tools — zero API setup, zero extra billing                              |
| **Messaging**      | Telegram, Discord, WhatsApp, Slack                  | Terminal-native — one project, one loop, full focus. No chat noise, no context switching                |
| **Tool execution** | Sandboxed runtime for browser, files, web           | Delegates to the AI engine itself — Cursor, Claude, Kiro already have tool use built in                 |
| **Multi-channel**  | Manages conversations across platforms              | One persona per project. Each repo gets its own memory, config, and AI personality — isolated by design |
| **Memory**         | Vector-based with embedding APIs                    | File-based TF-IDF vectors — semantic search with zero API calls, zero cost, works offline               |
| **Dashboard**      | Web UI for monitoring                               | `cliclaw status`, `cliclaw audit` — everything in the terminal, scriptable, pipe-friendly               |
| **Deployment**     | Docker, VPS, always-on server                       | `curl \| bash` and done. Runs from your laptop. No infrastructure to maintain                           |

**In short**: OpenClaw is a full autonomous agent platform. CLIClaw is a cron job that makes your existing AI coding tools work harder while you sleep.
