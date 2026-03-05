import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { initLogger, log, logInfo, logWarn, logError, logDebug, logJson, logRaw } from "../src/core/logger.js";

let testDir: string;
let logFile: string;
let jsonlFile: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-logger-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  logFile = join(testDir, "test.log");
  jsonlFile = join(testDir, "test.jsonl");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("initLogger", () => {
  it("creates log directories", () => {
    const nested = join(testDir, "sub", "dir", "test.log");
    const nestedJsonl = join(testDir, "sub", "dir", "test.jsonl");
    initLogger(nested, nestedJsonl);
    expect(existsSync(join(testDir, "sub", "dir"))).toBe(true);
  });
});

describe("log", () => {
  it("writes info to stdout and log file", () => {
    initLogger(logFile, jsonlFile);
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    log("info", "test message");
    expect(stdoutSpy).toHaveBeenCalled();
    const content = readFileSync(logFile, "utf-8");
    expect(content).toContain("test message");
    stdoutSpy.mockRestore();
  });

  it("writes error to stderr", () => {
    initLogger(logFile, jsonlFile);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log("error", "error message");
    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });

  it("writes debug only to file, not console", () => {
    initLogger(logFile, jsonlFile);
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    log("debug", "debug message");
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
    const content = readFileSync(logFile, "utf-8");
    expect(content).toContain("debug message");
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("writes JSONL entries", () => {
    initLogger(logFile, jsonlFile);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    log("info", "jsonl test", { key: "value" });
    const content = readFileSync(jsonlFile, "utf-8");
    const entry = JSON.parse(content.trim());
    expect(entry.message).toBe("jsonl test");
    vi.restoreAllMocks();
  });
});

describe("convenience functions", () => {
  it("logInfo writes info level", () => {
    initLogger(logFile, jsonlFile);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logInfo("info test");
    expect(readFileSync(logFile, "utf-8")).toContain("[INFO]");
    vi.restoreAllMocks();
  });

  it("logWarn writes warn level", () => {
    initLogger(logFile, jsonlFile);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logWarn("warn test");
    expect(readFileSync(logFile, "utf-8")).toContain("[WARN]");
    vi.restoreAllMocks();
  });

  it("logError writes error level", () => {
    initLogger(logFile, jsonlFile);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logError("error test");
    expect(readFileSync(logFile, "utf-8")).toContain("[ERROR]");
    vi.restoreAllMocks();
  });

  it("logDebug writes debug level", () => {
    initLogger(logFile, jsonlFile);
    logDebug("debug test");
    expect(readFileSync(logFile, "utf-8")).toContain("[DEBUG]");
  });
});

describe("logJson", () => {
  it("writes structured event to JSONL", () => {
    initLogger(logFile, jsonlFile);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logJson("test_event", { cycle: 1, cost: 0.5 });
    const lines = readFileSync(jsonlFile, "utf-8").trim().split("\n");
    // logJson writes one JSONL entry directly + logInfo writes another
    const directEntry = JSON.parse(lines[0]!);
    expect(directEntry.event).toBe("test_event");
    expect(directEntry.cycle).toBe(1);
    vi.restoreAllMocks();
  });
});

describe("logRaw", () => {
  it("writes raw text to log file only", () => {
    initLogger(logFile, jsonlFile);
    logRaw("raw output text");
    const content = readFileSync(logFile, "utf-8");
    expect(content).toContain("raw output text");
  });
});
