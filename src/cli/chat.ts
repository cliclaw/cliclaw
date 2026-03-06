import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolveConfig, ensureAllDirs } from "../core/config.js";
import { getEngine } from "../engines/registry.js";
import type { EngineEntry } from "../core/types.js";

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  blue:   "\x1b[34m",
  gray:   "\x1b[90m",
  white:  "\x1b[97m",
};
const paint = (color: string, s: string): string => `${color}${s}${c.reset}`;

// ── Slash commands ────────────────────────────────────────────────────────────
const SLASH_COMMANDS: Record<string, string> = {
  "/clear":   "Clear conversation history (keeps meta context)",
  "/history": "Show conversation history",
  "/help":    "Show available commands",
  "/exit":    "Exit chat",
};

// ── Persistence ───────────────────────────────────────────────────────────────
type Message = { role: "user" | "agent"; text: string; ts: number; summary?: string };

const RECENT_TURNS = 10; // full verbatim turns to keep in prompt

function historyFile(tmpDir: string, engineLabel: string): string {
  return join(tmpDir, `chat-${engineLabel}.json`);
}
function loadHistory(file: string): Message[] {
  try { return JSON.parse(readFileSync(file, "utf-8")); } catch { return []; }
}
function saveHistory(file: string, history: Message[]): void {
  writeFileSync(file, JSON.stringify(history, null, 2));
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a conversational AI assistant focused exclusively on documentation and identity management.

You have full context about yourself and the project in the CONTEXT section below (identity, memory, boundaries, user info, projects, tools). Use all of it to give informed, accurate answers.

STRICT RULES:
- You may ONLY discuss, update, or clarify documentation (identity, memory, project notes, plans, decisions, context).
- You must NEVER write, suggest, or discuss code implementation — not even snippets, pseudocode, or "you could try X" suggestions.
- You must NEVER suggest tasks to implement or features to build. That is handled by \`cliclaw cron\`.
- If the user asks about implementation, code, or what to build next, redirect them: "That's for \`cliclaw cron\` to handle."

MEMORY TRIGGERS:
When the user says phrases like "Take note", "Remember...", "Don't forget...", "Keep in mind...", or similar memory-related instructions, you MUST update your identity file with the new information.

If the user tells you something new about yourself or the project — update the relevant documentation by outputting a block at the END of your response:

\`\`\`identity
<full updated identity.md content>
\`\`\`

Only include this block when there is actually something new to update. Most replies should just be normal conversation with NO identity block.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractAgentName(identityPath: string): string {
  if (!existsSync(identityPath)) return "agent";
  const match = readFileSync(identityPath, "utf-8").match(/\*\*Name\*\*:\s*(.+)/);
  return match?.[1]?.trim() ?? "agent";
}

function extractIdentityBlock(output: string): string | null {
  const match = output.match(/```identity\n([\s\S]*?)```/);
  const content = match?.[1]?.trim();
  return content || null;
}

function resolveEngine(args: string[], config: ReturnType<typeof resolveConfig>): EngineEntry {
  const flag = args.find((a) => a.startsWith("--engine="));
  const target = flag ? flag.slice("--engine=".length) : null;
  if (target) {
    return config.engines.find((e) => e.alias === target || e.engine === target) ?? config.engines[0]!;
  }
  return config.engines[0]!;
}

function spinner(label: string): () => void {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r${paint(c.yellow, frames[i++ % frames.length]!)} ${paint(c.dim, `${label} is thinking...`)}`);
  }, 80);
  return () => {
    clearInterval(id);
    process.stdout.write("\r\x1b[2K");
  };
}

function printBanner(engineLabel: string, histFile: string): void {
  const w = 60;
  const line = "─".repeat(w);
  console.log(`\n${paint(c.cyan, `╭${line}╮`)}`);
  console.log(paint(c.cyan, "│") + paint(c.bold + c.white, "  🤖 CLIClaw Chat".padEnd(w)) + paint(c.cyan, "│"));
  console.log(paint(c.cyan, "│") + paint(c.dim, `  engine: ${engineLabel}`.padEnd(w)) + paint(c.cyan, "│"));
  console.log(paint(c.cyan, "│") + paint(c.dim, `  history: ${histFile}`.padEnd(w)) + paint(c.cyan, "│"));
  console.log(`${paint(c.cyan, `╰${line}╯`)}`);
  console.log(paint(c.gray, `  Type ${paint(c.white, "/help")} for commands, ${paint(c.white, "/exit")} or Ctrl+C to quit.\n`));
}

function printHelp(): void {
  console.log(paint(c.cyan, "\n  Slash commands:"));
  for (const [cmd, desc] of Object.entries(SLASH_COMMANDS)) {
    console.log(`  ${paint(c.yellow, cmd.padEnd(12))} ${paint(c.dim, desc)}`);
  }
  console.log();
}

function printHistory(history: Message[], agentName: string): void {
  if (!history.length) { console.log(paint(c.dim, "\n  (no history)\n")); return; }
  console.log();
  for (const m of history) {
    const ts = paint(c.gray, new Date(m.ts).toLocaleTimeString());
    if (m.role === "user") {
      console.log(`  ${paint(c.green + c.bold, "you")} ${ts}`);
    } else {
      console.log(`  ${paint(c.blue + c.bold, agentName)} ${ts}`);
    }
    console.log(paint(c.dim, `  ${m.text.split("\n").join("\n  ")}\n`));
  }
}

