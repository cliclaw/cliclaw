/**
 * `cliclaw personai` — interactive AI persona configuration.
 * Asks questions to build the personai.md file.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolveConfig, ensureAllDirs } from "../core/config.js";
import { ask, confirm, closePrompt } from "../utils/prompt.js";

const QUESTIONS: { key: string; question: string; hint: string }[] = [
  {
    key: "tone",
    question: "What tone should the AI use?",
    hint: "e.g. professional, casual, concise, verbose, friendly",
  },
  {
    key: "expertise",
    question: "What areas of expertise should the AI prioritize?",
    hint: "e.g. TypeScript, Rust, DevOps, frontend, backend",
  },
  {
    key: "style",
    question: "How should the AI format its responses?",
    hint: "e.g. bullet points, code-heavy, minimal explanations, detailed",
  },
  {
    key: "avoid",
    question: "What should the AI avoid doing?",
    hint: "e.g. don't add comments, don't refactor unrelated code, don't use any type",
  },
  {
    key: "preferences",
    question: "Any coding preferences or conventions?",
    hint: "e.g. prefer functional style, use early returns, kebab-case files",
  },
  {
    key: "context",
    question: "Any additional context about how you work?",
    hint: "e.g. I work in monorepos, I use pnpm, I deploy to AWS",
  },
];

function buildPersonaiContent(answers: Record<string, string>): string {
  const sections: string[] = [
    "# AI Persona (personai)",
    "",
    "This file defines how the AI agent should behave, communicate, and prioritize.",
    "",
  ];

  if (answers["tone"]) {
    sections.push(`## Tone\n${answers["tone"]}\n`);
  }
  if (answers["expertise"]) {
    sections.push(`## Expertise\n${answers["expertise"]}\n`);
  }
  if (answers["style"]) {
    sections.push(`## Response Style\n${answers["style"]}\n`);
  }
  if (answers["avoid"]) {
    sections.push(`## Avoid\n${answers["avoid"]}\n`);
  }
  if (answers["preferences"]) {
    sections.push(`## Coding Preferences\n${answers["preferences"]}\n`);
  }
  if (answers["context"]) {
    sections.push(`## Additional Context\n${answers["context"]}\n`);
  }

  return sections.join("\n");
}

export async function personaiCommand(_args: string[]): Promise<void> {
  const config = resolveConfig();
  const personaiFile = config.paths.personaiFile;
  ensureAllDirs(config.paths);

  console.log("\n🤖 CLIClaw Persona Configuration\n");

  // Check if existing personai exists
  if (existsSync(personaiFile)) {
    const existing = readFileSync(personaiFile, "utf-8");
    console.log("Current personai.md:\n");
    console.log(existing);
    console.log("---\n");

    const update = await confirm("Update the persona?");
    if (!update) {
      closePrompt();
      return;
    }
  }

  const answers: Record<string, string> = {};

  for (const q of QUESTIONS) {
    console.log(`\n${q.question}`);
    console.log(`  (${q.hint})`);
    const answer = await ask("> ");
    if (answer) answers[q.key] = answer;
  }

  // Allow free-form additions
  console.log("\nAnything else to add? (press Enter to skip)");
  const extra = await ask("> ");
  if (extra) answers["extra"] = extra;

  const content = buildPersonaiContent(answers);

  console.log("\n--- Preview ---");
  console.log(content);
  console.log("--- End Preview ---\n");

  const save = await confirm("Save this persona?");
  if (save) {
    writeFileSync(personaiFile, content);
    console.log(`✅ Saved to ${personaiFile}`);
  } else {
    console.log("Discarded.");
  }

  closePrompt();
}
