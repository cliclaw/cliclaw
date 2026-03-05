/**
 * `cliclaw logs` — view or live-tail log entries.
 */

import { existsSync, readFileSync, openSync, readSync, closeSync, statSync, watch } from "node:fs";
import { resolveConfig } from "../core/config.js";
import { parseStreamLine } from "../engines/registry.js";

function printTail(path: string, lines: number): void {
  const content = readFileSync(path, "utf-8");
  const all = content.split("\n");
  console.log(all.slice(-lines).join("\n"));
}

/** Watch cycleOut and decode each line in real time, printing text as it arrives */
function liveTailCycle(path: string): void {
  let size = 0;
  let leftover = "";

  console.log("--- streaming agent output (Ctrl+C to stop) ---\n");

  function drain(): void {
    if (!existsSync(path)) { size = 0; leftover = ""; return; }
    const newSize = statSync(path).size;
    if (newSize < size) { size = 0; leftover = ""; process.stdout.write("\n--- new cycle ---\n\n"); }
    if (newSize <= size) return;
    const buf = Buffer.alloc(newSize - size);
    const fd = openSync(path, "r");
    readSync(fd, buf, 0, buf.length, size);
    closeSync(fd);
    size = newSize;

    const chunk = leftover + buf.toString("utf-8");
    const lines = chunk.split("\n");
    leftover = lines.pop() ?? "";

    for (const line of lines) {
      const text = parseStreamLine(line);
      if (text) process.stdout.write(text);
    }
  }

  // Drain any existing content first
  drain();

  // Use fs.watch for event-driven notifications (fires immediately on write)
  const dir = path.substring(0, path.lastIndexOf("/"));
  const file = path.substring(path.lastIndexOf("/") + 1);
  try {
    watch(dir, (_event, filename) => {
      if (filename === file) drain();
    });
  } catch {
    // Fallback: if watch fails (e.g. dir doesn't exist yet), poll until it does
    const interval = setInterval(() => {
      if (existsSync(path)) {
        clearInterval(interval);
        drain();
        watch(path.substring(0, path.lastIndexOf("/")), (_event, filename) => {
          if (filename === file) drain();
        });
      }
    }, 500);
  }
}

export async function logsCommand(args: string[]): Promise<void> {
  const config = resolveConfig();
  const useJsonl = args.includes("--json");
  const isTail = args.includes("--tail") || args.includes("-f");

  if (isTail) {
    liveTailCycle(config.paths.cycleOut);
    return;
  }

  const logPath = useJsonl ? config.paths.logJsonl : config.paths.logFile;

  if (!existsSync(logPath)) {
    console.log("No logs found yet. Run `cliclaw cron` to start.");
    return;
  }

  const countArg = args.find((a) => !a.startsWith("-"));
  const tailCount = parseInt(countArg ?? "50", 10) || 50;

  console.log(`\n📋 Last ${tailCount} log entries:\n`);
  printTail(logPath, tailCount);
  console.log("");
}
