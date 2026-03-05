/**
 * Configuration builder — resolves env vars, defaults, CLI overrides, and project config.
 */

import { resolve, join, dirname } from "node:path";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import type { ClawConfig, ClawPaths, EngineName, HooksConfig, ProjectConfig, EngineEntry } from "./types.js";

const DEFAULT_ENGINE: EngineName = "kiro";
const DEFAULT_MODELS: Record<EngineName, string> = {
  kiro: "claude-opus-4.6",
  claude: "claude-sonnet-4-20250514",
  codex: "o4-mini",
  aider: "sonnet",
  gemini: "gemini-2.5-pro",
  copilot: "gpt-4.1",
  cursor: "gpt-5.2-high",
};

const DEFAULT_HOOKS: HooksConfig = { preCycle: [], postCycle: [], onSuccess: [], onFailure: [] };

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export function buildPaths(projectRoot: string): ClawPaths {
  const base = join(projectRoot, ".cliclaw");
  return {
    logFile: join(base, "logs", "autonomous.log"),
    logJsonl: join(base, "logs", "autonomous.jsonl"),
    stateFile: join(base, "state", "cliclaw-state.json"),
    memoryFile: join(base, "memory", "MEMORY.md"),
    boundariesFile: join(base, "memory", "BOUNDARIES.md"),
    lockDir: join(base, "cliclaw.lockdir"),
    pidFile: join(base, "cliclaw.lockdir", "pid"),
    cycleOut: join(base, "tmp", "cycle.out"),
    cycleErr: join(base, "tmp", "cycle.err"),
    tmpDir: join(base, "tmp"),
    metaDir: join(base, "meta"),
    youFile: join(base, "meta", "you.md"),
    projectsFile: join(base, "meta", "projects.md"),
    personaiFile: join(base, "meta", "personai.md"),
    configFile: join(base, "config.json"),
    snapshotsDir: join(base, "snapshots"),
  };
}

/** Load project-scoped config from .cliclaw/config.json */
function loadProjectConfig(configFile: string): ProjectConfig {
  if (!existsSync(configFile)) return {};
  try {
    return JSON.parse(readFileSync(configFile, "utf-8")) as ProjectConfig;
  } catch {
    return {};
  }
}

/** Ensure all required .cliclaw/ subdirectories exist */
export function ensureAllDirs(paths: ClawPaths): void {
  const dirs = [
    dirname(paths.logFile),
    dirname(paths.stateFile),
    dirname(paths.memoryFile),
    paths.metaDir,
    paths.tmpDir,
    paths.snapshotsDir,
  ];
  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Build default engines array from env or defaults */
function defaultEngines(): EngineEntry[] {
  const engineName = (env("CLICLAW_ENGINE", "") as EngineName) || DEFAULT_ENGINE;
  const model = env("CLICLAW_MODEL", DEFAULT_MODELS[engineName] ?? DEFAULT_MODELS.kiro);
  return [{ engine: engineName, model }];
}

/** Assign aliases to engines, requiring aliases for duplicates */
export function resolveAliases(engines: EngineEntry[]): EngineEntry[] {
  const counts = new Map<string, number>();
  for (const e of engines) {
    counts.set(e.engine, (counts.get(e.engine) ?? 0) + 1);
  }

  return engines.map((e, i) => {
    if (e.alias) return e;
    const count = counts.get(e.engine) ?? 1;
    if (count > 1) {
      return { ...e, alias: `${e.engine}${i + 1}` };
    }
    return { ...e, alias: e.engine };
  });
}

export function resolveConfig(overrides: Partial<ClawConfig> = {}): ClawConfig {
  const projectRoot = resolve(
    overrides.projectRoot ?? env("CLICLAW_PROJECT_ROOT", process.cwd())
  );
  const paths = buildPaths(projectRoot);
  const projectCfg = loadProjectConfig(paths.configFile);

  const engines = resolveAliases(
    overrides.engines ?? projectCfg.engines ?? defaultEngines()
  );

  return {
    projectRoot,
    engines,
    maxLoop: overrides.maxLoop ?? projectCfg.maxLoop ?? envInt("CLICLAW_MAX_LOOP", 500),
    maxConsecutiveFailures: envInt("CLICLAW_MAX_FAILURES", 5),
    sleepNormal: overrides.sleepNormal ?? projectCfg.sleepNormal ?? envInt("CLICLAW_SLEEP", 60),
    sleepAfterFailure: envInt("CLICLAW_SLEEP_FAIL", 90),
    agentTimeout: envInt("CLICLAW_TIMEOUT", 86400),
    freshSessionEvery: envInt("CLICLAW_FRESH_EVERY", 3),
    promptHeader: env(
      "CLICLAW_PROMPT_HEADER",
      "You are running an autonomous agent loop for this repository."
    ),
    focusFilter: overrides.focusFilter ?? null,
    dryRun: overrides.dryRun ?? envBool("CLICLAW_DRY_RUN", false),
    parallel: overrides.parallel ?? false,
    maxConcurrent: projectCfg.maxConcurrent ?? envInt("CLICLAW_MAX_CONCURRENT", 2),
    tokenBudget: projectCfg.tokenBudget ?? envInt("CLICLAW_TOKEN_BUDGET", 8000),
    hooks: projectCfg.hooks ?? DEFAULT_HOOKS,
    paths,
    snapshotEvery: projectCfg.snapshotEvery ?? 4,
    engineRotateAfter: projectCfg.engineRotateAfter ?? 3,
    stallMax: projectCfg.stallMax ?? 10,
    stallBackoffMultiplier: projectCfg.stallBackoffMultiplier ?? 1.5,
    stallBackoffCap: projectCfg.stallBackoffCap ?? 10,
    hookTimeout: projectCfg.hookTimeout ?? 60_000,
    maxSnapshots: projectCfg.maxSnapshots ?? 20,
    promptBudgets: {
      memory: projectCfg.promptBudgets?.memory ?? 500,
      you: projectCfg.promptBudgets?.you ?? 400,
      projects: projectCfg.promptBudgets?.projects ?? 600,
      personai: projectCfg.promptBudgets?.personai ?? 300,
      boundaries: projectCfg.promptBudgets?.boundaries ?? 200,
    },
    memoryMaxLines: projectCfg.memoryMaxLines ?? 1100,
    memoryKeepHead: projectCfg.memoryKeepHead ?? 80,
    memoryKeepTail: projectCfg.memoryKeepTail ?? 850,
  };
}

export function getDefaultModel(engine: EngineName): string {
  return DEFAULT_MODELS[engine] ?? DEFAULT_MODELS.kiro;
}

/** Helper: get primary engine/model from config */
export function primaryEngine(config: ClawConfig): EngineEntry {
  return config.engines[0]!;
}

export const ALL_ENGINES: EngineName[] = [
  "kiro",
  "claude",
  "cursor",
  "codex",
  "aider",
  "gemini",
  "copilot",
];
