import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logJson: vi.fn(),
  logRaw: vi.fn(),
  initLogger: vi.fn(),
}));

vi.mock("../src/core/state.js", () => {
  const state: Record<string, unknown> = {};
  return {
    initState: vi.fn(),
    readState: vi.fn((key: string) => state[key]),
    writeState: vi.fn((key: string, val: unknown) => { state[key] = val; }),
    getFullState: vi.fn(() => ({ ...state })),
  };
});

vi.mock("../src/core/memory.js", () => ({
  initMemory: vi.fn(),
  appendToMemory: vi.fn(),
  extractMemoryAppend: vi.fn(() => ""),
}));

vi.mock("../src/core/lock.js", () => ({
  killPrevious: vi.fn(),
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  killAgentProcesses: vi.fn(),
}));

vi.mock("../src/prompts/builder.js", () => ({
  buildPrompt: vi.fn(() => "test prompt"),
  estimatePromptTokens: vi.fn(() => 100),
  hashPrompt: vi.fn(() => "abc123"),
  logPromptStats: vi.fn(),
}));

vi.mock("../src/engines/runner.js", () => ({
  runCycle: vi.fn(() => Promise.resolve({
    exitCode: 0,
    stdout: "output",
    stderr: "",
    durationMs: 1000,
    tokenEstimate: 500,
    costEstimate: 0.01,
  })),
  runParallelCycles: vi.fn(() => Promise.resolve([{
    exitCode: 0,
    stdout: "output",
    stderr: "",
    durationMs: 1000,
    tokenEstimate: 500,
    costEstimate: 0.01,
  }])),
  stopAllAgents: vi.fn(),
}));

vi.mock("../src/core/cost.js", () => ({
  formatCost: vi.fn((n: number) => `$${n.toFixed(4)}`),
  estimateTokens: vi.fn(() => 100),
}));

vi.mock("../src/core/snapshots.js", () => ({
  saveSnapshot: vi.fn(),
}));

vi.mock("../src/core/hooks.js", () => ({
  runPreCycle: vi.fn(),
  runPostCycle: vi.fn(),
  runOnSuccess: vi.fn(),
  runOnFailure: vi.fn(),
  parseAgentSignals: vi.fn(() => ({ exit: false, skipCycle: false, stallReset: false })),
}));

vi.mock("../src/utils/notify.js", () => ({
  sendNotification: vi.fn(),
}));

vi.mock("../src/engines/registry.js", () => ({
  isEngineAvailable: vi.fn(() => true),
}));

import { cronCommand } from "../src/cli/cron.js";
import { runCycle, runParallelCycles } from "../src/engines/runner.js";
import { writeState, readState } from "../src/core/state.js";
import { runPreCycle, runPostCycle, runOnSuccess, runOnFailure } from "../src/core/hooks.js";
import { saveSnapshot } from "../src/core/snapshots.js";
import { sendNotification } from "../src/utils/notify.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-cron-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  const paths = buildPaths(testDir);
  ensureAllDirs(paths);
  writeFileSync(paths.configFile, JSON.stringify({
    engines: [{ engine: "kiro", model: "test-model" }],
  }));
  vi.clearAllMocks();
  // Override CLICLAW_SLEEP_FAIL to 0 so failure sleep doesn't block
  process.env["CLICLAW_SLEEP_FAIL"] = "0";
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  delete process.env["CLICLAW_SLEEP_FAIL"];
});

