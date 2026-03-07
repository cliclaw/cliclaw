/**
 * `cliclaw memory` — view, optimize, search persistent memory.
 */

import { resolveConfig } from "../core/config.js";
import {
  readFullMemory,
  getMemoryStats,
  trimMemory,
  initMemory,
  rebuildMemoryIndex,
} from "../core/memory.js";
import { searchVectorMemory, getVectorStats } from "../core/vectors.js";
import { ask, confirm, closePrompt } from "../utils/prompt.js";
import { writeFileSync } from "node:fs";
import { dirname } from "node:path";

const TOKEN_THRESHOLD = 800;

const MEMORY_HELP = `
cliclaw memory — View and manage persistent memory

Usage:
  cliclaw memory [command] [options]

Commands:
  (none)                 View memory contents and stats
  search <term>          Text search through memory
  search <term> --semantic  Semantic vector search
  reindex                Rebuild vector index from MEMORY.md

Options:
  --help, -h             Show this help

Examples:
  cliclaw memory                        # View memory
  cliclaw memory search "bug fix"       # Text search
  cliclaw memory search "testing" --semantic  # Semantic search
  cliclaw memory reindex                # Rebuild index
`;

function deduplicateMemory(content: string): string {
  const lines = content.split("\n");
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "" || line.startsWith("<!--")) {
      result.push(line);
      continue;
    }
    const normalized = line.trim().toLowerCase();
    if (normalized.length < 10 || !seen.has(normalized)) {
      seen.add(normalized);
      result.push(line);
    }
  }

  return result.join("\n");
}

function searchMemoryText(content: string, pattern: string): string[] {
  const lines = content.split("\n");
  const regex = new RegExp(pattern, "i");
  const matches: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && regex.test(line)) {
      const start = Math.max(0, i - 1);
      const end = Math.min(lines.length - 1, i + 1);
      const context = lines.slice(start, end + 1).join("\n");
      matches.push(`[line ${i + 1}] ${context}`);
    }
  }

  return matches;
}

export async function memoryCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(MEMORY_HELP);
    return;
  }

  const config = resolveConfig();
  const memoryFile = config.paths.memoryFile;
  const memoryDir = dirname(memoryFile);
  initMemory(memoryFile);

  // Handle subcommands
  if (args[0] === "search" && args[1]) {
    const pattern = args.slice(1).join(" ");
    const isSemantic = args.includes("--semantic");
    const query = args.filter((a) => a !== "--semantic").slice(1).join(" ");

    if (isSemantic) {
      // Semantic vector search
      const results = searchVectorMemory(memoryDir, query);
      console.log(`\n🧠 Semantic search: "${query}"\n`);
      if (results.length === 0) {
        const stats = getVectorStats(memoryDir);
        if (stats.entries === 0) {
          console.log("Vector index is empty. Run: cliclaw memory reindex");
        } else {
          console.log("No relevant matches found.");
        }
      } else {
        for (const { entry, score } of results) {
          const pct = (score * 100).toFixed(1);
          console.log(`  [${pct}%] ${entry.timestamp}`);
          console.log(`  ${entry.text.slice(0, 200)}${entry.text.length > 200 ? "..." : ""}\n`);
        }
      }
    } else {
      // Text search (existing behavior)
      const content = readFullMemory(memoryFile);
      const matches = searchMemoryText(content, pattern);
      console.log(`\n🔎 Memory search: "${pattern}"\n`);
      if (matches.length === 0) {
        console.log("No matches found.");
      } else {
        console.log(`Found ${matches.length} match(es):\n`);
        for (const m of matches) {
          console.log(`  ${m}\n`);
        }
      }
    }
    return;
  }

  if (args[0] === "reindex") {
    rebuildMemoryIndex(memoryFile);
    const stats = getVectorStats(memoryDir);
    console.log(`\n✅ Rebuilt vector index: ${stats.entries} entries, ${stats.terms} unique terms`);
    return;
  }

  // Default: show memory
  const content = readFullMemory(memoryFile);
  const stats = getMemoryStats(memoryFile);
  const vecStats = getVectorStats(memoryDir);

  console.log("\n📝 CLIClaw Memory\n");
  console.log(`Lines: ${stats.lines} | Tokens: ~${stats.tokens} | Vector entries: ${vecStats.entries} (${vecStats.terms} terms)`);
  console.log("─".repeat(60));
  console.log(content);
  console.log("─".repeat(60));

  if (stats.tokens > TOKEN_THRESHOLD) {
    console.log(`\n⚠️  Memory is large (~${stats.tokens} tokens, threshold: ${TOKEN_THRESHOLD})`);
    const optimize = await confirm("Would you like to optimize it?");

    if (optimize) {
      console.log("\nOptimization options:");
      console.log("  1) Deduplicate entries");
      console.log("  2) Trim old entries (keep head + tail)");
      console.log("  3) Both");
      const choice = await ask("> ");

      let optimized = content;

      if (choice === "1" || choice === "3") {
        optimized = deduplicateMemory(optimized);
        console.log("✓ Deduplicated");
      }
      if (choice === "2" || choice === "3") {
        trimMemory(memoryFile);
        console.log("✓ Trimmed");
      }
      if (choice === "1" || choice === "3") {
        writeFileSync(memoryFile, optimized);
      }

      // Rebuild vector index after optimization
      rebuildMemoryIndex(memoryFile);
      console.log("✓ Vector index rebuilt");

      const newStats = getMemoryStats(memoryFile);
      console.log(`\nAfter optimization: ${newStats.lines} lines (~${newStats.tokens} tokens)`);
      console.log(`Saved ~${stats.tokens - newStats.tokens} tokens`);
    }
  } else {
    console.log("\n✅ Memory size is within budget.");
  }

  closePrompt();
}
