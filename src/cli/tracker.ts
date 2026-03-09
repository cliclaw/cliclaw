/**
 * Tracker command - Start the tracker web UI
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const TRACKER_HELP = `
cliclaw tracker — Start the tracker web UI

Usage:
  cliclaw tracker [options]

Options:
  --help, -h             Show this help

The tracker is a SvelteKit web UI that visualizes:
- Agent communication and messages
- Task board with all agent tasks
- Token usage per agent
- Active agents overview

Runs on http://localhost:9122
`;

export async function trackerCommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(TRACKER_HELP);
    return;
  }

  const trackerDir = resolve(process.cwd(), "tracker");
  const packageJson = resolve(trackerDir, "package.json");

  if (!existsSync(packageJson)) {
    console.error("❌ Tracker not found");
    console.log("\nThe tracker should be in ./tracker/");
    console.log("Make sure you're running from the CLIClaw repository root.");
    console.log("\nTo start the tracker:");
    console.log("  cd tracker");
    console.log("  npm install");
    console.log("  npm run dev");
    process.exit(1);
  }

  // Kill any process on port 9122
  try {
    console.log("🔍 Checking port 9122...");
    const lsof = spawn("lsof", ["-ti:9122"], { stdio: "pipe" });
    
    await new Promise<void>((resolve) => {
      let killed = false;
      lsof.stdout?.on("data", (data) => {
        const pid = data.toString().trim();
        if (pid) {
          console.log(`🔪 Killing process ${pid} on port 9122...`);
          spawn("kill", ["-9", pid]).on("exit", () => {
            killed = true;
            setTimeout(resolve, 500);
          });
        }
      });
      lsof.on("exit", () => {
        if (!killed) resolve();
      });
    });
  } catch (err) {
    // Port might be free, continue
  }

  // Check if node_modules exists
  const nodeModules = resolve(trackerDir, "node_modules");
  if (!existsSync(nodeModules)) {
    console.log("📦 Installing dependencies...");
    const install = spawn("npm", ["install"], {
      cwd: trackerDir,
      stdio: "inherit"
    });

    await new Promise<void>((resolve, reject) => {
      install.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`npm install failed with code ${code}`));
      });
    });
  }

  console.log("🚀 Starting tracker on http://localhost:9122");
  console.log("");
  
  const child = spawn("npm", ["run", "dev"], {
    cwd: trackerDir,
    stdio: "inherit"
  });

  child.on("error", (err) => {
    console.error(`Failed to start tracker: ${err.message}`);
    console.log("\nMake sure Node.js is installed: https://nodejs.org/");
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}

