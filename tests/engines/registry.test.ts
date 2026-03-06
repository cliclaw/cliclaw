import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { getEngine, getAllEngines, isEngineAvailable, parseStreamLine } from "../src/engines/registry.js";

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

describe("parseStreamLine", () => {
  it("returns null for empty/whitespace line", () => {
    expect(parseStreamLine("")).toBeNull();
    expect(parseStreamLine("   ")).toBeNull();
  });

  it("returns plain text line with newline", () => {
    expect(parseStreamLine("hello world")).toBe("hello world\n");
  });

  it("parses cursor full assistant message (with model_call_id)", () => {
    const line = JSON.stringify({
      type: "assistant",
      model_call_id: "abc",
      message: { content: [{ type: "text", text: "cursor output" }] },
    });
    expect(parseStreamLine(line)).toBe("cursor output\n");
  });

  it("returns null for cursor full message with no text content", () => {
    const line = JSON.stringify({
      type: "assistant",
      model_call_id: "abc",
      message: { content: [{ type: "tool_use" }] },
    });
    expect(parseStreamLine(line)).toBeNull();
  });

  it("parses cursor streaming delta (no model_call_id)", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "delta" }] },
    });
    expect(parseStreamLine(line)).toBe("delta");
  });

  it("returns null for cursor delta with no text", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use" }] },
    });
    expect(parseStreamLine(line)).toBeNull();
  });

  it("parses claude text_delta stream event", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { delta: { type: "text_delta", text: "claude chunk" } },
    });
    expect(parseStreamLine(line)).toBe("claude chunk");
  });

  it("returns null for non-text_delta stream event", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { delta: { type: "input_json_delta" } },
    });
    expect(parseStreamLine(line)).toBeNull();
  });

  it("parses claude result line", () => {
    const line = JSON.stringify({ type: "result", result: "final answer" });
    expect(parseStreamLine(line)).toBe("final answer\n");
  });

  it("returns null for unrecognized JSON object", () => {
    const line = JSON.stringify({ type: "unknown_event" });
    expect(parseStreamLine(line)).toBeNull();
  });
});

describe("parseOutput functions", () => {
  describe("cursor parseOutput (parseCursorOutput)", () => {
    const engine = getEngine("cursor");

    it("extracts text from assistant messages with model_call_id", () => {
      const line = JSON.stringify({
        type: "assistant",
        model_call_id: "abc",
        message: { content: [{ type: "text", text: "hello" }] },
      });
      expect(engine.parseOutput!(line)).toBe("hello");
    });

    it("falls back to raw stdout when no matching lines", () => {
      expect(engine.parseOutput!("plain text output")).toBe("plain text output");
    });

    it("skips non-JSON lines", () => {
      const line = JSON.stringify({
        type: "assistant",
        model_call_id: "abc",
        message: { content: [{ type: "text", text: "msg" }] },
      });
      expect(engine.parseOutput!("not json\n" + line)).toBe("msg");
    });

    it("skips assistant messages without model_call_id", () => {
      const line = JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "skip" }] } });
      expect(engine.parseOutput!(line)).toBe(line);
    });
  });

  describe("claude parseOutput (parseClaudeOutput)", () => {
    const engine = getEngine("claude");

    it("extracts text from stream_event text_delta lines", () => {
      const line = JSON.stringify({
        type: "stream_event",
        event: { delta: { type: "text_delta", text: "chunk" } },
      });
      expect(engine.parseOutput!(line)).toBe("chunk");
    });

    it("returns result field from result line", () => {
      const line = JSON.stringify({ type: "result", result: "final" });
      expect(engine.parseOutput!(line)).toBe("final");
    });

    it("parses plain JSON with result field", () => {
      expect(engine.parseOutput!(JSON.stringify({ result: "plain json" }))).toBe("plain json");
    });

    it("falls back to raw stdout for unrecognized format", () => {
      expect(engine.parseOutput!("raw output")).toBe("raw output");
    });

    it("skips non-text_delta stream events", () => {
      const line = JSON.stringify({ type: "stream_event", event: { delta: { type: "other" } } });
      expect(engine.parseOutput!(line)).toBe(line);
    });
  });

  describe("gemini parseOutput (parseGeminiOutput)", () => {
    const engine = getEngine("gemini");

    it("extracts response field from JSON", () => {
      expect(engine.parseOutput!(JSON.stringify({ response: "gemini answer" }))).toBe("gemini answer");
    });

    it("falls back to raw stdout for non-JSON", () => {
      expect(engine.parseOutput!("raw gemini output")).toBe("raw gemini output");
    });

    it("falls back when response field is not a string", () => {
      expect(engine.parseOutput!(JSON.stringify({ response: 42 }))).toBe(JSON.stringify({ response: 42 }));
    });
  });
});