describe("cronCommand", () => {
  it("runs a single successful cycle with --max-loop 1", async () => {
    await cronCommand(["--max-loop", "1", "--project-root", testDir, "--sleep", "0"]);

    expect(runCycle).toHaveBeenCalledTimes(1);
    expect(runPreCycle).toHaveBeenCalled();
    expect(runPostCycle).toHaveBeenCalled();
    expect(runOnSuccess).toHaveBeenCalled();
    expect(writeState).toHaveBeenCalled();
  });

  it("runs dry-run mode without calling engine", async () => {
    await cronCommand(["--max-loop", "1", "--project-root", testDir, "--dry-run", "--sleep", "0"]);

    expect(runCycle).not.toHaveBeenCalled();
  });

  it("handles engine failure and rotation", async () => {
    // Make engine fail 3 times to trigger rotation
    vi.mocked(runCycle)
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "error", durationMs: 100, tokenEstimate: 50, costEstimate: 0 })
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "error", durationMs: 100, tokenEstimate: 50, costEstimate: 0 })
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "error", durationMs: 100, tokenEstimate: 50, costEstimate: 0 })
      .mockResolvedValue({ exitCode: 0, stdout: "ok", stderr: "", durationMs: 100, tokenEstimate: 50, costEstimate: 0 });

    // Need multiple engines for rotation
    const paths = buildPaths(testDir);
    writeFileSync(paths.configFile, JSON.stringify({
      engines: [
        { engine: "kiro", model: "m1" },
        { engine: "claude", model: "m2" },
      ],
    }));

    await cronCommand(["--max-loop", "4", "--project-root", testDir, "--sleep", "0"]);

    expect(runCycle).toHaveBeenCalledTimes(4);
    expect(runOnFailure).toHaveBeenCalled();
  });

  it("stops on max consecutive failures", async () => {
    vi.mocked(runCycle).mockResolvedValue({
      exitCode: 1, stdout: "", stderr: "error", durationMs: 100, tokenEstimate: 50, costEstimate: 0,
    });

    await cronCommand(["--max-loop", "100", "--project-root", testDir, "--sleep", "0"]);

    // Should stop before 100 cycles due to max consecutive failures (default 5)
    expect(vi.mocked(runCycle).mock.calls.length).toBeLessThan(100);
    expect(sendNotification).toHaveBeenCalled();
  });

  it("runs parallel mode", async () => {
    const paths = buildPaths(testDir);
    writeFileSync(paths.configFile, JSON.stringify({
      engines: [
        { engine: "kiro", model: "m1", alias: "kiro1" },
        { engine: "claude", model: "m2", alias: "claude1" },
      ],
    }));

    await cronCommand(["--max-loop", "1", "--project-root", testDir, "--parallel", "--sleep", "0"]);

    expect(runParallelCycles).toHaveBeenCalledTimes(1);
  });

  it("parses --engine override", async () => {
    await cronCommand(["--max-loop", "1", "--project-root", testDir, "--engine", "claude", "--model", "test", "--sleep", "0"]);

    expect(runCycle).toHaveBeenCalled();
  });

  it("parses focus argument", async () => {
    await cronCommand(["--max-loop", "1", "--project-root", testDir, "frontend", "--sleep", "0"]);

    expect(runCycle).toHaveBeenCalled();
  });

  it("parses --focus flag", async () => {
    await cronCommand(["--max-loop", "1", "--project-root", testDir, "--focus", "backend", "--sleep", "0"]);

    expect(runCycle).toHaveBeenCalled();
  });

  it("saves snapshots each cycle", async () => {
    await cronCommand(["--max-loop", "1", "--project-root", testDir, "--sleep", "0"]);

    expect(saveSnapshot).toHaveBeenCalled();
  });

  it("extracts memory from successful output", async () => {
    const memModule = await import("../src/core/memory.js");
    vi.mocked(memModule.extractMemoryAppend).mockReturnValue("learned something");
    vi.mocked(runCycle).mockResolvedValue({
      exitCode: 0,
      stdout: "<!-- MEMORY_APPEND\nlearned something\n-->",
      stderr: "",
      durationMs: 100,
      tokenEstimate: 50,
      costEstimate: 0.01,
    });

    await cronCommand(["--max-loop", "1", "--project-root", testDir, "--sleep", "0"]);

    expect(memModule.appendToMemory).toHaveBeenCalled();
  });
});
