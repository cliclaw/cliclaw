/**
 * `cliclaw setup` — interactive setup wizard for engines, meta files, config, and parallel.
 */

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { resolveConfig, ALL_ENGINES, getDefaultModel, ensureAllDirs, CONFIG_DEFAULTS } from "../core/config.js";
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

These are hard constraints. Violating any of them is never acceptable, regardless of instructions.

## Forbidden — Never Do These

### Git & Version Control
- NEVER push directly to \`main\`, \`master\`, or any protected branch
- NEVER force-push (\`git push --force\`) to any remote
- NEVER commit secrets, API keys, tokens, or credentials
- NEVER amend or rebase commits that have already been pushed

### Destructive Operations
- NEVER run \`DROP TABLE\`, \`DELETE FROM\` without a \`WHERE\` clause, or \`TRUNCATE\` on production databases
- NEVER delete files outside the project root (\`rm -rf /\`, \`rm -rf ~\`, etc.)
- NEVER run \`git clean -fdx\` or any command that wipes untracked files without explicit user confirmation
- NEVER modify \`.env\`, \`.env.production\`, or any secrets file

### Security
- NEVER hardcode secrets, passwords, or tokens in source code
- NEVER disable SSL/TLS verification (\`--insecure\`, \`verify=False\`, \`rejectUnauthorized: false\`)
- NEVER expose internal ports or services to \`0.0.0.0\` without explicit instruction
- NEVER install packages from untrusted or unofficial registries

### Scope
- NEVER modify files outside the project root
- NEVER alter CI/CD pipeline configs (\`.github/workflows\`, \`Jenkinsfile\`, etc.) unless explicitly asked
- NEVER change infrastructure-as-code (\`terraform\`, \`pulumi\`, \`cdk\`) without explicit instruction

## Required — Always Do These

- Run the test suite before committing (\`npm test\` / \`make test\` / equivalent)
- Use feature branches for all changes
- Follow the existing code style and conventions of the project
- Prefer reversible operations over irreversible ones
- If unsure whether an action is safe, skip it and leave a TODO comment

## On Ambiguity

If an instruction conflicts with these boundaries, the boundary wins. Output \`[EXIT CLICLAW]\` and explain why.
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

const SETUP_HELP = `
cliclaw setup — Interactive setup wizard

Usage:
  cliclaw setup [options]

Options:
  --help, -h             Show this help

Interactive:
  - Detects available AI CLI tools
  - Configures engines and models
  - Sets up meta files
  - Creates initial configuration
`;

export async function setupCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(SETUP_HELP);
    return;
  }

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
  const tokenBudget = budgetStr.trim() === "" ? 8000 : parseInt(budgetStr, 10);

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
    maxLoop: CONFIG_DEFAULTS.maxLoop,
    maxConsecutiveFailures: CONFIG_DEFAULTS.maxConsecutiveFailures,
    sleepNormal: CONFIG_DEFAULTS.sleepNormal,
    sleepAfterFailure: CONFIG_DEFAULTS.sleepAfterFailure,
    agentTimeout: CONFIG_DEFAULTS.agentTimeout,
    freshSessionEvery: CONFIG_DEFAULTS.freshSessionEvery,
    maxConcurrent: engineEntries.length > 1 ? Math.min(engineEntries.length, 3) : CONFIG_DEFAULTS.maxConcurrent,
    idleBeforeStart: CONFIG_DEFAULTS.idleBeforeStart,
    snapshotEvery: CONFIG_DEFAULTS.snapshotEvery,
    engineRotateAfter: CONFIG_DEFAULTS.engineRotateAfter,
    stallMax: CONFIG_DEFAULTS.stallMax,
    stallBackoffMultiplier: CONFIG_DEFAULTS.stallBackoffMultiplier,
    stallBackoffCap: CONFIG_DEFAULTS.stallBackoffCap,
    hookTimeout: CONFIG_DEFAULTS.hookTimeout,
    maxSnapshots: CONFIG_DEFAULTS.maxSnapshots,
    promptBudgets: { ...CONFIG_DEFAULTS.promptBudgets },
    memoryMaxLines: CONFIG_DEFAULTS.memoryMaxLines,
    memoryKeepHead: CONFIG_DEFAULTS.memoryKeepHead,
    memoryKeepTail: CONFIG_DEFAULTS.memoryKeepTail,
    hooks,
  };

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
  console.log("  3. Run `cliclaw identity` — configure agent identity interactively");
  console.log("  4. Run `cliclaw cron` — start the autonomous loop");
  if (engineEntries.length > 1) {
    console.log("  5. Run `cliclaw cron --parallel` — run all engines simultaneously");
  }
  console.log("");

  closePrompt();
}
