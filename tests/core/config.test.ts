import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Must mock before import
vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
  logJson: vi.fn(),
  logRaw: vi.fn(),
  initLogger: vi.fn(),
}));

import {
  buildPaths,
  resolveConfig,
  ensureAllDirs,
  getDefaultModel,
  primaryEngine,
  resolveAliases,
  ALL_ENGINES,
} from "../src/core/config.js";
import type { ClawPaths, EngineEntry } from "../src/core/types.js";

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-config-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  // Clear env vars
  delete process.env["CLICLAW_ENGINE"];
  delete process.env["CLICLAW_MODEL"];
  delete process.env["CLICLAW_MAX_LOOP"];
  delete process.env["CLICLAW_SLEEP"];
  delete process.env["CLICLAW_SLEEP_FAIL"];
  delete process.env["CLICLAW_TIMEOUT"];
  delete process.env["CLICLAW_FRESH_EVERY"];
  delete process.env["CLICLAW_DRY_RUN"];
  delete process.env["CLICLAW_MAX_FAILURES"];
  delete process.env["CLICLAW_TOKEN_BUDGET"];
  delete process.env["CLICLAW_MAX_CONCURRENT"];
  delete process.env["CLICLAW_PROMPT_HEADER"];
  delete process.env["CLICLAW_PROJECT_ROOT"];
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("buildPaths", () => {
  it("returns all expected path keys", () => {
    const paths = buildPaths("/some/project");
    expect(paths.logFile).toContain(".cliclaw/logs/autonomous.log");
    expect(paths.logJsonl).toContain(".cliclaw/logs/autonomous.jsonl");
    expect(paths.stateFile).toContain("cliclaw-state.json");
    expect(paths.memoryFile).toContain("MEMORY.md");
    expect(paths.boundariesFile).toContain("BOUNDARIES.md");
    expect(paths.lockDir).toContain("cliclaw.lockdir");
    expect(paths.pidFile).toContain("pid");
    expect(paths.cycleOut).toContain("cycle.out");
    expect(paths.cycleErr).toContain("cycle.err");
    expect(paths.tmpDir).toContain("tmp");
    expect(paths.metaDir).toContain("meta");
    expect(paths.youFile).toContain("you.md");
    expect(paths.projectsFile).toContain("projects.md");
    expect(paths.identityFile).toContain("identity.md");
    expect(paths.toolsFile).toContain("tools.md");
    expect(paths.bootFile).toContain("boot.md");
    expect(paths.configFile).toContain("config.json");
    expect(paths.snapshotsDir).toContain("snapshots");
  });
});

describe("ensureAllDirs", () => {
  it("creates all required directories", () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    expect(existsSync(join(testDir, ".cliclaw", "logs"))).toBe(true);
    expect(existsSync(join(testDir, ".cliclaw", "state"))).toBe(true);
    expect(existsSync(join(testDir, ".cliclaw", "memory"))).toBe(true);
    expect(existsSync(join(testDir, ".cliclaw", "meta"))).toBe(true);
    expect(existsSync(join(testDir, ".cliclaw", "tmp"))).toBe(true);
    expect(existsSync(join(testDir, ".cliclaw", "snapshots"))).toBe(true);
  });
});

describe("resolveAliases", () => {
  it("assigns engine name as alias for unique engines", () => {
    const engines: EngineEntry[] = [
      { engine: "kiro", model: "m1" },
      { engine: "claude", model: "m2" },
    ];
    const result = resolveAliases(engines);
    expect(result[0]?.alias).toBe("kiro");
    expect(result[1]?.alias).toBe("claude");
  });

  it("assigns numbered aliases for duplicate engines", () => {
    const engines: EngineEntry[] = [
      { engine: "kiro", model: "m1" },
      { engine: "kiro", model: "m2" },
    ];
    const result = resolveAliases(engines);
    expect(result[0]?.alias).toBe("kiro1");
    expect(result[1]?.alias).toBe("kiro2");
  });

  it("preserves existing aliases", () => {
    const engines: EngineEntry[] = [
      { engine: "kiro", model: "m1", alias: "myalias" },
      { engine: "kiro", model: "m2" },
    ];
    const result = resolveAliases(engines);
    expect(result[0]?.alias).toBe("myalias");
    expect(result[1]?.alias).toBe("kiro2");
  });
});

