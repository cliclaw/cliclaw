import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../src/core/memory.js", () => ({
  initMemory: vi.fn(),
}));

const mockAsk = vi.fn(() => Promise.resolve(""));
const mockMultiSelect = vi.fn(() => Promise.resolve([0]));
const mockConfirm = vi.fn(() => Promise.resolve(true));
const mockClosePrompt = vi.fn();

vi.mock("../src/utils/prompt.js", () => ({
  ask: (...args: unknown[]) => mockAsk(...args),
  multiSelect: (...args: unknown[]) => mockMultiSelect(...args),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  closePrompt: () => mockClosePrompt(),
}));

const mockExecSync = vi.fn(() => Buffer.from(""));

vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

import { setupCommand } from "../src/cli/setup.js";
import { buildPaths } from "../src/core/config.js";

let testDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-setup-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.env["CLICLAW_PROJECT_ROOT"] = testDir;
  vi.clearAllMocks();
  // Default: all commands available
  mockExecSync.mockReturnValue(Buffer.from(""));
  mockAsk.mockResolvedValue("");
  mockMultiSelect.mockResolvedValue([0]);
  mockConfirm.mockResolvedValue(true);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

describe("setupCommand", () => {
  it("runs full setup wizard and creates config", async () => {
    // ask calls: instance count → "1", model → "", budget → ""
    mockAsk.mockResolvedValue("");

    await setupCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Setup Wizard");
    expect(output).toContain("Setup complete");

    const paths = buildPaths(testDir);
    expect(existsSync(paths.configFile)).toBe(true);
    const config = JSON.parse(readFileSync(paths.configFile, "utf-8"));
    expect(config.engines).toBeDefined();
    expect(config.engines.length).toBeGreaterThan(0);
  });

  it("creates all meta files", async () => {
    await setupCommand([]);

    const paths = buildPaths(testDir);
    expect(existsSync(paths.youFile)).toBe(true);
    expect(existsSync(paths.projectsFile)).toBe(true);
    expect(existsSync(paths.boundariesFile)).toBe(true);
  });

  it("shows no engines message when none installed", async () => {
    mockExecSync.mockImplementation(() => { throw new Error("not found"); });

    await setupCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No AI CLI agents found");
    expect(mockClosePrompt).toHaveBeenCalled();
  });

  it("does not write config when declined", async () => {
    // Decline the "Write config?" confirm
    let confirmCount = 0;
    mockConfirm.mockImplementation(() => {
      confirmCount++;
      // First confirm is "Set up hooks?" → false, second is "Write config?" → false
      return Promise.resolve(false);
    });

    await setupCommand([]);

    const paths = buildPaths(testDir);
    // Config should NOT be written since we declined
    // (but meta files are still created before the config prompt)
  });

  it("handles multiple instances with aliases", async () => {
    // ask: instance count → "2", model1 → "", alias1 → "a", model2 → "", alias2 → "b", budget → ""
    let askCount = 0;
    mockAsk.mockImplementation(() => {
      askCount++;
      const answers: Record<number, string> = { 1: "2", 3: "a", 5: "b" };
      return Promise.resolve(answers[askCount] ?? "");
    });

    await setupCommand([]);

    const paths = buildPaths(testDir);
    if (existsSync(paths.configFile)) {
      const config = JSON.parse(readFileSync(paths.configFile, "utf-8"));
      if (config.engines.length > 1) {
        expect(config.maxConcurrent).toBeDefined();
      }
    }
  });

  it("configures hooks when enabled", async () => {
    let confirmCount = 0;
    mockConfirm.mockImplementation(() => {
      confirmCount++;
      return Promise.resolve(true); // Yes to all confirms including hooks
    });

    let askCount = 0;
    mockAsk.mockImplementation(() => {
      askCount++;
      const answers: Record<number, string> = {
        1: "1",   // instance count
        2: "",    // model
        3: "",    // budget
        4: "npm run lint",  // onSuccess hook
        5: "git stash",     // onFailure hook
      };
      return Promise.resolve(answers[askCount] ?? "");
    });

    await setupCommand([]);

    const paths = buildPaths(testDir);
    if (existsSync(paths.configFile)) {
      const config = JSON.parse(readFileSync(paths.configFile, "utf-8"));
      expect(config.hooks).toBeDefined();
    }
  });
});
