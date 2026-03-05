/**
 * Core type definitions for CLIClaw
 */

export type EngineName = "kiro" | "claude" | "codex" | "aider" | "gemini" | "copilot" | "cursor";

export interface EngineConfig {
  name: EngineName;
  command: string;
  model: string;
  timeout: number;
  buildArgs: (opts: EngineRunOpts) => string[];
  supportsResume: boolean;
  lenientExit: boolean;
  /** Whether this engine reads prompt from stdin instead of CLI arg */
  stdinPrompt: boolean;
}

export interface EngineRunOpts {
  prompt: string;
  inputFile: string;
  resume: boolean;
  model: string;
}

export interface CycleResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  tokenEstimate: number;
  costEstimate: number;
}

/** A configured engine entry — the primary unit of config */
export interface EngineEntry {
  engine: EngineName;
  model: string;
  alias?: string;
  focus?: string;
}

export interface ClawConfig {
  projectRoot: string;
  /** All configured engines — first is primary */
  engines: EngineEntry[];
  maxLoop: number;
  maxConsecutiveFailures: number;
  sleepNormal: number;
  sleepAfterFailure: number;
  agentTimeout: number;
  freshSessionEvery: number;
  promptHeader: string;
  focusFilter: string | null;
  dryRun: boolean;
  parallel: boolean;
  maxConcurrent: number;
  /** Global token budget per cycle (0 = unlimited) */
  tokenBudget: number;
  /** Plugin hooks */
  hooks: HooksConfig;
  paths: ClawPaths;
}

export interface HooksConfig {
  preCycle: string[];
  postCycle: string[];
  onSuccess: string[];
  onFailure: string[];
}

export interface ClawPaths {
  logFile: string;
  logJsonl: string;
  stateFile: string;
  heartbeatFile: string;
  memoryFile: string;
  boundariesFile: string;
  lockDir: string;
  pidFile: string;
  cycleOut: string;
  cycleErr: string;
  tmpDir: string;
  metaDir: string;
  youFile: string;
  projectsFile: string;
  personaiFile: string;
  configFile: string;
  snapshotsDir: string;
}

export interface ClawState {
  lastSuccess?: string;
  stallCycles?: number;
  totalCycles?: number;
  totalTokensEstimate?: number;
  totalCostEstimate?: number;
  lastPromptHash?: string;
  engineRotationIndex?: number;
  [key: string]: string | number | undefined;
}

export interface MetaFiles {
  memory: string;
  you: string;
  projects: string;
  personai: string;
  boundaries: string;
}

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  cycle?: number;
  data?: Record<string, string | number | boolean>;
}

export interface SetupAnswers {
  engines: EngineName[];
  models: Record<EngineName, string>;
  projectRoot: string;
  maxLoop: number;
  sleepNormal: number;
}

/** Per-model pricing in USD per 1M tokens */
export interface ModelPricing {
  input: number;
  output: number;
}

export interface ProjectConfig {
  engines?: EngineEntry[];
  maxLoop?: number;
  sleepNormal?: number;
  tokenBudget?: number;
  maxConcurrent?: number;
  hooks?: HooksConfig;
}
