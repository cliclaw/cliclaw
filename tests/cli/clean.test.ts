import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../src/core/lock.js", () => ({
  releaseLock: vi.fn(),
}));

vi.mock("../src/utils/prompt.js", () => ({
  confirm: vi.fn(() => Promise.resolve(true)),
  closePrompt: vi.fn(),
}));

import { cleanCommand } from "../src/cli/clean.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";

let testDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-clean-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.env["CLICLAW_PROJECT_ROOT"] = testDir;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

describe("cleanCommand", () => {
  it("removes tmp dir and releases lock", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(join(paths.tmpDir, "test.txt"), "data");

    await cleanCommand([]);

    expect(existsSync(paths.tmpDir)).toBe(false);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Removed tmp/");
    expect(output).toContain("Released lock");
    expect(output).toContain("Clean complete");
  });

  it("removes logs when confirmed", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.logFile, "log data");
    writeFileSync(paths.logJsonl, "jsonl data");

    await cleanCommand([]);

    expect(existsSync(paths.logFile)).toBe(false);
    expect(existsSync(paths.logJsonl)).toBe(false);
  });

  it("removes state when confirmed", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.stateFile, "{}");

    await cleanCommand([]);

    expect(existsSync(paths.stateFile)).toBe(false);
  });
});
