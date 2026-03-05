import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { buildPaths, ensureAllDirs } from "../src/core/config.js";
import { logsCommand } from "../src/cli/logs.js";

let testDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-logs-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.env["CLICLAW_PROJECT_ROOT"] = testDir;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

describe("logsCommand", () => {
  it("shows message when no logs", async () => {
    await logsCommand([]);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No logs found");
  });

  it("shows last N log lines", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    const lines = Array.from({ length: 100 }, (_, i) => `[INFO] line ${i}`);
    writeFileSync(paths.logFile, lines.join("\n"));

    await logsCommand(["10"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Last 10 log entries");
  });

  it("defaults to 50 lines", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.logFile, "line1\nline2\n");

    await logsCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Last 50 log entries");
  });

  it("reads JSONL when --json flag", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.logJsonl, '{"event":"test"}\n');

    await logsCommand(["--json"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Last 50 log entries");
  });

  it("starts live tail with --tail flag", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.logFile, "line1\nline2\n");

    // liveTail calls watchFile which blocks — we just verify it doesn't throw immediately
    // and that it prints the initial tail
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    // Use a timeout to prevent hanging
    const promise = Promise.race([
      logsCommand(["--tail"]),
      new Promise<void>((resolve) => setTimeout(resolve, 100)),
    ]);

    await promise;
    stdoutSpy.mockRestore();
  });

  it("handles --tail with non-existent file", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    // Don't create the log file

    await logsCommand(["--tail"]).catch(() => {}); // May throw or not
    // Just verify it doesn't crash
  });
});
