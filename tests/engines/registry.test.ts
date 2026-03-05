import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { getEngine, getAllEngines, isEngineAvailable } from "../src/engines/registry.js";

describe("getEngine", () => {
  it("returns config for all known engines", () => {
    const names = ["kiro", "claude", "cursor", "codex", "aider", "gemini", "copilot"] as const;
    for (const name of names) {
      const engine = getEngine(name);
      expect(engine.name).toBe(name);
      expect(engine.command).toBeTruthy();
      expect(engine.timeout).toBeGreaterThan(0);
    }
  });

  it("kiro uses kiro-cli command", () => {
    const engine = getEngine("kiro");
    expect(engine.command).toBe("kiro-cli");
    expect(engine.stdinPrompt).toBe(false);
  });

  it("cursor uses agent command and stdinPrompt", () => {
    const engine = getEngine("cursor");
    expect(engine.command).toBe("agent");
    expect(engine.stdinPrompt).toBe(true);
  });

  it("copilot uses copilot command", () => {
    const engine = getEngine("copilot");
    expect(engine.command).toBe("copilot");
  });

  it("throws for unknown engine", () => {
    expect(() => getEngine("unknown" as any)).toThrow("Unknown engine");
  });
});

describe("buildArgs", () => {
  it("kiro builds correct args", () => {
    const engine = getEngine("kiro");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: false, model: "m1" });
    expect(args).toContain("chat");
    expect(args).toContain("--no-interactive");
    expect(args).toContain("--model");
    expect(args).toContain("m1");
    expect(args).toContain("test");
  });

  it("kiro adds --resume when resume=true", () => {
    const engine = getEngine("kiro");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: true, model: "m1" });
    expect(args).toContain("--resume");
  });

  it("claude builds correct args", () => {
    const engine = getEngine("claude");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: false, model: "m1" });
    expect(args).toContain("--dangerously-skip-permissions");
    expect(args).toContain("-p");
    expect(args).toContain("test");
  });

  it("claude adds --continue when resume=true", () => {
    const engine = getEngine("claude");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: true, model: "m1" });
    expect(args).toContain("--continue");
  });

  it("cursor builds correct args", () => {
    const engine = getEngine("cursor");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: false, model: "m1" });
    expect(args).toContain("--yolo");
    expect(args).toContain("--model");
    expect(args).toContain("m1");
  });

  it("codex builds correct args", () => {
    const engine = getEngine("codex");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: false, model: "m1" });
    expect(args).toContain("--full-auto");
    expect(args).toContain("--quiet");
    expect(args).toContain("test");
  });

  it("aider builds correct args", () => {
    const engine = getEngine("aider");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: false, model: "m1" });
    expect(args).toContain("--yes-always");
    expect(args).toContain("--message");
    expect(args).toContain("test");
  });

  it("gemini builds correct args", () => {
    const engine = getEngine("gemini");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: false, model: "m1" });
    expect(args).toContain("-p");
    expect(args).toContain("test");
  });

  it("copilot builds correct args", () => {
    const engine = getEngine("copilot");
    const args = engine.buildArgs({ prompt: "test", inputFile: "/tmp/in", resume: false, model: "m1" });
    expect(args).toContain("-p");
    expect(args).toContain("test");
    expect(args).toContain("--model");
  });
});

describe("getAllEngines", () => {
  it("returns all 7 engines", () => {
    const all = getAllEngines();
    expect(all).toHaveLength(7);
  });
});

describe("isEngineAvailable", () => {
  it("returns true when command exists", () => {
    vi.mocked(execSync).mockImplementation(() => Buffer.from(""));
    expect(isEngineAvailable("kiro")).toBe(true);
  });

  it("returns false when command not found", () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error("not found"); });
    expect(isEngineAvailable("kiro")).toBe(false);
  });

  it("returns false for unknown engine", () => {
    expect(isEngineAvailable("unknown" as any)).toBe(false);
  });
});
