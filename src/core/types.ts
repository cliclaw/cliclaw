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
  /** Parse raw stdout into human-readable text. Falls back to raw stdout if absent. */
  parseOutput?: (stdout: string) => string;
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
  /** Path to an identity file for this engine (relative to projectRoot). Falls back to meta/identity.md */
  identity?: string;
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
  /** Seconds of no new output before killing the agent (0 = disabled) */
  outputStallTimeout: number;
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
  /** Seconds to idle/pause before the loop starts (0 = no pause) */
  idleBeforeStart: number;
  /** How often (in cycles) to save a state snapshot */
  snapshotEvery: number;
  /** Consecutive failures before rotating to next engine */
  engineRotateAfter: number;
  /** Stall cycles before declaring a stall */
  stallMax: number;
  /** Backoff multiplier per stall cycle (sleep *= multiplier^stallCycles, capped at stallBackoffCap) */
  stallBackoffMultiplier: number;
  /** Maximum backoff multiplier cap */
  stallBackoffCap: number;
  /** Hook execution timeout in ms */
  hookTimeout: number;
  /** Max state snapshots to keep */
  maxSnapshots: number;
  /** Per-section prompt token budgets */
  promptBudgets: { memory: number; you: number; projects: number; boundaries: number; identity: number; tools: number; boot: number };
  /** Memory trim: max lines before trimming */
  memoryMaxLines: number;
  /** Memory trim: lines to keep from the top */
  memoryKeepHead: number;
  /** Memory trim: lines to keep from the bottom */
  memoryKeepTail: number;
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
  identityFile: string;
  toolsFile: string;
  bootFile: string;
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
  maxConsecutiveFailures?: number;
  sleepNormal?: number;
  sleepAfterFailure?: number;
  agentTimeout?: number;
  outputStallTimeout?: number;
  freshSessionEvery?: number;
  tokenBudget?: number;
  maxConcurrent?: number;
  hooks?: HooksConfig;
  idleBeforeStart?: number;
  snapshotEvery?: number;
  engineRotateAfter?: number;
  stallMax?: number;
  stallBackoffMultiplier?: number;
  stallBackoffCap?: number;
  hookTimeout?: number;
  maxSnapshots?: number;
  promptBudgets?: { memory?: number; you?: number; projects?: number; boundaries?: number; identity?: number; tools?: number; boot?: number };
  memoryMaxLines?: number;
  memoryKeepHead?: number;
  memoryKeepTail?: number;
}
