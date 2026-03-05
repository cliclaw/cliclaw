import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  initLedger,
  claimTask,
  completeTask,
  getLedgerContext,
} from "../src/core/ledger.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-ledger-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("initLedger", () => {
  it("creates ledger with tasks for each engine", () => {
    const ledger = initLedger(testDir, 1, [
      { engine: "kiro1", focus: "frontend" },
      { engine: "kiro2", focus: "backend" },
    ]);
    expect(ledger.cycle).toBe(1);
    expect(ledger.tasks).toHaveLength(2);
    expect(ledger.tasks[0]!.focus).toBe("frontend");
    expect(ledger.tasks[1]!.focus).toBe("backend");
    expect(ledger.tasks[0]!.status).toBe("pending");
  });

  it("defaults focus to 'general'", () => {
    const ledger = initLedger(testDir, 1, [{ engine: "kiro", focus: "" }]);
    expect(ledger.tasks[0]!.focus).toBe("general");
  });

  it("writes ledger to disk", () => {
    initLedger(testDir, 1, [{ engine: "kiro", focus: "" }]);
    expect(existsSync(join(testDir, "parallel-ledger.json"))).toBe(true);
  });
});

describe("claimTask", () => {
  it("claims a pending task", () => {
    initLedger(testDir, 1, [
      { engine: "kiro1", focus: "frontend" },
      { engine: "kiro2", focus: "backend" },
    ]);
    const task = claimTask(testDir, "kiro1");
    expect(task).not.toBeNull();
    expect(task!.status).toBe("claimed");
    expect(task!.claimedBy).toBe("kiro1");
  });

  it("returns null when no tasks available", () => {
    initLedger(testDir, 1, [{ engine: "kiro", focus: "" }]);
    claimTask(testDir, "kiro"); // claim the only task
    // Now try to claim again — the task is already claimed with focus "general"
    // The claimTask logic checks for pending OR (non-general focus AND unclaimed)
    const task = claimTask(testDir, "kiro2");
    expect(task).toBeNull();
  });
});

describe("completeTask", () => {
  it("marks task as done", () => {
    const ledger = initLedger(testDir, 1, [{ engine: "kiro", focus: "" }]);
    const taskId = ledger.tasks[0]!.id;
    completeTask(testDir, taskId, "done", "completed successfully");

    const raw = JSON.parse(readFileSync(join(testDir, "parallel-ledger.json"), "utf-8"));
    expect(raw.tasks[0].status).toBe("done");
    expect(raw.tasks[0].result).toBe("completed successfully");
  });

  it("marks task as failed", () => {
    const ledger = initLedger(testDir, 1, [{ engine: "kiro", focus: "" }]);
    const taskId = ledger.tasks[0]!.id;
    completeTask(testDir, taskId, "failed");

    const raw = JSON.parse(readFileSync(join(testDir, "parallel-ledger.json"), "utf-8"));
    expect(raw.tasks[0].status).toBe("failed");
  });

  it("does nothing for unknown task id", () => {
    initLedger(testDir, 1, [{ engine: "kiro", focus: "" }]);
    completeTask(testDir, "nonexistent_id", "done"); // should not throw
  });
});

describe("getLedgerContext", () => {
  it("returns empty string when no tasks", () => {
    expect(getLedgerContext(testDir)).toBe("");
  });

  it("returns markdown summary of tasks", () => {
    initLedger(testDir, 1, [
      { engine: "kiro1", focus: "frontend" },
      { engine: "kiro2", focus: "backend" },
    ]);
    claimTask(testDir, "kiro1");

    const context = getLedgerContext(testDir);
    expect(context).toContain("Parallel Task Coordination");
    expect(context).toContain("frontend");
    expect(context).toContain("kiro1");
  });
});
