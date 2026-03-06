import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { saveSnapshot, listSnapshots, rollbackTo } from "../src/core/snapshots.js";

let testDir: string;
let snapshotsDir: string;
let stateFile: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-snap-${Date.now()}`);
  snapshotsDir = join(testDir, "snapshots");
  stateFile = join(testDir, "state.json");
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("saveSnapshot", () => {
  it("saves a snapshot of the state file", () => {
    writeFileSync(stateFile, JSON.stringify({ totalCycles: 5 }));
    saveSnapshot(snapshotsDir, stateFile, 1);
    const files = readdirSync(snapshotsDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toBe("state-cycle-00001.json");
  });

  it("does nothing if state file doesn't exist", () => {
    saveSnapshot(snapshotsDir, stateFile, 1);
    // snapshotsDir is created but no snapshot file
    const files = existsSync(snapshotsDir) ? readdirSync(snapshotsDir) : [];
    expect(files).toHaveLength(0);
  });

  it("prunes old snapshots beyond 20", () => {
    writeFileSync(stateFile, "{}");
    for (let i = 1; i <= 25; i++) {
      saveSnapshot(snapshotsDir, stateFile, i);
    }
    const files = readdirSync(snapshotsDir).filter((f) => f.startsWith("state-cycle-"));
    expect(files.length).toBeLessThanOrEqual(20);
  });

  it("respects custom maxSnapshots limit", () => {
    writeFileSync(stateFile, "{}");
    for (let i = 1; i <= 10; i++) {
      saveSnapshot(snapshotsDir, stateFile, i, 5);
    }
    const files = readdirSync(snapshotsDir).filter((f) => f.startsWith("state-cycle-"));
    expect(files.length).toBeLessThanOrEqual(5);
  });
});

describe("listSnapshots", () => {
  it("returns empty array when no snapshots dir", () => {
    expect(listSnapshots(snapshotsDir)).toEqual([]);
  });

  it("returns sorted snapshot names", () => {
    writeFileSync(stateFile, "{}");
    saveSnapshot(snapshotsDir, stateFile, 3);
    saveSnapshot(snapshotsDir, stateFile, 1);
    saveSnapshot(snapshotsDir, stateFile, 2);
    const list = listSnapshots(snapshotsDir);
    expect(list).toEqual([
      "state-cycle-00001.json",
      "state-cycle-00002.json",
      "state-cycle-00003.json",
    ]);
  });
});

describe("rollbackTo", () => {
  it("restores state from snapshot", () => {
    writeFileSync(stateFile, JSON.stringify({ totalCycles: 5 }));
    saveSnapshot(snapshotsDir, stateFile, 1);
    writeFileSync(stateFile, JSON.stringify({ totalCycles: 99 }));

    const success = rollbackTo(snapshotsDir, stateFile, "state-cycle-00001.json");
    expect(success).toBe(true);
    const restored = JSON.parse(readFileSync(stateFile, "utf-8"));
    expect(restored.totalCycles).toBe(5);
  });

  it("returns false for non-existent snapshot", () => {
    expect(rollbackTo(snapshotsDir, stateFile, "nonexistent.json")).toBe(false);
  });
});