describe("resolveConfig", () => {
  it("returns defaults when no config file or env vars", () => {
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.engines.length).toBeGreaterThan(0);
    expect(config.engines[0]?.engine).toBe("kiro");
    expect(config.maxLoop).toBe(0);
    expect(config.sleepNormal).toBe(60);
    expect(config.tokenBudget).toBe(8000);
    expect(config.dryRun).toBe(false);
    expect(config.parallel).toBe(false);
  });

  it("reads from project config file", () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    const projectCfg = {
      engines: [{ engine: "claude", model: "test-model" }],
      tokenBudget: 5000,
      maxLoop: 100,
    };
    writeFileSync(paths.configFile, JSON.stringify(projectCfg));

    const config = resolveConfig({ projectRoot: testDir });
    expect(config.engines[0]?.engine).toBe("claude");
    expect(config.engines[0]?.model).toBe("test-model");
    expect(config.tokenBudget).toBe(5000);
    expect(config.maxLoop).toBe(100);
  });

  it("respects env vars", () => {
    process.env["CLICLAW_MAX_LOOP"] = "10";
    process.env["CLICLAW_SLEEP"] = "30";
    process.env["CLICLAW_TOKEN_BUDGET"] = "4000";
    process.env["CLICLAW_DRY_RUN"] = "true";
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.maxLoop).toBe(10);
    expect(config.sleepNormal).toBe(30);
    expect(config.tokenBudget).toBe(4000);
    expect(config.dryRun).toBe(true);
  });

  it("env var with invalid int falls back to default", () => {
    process.env["CLICLAW_MAX_LOOP"] = "notanumber";
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.maxLoop).toBe(0);
  });

  it("CLI overrides take precedence over project config and env", () => {
    process.env["CLICLAW_MAX_LOOP"] = "10";
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.configFile, JSON.stringify({ maxLoop: 50 }));

    const config = resolveConfig({ projectRoot: testDir, maxLoop: 999 });
    expect(config.maxLoop).toBe(999);
  });

  it("handles malformed config.json gracefully", () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.configFile, "NOT JSON");
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.engines[0]?.engine).toBe("kiro");
  });

  it("uses CLICLAW_ENGINE env var for default engine", () => {
    process.env["CLICLAW_ENGINE"] = "claude";
    process.env["CLICLAW_MODEL"] = "my-model";
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.engines[0]?.engine).toBe("claude");
    expect(config.engines[0]?.model).toBe("my-model");
  });

  it("overrides engines from CLI", () => {
    const config = resolveConfig({
      projectRoot: testDir,
      engines: [{ engine: "gemini", model: "gem-model" }],
    });
    expect(config.engines[0]?.engine).toBe("gemini");
  });

  it("reads hooks from project config", () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.configFile, JSON.stringify({
      hooks: { preCycle: ["echo pre"], postCycle: [], onSuccess: ["echo ok"], onFailure: [] },
    }));
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.hooks.preCycle).toEqual(["echo pre"]);
    expect(config.hooks.onSuccess).toEqual(["echo ok"]);
  });

  it("reads maxConsecutiveFailures from project config", () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.configFile, JSON.stringify({ maxConsecutiveFailures: 10 }));
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.maxConsecutiveFailures).toBe(10);
  });

  it("reads maxLoop from project config", () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.configFile, JSON.stringify({ maxLoop: 42 }));
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.maxLoop).toBe(42);
  });

  it("reads maxConcurrent from project config", () => {
    const paths = buildPaths(testDir);
    ensureAllDirs(paths);
    writeFileSync(paths.configFile, JSON.stringify({ maxConcurrent: 5 }));
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.maxConcurrent).toBe(5);
  });

  it("sets focusFilter from overrides", () => {
    const config = resolveConfig({ projectRoot: testDir, focusFilter: "frontend" });
    expect(config.focusFilter).toBe("frontend");
  });

  it("sets parallel from overrides", () => {
    const config = resolveConfig({ projectRoot: testDir, parallel: true });
    expect(config.parallel).toBe(true);
  });

  it("sets custom prompt header from env", () => {
    process.env["CLICLAW_PROMPT_HEADER"] = "Custom header";
    const config = resolveConfig({ projectRoot: testDir });
    expect(config.promptHeader).toBe("Custom header");
  });

  it("envBool handles '1' and 'false'", () => {
    process.env["CLICLAW_DRY_RUN"] = "1";
    expect(resolveConfig({ projectRoot: testDir }).dryRun).toBe(true);
    process.env["CLICLAW_DRY_RUN"] = "false";
    expect(resolveConfig({ projectRoot: testDir }).dryRun).toBe(false);
  });
});

describe("getDefaultModel", () => {
  it("returns correct defaults for known engines", () => {
    expect(getDefaultModel("kiro")).toBe("claude-opus-4.6");
    expect(getDefaultModel("claude")).toBe("claude-sonnet-4-20250514");
    expect(getDefaultModel("codex")).toBe("o4-mini");
    expect(getDefaultModel("gemini")).toBe("gemini-2.5-pro");
    expect(getDefaultModel("cursor")).toBe("gpt-5.2-high");
    expect(getDefaultModel("copilot")).toBe("gpt-4.1");
    expect(getDefaultModel("aider")).toBe("sonnet");
  });
});

describe("primaryEngine", () => {
  it("returns first engine from config", () => {
    const config = resolveConfig({
      projectRoot: testDir,
      engines: [
        { engine: "claude", model: "m1" },
        { engine: "kiro", model: "m2" },
      ],
    });
    const primary = primaryEngine(config);
    expect(primary.engine).toBe("claude");
  });
});

describe("ALL_ENGINES", () => {
  it("contains all 7 engines", () => {
    expect(ALL_ENGINES).toHaveLength(7);
    expect(ALL_ENGINES).toContain("kiro");
    expect(ALL_ENGINES).toContain("claude");
    expect(ALL_ENGINES).toContain("cursor");
    expect(ALL_ENGINES).toContain("codex");
    expect(ALL_ENGINES).toContain("aider");
    expect(ALL_ENGINES).toContain("gemini");
    expect(ALL_ENGINES).toContain("copilot");
  });
});
