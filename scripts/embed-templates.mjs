#!/usr/bin/env node
/**
 * Reads each content.md and regenerates the corresponding index.ts
 * with the markdown embedded as a template literal.
 *
 * Usage: node scripts/embed-templates.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TEMPLATES = {
  "ceo":              { var: "ceo",             name: "CEO/Founder",                  desc: "Strategic, product-focused, business-oriented leadership",  agent: "kiro",   alias: "ceo",      skills: [], sleep: 86400 },
  "cto":              { var: "cto",             name: "CTO",                          desc: "Technical architecture, quality, and engineering leadership", agent: "kiro",   alias: "cto",      skills: [], sleep: 14400 },
  "staff-engineer":   { var: "staffEngineer",   name: "Staff Engineer",               desc: "Full-stack implementation, code quality, best practices",    agent: "kiro",   alias: "staff",    skills: [], sleep: 7200 },
  "typescript-dev":   { var: "typescriptDev",   name: "TypeScript Developer",         desc: "Type-safe Node.js, modern JavaScript/TypeScript",            agent: "codex",  alias: "ts-dev",   skills: [], sleep: 300 },
  "go-dev":           { var: "goDev",           name: "Go Developer",                 desc: "Backend services, concurrency, Go idioms",                   agent: "gemini", alias: "go-dev",   skills: [], sleep: 300 },
  "frontend-svelte":  { var: "frontendSvelte",  name: "Frontend Developer (Svelte)",  desc: "Svelte 5, reactive UI, component architecture",              agent: "claude", alias: "frontend", skills: ["tailwindcss", "daisyui", "svelte-sonner"], sleep: 300 },
  "mobile-flutter":   { var: "mobileFlutter",   name: "Mobile Developer (Flutter)",   desc: "Cross-platform mobile, Flutter/Dart, responsive design",     agent: "gemini", alias: "mobile",   skills: [], sleep: 300 },
  "qa-playwright":    { var: "qaPlaywright",     name: "QA Engineer (Playwright)",     desc: "E2E testing, test automation, quality assurance",             agent: "codex",  alias: "qa",       skills: [], sleep: 3600 },
};

const SKILLS = {
  "tailwindcss":   { var: "tailwindcss",  name: "Tailwind CSS",   desc: "Utility-first CSS framework",       cat: "styling" },
  "daisyui":       { var: "daisyui",      name: "DaisyUI",        desc: "Tailwind CSS component library",    cat: "ui-components" },
  "skeleton-ui":   { var: "skeletonUi",   name: "Skeleton UI",    desc: "Svelte UI component library",       cat: "ui-components" },
  "svelte-sonner": { var: "svelteSonner", name: "Svelte Sonner",  desc: "Toast notifications for Svelte",    cat: "ui-components" },
};

function escapeTemplateLiteral(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

for (const [id, m] of Object.entries(TEMPLATES)) {
  const md = readFileSync(join("src/config/templates", id, "content.md"), "utf-8");
  const skillsStr = m.skills.length ? `["${m.skills.join('", "')}"]` : "[]";
  writeFileSync(join("src/config/templates", id, "index.ts"),
`import type { IdentityTemplate } from "../types.js";

export const ${m.var}: IdentityTemplate = {
  id: "${id}",
  name: "${m.name}",
  description: "${m.desc}",
  defaultAgent: "${m.agent}",
  defaultAlias: "${m.alias}",
  skills: ${skillsStr},
  sleepNormal: ${m.sleep},
  content: \`${escapeTemplateLiteral(md)}\`,
};
`);
  console.log(`  ✓ templates/${id}`);
}

for (const [id, m] of Object.entries(SKILLS)) {
  const md = readFileSync(join("src/config/skills", id, "content.md"), "utf-8");
  writeFileSync(join("src/config/skills", id, "index.ts"),
`import type { SkillTemplate } from "../types.js";

export const ${m.var}: SkillTemplate = {
  id: "${id}",
  name: "${m.name}",
  description: "${m.desc}",
  category: "${m.cat}",
  content: \`${escapeTemplateLiteral(md)}\`,
};
`);
  console.log(`  ✓ skills/${id}`);
}

console.log("Done.");
