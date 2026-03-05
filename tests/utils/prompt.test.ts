import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInterface } from "node:readline";

// We need to mock readline to test the prompt utilities
vi.mock("node:readline", () => {
  const mockQuestion = vi.fn();
  const mockClose = vi.fn();
  return {
    createInterface: vi.fn(() => ({
      question: mockQuestion,
      close: mockClose,
    })),
  };
});

import { ask, select, multiSelect, confirm, closePrompt } from "../src/utils/prompt.js";

function getRL() {
  const rl = vi.mocked(createInterface).mock.results[0]?.value as any;
  return rl;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the module-level rl by calling closePrompt
  closePrompt();
});

describe("ask", () => {
  it("returns trimmed answer", async () => {
    const promise = ask("question? ");
    const rl = getRL();
    // Simulate user typing
    const callback = rl.question.mock.calls[0][1];
    callback("  answer  ");
    const result = await promise;
    expect(result).toBe("answer");
  });
});

describe("select", () => {
  it("returns selected index", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const promise = select("Pick one:", ["a", "b", "c"]);
    const rl = getRL();
    const callback = rl.question.mock.calls[0][1];
    callback("2");
    const result = await promise;
    expect(result).toBe(1); // 0-indexed
    consoleSpy.mockRestore();
  });

  it("defaults to 0 for invalid input", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const promise = select("Pick:", ["a", "b"]);
    const rl = getRL();
    const callback = rl.question.mock.calls[0][1];
    callback("invalid");
    const result = await promise;
    expect(result).toBe(0);
    consoleSpy.mockRestore();
  });
});

describe("multiSelect", () => {
  it("returns selected indices", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const promise = multiSelect("Pick:", ["a", "b", "c"]);
    const rl = getRL();
    const callback = rl.question.mock.calls[0][1];
    callback("1,3");
    const result = await promise;
    expect(result).toEqual([0, 2]);
    consoleSpy.mockRestore();
  });

  it("defaults to [0] for empty input", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const promise = multiSelect("Pick:", ["a", "b"]);
    const rl = getRL();
    const callback = rl.question.mock.calls[0][1];
    callback("");
    const result = await promise;
    expect(result).toEqual([0]);
    consoleSpy.mockRestore();
  });
});

describe("confirm", () => {
  it("returns true for 'y'", async () => {
    const promise = confirm("Sure?");
    const rl = getRL();
    const callback = rl.question.mock.calls[0][1];
    callback("y");
    expect(await promise).toBe(true);
  });

  it("returns false for 'n'", async () => {
    const promise = confirm("Sure?");
    const rl = getRL();
    const callback = rl.question.mock.calls[0][1];
    callback("n");
    expect(await promise).toBe(false);
  });

  it("returns defaultYes=true for empty input", async () => {
    const promise = confirm("Sure?", true);
    const rl = getRL();
    const callback = rl.question.mock.calls[0][1];
    callback("");
    expect(await promise).toBe(true);
  });

  it("returns defaultYes=false for empty input", async () => {
    const promise = confirm("Sure?", false);
    const rl = getRL();
    const callback = rl.question.mock.calls[0][1];
    callback("");
    expect(await promise).toBe(false);
  });
});

describe("closePrompt", () => {
  it("closes readline and allows re-creation", async () => {
    // Trigger rl creation
    const p = ask("test");
    const rl = getRL();
    rl.question.mock.calls[0][1]("answer");
    await p;

    closePrompt();
    expect(rl.close).toHaveBeenCalled();
  });
});
