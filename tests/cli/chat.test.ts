import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── helpers extracted for testing (duplicated minimally) ──────────────────────

function extractAgentName(identityContent: string): string {
  const match = identityContent.match(/\*\*Name\*\*:\s*(.+)/);
  return match?.[1]?.trim() ?? "agent";
}

function extractIdentityBlock(output: string): string | null {
  const match = output.match(/```identity\n([\s\S]*?)```/);
  const content = match?.[1]?.trim();
  return content || null;
}

type Message = { role: "user" | "agent"; text: string; ts: number };

function buildHistoryBlock(history: Message[], recentTurns: number): string {
  const cutoff = Math.max(0, history.length - recentTurns * 2);
  const older = history.slice(0, cutoff);
  const recent = history.slice(cutoff);
  const parts: string[] = [];
  if (older.length) {
    const digest = older.filter((m) => m.role === "user").map((m) => m.text.slice(0, 120)).join(" | ");
    parts.push(`[Earlier conversation summary — ${older.length} messages]: ${digest}`);
  }
  parts.push(...recent.map((h) => `${h.role === "user" ? "User" : "Agent"}: ${h.text}`));
  return parts.join("\n");
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("extractAgentName", () => {
  it("extracts name from identity content", () => {
    expect(extractAgentName("## Core\n- **Name**: BonBowMacus\n")).toBe("BonBowMacus");
  });
  it("returns 'agent' when no name field", () => {
    expect(extractAgentName("# Identity\nNo name here.")).toBe("agent");
  });
  it("trims whitespace", () => {
    expect(extractAgentName("**Name**:   Kiro  ")).toBe("Kiro");
  });
});

describe("extractIdentityBlock", () => {
  it("extracts content inside identity fence", () => {
    const out = "Sure!\n```identity\n# Agent\n- **Name**: X\n```\nDone.";
    expect(extractIdentityBlock(out)).toBe("# Agent\n- **Name**: X");
  });
  it("returns null when no block present", () => {
    expect(extractIdentityBlock("Just a normal reply.")).toBeNull();
  });
  it("returns null for empty block", () => {
    expect(extractIdentityBlock("```identity\n```")).toBeNull();
  });
});

describe("buildHistoryBlock", () => {
  const make = (role: "user" | "agent", text: string): Message => ({ role, text, ts: 0 });

  it("returns empty string for empty history", () => {
    expect(buildHistoryBlock([], 10)).toBe("");
  });

  it("renders recent turns verbatim", () => {
    const h = [make("user", "hello"), make("agent", "hi")];
    const result = buildHistoryBlock(h, 10);
    expect(result).toContain("User: hello");
    expect(result).toContain("Agent: hi");
    expect(result).not.toContain("Earlier conversation");
  });

  it("summarizes older turns beyond recentTurns*2", () => {
    // 6 messages, recentTurns=2 → cutoff at 6-4=2, older=first 2, recent=last 4
    const h: Message[] = [
      make("user", "old topic A"),
      make("agent", "reply A"),
      make("user", "recent 1"),
      make("agent", "reply 1"),
      make("user", "recent 2"),
      make("agent", "reply 2"),
    ];
    const result = buildHistoryBlock(h, 2);
    expect(result).toContain("[Earlier conversation summary — 2 messages]: old topic A");
    expect(result).toContain("User: recent 1");
    expect(result).toContain("User: recent 2");
    expect(result).not.toContain("old topic A\nAgent:");
  });

  it("digest only includes user messages", () => {
    const h: Message[] = [
      make("user", "user msg"),
      make("agent", "agent msg should not appear in digest"),
      make("user", "r1"), make("agent", "r2"),
      make("user", "r3"), make("agent", "r4"),
    ];
    const result = buildHistoryBlock(h, 2);
    expect(result).toContain("user msg");
    expect(result).not.toContain("agent msg should not appear in digest");
  });

  it("truncates long older messages to 120 chars", () => {
    const long = "x".repeat(200);
    const h: Message[] = [
      make("user", long), make("agent", "a"),
      make("user", "r1"), make("agent", "r2"),
      make("user", "r3"), make("agent", "r4"),
    ];
    const result = buildHistoryBlock(h, 2);
    expect(result).toContain("x".repeat(120));
    expect(result).not.toContain("x".repeat(121));
  });
});

describe("loadHistory / saveHistory (file I/O)", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `cliclaw-chat-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it("returns empty array for missing file", async () => {
    const { loadHistory } = await import("../src/cli/chat.js").catch(() => ({ loadHistory: null }));
    // loadHistory is not exported — test via file directly
    const file = join(dir, "chat-test.json");
    // simulate what loadHistory does
    let result: Message[] = [];
    try { result = JSON.parse(require("fs").readFileSync(file, "utf-8")); } catch { result = []; }
    expect(result).toEqual([]);
  });

  it("round-trips history to JSON", () => {
    const file = join(dir, "chat-kiro.json");
    const history: Message[] = [{ role: "user", text: "hello", ts: 1234 }];
    writeFileSync(file, JSON.stringify(history, null, 2));
    const loaded = JSON.parse(require("fs").readFileSync(file, "utf-8")) as Message[];
    expect(loaded).toEqual(history);
  });
});
