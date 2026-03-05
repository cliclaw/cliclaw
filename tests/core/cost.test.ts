import { describe, it, expect } from "vitest";
import {
  getModelPricing,
  estimateCost,
  formatCost,
  estimateTokens,
  getEnginePricing,
} from "../src/core/cost.js";

describe("getModelPricing", () => {
  it("returns pricing for known models", () => {
    const opus = getModelPricing("claude-opus-4.6");
    expect(opus.input).toBe(15);
    expect(opus.output).toBe(75);

    const sonnet = getModelPricing("claude-sonnet-4.6");
    expect(sonnet.input).toBe(3);
    expect(sonnet.output).toBe(15);

    const gpt = getModelPricing("gpt-4.1");
    expect(gpt.input).toBe(2);
    expect(gpt.output).toBe(8);

    const gemini = getModelPricing("gemini-2.5-pro");
    expect(gemini.input).toBe(1.25);
    expect(gemini.output).toBe(10);

    const o4 = getModelPricing("o4-mini");
    expect(o4.input).toBe(1.1);
    expect(o4.output).toBe(4.4);
  });

  it("returns default pricing for unknown models", () => {
    const unknown = getModelPricing("unknown-model-xyz");
    expect(unknown.input).toBe(3);
    expect(unknown.output).toBe(15);
  });
});

describe("estimateCost", () => {
  it("calculates cost correctly", () => {
    // 1M input tokens at $3/M + 1M output tokens at $15/M = $18
    const cost = estimateCost("claude-sonnet-4.6", 1_000_000, 1_000_000);
    expect(cost).toBe(18);
  });

  it("returns 0 for 0 tokens", () => {
    expect(estimateCost("claude-opus-4.6", 0, 0)).toBe(0);
  });

  it("handles small token counts", () => {
    const cost = estimateCost("claude-sonnet-4.6", 1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1);
  });
});

describe("formatCost", () => {
  it("formats small costs in cents", () => {
    expect(formatCost(0.005)).toMatch(/¢/);
  });

  it("formats larger costs in dollars", () => {
    const result = formatCost(1.5);
    expect(result).toBe("$1.5000");
  });

  it("formats zero", () => {
    expect(formatCost(0)).toMatch(/¢/);
  });
});

describe("estimateTokens", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });

  it("rounds up", () => {
    expect(estimateTokens("abcde")).toBe(2); // 5/4 = 1.25 → ceil = 2
  });
});

describe("getEnginePricing", () => {
  it("delegates to getModelPricing", () => {
    const pricing = getEnginePricing("kiro", "claude-opus-4.6");
    expect(pricing.input).toBe(15);
    expect(pricing.output).toBe(75);
  });
});
