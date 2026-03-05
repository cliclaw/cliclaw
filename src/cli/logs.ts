/**
 * `cliclaw logs` — view or live-tail log entries.
 */

import { existsSync, readFileSync, openSync, readSync, closeSync, statSync, watchFile } from "node:fs";
import { resolveConfig } from "../core/config.js";

function printTail(path: string, lines: number): void {
  const content = readFileSync(path, "utf-8");
  const all = content.split("\n");
  console.log(all.slice(-lines).join("\n"));
}

function liveTail(path: string): void {
  let size = existsSync(path) ? statSync(path).size : 0;

  if (existsSync(path)) printTail(path, 20);
  console.log("\n--- watching (Ctrl+C to stop) ---\n");

  watchFile(path, { interval: 500 }, () => {
    if (!existsSync(path)) return;
    const newSize = statSync(path).size;
    if (newSize <= size) { size = newSize; return; }

    const buf = Buffer.alloc(newSize - size);
    const fd = openSync(path, "r");
    readSync(fd, buf, 0, buf.length, size);
    closeSync(fd);
    process.stdout.write(buf.toString("utf-8"));
    size = newSize;
  });
}

export async function logsCommand(args: string[]): Promise<void> {
  const config = resolveConfig();
  const useJsonl = args.includes("--json");
  const isTail = args.includes("--tail") || args.includes("-f");
  const logPath = useJsonl ? config.paths.logJsonl : config.paths.logFile;

  if (!existsSync(logPath)) {
    console.log("No logs found yet. Run `cliclaw cron` to start.");
    return;
  }

  if (isTail) {
    liveTail(logPath);
    return;
  }

  const countArg = args.find((a) => !a.startsWith("-"));
  const tailCount = parseInt(countArg ?? "50", 10) || 50;

  console.log(`\n📋 Last ${tailCount} log entries:\n`);
  printTail(logPath, tailCount);
  console.log("");
}
