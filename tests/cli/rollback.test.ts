import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

const mockListSnapshots = vi.fn(() => ["state-cycle-00001.json", "state-cycle-00002.json"]);
const mockRollbackTo = vi.fn(() => true);

vi.mock("../src/core/snapshots.js", () => ({
  listSnapshots: (...args: unknown[]) => mockListSnapshots(...args),
  rollbackTo: (...args: unknown[]) => mockRollbackTo(...args),
}));

vi.mock("../src/utils/prompt.js", () => ({
  select: vi.fn(() => Promise.resolve(0)),
  closePrompt: vi.fn(),
}));

import { rollbackCommand } from "../src/cli/rollback.js";

let testDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-rollback-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.env["CLICLAW_PROJECT_ROOT"] = testDir;
  vi.clearAllMocks();
  // Reset defaults
  mockListSnapshots.mockReturnValue(["state-cycle-00001.json", "state-cycle-00002.json"]);
  mockRollbackTo.mockReturnValue(true);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

describe("rollbackCommand", () => {
  it("shows message when no snapshots", async () => {
    mockListSnapshots.mockReturnValue([]);
    await rollbackCommand([]);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No snapshots available");
  });

  it("rolls back to selected snapshot", async () => {
    await rollbackCommand([]);
    expect(mockRollbackTo).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Rolled back to");
  });

  it("shows failure message when rollback fails", async () => {
    mockRollbackTo.mockReturnValue(false);
    await rollbackCommand([]);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Failed to rollback");
  });
});
