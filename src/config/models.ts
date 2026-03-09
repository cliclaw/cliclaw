import type { AgentName } from "../core/types.js";

export const AGENT_MODELS: Record<AgentName, string[]> = {
  kiro: [
    "claude-opus-4.6",
    "claude-sonnet-4.6",
    "claude-opus-4.5",
    "claude-sonnet-4.5",
    "claude-sonnet-4",
    "claude-haiku-4.5",
    "gpt-4o",
    "gpt-4o-mini",
    "o1",
    "o1-mini"
  ],
  claude: [
    "claude-opus-4-20250514",
    "claude-sonnet-4-20250514",
    "claude-3-7-sonnet-20250219",
    "claude-3-5-haiku-20241022"
  ],
  cursor: [
    "claude-sonnet-4",
    "gpt-4o",
    "gpt-4o-mini",
    "o1-preview",
    "o1-mini"
  ],
  codex: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo"
  ],
  gemini: [
    "gemini-2.0-flash-exp",
    "gemini-exp-1206",
    "gemini-2.0-flash-thinking-exp-01-21",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ],
  copilot: [
    "gpt-4o",
    "o1-preview",
    "o1-mini",
    "claude-sonnet-4"
  ]
};

export const DEFAULT_MODELS: Record<AgentName, string> = {
  kiro: "claude-sonnet-4.5",
  claude: "claude-sonnet-4-20250514",
  codex: "gpt-4o",
  gemini: "gemini-2.0-flash-exp",
  copilot: "gpt-4o",
  cursor: "claude-sonnet-4",
};

export const AGENT_COMMANDS: Record<AgentName, string> = {
  kiro: "kiro-cli",
  claude: "claude",
  cursor: "agent",
  codex: "codex",
  gemini: "gemini",
  copilot: "copilot",
};
