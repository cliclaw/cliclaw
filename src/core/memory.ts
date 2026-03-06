/**
 * Memory management — persistent MEMORY.md with trim/append/read.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logInfo } from "./logger.js";
import { indexMemoryEntry, rebuildVectorIndex } from "./vectors.js";

const MAX_LINES = 1100;
const KEEP_HEAD = 80;
const KEEP_TAIL = 850;

const MEMORY_TEMPLATE = `# CLIClaw Memory
Persistent notes, learned patterns, recurring issues, model behavior, and workflow heuristics.

## Rules for this file
- Keep under ~1200-1500 tokens if possible
- Append only important durable facts
- Prefix new entries with date + short category
`;

export function initMemory(memoryFile: string): void {
  mkdirSync(dirname(memoryFile), { recursive: true });
  if (!existsSync(memoryFile)) {
    writeFileSync(memoryFile, MEMORY_TEMPLATE);
    logInfo("Initialized fresh MEMORY.md");
  }
}

export function readMemorySnippet(memoryFile: string, tailLines = 40): string {
  if (!existsSync(memoryFile)) return "(no persistent memory yet)";
  const lines = readFileSync(memoryFile, "utf-8").split("\n");
  const templatePatterns = /^-?\s*(Persistent notes|Keep under|Append only|Prefix new entries|Rules for this file)/i;
  const filtered = lines
    .slice(-tailLines)
    .filter((l) => !l.startsWith("#"))
    .filter((l) => !templatePatterns.test(l))
    .filter((l) => l.trim() !== "")
    .slice(-30)
    .join("\n")
    .trim();
  return filtered || "(no persistent memory yet)";
}

export function readFullMemory(memoryFile: string): string {
  if (!existsSync(memoryFile)) return "(no persistent memory yet)";
  return readFileSync(memoryFile, "utf-8");
}

export function appendToMemory(memoryFile: string, entry: string, maxLines = MAX_LINES, keepHead = KEEP_HEAD, keepTail = KEEP_TAIL): void {
  if (!entry.trim()) return;
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const block = `\n## ${now} — agent\n${entry}\n`;
  try {
    const existing = existsSync(memoryFile) ? readFileSync(memoryFile, "utf-8") : MEMORY_TEMPLATE;
    writeFileSync(memoryFile, existing + block);
    trimMemory(memoryFile, maxLines, keepHead, keepTail);
    indexMemoryEntry(dirname(memoryFile), entry, new Date().toISOString());
    logInfo("Appended to MEMORY.md");
  } catch {
    logInfo("WARNING: Failed to append to MEMORY.md");
  }
}

export function trimMemory(memoryFile: string, maxLines = MAX_LINES, keepHead = KEEP_HEAD, keepTail = KEEP_TAIL): void {
  if (!existsSync(memoryFile)) return;
  const lines = readFileSync(memoryFile, "utf-8").split("\n");
  if (lines.length <= maxLines) return;

  const head = lines.slice(0, keepHead);
  const tail = lines.slice(-keepTail);
  writeFileSync(memoryFile, [...head, "", "<!-- trimmed -->", "", ...tail].join("\n"));
  logInfo(`Trimmed MEMORY.md (was ${lines.length} lines)`);
}

export function extractMemoryAppend(output: string): string {
  const match = output.match(/<!--\s*MEMORY_APPEND\s*\n([\s\S]*?)\n\s*-->/);
  const entry = match?.[1]?.trim() ?? "";
  // Reject unfilled template placeholders
  if (!entry || entry.includes("your concise") || entry.includes("high-value insight here")) return "";
  return entry;
}

export function getMemoryStats(memoryFile: string): { lines: number; tokens: number } {
  if (!existsSync(memoryFile)) return { lines: 0, tokens: 0 };
  const content = readFileSync(memoryFile, "utf-8");
  const lines = content.split("\n").length;
  const tokens = Math.ceil(content.length / 4);
  return { lines, tokens };
}

export function rebuildMemoryIndex(memoryFile: string): void {
  if (!existsSync(memoryFile)) return;
  const content = readFileSync(memoryFile, "utf-8");
  rebuildVectorIndex(dirname(memoryFile), content);
  logInfo("Rebuilt vector index from MEMORY.md");
}