// ── Prompt runner ─────────────────────────────────────────────────────────────
function runOneShotPrompt(entry: EngineEntry, prompt: string, cwd: string, tmpDir: string, agentName: string): Promise<string> {
  return new Promise((resolve) => {
    const engine = getEngine(entry.engine);

    mkdirSync(tmpDir, { recursive: true });
    const inputFile = join(tmpDir, `chat-input-${Date.now()}.txt`);
    writeFileSync(inputFile, prompt);

    const args = engine.buildArgs({ prompt, inputFile, resume: false, model: entry.model });

    let stdout = "";
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    let firstChunk = true;
    const stopSpinner = spinner(agentName);

    const done = (): void => {
      if (settled) return;
      settled = true;
      if (idleTimer) clearTimeout(idleTimer);
      try { child.kill("SIGTERM"); } catch { /* already dead */ }
      resolve(engine.parseOutput ? engine.parseOutput(stdout) : stdout);
    };

    const child = spawn(engine.command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (firstChunk) {
        firstChunk = false;
        stopSpinner();
        process.stdout.write(`  ${paint(c.blue + c.bold, agentName + ">")} `);
      }
      process.stdout.write(text);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(done, 5000);
    });

    child.on("close", done);
    child.on("error", (err) => { stopSpinner(); stdout += `\n[error: ${err.message}]`; done(); });
    setTimeout(done, 300_000);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function chatCommand(args: string[]): Promise<void> {
  const config = resolveConfig();
  ensureAllDirs(config.paths);

  const entry = resolveEngine(args, config);
  const identityPath = entry.identity
    ? `${config.projectRoot}/${entry.identity}`
    : config.paths.identityFile;

  const engineLabel = entry.alias ?? entry.engine;
  const histFile = historyFile(config.paths.tmpDir, engineLabel);

  mkdirSync(config.paths.tmpDir, { recursive: true });
  printBanner(engineLabel, histFile);

  const history: Message[] = loadHistory(histFile);
  if (history.length) {
    const older = history.length > RECENT_TURNS * 2 ? history.length - RECENT_TURNS * 2 : 0;
    console.log(paint(c.dim, `  Resumed ${history.length} message(s) from previous session.${older ? ` (${older} older messages will be summarized)` : ""} Use /clear to start fresh.\n`));
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, (a) => res(a.trim())));

  const shutdown = (): void => { saveHistory(histFile, history); rl.close(); process.exit(0); };
  process.on("SIGINT", shutdown);

  while (true) {
    const userInput = await ask(`\n  ${paint(c.green + c.bold, "you>")} `);
    if (!userInput) continue;

    // ── slash commands ──
    if (userInput.startsWith("/")) {
      const cmd = userInput.split(" ")[0];
      if (cmd === "/exit" || cmd === "/quit") { shutdown(); break; }
      if (cmd === "/clear") {
        history.length = 0;
        saveHistory(histFile, history);
        console.log(paint(c.yellow, "\n  ✓ History cleared.\n"));
        continue;
      }
      if (cmd === "/history") {
        printHistory(history, extractAgentName(identityPath));
        continue;
      }
      if (cmd === "/help") { printHelp(); continue; }
      console.log(paint(c.gray, `\n  Unknown command. Type /help for available commands.\n`));
      continue;
    }

    if (userInput.toLowerCase() === "exit") { shutdown(); break; }

    history.push({ role: "user", text: userInput, ts: Date.now() });
    saveHistory(histFile, history);

    const readMeta = (p: string): string => existsSync(p) ? readFileSync(p, "utf-8") : "(empty)";
    const metaContext = [
      `IDENTITY:\n${readMeta(identityPath)}`,
      `MEMORY:\n${readMeta(config.paths.memoryFile)}`,
      `BOUNDARIES:\n${readMeta(config.paths.boundariesFile)}`,
      `YOU (user info):\n${readMeta(config.paths.youFile)}`,
      `PROJECTS:\n${readMeta(config.paths.projectsFile)}`,
      `TOOLS:\n${readMeta(config.paths.toolsFile)}`,
    ].join("\n\n---\n\n");

    const historyBlock = (() => {
      const turns = history.slice(0, -1); // exclude current message
      const cutoff = Math.max(0, turns.length - RECENT_TURNS * 2);
      const older = turns.slice(0, cutoff);
      const recent = turns.slice(cutoff);

      const parts: string[] = [];
      if (older.length) {
        // Summarize older turns as a compact digest
        const digest = older
          .filter((m) => m.role === "user")
          .map((m) => m.text.slice(0, 120))
          .join(" | ");
        parts.push(`[Earlier conversation summary — ${older.length} messages]: ${digest}`);
      }
      parts.push(...recent.map((h) => `${h.role === "user" ? "User" : "Agent"}: ${h.text}`));
      return parts.join("\n");
    })();

    const prompt = [
      SYSTEM_PROMPT,
      `\nCONTEXT:\n${metaContext}`,
      historyBlock ? `\nCONVERSATION SO FAR:\n${historyBlock}` : "",
      `\nUser: ${userInput}`,
      `Agent:`,
    ].join("\n");

    process.stdout.write("\n");
    rl.pause();
    const agentName = extractAgentName(identityPath);
    const response = await runOneShotPrompt(entry, prompt, config.projectRoot, config.paths.tmpDir, agentName);
    process.stdout.write("\n");
    rl.resume();

    const updated = extractIdentityBlock(response);
    if (updated) {
      writeFileSync(identityPath, updated);
      console.log(paint(c.green, "\n  ✓ identity.md updated\n"));
    } else {
      console.log();
    }

    history.push({ role: "agent", text: response, ts: Date.now() });
    saveHistory(histFile, history);
  }
}
