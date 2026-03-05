import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
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
  searchVectorMemory: vi.fn(() => []),
  getVectorStats: vi.fn(() => ({ entries: 5, terms: 20 })),
}));

vi.mock("../src/utils/prompt.js", () => ({
  ask: vi.fn(() => Promise.resolve("")),
  confirm: vi.fn(() => Promise.resolve(false)),
  closePrompt: vi.fn(),
}));

import { memoryCommand } from "../src/cli/memory.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";

let testDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-memcli-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.env["CLICLAW_PROJECT_ROOT"] = testDir;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

describe("memoryCommand", () => {
  it("shows memory content", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.memoryFile, "# Memory\nSome content here");

    await memoryCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("CLIClaw Memory");
    expect(output).toContain("Memory size is within budget");
  });

  it("handles text search subcommand", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.memoryFile, "# Memory\nTypeScript is great\nRust is fast");

    await memoryCommand(["search", "TypeScript"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Memory search");
  });

  it("handles semantic search subcommand", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.memoryFile, "# Memory\nSome content");

    await memoryCommand(["search", "query", "--semantic"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Semantic search");
  });

  it("handles reindex subcommand", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.memoryFile, "# Memory\nSome content");

    await memoryCommand(["reindex"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Rebuilt vector index");
  });

  it("shows no matches for text search with no results", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.memoryFile, "# Memory\nSome content");

    await memoryCommand(["search", "nonexistent_pattern_xyz"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No matches found");
  });

  it("shows semantic results when found", async () => {
    const { searchVectorMemory } = await import("../src/core/vectors.js");
    vi.mocked(searchVectorMemory).mockReturnValue([
      { entry: { id: "1", text: "TypeScript is great", timestamp: "2026-03-01", terms: {} }, score: 0.95 },
    ]);

    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.memoryFile, "# Memory\nSome content");

    await memoryCommand(["search", "typescript", "--semantic"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("95.0%");
    expect(output).toContain("TypeScript is great");
  });

  it("shows empty index message for semantic search", async () => {
    const vecModule = await import("../src/core/vectors.js");
    vi.mocked(vecModule.searchVectorMemory).mockReturnValue([]);
    vi.mocked(vecModule.getVectorStats).mockReturnValue({ entries: 0, terms: 0 });

    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.memoryFile, "# Memory\nSome content");

    await memoryCommand(["search", "query", "--semantic"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Vector index is empty");
  });

  it("offers optimization for large memory", async () => {
    const { confirm: mockConfirm } = await import("../src/utils/prompt.js");
    vi.mocked(mockConfirm).mockResolvedValue(true);
    const { ask: mockAsk } = await import("../src/utils/prompt.js");
    vi.mocked(mockAsk).mockResolvedValue("3"); // Both deduplicate and trim

    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    // Create a large memory file (>800 tokens = >3200 chars)
    const bigContent = "# Memory\n" + Array.from({ length: 200 }, (_, i) => `- Entry ${i}: some important data here that takes up space`).join("\n");
    writeFileSync(paths.memoryFile, bigContent);

    await memoryCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Memory is large");
  });

  it("handles deduplication optimization", async () => {
    const { confirm: mockConfirm } = await import("../src/utils/prompt.js");
    vi.mocked(mockConfirm).mockResolvedValue(true);
    const { ask: mockAsk } = await import("../src/utils/prompt.js");
    vi.mocked(mockAsk).mockResolvedValue("1"); // Deduplicate only

    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    const bigContent = "# Memory\n" + Array.from({ length: 200 }, () => "- Duplicate entry here with enough content").join("\n");
    writeFileSync(paths.memoryFile, bigContent);

    await memoryCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Deduplicated");
  });

  it("handles trim optimization", async () => {
    const { confirm: mockConfirm } = await import("../src/utils/prompt.js");
    vi.mocked(mockConfirm).mockResolvedValue(true);
    const { ask: mockAsk } = await import("../src/utils/prompt.js");
    vi.mocked(mockAsk).mockResolvedValue("2"); // Trim only

    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    const bigContent = "# Memory\n" + Array.from({ length: 200 }, (_, i) => `- Entry ${i}: important data`).join("\n");
    writeFileSync(paths.memoryFile, bigContent);

    await memoryCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Trimmed");
  });
});
