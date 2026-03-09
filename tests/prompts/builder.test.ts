import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../src/core/state.js", () => ({
  readState: vi.fn(() => undefined),
}));

vi.mock("../src/core/secrets.js", () => ({
  scanAndRedact: vi.fn((text: string) => ({ clean: text, redacted: 0, findings: [] })),
}));

vi.mock("../src/core/cost.js", () => ({
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}));

vi.mock("../src/core/memory.js", () => ({
  readMemorySnippet: vi.fn(() => "(no persistent memory yet)"),
}));

import { buildPrompt, hashPrompt, estimatePromptTokens, logPromptStats } from "../src/prompts/builder.js";
import { buildPaths, ensureAllDirs } from "../src/core/config.js";
import type { ClawConfig } from "../src/core/types.js";

let testDir: string;

function makeConfig(overrides: Partial<ClawConfig> = {}): ClawConfig {
  const paths = buildPaths(testDir);
  return {
    projectRoot: testDir,
    engines: [{ agent: "kiro", model: "test-model", alias: "kiro" }],
    maxLoop: 10,
    maxConsecutiveFailures: 5,
    sleepNormal: 1,
    sleepAfterFailure: 2,
    agentTimeout: 60,
    freshSessionEvery: 3,
    promptHeader: "You are an autonomous agent.",
    focusFilter: null,
    dryRun: false,
    parallel: false,
    maxConcurrent: 2,
    tokenBudget: 0,
    hooks: { preCycle: [], postCycle: [], onSuccess: [], onFailure: [] },
    paths,
    idleBeforeStart: 0,
    snapshotEvery: 4,
    engineRotateAfter: 3,
    stallMax: 10,
    stallBackoffMultiplier: 1.5,
    stallBackoffCap: 10,
    hookTimeout: 60000,
    maxSnapshots: 20,
    promptBudgets: { memory: 500, you: 400, projects: 600, boundaries: 200, identity: 200, tools: 300, boot: 300 },
    memoryMaxLines: 1100,
    memoryKeepHead: 80,
    memoryKeepTail: 850,
    ...overrides,
  };
}

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-builder-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  const paths = buildPaths(testDir);
  ensureAllDirs(paths);
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("buildPrompt", () => {
  it("includes prompt header", () => {
    const config = makeConfig();
    const prompt = buildPrompt(config);
    expect(prompt).toContain("You are an autonomous agent.");
  });

  it("includes instructions section", () => {
    const config = makeConfig();
    const prompt = buildPrompt(config);
    expect(prompt).toContain("## Instructions");
    expect(prompt).toContain("MEMORY_APPEND");
  });

  it("includes focus when set", () => {
    const config = makeConfig({ focusFilter: "frontend" });
    const prompt = buildPrompt(config);
    expect(prompt).toContain("## Focus");
    expect(prompt).toContain("frontend");
  });

  it("does not include focus when null", () => {
    const config = makeConfig({ focusFilter: null });
    const prompt = buildPrompt(config);
    expect(prompt).not.toContain("## Focus");
  });

  it("includes user content when you.md has real data", () => {
    const config = makeConfig();
    writeFileSync(config.paths.youFile, "## Role\nSenior Developer\n\n## Stack\nTypeScript, Node.js");
    const prompt = buildPrompt(config);
    expect(prompt).toContain("About the User");
    expect(prompt).toContain("Senior Developer");
  });

  it("skips template-only meta files", () => {
    const config = makeConfig();
    // Write only template content
    writeFileSync(config.paths.youFile, "# About You\n\n## Role\n<!-- e.g. Senior Developer -->\n\n- **Name**: \n");
    const prompt = buildPrompt(config);
    expect(prompt).not.toContain("About the User");
  });

  it("includes projects when present", () => {
    const config = makeConfig();
    writeFileSync(config.paths.projectsFile, "## Folder Structure\n\n```\n- src/\n- tests/\n```\n\n## Build & Run\n\n`make dev` - start the dev server");
    const prompt = buildPrompt(config);
    expect(prompt).toContain("## Projects");
  });

  it("includes identity when present", () => {
    const config = makeConfig();
    writeFileSync(config.paths.identityFile, "## Tone\nProfessional and concise.\n\n## Expertise\nTypeScript\n\n## Role\nCoding assistant");
    const prompt = buildPrompt(config);
    expect(prompt).toContain("Agent Identity");
    expect(prompt).toContain("Coding assistant");
  });

  it("includes boundaries when present", () => {
    const config = makeConfig();
    writeFileSync(config.paths.boundariesFile, "## Do NOT\n- Delete production databases\n- Push to main");
    const prompt = buildPrompt(config);
    expect(prompt).toContain("Boundaries");
  });

  it("includes identity when present", () => {
    const config = makeConfig();
    writeFileSync(config.paths.identityFile, "## Role\nAutonomous coding assistant\n\n## Mission\nAutomate workflows");
    const prompt = buildPrompt(config);
    expect(prompt).toContain("Agent Identity");
    expect(prompt).toContain("Autonomous coding assistant");
  });

  it("includes tools when present", () => {
    const config = makeConfig();
    writeFileSync(config.paths.toolsFile, "## Version Control\n- `git` — standard git CLI");
    const prompt = buildPrompt(config);
    expect(prompt).toContain("Available Tools");
  });

  it("includes boot instructions only on cycle 1", () => {
    const config = makeConfig();
    writeFileSync(config.paths.bootFile, "## On First Run\n- Check for pending tasks");
    const promptCycle1 = buildPrompt(config, false, 1);
    expect(promptCycle1).toContain("Boot Instructions");
    const promptCycle2 = buildPrompt(config, false, 2);
    expect(promptCycle2).not.toContain("Boot Instructions");
  });

  it("uses per-agent identity file when specified", () => {
    const { join } = require("node:path");
    const { writeFileSync: wf } = require("node:fs");
    const customIdentityPath = join(testDir, "custom-identity.md");
    wf(customIdentityPath, "## Role\nCode Reviewer\n\n## Mission\nReview all PRs");
    const config = makeConfig({
      engines: [{ agent: "kiro", model: "m", alias: "reviewer", identity: "custom-identity.md" }],
    });
    const prompt = buildPrompt(config, false, 1, config.agents[0]);
    expect(prompt).toContain("Code Reviewer");
  });

  it("truncates prompt when token budget exceeded", () => {
    const config = makeConfig({ tokenBudget: 10 }); // Very small budget
    writeFileSync(config.paths.youFile, "## Role\n" + "x".repeat(1000));
    const prompt = buildPrompt(config);
    expect(prompt).toContain("truncated: budget exceeded");
  });

  it("calls scanAndRedact", async () => {
    const { scanAndRedact } = await import("../src/core/secrets.js");
    const config = makeConfig();
    buildPrompt(config);
    expect(scanAndRedact).toHaveBeenCalled();
  });

  it("logs warning when secrets are redacted", async () => {
    const { scanAndRedact } = await import("../src/core/secrets.js");
    const { logWarn } = await import("../src/core/logger.js");
    vi.mocked(scanAndRedact).mockReturnValueOnce({ clean: "cleaned", redacted: 2, findings: ["AWS Key: AKIA1234..."] });
    const config = makeConfig();
    buildPrompt(config);
    expect(logWarn).toHaveBeenCalledWith(expect.stringContaining("redacted 2"));
  });

  it("includes persistent memory when present", async () => {
    const { readMemorySnippet } = await import("../src/core/memory.js");
    vi.mocked(readMemorySnippet).mockReturnValueOnce("learned: always use feature branches");
    const config = makeConfig();
    const prompt = buildPrompt(config);
    expect(prompt).toContain("Persistent Memory");
    expect(prompt).toContain("learned: always use feature branches");
  });

  it("skips memory section when no persistent memory", async () => {
    const { readMemorySnippet } = await import("../src/core/memory.js");
    vi.mocked(readMemorySnippet).mockReturnValueOnce("(no persistent memory yet)");
    const config = makeConfig();
    const prompt = buildPrompt(config);
    expect(prompt).not.toContain("Persistent Memory");
  });

  it("runs with enableDiff=true without throwing", () => {
    const config = makeConfig();
    writeFileSync(config.paths.youFile, "## Role\nDeveloper\n\n## Stack\nNode.js");
    expect(() => buildPrompt(config, true, 2)).not.toThrow();
  });

  it("truncates long meta section content", () => {
    const config = makeConfig({ promptBudgets: { memory: 500, you: 5, projects: 600, boundaries: 200, identity: 200, tools: 300, boot: 300 } });
    writeFileSync(config.paths.youFile, "## Role\n" + "word ".repeat(200));
    const prompt = buildPrompt(config);
    expect(prompt).toContain("truncated");
  });
});

describe("hashPrompt", () => {
  it("returns consistent hash for same input", () => {
    const h1 = hashPrompt("test prompt");
    const h2 = hashPrompt("test prompt");
    expect(h1).toBe(h2);
  });

  it("returns different hash for different input", () => {
    const h1 = hashPrompt("prompt A");
    const h2 = hashPrompt("prompt B");
    expect(h1).not.toBe(h2);
  });

  it("returns 16-char hex string", () => {
    const hash = hashPrompt("test");
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("estimatePromptTokens", () => {
  it("estimates tokens from prompt text", () => {
    const tokens = estimatePromptTokens("abcdefgh"); // 8 chars / 4 = 2
    expect(tokens).toBe(2);
  });
});

describe("logPromptStats", () => {
  it("does not throw", () => {
    expect(() => logPromptStats("test prompt")).not.toThrow();
  });
});
