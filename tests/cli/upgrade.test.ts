import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { upgradeCommand } from "../src/cli/upgrade.js";

describe("upgradeCommand", () => {
  it("runs install script via curl", async () => {
    await upgradeCommand([]);
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("curl -fsSL"),
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("exits on failure", async () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error("curl failed"); });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });

    await expect(upgradeCommand([])).rejects.toThrow("exit");

    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
