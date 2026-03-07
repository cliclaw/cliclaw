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
    identityFile: join(base, "meta", "identity.md"),
    toolsFile: join(base, "meta", "tools.md"),
    bootFile: join(base, "meta", "boot.md"),
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

export const CONFIG_DEFAULTS = {
  maxLoop: 0,
  maxConsecutiveFailures: 5,
  sleepNormal: 60,
  sleepAfterFailure: 90,
  agentTimeout: 3600,
  outputStallTimeout: 600,
  freshSessionEvery: 3,
  maxConcurrent: 2,
  tokenBudget: 8000,
  idleBeforeStart: 0,
  snapshotEvery: 4,
  engineRotateAfter: 3,
  stallMax: 10,
  stallBackoffMultiplier: 1.5,
  stallBackoffCap: 10,
  hookTimeout: 60_000,
  maxSnapshots: 20,
  promptBudgets: { memory: 500, you: 400, projects: 600, boundaries: 200, identity: 200, tools: 300, boot: 300 },
  memoryMaxLines: 1100,
  memoryKeepHead: 80,
  memoryKeepTail: 850,
} as const;

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
    maxLoop: overrides.maxLoop ?? projectCfg.maxLoop ?? envInt("CLICLAW_MAX_LOOP", CONFIG_DEFAULTS.maxLoop),
    maxConsecutiveFailures: projectCfg.maxConsecutiveFailures ?? envInt("CLICLAW_MAX_FAILURES", CONFIG_DEFAULTS.maxConsecutiveFailures),
    sleepNormal: overrides.sleepNormal ?? projectCfg.sleepNormal ?? envInt("CLICLAW_SLEEP", CONFIG_DEFAULTS.sleepNormal),
    sleepAfterFailure: projectCfg.sleepAfterFailure ?? envInt("CLICLAW_SLEEP_FAIL", CONFIG_DEFAULTS.sleepAfterFailure),
    agentTimeout: projectCfg.agentTimeout ?? envInt("CLICLAW_TIMEOUT", CONFIG_DEFAULTS.agentTimeout),
    outputStallTimeout: projectCfg.outputStallTimeout ?? envInt("CLICLAW_OUTPUT_STALL_TIMEOUT", CONFIG_DEFAULTS.outputStallTimeout),
    freshSessionEvery: projectCfg.freshSessionEvery ?? envInt("CLICLAW_FRESH_EVERY", CONFIG_DEFAULTS.freshSessionEvery),
    promptHeader: env(
      "CLICLAW_PROMPT_HEADER",
      "You are running an autonomous agent loop for this repository."
    ),
    focusFilter: overrides.focusFilter ?? null,
    dryRun: overrides.dryRun ?? envBool("CLICLAW_DRY_RUN", false),
    parallel: overrides.parallel ?? false,
    maxConcurrent: projectCfg.maxConcurrent ?? envInt("CLICLAW_MAX_CONCURRENT", CONFIG_DEFAULTS.maxConcurrent),
    tokenBudget: projectCfg.tokenBudget ?? envInt("CLICLAW_TOKEN_BUDGET", CONFIG_DEFAULTS.tokenBudget),
    hooks: projectCfg.hooks ?? DEFAULT_HOOKS,
    paths,
    idleBeforeStart: projectCfg.idleBeforeStart ?? CONFIG_DEFAULTS.idleBeforeStart,
    snapshotEvery: projectCfg.snapshotEvery ?? CONFIG_DEFAULTS.snapshotEvery,
    engineRotateAfter: projectCfg.engineRotateAfter ?? CONFIG_DEFAULTS.engineRotateAfter,
    stallMax: projectCfg.stallMax ?? CONFIG_DEFAULTS.stallMax,
    stallBackoffMultiplier: projectCfg.stallBackoffMultiplier ?? CONFIG_DEFAULTS.stallBackoffMultiplier,
    stallBackoffCap: projectCfg.stallBackoffCap ?? CONFIG_DEFAULTS.stallBackoffCap,
    hookTimeout: projectCfg.hookTimeout ?? CONFIG_DEFAULTS.hookTimeout,
    maxSnapshots: projectCfg.maxSnapshots ?? CONFIG_DEFAULTS.maxSnapshots,
    promptBudgets: {
      memory: projectCfg.promptBudgets?.memory ?? CONFIG_DEFAULTS.promptBudgets.memory,
      you: projectCfg.promptBudgets?.you ?? CONFIG_DEFAULTS.promptBudgets.you,
      projects: projectCfg.promptBudgets?.projects ?? CONFIG_DEFAULTS.promptBudgets.projects,
      boundaries: projectCfg.promptBudgets?.boundaries ?? CONFIG_DEFAULTS.promptBudgets.boundaries,
      identity: projectCfg.promptBudgets?.identity ?? CONFIG_DEFAULTS.promptBudgets.identity,
      tools: projectCfg.promptBudgets?.tools ?? CONFIG_DEFAULTS.promptBudgets.tools,
      boot: projectCfg.promptBudgets?.boot ?? CONFIG_DEFAULTS.promptBudgets.boot,
    },
    memoryMaxLines: projectCfg.memoryMaxLines ?? CONFIG_DEFAULTS.memoryMaxLines,
    memoryKeepHead: projectCfg.memoryKeepHead ?? CONFIG_DEFAULTS.memoryKeepHead,
    memoryKeepTail: projectCfg.memoryKeepTail ?? CONFIG_DEFAULTS.memoryKeepTail,
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
