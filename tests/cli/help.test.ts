import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { join } from "node:path";

describe("--help flag", () => {
  const cliPath = join(process.cwd(), "src", "index.ts");
  const tsxPath = join(process.cwd(), "node_modules", ".bin", "tsx");

  function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const proc = spawn(tsxPath, [cliPath, ...args], { stdio: "pipe" });
      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (data) => { stdout += data.toString(); });
      proc.stderr?.on("data", (data) => { stderr += data.toString(); });

      proc.on("close", (code) => {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
    });
  }

  it("should show help with 'cliclaw --help'", async () => {
    const result = await runCLI(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
    expect(result.stdout).toContain("Commands:");
  });

  it("should show help with 'cliclaw -h'", async () => {
    const result = await runCLI(["-h"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
  });

  it("should show help with 'cliclaw help'", async () => {
    const result = await runCLI(["help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
  });

  it("should show help with 'cliclaw cron --help'", async () => {
    const result = await runCLI(["cron", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
  });

  it("should show help with 'cliclaw --help cron'", async () => {
    const result = await runCLI(["--help", "cron"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
  });

  it("should show help with 'cliclaw memory --help'", async () => {
    const result = await runCLI(["memory", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
  });

  it("should show help with 'cliclaw chat --help'", async () => {
    const result = await runCLI(["chat", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
  });

  it("should show help with '--help' in middle of args", async () => {
    const result = await runCLI(["cron", "--help", "--engine=kiro"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
  });

  it("should show help with '--help' at end of args", async () => {
    const result = await runCLI(["status", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CLIClaw — Autonomous AI Agent Loop Runner");
  });
});
