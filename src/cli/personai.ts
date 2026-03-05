/**
 * `cliclaw personai` — interactive AI identity/persona configuration.
 * Asks questions to build the identity.md file.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolveConfig, ensureAllDirs } from "../core/config.js";
import { ask, confirm, closePrompt } from "../utils/prompt.js";

const QUESTIONS: { key: string; question: string; hint: string }[] = [
  {
    key: "name",
    question: "What is the agent's name?",
    hint: "e.g. ClawDev, CodeBot, DevAgent",
  },
  {
    key: "role",
    question: "What is the agent's role?",
    hint: "e.g. Autonomous coding assistant, Code reviewer, DevOps engineer",
  },
  {
    key: "mission",
    question: "What is the agent's mission?",
    hint: "e.g. Automate development workflows, Keep the codebase clean",
  },
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
];

function buildIdentityContent(answers: Record<string, string>): string {
  const sections: string[] = [
    "# Agent Identity",
    "",
    "This file defines who the AI agent is and how it should behave.",
    "",
  ];

  if (answers["name"]) sections.push(`## Name\n${answers["name"]}\n`);
  if (answers["role"]) sections.push(`## Role\n${answers["role"]}\n`);
  if (answers["mission"]) sections.push(`## Mission\n${answers["mission"]}\n`);
  if (answers["tone"]) sections.push(`## Tone\n${answers["tone"]}\n`);
  if (answers["expertise"]) sections.push(`## Expertise\n${answers["expertise"]}\n`);
  if (answers["style"]) sections.push(`## Response Style\n${answers["style"]}\n`);
  if (answers["avoid"]) sections.push(`## Avoid\n${answers["avoid"]}\n`);
  if (answers["preferences"]) sections.push(`## Coding Preferences\n${answers["preferences"]}\n`);

  return sections.join("\n");
}

export async function identityCommand(_args: string[]): Promise<void> {
  const config = resolveConfig();
  const identityFile = config.paths.identityFile;
  ensureAllDirs(config.paths);

  console.log("\n🤖 CLIClaw Agent Identity Configuration\n");

  if (existsSync(identityFile)) {
    const existing = readFileSync(identityFile, "utf-8");
    console.log("Current identity.md:\n");
    console.log(existing);
    console.log("---\n");

    const update = await confirm("Update the identity?");
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

  const content = buildIdentityContent(answers);

  console.log("\n--- Preview ---");
  console.log(content);
  console.log("--- End Preview ---\n");

  const save = await confirm("Save this identity?");
  if (save) {
    writeFileSync(identityFile, content);
    console.log(`✅ Saved to ${identityFile}`);
  } else {
    console.log("Discarded.");
  }

  closePrompt();
}
