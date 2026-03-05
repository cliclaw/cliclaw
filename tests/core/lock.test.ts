import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { isPidAlive, acquireLock, releaseLock, killPidTree, killPrevious, killAgentProcesses } from "../src/core/lock.js";

let testDir: string;
let lockDir: string;
let pidFile: string;

beforeEach(() => {
  testDir = join(tmpdir(), `cliclaw-test-lock-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  lockDir = join(testDir, "lockdir");
  pidFile = join(lockDir, "pid");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("isPidAlive", () => {
  it("returns true for current process", () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  it("returns false for non-existent PID", () => {
    expect(isPidAlive(999999999)).toBe(false);
  });
});

describe("acquireLock", () => {
  it("creates lock directory and PID file", () => {
    acquireLock(lockDir, pidFile);
    expect(existsSync(lockDir)).toBe(true);
    expect(existsSync(pidFile)).toBe(true);
    const pid = readFileSync(pidFile, "utf-8");
    expect(parseInt(pid, 10)).toBe(process.pid);
  });

  it("cleans up stale lock from dead process", () => {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(pidFile, "999999999"); // dead PID
    acquireLock(lockDir, pidFile);
    expect(readFileSync(pidFile, "utf-8")).toBe(String(process.pid));
  });

  it("exits if another live process holds the lock", () => {
    mkdirSync(lockDir, { recursive: true });
    // Use parent PID — always alive, not our PID
    const ppid = process.ppid;
    writeFileSync(pidFile, String(ppid));
    // Verify isPidAlive returns true for ppid
    expect(isPidAlive(ppid)).toBe(true);
    expect(ppid).not.toBe(process.pid);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    acquireLock(lockDir, pidFile);
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("handles lock dir without pid file", () => {
    mkdirSync(lockDir, { recursive: true });
    // No pid file — should clean up and acquire
    acquireLock(lockDir, pidFile);
    expect(existsSync(pidFile)).toBe(true);
  });
});

describe("releaseLock", () => {
  it("removes lock directory", () => {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(pidFile, "123");
    releaseLock(lockDir);
    expect(existsSync(lockDir)).toBe(false);
  });

  it("does nothing if lock doesn't exist", () => {
    releaseLock(lockDir); // should not throw
  });
});

describe("killPidTree", () => {
  it("does not throw for non-existent PID", () => {
    expect(() => killPidTree(999999999)).not.toThrow();
  });

  it("does not throw with SIGKILL signal", () => {
    expect(() => killPidTree(999999999, "SIGKILL")).not.toThrow();
  });
});

describe("killPrevious", () => {
  it("does nothing when no pid file exists", () => {
    expect(() => killPrevious(lockDir, pidFile, "cliclaw")).not.toThrow();
  });

  it("handles stale pid file with dead process", () => {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(pidFile, "999999999");
    expect(() => killPrevious(lockDir, pidFile, "cliclaw")).not.toThrow();
  });

  it("handles pid file with invalid content", () => {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(pidFile, "notanumber");
    expect(() => killPrevious(lockDir, pidFile, "cliclaw")).not.toThrow();
  });

  it("handles pid file with our own PID", () => {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(pidFile, String(process.pid));
    expect(() => killPrevious(lockDir, pidFile, "cliclaw")).not.toThrow();
  });
});

describe("killAgentProcesses", () => {
  it("does not throw", () => {
    expect(() => killAgentProcesses()).not.toThrow();
  });
});
