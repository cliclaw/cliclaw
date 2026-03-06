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
import { logWarn } from "../src/core/logger.js";
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
    outputStallTimeout: 0,
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

  it("does NOT apply lenient exit when stderr has hard error", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => {
        child.stdout.emit("data", Buffer.from("x".repeat(200)));
        child.stderr.emit("data", Buffer.from("fatal: command not found"));
        child.emit("close", 1);
      }, 10);
      return child;
    }) as any);

    const result = await runCycle(config, "test prompt", 1);
    expect(result.exitCode).toBe(1);
  });

  it("does NOT apply lenient exit when output is too short", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => {
        child.stdout.emit("data", Buffer.from("short"));
        child.emit("close", 1);
      }, 10);
      return child;
    }) as any);

    const result = await runCycle(config, "test prompt", 1);
    expect(result.exitCode).toBe(1);
  });

  it("uses exit code 124 when timed out", async () => {
    const config = makeConfig({ agentTimeout: 0.01 }); // 10ms timeout
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      // close fires after timeout triggers
      setTimeout(() => child.emit("close", 0), 200);
      return child;
    }) as any);

    const result = await runCycle(config, "test prompt", 1);
    expect(result.exitCode).toBe(124);
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

  it("captures stderr output", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => {
        child.stderr.emit("data", Buffer.from("some warning"));
        child.emit("close", 0);
      }, 10);
      return child;
    }) as any);

    const result = await runCycle(config, "test", 1);
    expect(result.stderr).toContain("some warning");
  });

  it("handles null exit code (defaults to 1)", async () => {
    const config = makeConfig();
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", null), 10);
      return child;
    }) as any);

    const result = await runCycle(config, "test", 1);
    expect(result.exitCode).toBe(1);
  });

  it("uses resume=true for cycle > 1 within freshSessionEvery window", async () => {
    const config = makeConfig({ freshSessionEvery: 3 });
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    await runCycle(config, "test", 2); // cycle 2, freshSessionEvery=3 → resume=true
    const args = vi.mocked(spawn).mock.calls[0]![1] as string[];
    expect(args).toContain("--resume");
  });

  it("uses resume=false on fresh session cycle", async () => {
    const config = makeConfig({ freshSessionEvery: 3 });
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    await runCycle(config, "test", 3); // cycle 3 % 3 === 0 → fresh session
    const args = vi.mocked(spawn).mock.calls[0]![1] as string[];
    expect(args).not.toContain("--resume");
  });

  describe("outputStallTimeout", () => {
    it("is disabled when outputStallTimeout is 0", async () => {
      const config = makeConfig({ outputStallTimeout: 0 });
      vi.mocked(spawn).mockImplementation((() => {
        const child = mockChild();
        setTimeout(() => child.emit("close", 0), 50);
        return child;
      }) as any);

      const result = await runCycle(config, "test", 1);
      expect(result.exitCode).toBe(0);
      expect(vi.mocked(logWarn)).not.toHaveBeenCalledWith(expect.stringContaining("output stall"));
    });

    it("kills agent when no output arrives within stall window", async () => {
      const config = makeConfig({ outputStallTimeout: 0.02 }); // 20ms
      vi.mocked(spawn).mockImplementation((() => {
        const child = mockChild();
        // No stdout data — close fires after stall triggers
        setTimeout(() => child.emit("close", 0), 200);
        return child;
      }) as any);

      const result = await runCycle(config, "test", 1);
      expect(result.exitCode).toBe(124);
      expect(vi.mocked(logWarn)).toHaveBeenCalledWith(expect.stringContaining("output stall"));
    });

    it("resets stall timer on each data chunk", async () => {
      const config = makeConfig({ outputStallTimeout: 0.05 }); // 50ms
      vi.mocked(spawn).mockImplementation((() => {
        const child = mockChild();
        // Send data at 20ms intervals — each resets the 50ms stall timer
        setTimeout(() => child.stdout.emit("data", Buffer.from("chunk1")), 20);
        setTimeout(() => child.stdout.emit("data", Buffer.from("chunk2")), 40);
        setTimeout(() => child.stdout.emit("data", Buffer.from("chunk3")), 60);
        setTimeout(() => child.emit("close", 0), 80);
        return child;
      }) as any);

      const result = await runCycle(config, "test", 1);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("chunk1chunk2chunk3");
      expect(vi.mocked(logWarn)).not.toHaveBeenCalledWith(expect.stringContaining("output stall"));
    });

    it("clears stall timer on close", async () => {
      const config = makeConfig({ outputStallTimeout: 0.5 }); // 500ms — would fire after close
      vi.mocked(spawn).mockImplementation((() => {
        const child = mockChild();
        setTimeout(() => child.emit("close", 0), 10);
        return child;
      }) as any);

      const result = await runCycle(config, "test", 1);
      expect(result.exitCode).toBe(0);
      // If stall timer wasn't cleared, it would fire after and cause issues
      await new Promise((r) => setTimeout(r, 600));
      expect(vi.mocked(logWarn)).not.toHaveBeenCalledWith(expect.stringContaining("output stall"));
    });

    it("clears stall timer on error", async () => {
      const config = makeConfig({ outputStallTimeout: 0.5 });
      vi.mocked(spawn).mockImplementation((() => {
        const child = mockChild();
        setTimeout(() => child.emit("error", new Error("spawn failed")), 10);
        return child;
      }) as any);

      const result = await runCycle(config, "test", 1);
      expect(result.exitCode).toBe(127);
      await new Promise((r) => setTimeout(r, 600));
      expect(vi.mocked(logWarn)).not.toHaveBeenCalledWith(expect.stringContaining("output stall"));
    });
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

  it("batches engines by maxConcurrent", async () => {
    const config = makeConfig({ maxConcurrent: 1 });
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    const entries: EngineEntry[] = [
      { engine: "kiro", model: "m1", alias: "kiro1" },
      { engine: "kiro", model: "m2", alias: "kiro2" },
    ];

    const results = await runParallelCycles(config, "test", 1, entries);
    expect(results).toHaveLength(2);
    // With maxConcurrent=1, spawn is called sequentially
    expect(spawn).toHaveBeenCalledTimes(2);
  });

  it("adds focus to prompt when entry has focus", async () => {
    const config = makeConfig({ maxConcurrent: 2 });
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    const entries: EngineEntry[] = [
      { engine: "kiro", model: "m1", alias: "kiro1", focus: "frontend" },
    ];

    const results = await runParallelCycles(config, "base prompt", 1, entries);
    expect(results).toHaveLength(1);
    // Verify the focused prompt was written to the input file
    const inputFile = join(config.paths.tmpDir, "agent-input-1-kiro.txt");
    const written = readFileSync(inputFile, "utf-8");
    expect(written).toContain("Focus on: frontend");
  });

  it("uses buildEnginePrompt when provided", async () => {
    const config = makeConfig({ maxConcurrent: 2 });
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    const entries: EngineEntry[] = [{ engine: "kiro", model: "m1", alias: "kiro1" }];
    const buildEnginePrompt = vi.fn(() => "custom engine prompt");

    await runParallelCycles(config, "base", 1, entries, buildEnginePrompt);
    expect(buildEnginePrompt).toHaveBeenCalledWith(entries[0]);
  });

  it("marks task as failed when cycle fails", async () => {
    const { completeTask } = await import("../src/core/ledger.js");
    const config = makeConfig({ maxConcurrent: 1 });
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 1), 10);
      return child;
    }) as any);

    const entries: EngineEntry[] = [{ engine: "codex", model: "m1", alias: "codex1" }];
    await runParallelCycles(config, "test", 1, entries);
    expect(completeTask).toHaveBeenCalledWith(expect.any(String), "t1", "failed");
  });

  it("marks task as done when cycle succeeds", async () => {
    const { completeTask } = await import("../src/core/ledger.js");
    const config = makeConfig({ maxConcurrent: 1 });
    vi.mocked(spawn).mockImplementation((() => {
      const child = mockChild();
      setTimeout(() => child.emit("close", 0), 10);
      return child;
    }) as any);

    const entries: EngineEntry[] = [{ engine: "kiro", model: "m1", alias: "kiro1" }];
    await runParallelCycles(config, "test", 1, entries);
    expect(completeTask).toHaveBeenCalledWith(expect.any(String), "t1", "done");
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
