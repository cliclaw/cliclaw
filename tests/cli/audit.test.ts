import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../src/core/cost.js", () => ({
  formatCost: vi.fn((n: number) => `$${n.toFixed(4)}`),
}));

import { auditCommand } from "../src/cli/audit.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";

let testDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-audit-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.env["CLICLAW_PROJECT_ROOT"] = testDir;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

describe("auditCommand", () => {
  it("shows message when no audit data", async () => {
    await auditCommand([]);
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No audit data found");
  });

  it("parses and displays JSONL entries", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);

    const entries = [
      JSON.stringify({ timestamp: "2026-03-01T12:00:00Z", event: "cycle_complete", cycle: 1, tokens: 1000, cost: 0.5 }),
      JSON.stringify({ timestamp: "2026-03-01T12:01:00Z", event: "cycle_failed", cycle: 2, consecutive_fails: 1 }),
      JSON.stringify({ timestamp: "2026-03-01T12:02:00Z", event: "loop_stopped", reason: "max_consecutive_failures" }),
    ];
    writeFileSync(paths.logJsonl, entries.join("\n"));

    await auditCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Audit Report");
    expect(output).toContain("Successes: 1");
    expect(output).toContain("Failures: 1");
    expect(output).toContain("stopped");
  });

  it("respects limit argument", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);

    const entries = Array.from({ length: 100 }, (_, i) =>
      JSON.stringify({ timestamp: "2026-03-01T12:00:00Z", event: "cycle_complete", cycle: i, tokens: 100, cost: 0.01 })
    );
    writeFileSync(paths.logJsonl, entries.join("\n"));

    await auditCommand(["10"]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("last 10 events");
  });

  it("handles malformed JSONL lines", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.logJsonl, "NOT JSON\n{}\n");

    await auditCommand([]);
    // Should not throw
    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Audit Report");
  });
});
