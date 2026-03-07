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

  it("should show cron-specific help with 'cliclaw cron --help'", async () => {
    const result = await runCLI(["cron", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cliclaw cron");
    expect(result.stdout).toContain("Start the autonomous agent loop");
  });

  it("should show memory-specific help with 'cliclaw memory --help'", async () => {
    const result = await runCLI(["memory", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cliclaw memory");
    expect(result.stdout).toContain("View and manage persistent memory");
  });

  it("should show chat-specific help with 'cliclaw chat --help'", async () => {
    const result = await runCLI(["chat", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cliclaw chat");
    expect(result.stdout).toContain("Interactive chat");
  });

  it("should show status-specific help with 'cliclaw status --help'", async () => {
    const result = await runCLI(["status", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cliclaw status");
    expect(result.stdout).toContain("Show current state");
  });

  it("should show audit-specific help with 'cliclaw audit --help'", async () => {
    const result = await runCLI(["audit", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cliclaw audit");
    expect(result.stdout).toContain("Audit report");
  });

  it("should show logs-specific help with 'cliclaw logs --help'", async () => {
    const result = await runCLI(["logs", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cliclaw logs");
    expect(result.stdout).toContain("View log entries");
  });
});
