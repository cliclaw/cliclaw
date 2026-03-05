import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
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
    engines: [{ engine: "kiro", model: "test-model", alias: "kiro" }],
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

  it("includes personai when present", () => {
    const config = makeConfig();
    writeFileSync(config.paths.personaiFile, "## Tone\nProfessional and concise.\n\n## Expertise\nTypeScript");
    const prompt = buildPrompt(config);
    expect(prompt).toContain("AI Persona");
  });

  it("includes boundaries when present", () => {
    const config = makeConfig();
    writeFileSync(config.paths.boundariesFile, "## Do NOT\n- Delete production databases\n- Push to main");
    const prompt = buildPrompt(config);
    expect(prompt).toContain("Boundaries");
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
