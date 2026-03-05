/**
 * Cost tracking — per-model pricing and estimation.
 */

import type { EngineName, ModelPricing } from "./types.js";

/** USD per 1M tokens — approximate public pricing as of early 2026 */
const PRICING: Record<string, ModelPricing> = {
  // Anthropic (kiro models)
  "claude-opus-4.6": { input: 15, output: 75 },
  "claude-sonnet-4.6": { input: 3, output: 15 },
  "claude-opus-4.5": { input: 15, output: 75 },
  "claude-sonnet-4.5": { input: 3, output: 15 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-haiku-4.5": { input: 0.8, output: 4 },
  // Anthropic (claude-code)
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "sonnet": { input: 3, output: 15 },
  // OpenAI
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-5.2-high": { input: 10, output: 30 },
  "o4-mini": { input: 1.1, output: 4.4 },
  // Google
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  // Fallback
  "_default": { input: 3, output: 15 },
};

export function getModelPricing(model: string): ModelPricing {
  return PRICING[model] ?? PRICING["_default"]!;
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(model);
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Engine-specific default pricing lookup */
export function getEnginePricing(_engine: EngineName, model: string): ModelPricing {
  return getModelPricing(model);
}
