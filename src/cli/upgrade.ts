/**
 * Upgrade CLIClaw by re-running the install script.
 */

import { execSync } from "node:child_process";

const REPO = "cliclaw/cliclaw";
const INSTALL_URL = `https://raw.githubusercontent.com/${REPO}/main/install.sh`;

const UPGRADE_HELP = `
cliclaw upgrade — Upgrade to latest version

Usage:
  cliclaw upgrade [options]

Options:
  --help, -h             Show this help

Runs:
  curl -fsSL ${INSTALL_URL} | bash
`;

export async function upgradeCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(UPGRADE_HELP);
    return;
  }

  console.log("Upgrading CLIClaw...\n");
  try {
    execSync(`curl -fsSL ${INSTALL_URL} | bash`, { stdio: "inherit" });
  } catch {
    console.error("Upgrade failed. Try manually:");
    console.error(`  curl -fsSL ${INSTALL_URL} | bash`);
    process.exit(1);
  }
}
