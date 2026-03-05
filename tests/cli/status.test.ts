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

vi.mock("../src/core/state.js", () => ({
  initState: vi.fn(),
  getFullState: vi.fn(() => ({
    lastSuccess: "2026-03-01",
    totalCycles: 10,
    totalTokensEstimate: 5000,
    totalCostEstimate: 1.5,
    stallCycles: 0,
  })),
  readState: vi.fn(),
  writeState: vi.fn(),
}));

vi.mock("../src/core/memory.js", () => ({
  getMemoryStats: vi.fn(() => ({ lines: 20, tokens: 100 })),
  initMemory: vi.fn(),
}));

vi.mock("../src/core/lock.js", () => ({
  isPidAlive: vi.fn(() => false),
}));

vi.mock("../src/core/cost.js", () => ({
  formatCost: vi.fn((n: number) => `$${n.toFixed(4)}`),
}));

vi.mock("../src/core/snapshots.js", () => ({
  listSnapshots: vi.fn(() => ["state-cycle-00001.json", "state-cycle-00002.json"]),
}));

import { statusCommand } from "../src/cli/status.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";

let testDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-status-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  // Set project root env
  process.env["CLICLAW_PROJECT_ROOT"] = testDir;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

describe("statusCommand", () => {
  it("shows status without errors", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.stateFile, JSON.stringify({}));

    await statusCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("CLIClaw Status");
    expect(output).toContain("Loop:");
    expect(output).toContain("Primary:");
    expect(output).toContain("Meta files:");
  });

  it("shows running status when PID file exists with alive PID", async () => {
    const { isPidAlive } = await import("../src/core/lock.js");
    vi.mocked(isPidAlive).mockReturnValue(true);

    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    mkdirSync(join(testDir, ".cliclaw", "cliclaw.lockdir"), { recursive: true });
    writeFileSync(paths.pidFile, String(process.pid));
    writeFileSync(paths.stateFile, JSON.stringify({}));

    await statusCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("🟢 Running");
  });

  it("shows stopped when no PID file", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.stateFile, JSON.stringify({}));

    await statusCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("🔴 Stopped");
  });
});
