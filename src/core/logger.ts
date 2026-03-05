/**
 * Structured logger — writes to console, log file, and JSONL.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LogLevel } from "./types.js";

let logFilePath: string | null = null;
let jsonlFilePath: string | null = null;

export function initLogger(logFile: string, jsonlFile: string): void {
  logFilePath = logFile;
  jsonlFilePath = jsonlFile;
  mkdirSync(dirname(logFile), { recursive: true });
  mkdirSync(dirname(jsonlFile), { recursive: true });
}

function ts(): string {
  return new Date().toISOString();
}

function writeToFile(path: string | null, line: string): void {
  if (!path) return;
  try {
    appendFileSync(path, line + "\n");
  } catch {
    // Silently ignore file write errors during shutdown
  }
}

export function log(level: LogLevel, message: string, data?: Record<string, string | number | boolean>): void {
  const timestamp = ts();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const line = `${prefix} ${message}`;

  if (level === "error") {
    process.stderr.write(line + "\n");
  } else if (level !== "debug") {
    process.stdout.write(line + "\n");
  }

  writeToFile(logFilePath, line);

  if (jsonlFilePath) {
    const entry = JSON.stringify({ timestamp, level, message, ...data });
    writeToFile(jsonlFilePath, entry);
  }
}

export function logInfo(message: string, data?: Record<string, string | number | boolean>): void {
  log("info", message, data);
}

export function logWarn(message: string, data?: Record<string, string | number | boolean>): void {
  log("warn", message, data);
}

export function logError(message: string, data?: Record<string, string | number | boolean>): void {
  log("error", message, data);
}

export function logDebug(message: string, data?: Record<string, string | number | boolean>): void {
  log("debug", message, data);
}

export function logJson(event: string, data: Record<string, string | number | boolean>): void {
  const entry = JSON.stringify({ timestamp: ts(), event, ...data });
  writeToFile(jsonlFilePath, entry);
  logInfo(`${event}: ${JSON.stringify(data)}`);
}

/** Write raw text to the log file only (no console, no timestamp) */
export function logRaw(text: string): void {
  writeToFile(logFilePath, text);
}
