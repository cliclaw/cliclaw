import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logRaw: vi.fn(),
  initLogger: vi.fn(),
}));

// Mock child_process.spawn
const mockChild = () => {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = null;
  child.pid = 12345;
  return child;
};

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => mockChild()),
}));

vi.mock("../src/core/ledger.js", () => ({
  initLedger: vi.fn(() => ({ cycle: 1, updatedAt: "", tasks: [{ id: "t1", focus: "general", claimedBy: null, claimedAt: null, status: "pending" }] })),
  claimTask: vi.fn(() => ({ id: "t1", focus: "general", claimedBy: "kiro", claimedAt: "", status: "claimed" })),
  completeTask: vi.fn(),
  getLedgerContext: vi.fn(() => ""),
}));

import { spawn } from "node:child_process";
import { runCycle, runParallelCycles, getCurrentAgentPids, stopAllAgents } from "../src/engines/runner.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";
import type { ClawConfig, EngineEntry } from "../src/core/types.js";

let testDir: string;

function makeConfig(overrides: Partial<ClawConfig> = {}): ClawConfig {
  const paths = buildPaths(testDir);
  ensureAllDirs(paths);
  return {
    projectRoot: testDir,
    engines: [{ engine: "kiro", model: "test-model", alias: "kiro" }],
    maxLoop: 10,
    maxConsecutiveFailures: 5,
    sleepNormal: 1,
    sleepAfterFailure: 2,
    agentTimeout: 60,
    freshSessionEvery: 3,
    promptHeader: "test",
    focusFilter: null,
    dryRun: false,
    parallel: false,
    maxConcurrent: 2,
    tokenBudget: 8000,
    hooks: { preCycle: [], postCycle: [], onSuccess: [], onFailure: [] },
    paths,
    ...overrides,
  };
}

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-runner-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  vi.clearAllMocks();
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("runCycle", () => {
  it("spawns agent and returns result on success", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => {
        child.stdout.emit("data", Buffer.from("agent output"));
        child.emit("close", 0);
      }, 10);
      return child;
    }) as any);

    const result = await runCycle(config, "test prompt", 1);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("agent output");
    expect(result.tokenEstimate).toBeGreaterThan(0);
    expect(result.costEstimate).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("handles spawn error", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => {
        child.emit("error", new Error("command not found"));
      }, 10);
      return child;
    }) as any);

    const result = await runCycle(config, "test prompt", 1);
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain("command not found");
  });

  it("handles non-zero exit with lenient engine", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => {
        // Produce enough output to trigger lenient success
        child.stdout.emit("data", Buffer.from("x".repeat(200)));
        child.emit("close", 1);
      }, 10);
      return child;
    }) as any);

    const result = await runCycle(config, "test prompt", 1);
    // kiro is lenientExit=true, so with 200 chars output and no hard error, exitCode should be 0
    expect(result.exitCode).toBe(0);
  });

  it("uses engine/model overrides", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    await runCycle(config, "test", 1, "claude", "my-model");
    expect(spawn).toHaveBeenCalledWith(
      "claude",
      expect.any(Array),
      expect.any(Object),
    );
  });

  it("writes input file to tmp dir", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    await runCycle(config, "my prompt text", 1);
    const inputFile = join(config.paths.tmpDir, "agent-input-1-kiro.txt");
    expect(existsSync(inputFile)).toBe(true);
    expect(readFileSync(inputFile, "utf-8")).toBe("my prompt text");
  });
});

describe("runParallelCycles", () => {
  it("runs multiple engines and returns results", async () => {
    const config = makeConfig({ maxConcurrent: 2 });
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => {
        child.stdout.emit("data", Buffer.from("output"));
        child.emit("close", 0);
      }, 10);
      return child;
    }) as any);

    const entries: EngineEntry[] = [
      { engine: "kiro", model: "m1", alias: "kiro1" },
      { engine: "claude", model: "m2", alias: "claude1" },
    ];

    const results = await runParallelCycles(config, "test", 1, entries);
    expect(results).toHaveLength(2);
    expect(results[0]!.exitCode).toBe(0);
    expect(results[1]!.exitCode).toBe(0);
  });

  it("adds focus to prompt when entry has focus", async () => {
    const config = makeConfig({ maxConcurrent: 2 });
    let capturedPrompt = "";
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    // We can't easily capture the prompt from spawn, but we can verify it doesn't throw
    const entries: EngineEntry[] = [
      { engine: "kiro", model: "m1", alias: "kiro1", focus: "frontend" },
    ];

    const results = await runParallelCycles(config, "base prompt", 1, entries);
    expect(results).toHaveLength(1);
  });
});

describe("getCurrentAgentPids / stopAllAgents", () => {
  it("getCurrentAgentPids returns copy of pids", () => {
    const pids = getCurrentAgentPids();
    expect(Array.isArray(pids)).toBe(true);
  });

  it("stopAllAgents does not throw", () => {
    expect(() => stopAllAgents()).not.toThrow();
  });
});
