import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../src/utils/prompt.js", () => ({
  ask: vi.fn(() => Promise.resolve("")),
  confirm: vi.fn(() => Promise.resolve(true)),
  closePrompt: vi.fn(),
}));

import { personaiCommand } from "../src/cli/personai.js";
import { ask, confirm } from "../src/utils/prompt.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";

let testDir: string;
let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-personai-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  process.env["CLICLAW_PROJECT_ROOT"] = testDir;
  vi.clearAllMocks();
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  consoleSpy.mockRestore();
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

describe("personaiCommand", () => {
  it("creates personai.md with answers", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);

    // Simulate answers: tone, expertise, style, avoid, preferences, context, extra
    let callCount = 0;
    vi.mocked(ask).mockImplementation(() => {
      callCount++;
      const answers: Record<number, string> = {
        1: "Professional",
        2: "TypeScript",
        3: "Code-heavy",
        4: "No any types",
        5: "Functional style",
        6: "AWS deployment",
        7: "", // extra — skip
      };
      return Promise.resolve(answers[callCount] ?? "");
    });

    await personaiCommand([]);

    expect(existsSync(paths.personaiFile)).toBe(true);
    const content = readFileSync(paths.personaiFile, "utf-8");
    expect(content).toContain("Professional");
    expect(content).toContain("TypeScript");
  });

  it("shows existing personai and asks to update", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.personaiFile, "# Existing Persona\nOld content");

    // First confirm = update? → false
    vi.mocked(confirm).mockResolvedValueOnce(false);

    await personaiCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Current personai.md");
  });

  it("discards when save is declined", async () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);

    vi.mocked(ask).mockResolvedValue("test answer");
    // confirm calls: save? → false
    vi.mocked(confirm).mockResolvedValue(false);

    await personaiCommand([]);

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Discarded");
  });
});
