/**
 * Engine registry — defines how each AI CLI agent is invoked.
 */

import { execSync } from "node:child_process";
import type { EngineConfig, EngineName, EngineRunOpts } from "../core/types.js";

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
    buildArgs: (opts: EngineRunOpts) => {
      const args = ["--dangerously-skip-permissions", "--model", opts.model];
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
    buildArgs: (opts: EngineRunOpts) => {
      return ["--model", opts.model, "-p", opts.prompt];
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
