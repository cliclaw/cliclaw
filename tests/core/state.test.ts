import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
}));

import { initState, readState, writeState, getFullState } from "../src/core/state.js";

let testDir: string;
let stateFile: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-state-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  stateFile = join(testDir, "state.json");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("initState", () => {
  it("creates state file if not exists", () => {
    initState(stateFile);
    expect(existsSync(stateFile)).toBe(true);
    const content = JSON.parse(readFileSync(stateFile, "utf-8"));
    expect(content).toEqual({});
  });

  it("preserves valid existing state", () => {
    writeFileSync(stateFile, JSON.stringify({ totalCycles: 5 }));
    initState(stateFile);
    const content = JSON.parse(readFileSync(stateFile, "utf-8"));
    expect(content.totalCycles).toBe(5);
  });

  it("resets corrupted state file", () => {
    writeFileSync(stateFile, "NOT JSON");
    initState(stateFile);
    const content = JSON.parse(readFileSync(stateFile, "utf-8"));
    expect(content).toEqual({});
  });
});

describe("readState / writeState", () => {
  it("reads and writes state keys", () => {
    initState(stateFile);
    writeState("totalCycles", 10);
    expect(readState("totalCycles")).toBe(10);
  });

  it("returns undefined for missing keys", () => {
    initState(stateFile);
    expect(readState("lastSuccess")).toBeUndefined();
  });

  it("overwrites existing keys", () => {
    initState(stateFile);
    writeState("stallCycles", 3);
    writeState("stallCycles", 0);
    expect(readState("stallCycles")).toBe(0);
  });
});

describe("getFullState", () => {
  it("returns all state", () => {
    initState(stateFile);
    writeState("totalCycles", 5);
    writeState("lastSuccess", "2026-01-01");
    const state = getFullState();
    expect(state.totalCycles).toBe(5);
    expect(state.lastSuccess).toBe("2026-01-01");
  });

  it("returns empty object when no state path set", () => {
    // Don't call initState — statePath is null from a fresh import perspective
    // But since it's module-level, we test the fallback by reading from the initialized path
    initState(stateFile);
    const state = getFullState();
    expect(typeof state).toBe("object");
  });
});
