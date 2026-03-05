/**
 * Engine registry — defines how each AI CLI agent is invoked.
 */

import { execSync } from "node:child_process";
import type { EngineConfig, EngineName, EngineRunOpts } from "../core/types.js";

/** Parse cursor stream-json: collect full assistant text messages (those with model_call_id) */
function parseCursorOutput(stdout: string): string {
  const parts: string[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj["type"] === "assistant" && obj["model_call_id"]) {
        const msg = obj["message"] as { content?: Array<{ type: string; text?: string }> } | undefined;
        const text = msg?.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("") ?? "";
        if (text) parts.push(text);
      }
    } catch { /* skip non-JSON lines */ }
  }
  return parts.join("\n") || stdout;
}

/** Parse claude stream-json: extract text_delta events or fall back to result field */
function parseClaudeOutput(stdout: string): string {
  // Try stream-json format first
  const parts: string[] = [];
  let hasStreamEvents = false;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (obj["type"] === "stream_event") {
        hasStreamEvents = true;
        const event = obj["event"] as { delta?: { type?: string; text?: string } } | undefined;
        if (event?.delta?.type === "text_delta" && event.delta.text) {
          parts.push(event.delta.text);
        }
      } else if (obj["type"] === "result" && typeof obj["result"] === "string") {
        return obj["result"] as string;
      }
    } catch { /* skip */ }
  }
  if (hasStreamEvents && parts.length > 0) return parts.join("");
  // Try plain json format
  try {
    const obj = JSON.parse(stdout.trim()) as Record<string, unknown>;
    if (typeof obj["result"] === "string") return obj["result"] as string;
  } catch { /* not json */ }
  return stdout;
}

/** Parse gemini json output: extract .response field */
function parseGeminiOutput(stdout: string): string {
  try {
    const obj = JSON.parse(stdout.trim()) as Record<string, unknown>;
    if (typeof obj["response"] === "string") return obj["response"] as string;
  } catch { /* not json */ }
  return stdout;
}

const engines: Record<EngineName, EngineConfig> = {
  kiro: {
    name: "kiro",
    command: "kiro-cli",
    model: "claude-opus-4.6",
    timeout: 86400,
    supportsResume: true,
    lenientExit: true,
    stdinPrompt: false,
    buildArgs: (opts: EngineRunOpts) => {
      const args = ["chat", "--no-interactive", "--trust-all-tools", "--model", opts.model];
      if (opts.resume) args.push("--resume");
      args.push(opts.prompt);
      return args;
    },
  },
  claude: {
    name: "claude",
    command: "claude",
    model: "claude-sonnet-4-20250514",
    timeout: 86400,
    supportsResume: true,
    lenientExit: true,
    stdinPrompt: false,
    parseOutput: parseClaudeOutput,
    buildArgs: (opts: EngineRunOpts) => {
      const args = ["--dangerously-skip-permissions", "--model", opts.model, "--output-format", "stream-json", "--verbose"];
      if (opts.resume) args.push("--continue");
      args.push("-p", opts.prompt);
      return args;
    },
  },
  cursor: {
    name: "cursor",
    command: "agent",
    model: "gpt-5.2-high",
    timeout: 86400,
    supportsResume: true,
    lenientExit: false,
    stdinPrompt: true,
    parseOutput: parseCursorOutput,
    buildArgs: (opts: EngineRunOpts) => {
      const args = [
        "--yolo", "--model", opts.model, "--trust", "-p",
        "--output-format", "stream-json", "--stream-partial-output",
      ];
      if (opts.resume) args.push("--continue");
      return args;
    },
  },
  codex: {
    name: "codex",
    command: "codex",
    model: "o4-mini",
    timeout: 86400,
    supportsResume: false,
    lenientExit: false,
    stdinPrompt: false,
    buildArgs: (opts: EngineRunOpts) => {
      return ["--model", opts.model, "--full-auto", "--quiet", opts.prompt];
    },
  },
  aider: {
    name: "aider",
    command: "aider",
    model: "sonnet",
    timeout: 86400,
    supportsResume: false,
    lenientExit: true,
    stdinPrompt: false,
    buildArgs: (opts: EngineRunOpts) => {
      return ["--model", opts.model, "--yes-always", "--message", opts.prompt];
    },
  },
  gemini: {
    name: "gemini",
    command: "gemini",
    model: "gemini-2.5-pro",
    timeout: 86400,
    supportsResume: false,
    lenientExit: true,
    stdinPrompt: false,
    parseOutput: parseGeminiOutput,
    buildArgs: (opts: EngineRunOpts) => {
      return ["--model", opts.model, "--output-format", "json", "-p", opts.prompt];
    },
  },
  copilot: {
    name: "copilot",
    command: "copilot",
    model: "gpt-4.1",
    timeout: 86400,
    supportsResume: false,
    lenientExit: true,
    stdinPrompt: false,
    buildArgs: (opts: EngineRunOpts) => {
      return ["-p", opts.prompt, "--model", opts.model];
    },
  },
};

export function getEngine(name: EngineName): EngineConfig {
  const engine = engines[name];
  if (!engine) throw new Error(`Unknown engine: ${name}`);
  return engine;
}

export function getAllEngines(): EngineConfig[] {
  return Object.values(engines);
}

export function isEngineAvailable(name: EngineName): boolean {
  const engine = engines[name];
  if (!engine) return false;
  try {
    execSync(`command -v ${engine.command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
