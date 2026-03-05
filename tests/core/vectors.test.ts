import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  loadVectorIndex,
  saveVectorIndex,
  indexMemoryEntry,
  searchVectorMemory,
  rebuildVectorIndex,
  getVectorStats,
} from "../src/core/vectors.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-vec-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("loadVectorIndex", () => {
  it("returns empty index when no file", () => {
    const index = loadVectorIndex(testDir);
    expect(index.entries).toEqual([]);
    expect(index.totalDocs).toBe(0);
  });

  it("loads existing index", () => {
    const idx = { entries: [], df: {}, totalDocs: 0 };
    const path = join(testDir, "vectors.json");
    const { writeFileSync } = require("node:fs");
    writeFileSync(path, JSON.stringify(idx));
    const loaded = loadVectorIndex(testDir);
    expect(loaded.totalDocs).toBe(0);
  });

  it("handles corrupted index file", () => {
    const { writeFileSync } = require("node:fs");
    writeFileSync(join(testDir, "vectors.json"), "NOT JSON");
    const loaded = loadVectorIndex(testDir);
    expect(loaded.entries).toEqual([]);
  });
});

describe("saveVectorIndex", () => {
  it("writes index to disk", () => {
    const idx = { entries: [], df: {}, totalDocs: 0 };
    saveVectorIndex(testDir, idx);
    expect(existsSync(join(testDir, "vectors.json"))).toBe(true);
  });
});

describe("indexMemoryEntry", () => {
  it("adds entry to index", () => {
    indexMemoryEntry(testDir, "TypeScript strict mode is important for type safety");
    const index = loadVectorIndex(testDir);
    expect(index.entries.length).toBe(1);
    expect(index.totalDocs).toBe(1);
  });

  it("skips entries with no meaningful tokens", () => {
    indexMemoryEntry(testDir, "a an the is");
    const index = loadVectorIndex(testDir);
    expect(index.entries.length).toBe(0);
  });

  it("accumulates multiple entries", () => {
    indexMemoryEntry(testDir, "TypeScript strict mode helps catch bugs");
    indexMemoryEntry(testDir, "React hooks simplify state management");
    const index = loadVectorIndex(testDir);
    expect(index.entries.length).toBe(2);
    expect(index.totalDocs).toBe(2);
  });
});

describe("searchVectorMemory", () => {
  it("returns empty for empty index", () => {
    const results = searchVectorMemory(testDir, "typescript");
    expect(results).toEqual([]);
  });

  it("finds relevant entries", () => {
    indexMemoryEntry(testDir, "TypeScript strict mode catches type errors at compile time");
    indexMemoryEntry(testDir, "React hooks like useState and useEffect manage component state");
    indexMemoryEntry(testDir, "Docker containers provide isolated runtime environments");

    const results = searchVectorMemory(testDir, "TypeScript type checking");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.entry.text).toContain("TypeScript");
  });

  it("returns empty for stop-word-only queries", () => {
    indexMemoryEntry(testDir, "some content here");
    const results = searchVectorMemory(testDir, "the is a");
    expect(results).toEqual([]);
  });

  it("respects topK limit", () => {
    for (let i = 0; i < 10; i++) {
      indexMemoryEntry(testDir, `entry number ${i} about TypeScript programming language features`);
    }
    const results = searchVectorMemory(testDir, "TypeScript", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});

describe("rebuildVectorIndex", () => {
  it("rebuilds from markdown content", () => {
    const content = [
      "# Memory",
      "## 2026-03-01 12:00 — agent",
      "TypeScript strict mode is essential for catching bugs early",
      "## 2026-03-02 12:00 — agent",
      "React hooks simplify component state management significantly",
    ].join("\n");

    rebuildVectorIndex(testDir, content);
    const index = loadVectorIndex(testDir);
    expect(index.entries.length).toBe(2);
    expect(index.totalDocs).toBe(2);
  });

  it("skips sections with short body", () => {
    const content = "# Memory\n## Header\nshort";
    rebuildVectorIndex(testDir, content);
    const index = loadVectorIndex(testDir);
    expect(index.entries.length).toBe(0);
  });
});

describe("getVectorStats", () => {
  it("returns zeros for empty index", () => {
    const stats = getVectorStats(testDir);
    expect(stats.entries).toBe(0);
    expect(stats.terms).toBe(0);
  });

  it("returns correct counts", () => {
    indexMemoryEntry(testDir, "TypeScript strict mode catches type errors at compile time");
    const stats = getVectorStats(testDir);
    expect(stats.entries).toBe(1);
    expect(stats.terms).toBeGreaterThan(0);
  });
});
