import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../src/core/vectors.js", () => ({
  indexMemoryEntry: vi.fn(),
  rebuildVectorIndex: vi.fn(),
}));

import {
  initMemory,
  readMemorySnippet,
  readFullMemory,
  appendToMemory,
  trimMemory,
  extractMemoryAppend,
  getMemoryStats,
  rebuildMemoryIndex,
} from "../src/core/memory.js";

let testDir: string;
let memoryFile: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-mem-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  memoryFile = join(testDir, "MEMORY.md");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("initMemory", () => {
  it("creates memory file with template", () => {
    initMemory(memoryFile);
    expect(existsSync(memoryFile)).toBe(true);
    const content = readFileSync(memoryFile, "utf-8");
    expect(content).toContain("# CLIClaw Memory");
  });

  it("does not overwrite existing file", () => {
    writeFileSync(memoryFile, "custom content");
    initMemory(memoryFile);
    expect(readFileSync(memoryFile, "utf-8")).toBe("custom content");
  });
});

describe("readMemorySnippet", () => {
  it("returns placeholder when no file", () => {
    expect(readMemorySnippet(memoryFile)).toBe("(no persistent memory yet)");
  });

  it("filters out headers and template lines", () => {
    initMemory(memoryFile);
    const snippet = readMemorySnippet(memoryFile);
    // Template-only file should return placeholder
    expect(snippet).toBe("(no persistent memory yet)");
  });

  it("returns actual content lines", () => {
    writeFileSync(memoryFile, "# Memory\n\nSome real content here\nAnother line");
    const snippet = readMemorySnippet(memoryFile);
    expect(snippet).toContain("Some real content here");
  });
});

describe("readFullMemory", () => {
  it("returns placeholder when no file", () => {
    expect(readFullMemory(memoryFile)).toBe("(no persistent memory yet)");
  });

  it("returns full content", () => {
    writeFileSync(memoryFile, "full content here");
    expect(readFullMemory(memoryFile)).toBe("full content here");
  });
});

describe("appendToMemory", () => {
  it("appends entry with timestamp", () => {
    initMemory(memoryFile);
    appendToMemory(memoryFile, "learned something new");
    const content = readFileSync(memoryFile, "utf-8");
    expect(content).toContain("learned something new");
    expect(content).toContain("## ");
  });

  it("does nothing for empty entry", () => {
    initMemory(memoryFile);
    const before = readFileSync(memoryFile, "utf-8");
    appendToMemory(memoryFile, "   ");
    const after = readFileSync(memoryFile, "utf-8");
    expect(after).toBe(before);
  });

  it("creates file if not exists", () => {
    appendToMemory(memoryFile, "new entry");
    const content = readFileSync(memoryFile, "utf-8");
    expect(content).toContain("new entry");
  });
});

describe("trimMemory", () => {
  it("does nothing for small files", () => {
    writeFileSync(memoryFile, "short\ncontent\n");
    trimMemory(memoryFile);
    expect(readFileSync(memoryFile, "utf-8")).toBe("short\ncontent\n");
  });

  it("trims large files", () => {
    const lines = Array.from({ length: 1200 }, (_, i) => `line ${i}`);
    writeFileSync(memoryFile, lines.join("\n"));
    trimMemory(memoryFile);
    const trimmed = readFileSync(memoryFile, "utf-8");
    expect(trimmed).toContain("<!-- trimmed -->");
    expect(trimmed.split("\n").length).toBeLessThan(1200);
  });

  it("does nothing if file doesn't exist", () => {
    trimMemory(memoryFile); // should not throw
  });
});

describe("extractMemoryAppend", () => {
  it("extracts content from MEMORY_APPEND block", () => {
    const output = "some output\n<!-- MEMORY_APPEND\nlearned this thing\n-->\nmore output";
    expect(extractMemoryAppend(output)).toBe("learned this thing");
  });

  it("returns empty string when no block", () => {
    expect(extractMemoryAppend("no memory block here")).toBe("");
  });

  it("rejects unfilled placeholder text", () => {
    const output = "<!-- MEMORY_APPEND\nyour concise insight here (replace this line)\n-->";
    expect(extractMemoryAppend(output)).toBe("");
  });

  it("rejects legacy placeholder text", () => {
    const output = "<!-- MEMORY_APPEND\nyour concise, high-value insight here\n-->";
    expect(extractMemoryAppend(output)).toBe("");
  });

  it("handles extra whitespace around the block", () => {
    const output = "<!--  MEMORY_APPEND  \n  real insight  \n  -->";
    expect(extractMemoryAppend(output)).toBe("real insight");
  });

  it("extracts multi-line entries", () => {
    const output = "<!-- MEMORY_APPEND\nline one\nline two\n-->";
    expect(extractMemoryAppend(output)).toBe("line one\nline two");
  });
});

describe("getMemoryStats", () => {
  it("returns zeros when no file", () => {
    const stats = getMemoryStats(memoryFile);
    expect(stats.lines).toBe(0);
    expect(stats.tokens).toBe(0);
  });

  it("returns line and token counts", () => {
    writeFileSync(memoryFile, "line1\nline2\nline3");
    const stats = getMemoryStats(memoryFile);
    expect(stats.lines).toBe(3);
    expect(stats.tokens).toBeGreaterThan(0);
  });
});

describe("rebuildMemoryIndex", () => {
  it("does nothing when file doesn't exist", () => {
    rebuildMemoryIndex(memoryFile); // should not throw
  });

  it("calls rebuildVectorIndex when file exists", async () => {
    const { rebuildVectorIndex } = await import("../src/core/vectors.js");
    writeFileSync(memoryFile, "# Memory\n## Entry\nsome content");
    rebuildMemoryIndex(memoryFile);
    expect(rebuildVectorIndex).toHaveBeenCalled();
  });
});
