/**
 * `cliclaw setup` — interactive setup wizard for engines, meta files, config, and parallel.
 */

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { resolveConfig, ALL_ENGINES, getDefaultModel, ensureAllDirs } from "../core/config.js";
import { initMemory } from "../core/memory.js";
import { ask, multiSelect, confirm, closePrompt } from "../utils/prompt.js";
import type { EngineName, EngineEntry, ProjectConfig } from "../core/types.js";

function checkCommand(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const ENGINE_COMMANDS: Record<EngineName, string> = {
  kiro: "kiro-cli",
  claude: "claude",
  cursor: "agent",
  codex: "codex",
  aider: "aider",
  gemini: "gemini",
  copilot: "copilot",
};

function initYouFile(path: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# About You

Describe who you are so the AI agent understands your context.

## Role
<!-- e.g. Senior Full-Stack Developer -->

## Tech Stack
<!-- e.g. TypeScript, Node.js, React, AWS -->

## Working Style
<!-- e.g. I prefer small PRs, TDD, trunk-based development -->
`);
}

function initProjectsFile(path: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# Projects

<!-- Describe your project structure, build commands, and conventions here. -->
<!-- The AI agent reads this file to understand how your codebase is organized. -->
<!-- Example below — replace with your own project details. -->

In my project we will have a \`./products/{name}/backend\` folder and a \`./products/{name}/frontend\` folder, and a \`Makefile\` to build and run the project.

Folder Structure:

- .cliclaw/
- products/
  - {name}/
    - backend/
    - frontend/
- Makefile
- .gitignore

## Makefile

\`make dev-fe {product-name}\` - will run the frontend development server
\`make dev-be {product-name}\` - will run the backend development server
\`make build-fe {product-name}\` - will build the frontend
\`make build-be {product-name}\` - will build the backend

<!-- Add more commands and conventions as needed -->

## .gitignore

\`\`\`
.cliclaw/cliclaw.lockdir/
.cliclaw/logs/
.cliclaw/tmp/
.cliclaw/snapshots/
\`\`\`
`);
}

function initBoundariesFile(path: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# Boundaries & Safety Rules

## Do NOT
- Delete or modify production databases
- Push directly to main/master branch
- Expose secrets or API keys in code
- Run destructive commands without confirmation
- Modify files outside the project root

## Always
- Run tests before committing
- Use feature branches
- Follow existing code conventions
`);
}

function initIdentityFile(path: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# Agent Identity

<!-- Fill in your agent's identity details -->

- **Name**: 
- **Role**: Autonomous coding assistant
- **Mission**: 
- **Emoji**: 🤖
`);
}

function initToolsFile(path: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# Available Tools

<!-- Document the tools and commands available in this environment -->

## Version Control
- \`git\` — standard git CLI

## Build & Test
- Document your build commands here (e.g. \`npm run build\`, \`make test\`)

## Environment Notes
- Document any local environment specifics here
`);
}

function initBootFile(path: string): void {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `# Boot Instructions

<!-- Optional startup instructions executed at the first cycle only -->
<!-- Leave empty if no special startup steps are needed -->

## On First Run
- Check for any pending tasks or TODOs
- Review recent git history for context
`);
}


