/**
 * Upgrade CLIClaw by re-running the install script.
 */

import { execSync } from "node:child_process";

const REPO = "cliclaw/cliclaw";
const INSTALL_URL = `https://raw.githubusercontent.com/${REPO}/main/install.sh`;

export async function upgradeCommand(_args: string[]): Promise<void> {
  console.log("Upgrading CLIClaw...\n");
  try {
    execSync(`curl -fsSL ${INSTALL_URL} | bash`, { stdio: "inherit" });
  } catch {
    console.error("Upgrade failed. Try manually:");
    console.error(`  curl -fsSL ${INSTALL_URL} | bash`);
    process.exit(1);
  }
}
