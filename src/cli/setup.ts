/**
 * `cliclaw setup` — interactive setup wizard with modern TUI
 */

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { join } from "node:path";
import { input, select, checkbox, confirm } from "@inquirer/prompts";
import { resolveConfig, ALL_AGENTS, ensureAllDirs, CONFIG_DEFAULTS } from "../core/config.js";
import { initMemory } from "../core/memory.js";
import { AGENT_MODELS, DEFAULT_MODELS, AGENT_COMMANDS, IDENTITY_TEMPLATES, PRESET_OPTIONS, getTemplate, getSkillContent } from "../config/index.js";
import { searchableSelect } from "../utils/searchable-select.js";
import type { AgentName, AgentEntry, ProjectConfig } from "../core/types.js";

/** Known role hierarchy tiers (top → bottom) */
const ROLE_TIERS: string[][] = [
  ["ceo", "founder", "owner"],
  ["cto", "vp-engineering", "director"],
  ["staff-engineer", "tech-lead", "architect", "lead"],
  // everything else is leaf
];

/** Build communication graph: each agent talks to its tier neighbors */
function buildCommunicationGraph(agents: AgentEntry[]): Record<string, string[]> {
  const aliases = agents.map(a => a.alias || a.agent);
  
  // Assign tier index per agent (lower = higher rank)
  const tierOf = (alias: string): number => {
    for (let i = 0; i < ROLE_TIERS.length; i++) {
      if (ROLE_TIERS[i]!.some(r => alias.includes(r))) return i;
    }
    return ROLE_TIERS.length;
  };

  // Group by tier
  const byTier = new Map<number, string[]>();
  for (const a of aliases) {
    const t = tierOf(a);
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(a);
  }

  const tiers = [...byTier.keys()].sort((a, b) => a - b);
  const graph: Record<string, string[]> = {};

  for (let i = 0; i < tiers.length; i++) {
    const current = byTier.get(tiers[i]!) ?? [];
    const above = i > 0 ? (byTier.get(tiers[i - 1]!) ?? []) : [];
    const below = i < tiers.length - 1 ? (byTier.get(tiers[i + 1]!) ?? []) : [];

    for (const agent of current) {
      // Can talk to same tier + adjacent tiers
      graph[agent] = [
        ...above,
        ...current.filter(a => a !== agent),
        ...below,
      ];
    }
  }

  return graph;
}

