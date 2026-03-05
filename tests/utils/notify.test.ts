import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { sendNotification } from "../src/utils/notify.js";

describe("sendNotification", () => {
  it("calls osascript with title and message", () => {
    sendNotification("Test Title", "Test Message");
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("display notification"),
      expect.objectContaining({ stdio: "ignore", timeout: 5000 }),
    );
  });

  it("escapes double quotes in message", () => {
    vi.mocked(execSync).mockClear();
    sendNotification("Title", 'Message with "quotes"');
    const call = vi.mocked(execSync).mock.calls[0]![0] as string;
    expect(call).toContain('\\"quotes\\"');
  });

  it("does not throw on failure", () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error("osascript failed"); });
    expect(() => sendNotification("Title", "Message")).not.toThrow();
  });
});
