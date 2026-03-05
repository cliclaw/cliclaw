/**
 * Desktop notifications — macOS native, no dependencies.
 */

import { execSync } from "node:child_process";

export function sendNotification(title: string, message: string): void {
  try {
    // macOS native notification
    const escaped = message.replace(/"/g, '\\"');
    execSync(
      `osascript -e 'display notification "${escaped}" with title "${title}"'`,
      { stdio: "ignore", timeout: 5000 },
    );
  } catch {
    // Silently ignore — notifications are best-effort
  }
}
