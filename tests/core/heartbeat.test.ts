import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../src/core/memory.js", () => ({
  getMemoryStats: vi.fn(() => ({ lines: 10, tokens: 50 })),
}));

vi.mock("../src/core/state.js", () => ({
  getFullState: vi.fn(() => ({
    totalCostEstimate: 1.5,
    totalTokensEstimate: 5000,
    lastSuccess: "2026-03-01",
  })),
}));

vi.mock("../src/core/cost.js", () => ({
  formatCost: vi.fn((n: number) => `$${n.toFixed(4)}`),
}));

import { writeHeartbeat } from "../src/core/heartbeat.js";
import type { ClawConfig } from "../src/core/types.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-hb-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("writeHeartbeat", () => {
  it("writes heartbeat entry to file", () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);

    const config = {
      engines: [
        { engine: "kiro", model: "claude-opus-4.6", alias: "kiro" },
        { engine: "claude", model: "sonnet", alias: "claude" },
      ],
      maxLoop: 100,
      paths,
    } as ClawConfig;

    writeHeartbeat(config, 5, 2);

    expect(existsSync(paths.heartbeatFile)).toBe(true);
    const content = readFileSync(paths.heartbeatFile, "utf-8");
    expect(content).toContain("kiro(claude-opus-4.6)");
    expect(content).toContain("claude(sonnet)");
    expect(content).toContain("Cycle: 5/100");
    expect(content).toContain("Consecutive failures: 2");
  });
});