function checkCommand(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

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

async function installTrackerTool(): Promise<void> {
  console.log("\n📦 Installing tracker...");
  
  const { homedir } = await import("node:os");
  const trackerDir = join(homedir(), ".cliclaw", "tracker");
  
  try {
    // Check if already installed
    if (existsSync(join(trackerDir, "tracker"))) {
      console.log("  ✓ Tracker already installed");
      return;
    }

    // Download from GitHub releases
    const os = process.platform;
    const arch = process.arch;
    
    console.log(`  Downloading tracker for ${os}-${arch}...`);
    console.log("  ⚠️  Tracker repository not yet available");
    console.log("  Coming soon: https://github.com/cliclaw/tracker");
    console.log("\n  For now, tracker events will be logged to .cliclaw/tracker.jsonl");
    console.log("  You can build a custom viewer or wait for the official release.");
    
  } catch (err) {
    console.error(`  ❌ Failed to install tracker: ${err instanceof Error ? err.message : String(err)}`);
    console.log("  You can install it manually later with: cliclaw tracker");
  }
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

  // 1. Preset selection with search
  const presetChoice = await searchableSelect(
    "Choose a team preset (type to search):",
    PRESET_OPTIONS.map(p => ({
      name: p.name,
      value: p.id,
      description: `${p.description} [${p.tags.join(", ")}]`
    }))
  );
  
  let engineEntries: AgentEntry[] = [];
  
  // Detect installed agents once
  const installedEngines = ALL_AGENTS.filter(name => checkCommand(AGENT_COMMANDS[name]));
  if (installedEngines.length === 0) {
    console.log("\n⚠️  No AI CLI agents found. Install at least one:");
    console.log("  - kiro-cli: https://kiro.dev");
    console.log("  - claude: npm install -g @anthropic-ai/claude-code");
    console.log("  - cursor: Cursor IDE agent CLI");
    return;
  }

  if (presetChoice !== "custom") {
    const preset = PRESET_OPTIONS.find(p => p.id === presetChoice);
    if (!preset || !preset.agents.length) {
      console.error("  ❌ Invalid preset selection");
      return;
    }
    console.log(`\n✓ Loaded preset: ${preset.name}`);
    console.log(`  ${preset.description}\n`);

    // Let user pick which preset agents to include
    const selectedAliases = await checkbox({
      message: "Select agents to include (space to toggle):",
      choices: preset.agents.map(a => ({
        name: `${a.alias ?? a.agent} (${a.identity ?? "no identity"})`,
        value: a.alias ?? a.agent,
        checked: true,
      })),
      required: true,
    });
    const selectedPresetAgents = preset.agents.filter(a => selectedAliases.includes(a.alias ?? a.agent));

    // Let user customize engine/model for each preset agent
    for (const presetAgent of selectedPresetAgents) {
      const role = presetAgent.alias ?? presetAgent.identity ?? presetAgent.agent;
      console.log(`\n📝 ${role}`);

      const selectedAgent = await select({
        message: `  Engine:`,
        choices: installedEngines.map(e => ({ name: e, value: e })),
        default: installedEngines.includes(presetAgent.agent) ? presetAgent.agent : installedEngines[0]
      });

      const models = AGENT_MODELS[selectedAgent];
      const selectedModel = await select({
        message: `  Model:`,
        choices: models.map(m => ({ name: m, value: m })),
        default: models.includes(presetAgent.model) ? presetAgent.model : DEFAULT_MODELS[selectedAgent]
      });

      engineEntries.push({
        ...presetAgent,
        agent: selectedAgent,
        model: selectedModel,
      });
    }

    // Offer to add more agents beyond the preset
    const addMore = await confirm({
      message: "Add more agents to this preset?",
      default: false
    });
    if (addMore) {
      const existingIds = new Set(engineEntries.map(e => e.identity));
      const extraOptions = IDENTITY_TEMPLATES
        .filter(t => !existingIds.has(t.id))
        .map(t => ({ name: `${t.name} - ${t.description}`, value: t.id }));

      if (extraOptions.length > 0) {
        const extraIds = await checkbox({
          message: "Select additional agents:",
          choices: extraOptions,
        });
        for (const id of extraIds) {
          const template = IDENTITY_TEMPLATES.find(t => t.id === id);
          if (!template) continue;
          console.log(`\n📝 ${template.name}`);

          const agent = await select({
            message: `  Engine:`,
            choices: installedEngines.map(e => ({ name: e, value: e })),
            default: installedEngines.includes(template.defaultAgent as AgentName) ? template.defaultAgent : installedEngines[0]
          });
          const models = AGENT_MODELS[agent];
          const model = await select({
            message: `  Model:`,
            choices: models.map(m => ({ name: m, value: m })),
            default: DEFAULT_MODELS[agent]
          });
          engineEntries.push({
            agent, model,
            alias: template.defaultAlias,
            identity: template.id,
            skills: template.skills.length ? [...template.skills] : undefined,
            sleepNormal: template.sleepNormal,
          });
        }
      } else {
        console.log("  All identity templates are already in the preset.");
      }
    }
  }
  
  if (engineEntries.length === 0) {
    // 2. Identity selection (multiple with checkboxes)
    const identityOptions = IDENTITY_TEMPLATES.map((t, idx) => ({
      name: `${t.name} - ${t.description}`,
      value: idx
    }));
    
    const selectedIdentityIndices = await checkbox({
      message: "Select identity templates for your agents (space to select, enter to confirm):",
      choices: identityOptions,
      required: true
    });
    
    // 3. Configure each selected identity
    for (const idx of selectedIdentityIndices) {
      const template = IDENTITY_TEMPLATES[idx];
      if (!template) continue;
      
      console.log(`\n📝 Configuring: ${template.name}`);
      
      // Agent selection
      const selectedAgent = await select({
        message: `Select agent for ${template.name}:`,
        choices: installedEngines.map(e => ({ name: e, value: e })),
        default: installedEngines.includes(template.defaultAgent as AgentName) ? template.defaultAgent : installedEngines[0]
      });
      
      // Model selection
      const models = AGENT_MODELS[selectedAgent];
      const defaultModel = DEFAULT_MODELS[selectedAgent];
      const selectedModel = await select({
        message: "Select model:",
        choices: models.map(m => ({ name: m, value: m })),
        default: defaultModel
      });
      
      // Alias input
      const defaultAlias = template.defaultAlias;
      const alias = await input({
        message: "Alias:",
        default: defaultAlias
      });
      
      engineEntries.push({
        agent: selectedAgent,
        model: selectedModel,
        alias: alias || defaultAlias,
        identity: template.id
      });
    }
  }

  // 4. Token budget
  const tokenBudget = parseInt(await input({
    message: "Token budget per cycle:",
    default: "8000"
  }), 10);

  // 5. Hooks
  const configureHooks = await confirm({
    message: "Configure hooks? (scripts to run at lifecycle points)",
    default: false
  });
  
  const hooks = { preCycle: [] as string[], postCycle: [] as string[], onSuccess: [] as string[], onFailure: [] as string[] };
  if (configureHooks) {
    const onSuccess = await input({
      message: "Post-success hook (e.g. 'npm run lint', leave empty to skip):",
      default: ""
    });
    if (onSuccess) hooks.onSuccess.push(onSuccess);

    const onFailure = await input({
      message: "Post-failure hook (e.g. 'git stash', leave empty to skip):",
      default: ""
    });
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
  
  // 6. Initialize meta files
  console.log("\n📁 Initializing project files...");
  ensureAllDirs(paths);

  initYouFile(paths.youFile);
  console.log(`  ✓ ${paths.youFile}`);
  initProjectsFile(paths.projectsFile);
  console.log(`  ✓ ${paths.projectsFile}`);
  initBoundariesFile(paths.boundariesFile);
  console.log(`  ✓ ${paths.boundariesFile}`);
  
  // Create identity files and export skills for each agent
  const skillsDir = join(paths.metaDir, "skills");
  mkdirSync(skillsDir, { recursive: true });

  for (const entry of engineEntries) {
    if (entry.identity) {
      const template = getTemplate(entry.identity);
      const identityPath = join(paths.metaDir, `identity-${entry.alias || entry.agent}.md`);
      if (!existsSync(identityPath)) {
        if (template) {
          writeFileSync(identityPath, template.content);
          console.log(`  ✓ ${identityPath} (from template: ${entry.identity})`);
        } else {
          initIdentityFile(identityPath);
          console.log(`  ⚠️  ${identityPath} (no template for ${entry.identity}, using default)`);
        }
      }
      entry.identity = `meta/identity-${entry.alias || entry.agent}.md`;

      // Link skills and sleepNormal from template
      if (template?.skills.length && !entry.skills?.length) {
        entry.skills = [...template.skills];
      }
      if (template && !entry.sleepNormal) {
        entry.sleepNormal = template.sleepNormal;
      }
    }

    // Export skill content files
    if (entry.skills?.length) {
      for (const skillId of entry.skills) {
        const skillPath = join(skillsDir, `${skillId}.md`);
        if (!existsSync(skillPath)) {
          const content = getSkillContent(skillId);
          if (content) {
            writeFileSync(skillPath, content);
            console.log(`  ✓ ${skillPath}`);
          } else {
            console.log(`  ⚠️  Skill not found: ${skillId}`);
          }
        }
      }
    }
  }
  
  initToolsFile(paths.toolsFile);
  console.log(`  ✓ ${paths.toolsFile}`);
  initBootFile(paths.bootFile);
  console.log(`  ✓ ${paths.bootFile}`);
  initMemory(paths.memoryFile);
  console.log(`  ✓ ${paths.memoryFile}`);

  // 6.5. Tracker installation
  const installTracker = await confirm({
    message: "Install tracker web UI for agent coordination?",
    default: false
  });
  if (installTracker) {
    await installTrackerTool();
  }

  // 7. Build communication graph from agent hierarchy
  const graph = buildCommunicationGraph(engineEntries);

  // 8. Write project config
  const projectConfig: ProjectConfig = {
    engines: engineEntries,
    graph,
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
    agentRotateAfter: CONFIG_DEFAULTS.agentRotateAfter,
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

  const writeConfig = await confirm({
    message: `Write config to ${paths.configFile}?`,
    default: true
  });
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
    console.log("  5. All non-manual agents run in parallel by default");
  }
  console.log("");
}
