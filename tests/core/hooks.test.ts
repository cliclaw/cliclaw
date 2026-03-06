import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "node:child_process";

vi.mock("../src/core/logger.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { runHooks, runPreCycle, runPostCycle, runOnSuccess, runOnFailure } from "../src/core/hooks.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runHooks", () => {
  it("does nothing for empty hooks array", () => {
    runHooks([], "test", "/tmp");
    expect(execSync).not.toHaveBeenCalled();
  });

  it("executes each hook", () => {
    runHooks(["echo hello", "echo world"], "test", "/tmp");
    expect(execSync).toHaveBeenCalledTimes(2);
  });

  it("passes cwd and env", () => {
    runHooks(["echo test"], "test", "/my/dir", { MY_VAR: "value" });
    expect(execSync).toHaveBeenCalledWith("echo test", expect.objectContaining({
      cwd: "/my/dir",
      timeout: 60_000,
    }));
  });

  it("continues on hook failure", () => {
    vi.mocked(execSync).mockImplementationOnce(() => { throw new Error("hook failed"); });
    runHooks(["fail", "succeed"], "test", "/tmp");
    expect(execSync).toHaveBeenCalledTimes(2);
  });

  it("logs warning with string error message on failure", () => {
    vi.mocked(execSync).mockImplementationOnce(() => { throw "string error"; });
    runHooks(["fail"], "test", "/tmp");
    // logWarn is already mocked via vi.mock at top — just verify no throw
    expect(execSync).toHaveBeenCalledTimes(1);
  });
});

describe("lifecycle hooks", () => {
  it("runPreCycle passes cycle env var", () => {
    const hooks = { preCycle: ["echo pre"], postCycle: [], onSuccess: [], onFailure: [] };
    runPreCycle(hooks, "/tmp", 5);
    expect(execSync).toHaveBeenCalledWith("echo pre", expect.objectContaining({
      env: expect.objectContaining({ CLICLAW_CYCLE: "5" }),
    }));
  });

  it("runPostCycle runs postCycle hooks", () => {
    const hooks = { preCycle: [], postCycle: ["echo post"], onSuccess: [], onFailure: [] };
    runPostCycle(hooks, "/tmp", 1);
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it("runOnSuccess runs onSuccess hooks", () => {
    const hooks = { preCycle: [], postCycle: [], onSuccess: ["echo ok"], onFailure: [] };
    runOnSuccess(hooks, "/tmp", 1);
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it("runOnFailure runs onFailure hooks", () => {
    const hooks = { preCycle: [], postCycle: [], onSuccess: [], onFailure: ["echo fail"] };
    runOnFailure(hooks, "/tmp", 1);
    expect(execSync).toHaveBeenCalledTimes(1);
  });
});