export async function setupCommand(_args: string[]): Promise<void> {
  const config = resolveConfig();
  const { paths } = config;

  console.log("\n⚙️  CLIClaw Setup Wizard\n");

  // 1. Check available engines
  console.log("Checking available AI CLI agents...\n");
  const available: { name: EngineName; installed: boolean }[] = ALL_ENGINES.map((name) => ({
    name,
    installed: checkCommand(ENGINE_COMMANDS[name]),
  }));

  for (const eng of available) {
    const status = eng.installed ? "✅" : "❌";
    console.log(`  ${status} ${eng.name} (${ENGINE_COMMANDS[eng.name]})`);
  }

  const installedEngines = available.filter((e) => e.installed).map((e) => e.name);
  if (installedEngines.length === 0) {
    console.log("\n⚠️  No AI CLI agents found. Install at least one:");
    console.log("  - kiro-cli: https://kiro.dev");
    console.log("  - claude: npm install -g @anthropic-ai/claude-code");
    console.log("  - cursor: Cursor IDE agent CLI");
    console.log("  - codex: npm install -g @openai/codex");
    console.log("  - aider: pip install aider-chat");
    console.log("  - gemini: npm install -g @google/gemini-cli");
    closePrompt();
    return;
  }

  // 2. Select engines
  const selectedIndices = await multiSelect("Which engines do you want to use?", installedEngines);
  const selectedEngines = selectedIndices
    .map((i) => installedEngines[i])
    .filter((e): e is EngineName => e !== undefined);

  // 3. Configure engines with models and aliases
  const engineEntries: EngineEntry[] = [];
  const engineCounts = new Map<string, number>();
  for (const eng of selectedEngines) {
    engineCounts.set(eng, (engineCounts.get(eng) ?? 0) + 1);
  }

  // Ask how many instances of each engine
  const expandedEngines: EngineName[] = [];
  for (const eng of selectedEngines) {
    if (engineCounts.get(eng) === 1) {
      console.log(`\nHow many ${eng} instances? (default: 1)`);
      const countStr = await ask("> ");
      const count = parseInt(countStr, 10) || 1;
      for (let j = 0; j < count; j++) expandedEngines.push(eng);
    } else {
      expandedEngines.push(eng);
    }
  }

  // Check if aliases are needed (duplicate engine names)
  const needsAlias = new Map<string, number>();
  for (const eng of expandedEngines) {
    needsAlias.set(eng, (needsAlias.get(eng) ?? 0) + 1);
  }

  const aliasCounter = new Map<string, number>();
  for (const eng of expandedEngines) {
    const defaultModel = getDefaultModel(eng);
    const count = needsAlias.get(eng) ?? 1;
    const idx = (aliasCounter.get(eng) ?? 0) + 1;
    aliasCounter.set(eng, idx);

    const suffix = count > 1 ? ` (instance ${idx}/${count})` : "";
    console.log(`\nModel for ${eng}${suffix}? (default: ${defaultModel})`);
    const model = await ask("> ");

    const entry: EngineEntry = {
      engine: eng,
      model: model || defaultModel,
    };

    if (count > 1) {
      const defaultAlias = `${eng}${idx}`;
      console.log(`  Alias for this instance? (default: ${defaultAlias})`);
      const alias = await ask("  > ");
      entry.alias = alias || defaultAlias;
    }

    engineEntries.push(entry);
  }

  // 4. Token budget
  console.log("\nToken budget per cycle? (default: 8000, 0 = unlimited)");
  const budgetStr = await ask("> ");
  const tokenBudget = parseInt(budgetStr, 10) || 8000;

  // 5. Hooks
  console.log("\nConfigure hooks? (scripts to run at lifecycle points)");
  const configureHooks = await confirm("Set up hooks?", false);
  const hooks = { preCycle: [] as string[], postCycle: [] as string[], onSuccess: [] as string[], onFailure: [] as string[] };
  if (configureHooks) {
    console.log("  Post-success hook? (e.g. 'npm run lint', leave empty to skip)");
    const onSuccess = await ask("  > ");
    if (onSuccess) hooks.onSuccess.push(onSuccess);

    console.log("  Post-failure hook? (e.g. 'git stash', leave empty to skip)");
    const onFailure = await ask("  > ");
    if (onFailure) hooks.onFailure.push(onFailure);
  }

  // 6. Initialize meta files
  console.log("\n📁 Initializing project files...");
  ensureAllDirs(paths);

  initYouFile(paths.youFile);
  console.log(`  ✓ ${paths.youFile}`);
  initProjectsFile(paths.projectsFile);
  console.log(`  ✓ ${paths.projectsFile}`);
  initBoundariesFile(paths.boundariesFile);
  console.log(`  ✓ ${paths.boundariesFile}`);
  initIdentityFile(paths.identityFile);
  console.log(`  ✓ ${paths.identityFile}`);
  initToolsFile(paths.toolsFile);
  console.log(`  ✓ ${paths.toolsFile}`);
  initBootFile(paths.bootFile);
  console.log(`  ✓ ${paths.bootFile}`);
  initMemory(paths.memoryFile);
  console.log(`  ✓ ${paths.memoryFile}`);

  // 7. Write project config
  const projectConfig: ProjectConfig = {
    engines: engineEntries,
    tokenBudget,
    hooks,
  };

  if (engineEntries.length > 1) {
    projectConfig.maxConcurrent = Math.min(engineEntries.length, 3);
  }

  const writeConfig = await confirm(`Write config to ${paths.configFile}?`);
  if (writeConfig) {
    writeFileSync(paths.configFile, JSON.stringify(projectConfig, null, 2));
    console.log(`  ✓ ${paths.configFile}`);
  }

  // 8. Summary
  console.log("\n✅ Setup complete!\n");
  console.log("Next steps:");
  console.log("  1. Edit .cliclaw/meta/you.md — tell the AI about yourself");
  console.log("  2. Edit .cliclaw/meta/projects.md — describe your project structure and build commands");
  console.log("  3. Run `cliclaw personai` — configure agent identity interactively");
  console.log("  4. Run `cliclaw cron` — start the autonomous loop");
  if (engineEntries.length > 1) {
    console.log("  5. Run `cliclaw cron --parallel` — run all engines simultaneously");
  }
  console.log("");

  closePrompt();
}
