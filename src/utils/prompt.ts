/**
 * Minimal interactive terminal helpers — no external dependencies.
 */

import { createInterface, type Interface } from "node:readline";

let rl: Interface | undefined;

function getRL(): Interface {
  if (!rl) {
    rl = createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

export function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    getRL().question(question, (answer) => resolve(answer.trim()));
  });
}

export async function select(prompt: string, options: string[]): Promise<number> {
  console.log(`\n${prompt}`);
  options.forEach((opt, i) => console.log(`  ${i + 1}) ${opt}`));
  const answer = await ask("> ");
  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < options.length) return idx;
  return 0;
}

export async function multiSelect(prompt: string, options: string[]): Promise<number[]> {
  console.log(`\n${prompt} (comma-separated numbers, e.g. 1,3,4)`);
  options.forEach((opt, i) => console.log(`  ${i + 1}) ${opt}`));
  const answer = await ask("> ");
  const indices = answer
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((n) => n >= 0 && n < options.length);
  return indices.length > 0 ? indices : [0];
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await ask(`${question} ${hint} `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith("y");
}

export function closePrompt(): void {
  rl?.close();
  rl = undefined;
}
