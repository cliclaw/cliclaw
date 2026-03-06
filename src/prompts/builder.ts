/**
 * Prompt builder — composes the agent prompt from meta files + memory + state.
 * Priority order: memory → you → projects → identity → tools → boundaries → boot
 * Features: token budget, prompt diff, secret scanning, content cleaning.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readMemorySnippet } from "../core/memory.js";
import { readState } from "../core/state.js";
import { scanAndRedact } from "../core/secrets.js";
import { estimateTokens } from "../core/cost.js";
import { logInfo, logWarn } from "../core/logger.js";
import type { ClawConfig, EngineEntry } from "../core/types.js";

function readFileOr(path: string, fallback: string): string {
  if (!existsSync(path)) return fallback;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return fallback;
  }
}

/** Strip content that wastes tokens: markdown title headers, HTML comments, empty placeholders, boilerplate descriptions */
function cleanMetaContent(raw: string): string {
  return raw
    .split("\n")
    // Remove top-level title (# Title) — we add our own section headers
    .filter((line) => !line.match(/^# /))
    // Remove HTML comment lines (template hints like <!-- e.g. ... -->)
    .filter((line) => !line.match(/^\s*<!--.*-->\s*$/))
    // Remove empty placeholder fields (e.g. "- **Name**: " with no value)
    .filter((line) => !line.match(/^-\s+\*\*\w+\*\*:\s*$/))
    // Remove boilerplate description lines
    .filter((line) => !line.match(/^(Describe who you are|List your active projects|This file defines|Persistent notes, learned patterns)/i))
    // Demote ## to ### so they don't clash with our section headers
    .map((line) => line.match(/^## /) ? "#" + line : line)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Check if content is just boilerplate with no real user data */
function isOnlyTemplate(cleaned: string): boolean {
  const meaningful = cleaned
    .split("\n")
    .filter((l) => l.trim() !== "")
    .filter((l) => !l.startsWith("##"));
  return meaningful.length === 0;
}

function truncate(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n<!-- truncated -->";
}

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

function diffAwareSection(
  content: string,
  label: string,
  maxTokens: number,
  lastHash: string | undefined,
): string {
  const hash = hashPrompt(content);
  if (lastHash && hash === lastHash) return `(${label}: unchanged since last cycle)`;
  return truncate(content, maxTokens);
}

export function buildPrompt(config: ClawConfig, enableDiff = false, cycle = 0, activeEngine?: EngineEntry): string {
  const { paths } = config;

  const identityPath = activeEngine?.identity
    ? resolve(config.projectRoot, activeEngine.identity)
    : paths.identityFile;

  const memory = readMemorySnippet(paths.memoryFile);
  const youRaw = cleanMetaContent(readFileOr(paths.youFile, ""));
  const projectsRaw = cleanMetaContent(readFileOr(paths.projectsFile, ""));
  const boundariesRaw = cleanMetaContent(readFileOr(paths.boundariesFile, ""));
  const identityRaw = cleanMetaContent(readFileOr(identityPath, ""));
  const toolsRaw = cleanMetaContent(readFileOr(paths.toolsFile, ""));
  const bootRaw = cleanMetaContent(readFileOr(paths.bootFile, ""));

  const lastSuccess = readState("lastSuccess") ?? "never";
  const lastHash = enableDiff ? (readState("lastPromptHash") as string | undefined) : undefined;

  const budgets = config.promptBudgets;
  const parts: string[] = [];

  // Header
  parts.push(config.promptHeader);
  parts.push(`\nLast successful cycle: ${lastSuccess}`);

  // Memory (highest priority)
  if (memory && memory !== "(no persistent memory yet)") {
    parts.push("\n## Persistent Memory\n" + truncate(memory, budgets.memory));
  }

  // User context
  if (youRaw && !isOnlyTemplate(youRaw)) {
    parts.push("\n## About the User\n" + diffAwareSection(youRaw, "User", budgets.you, lastHash));
  }

  // Projects
  if (projectsRaw && !isOnlyTemplate(projectsRaw)) {
    parts.push("\n## Projects\n" + diffAwareSection(projectsRaw, "Projects", budgets.projects, lastHash));
  }

  // Identity (agent persona + tone)
  if (identityRaw && !isOnlyTemplate(identityRaw)) {
    parts.push("\n## Agent Identity\n" + truncate(identityRaw, budgets.identity));
  }

  // Boundaries
  if (boundariesRaw && !isOnlyTemplate(boundariesRaw)) {
    parts.push("\n## Boundaries\n" + truncate(boundariesRaw, budgets.boundaries));
  }

  // Tools
  if (toolsRaw && !isOnlyTemplate(toolsRaw)) {
    parts.push("\n## Available Tools\n" + truncate(toolsRaw, budgets.tools));
  }

  // Boot instructions — only injected on cycle 1
  if (cycle === 1 && bootRaw && !isOnlyTemplate(bootRaw)) {
    parts.push("\n## Boot Instructions (first cycle only)\n" + truncate(bootRaw, budgets.boot));
  }

  // Focus
  if (config.focusFilter) {
    parts.push(`\n## Focus\nFocus on: ${config.focusFilter}\nPrioritize tasks and context related to this focus area.`);
  }

  // Instructions
  parts.push(`
## Instructions
- Review the repository and continue working on the highest-priority task.
- If no tasks are defined, look for TODOs, failing tests, or improvements to make.
- Work incrementally — complete one meaningful unit of work per cycle.
- If you learned something durable, output exactly:
<!-- MEMORY_APPEND
your concise insight here (replace this line)
-->`);

  let prompt = parts.join("\n");

  // Secret scanning
  const scan = scanAndRedact(prompt);
  if (scan.redacted > 0) {
    logWarn(`Secret scan: redacted ${scan.redacted} potential secrets`);
    prompt = scan.clean;
  }

  // Global token budget
  if (config.tokenBudget > 0) {
    const tokens = estimateTokens(prompt);
    if (tokens > config.tokenBudget) {
      logWarn(`Prompt exceeds budget (${tokens} > ${config.tokenBudget}), truncating`);
      prompt = prompt.slice(0, config.tokenBudget * 4) + "\n<!-- truncated: budget exceeded -->";
    }
  }

  return prompt;
}

export function estimatePromptTokens(prompt: string): number {
  return estimateTokens(prompt);
}

export function logPromptStats(prompt: string): void {
  logInfo(`Prompt: ~${estimateTokens(prompt)} tokens, hash=${hashPrompt(prompt)}`);
}
