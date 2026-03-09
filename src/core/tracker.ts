/**
 * Tracker system for agent communication and coordination
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TrackerEvent, TrackerMessageEvent, TrackerTaskEvent, TrackerTokenEvent } from "./types.js";

/** Communication hierarchy - who can message whom */
export const DEFAULT_COMMUNICATION_GRAPH: Record<string, string[]> = {
  "ceo": ["cto"],
  "cto": ["ceo", "staff-engineer"],
  "staff-engineer": ["cto", "go-dev", "frontend-svelte", "mobile-flutter", "qa-playwright", "typescript-dev"],
  "go-dev": ["staff-engineer"],
  "typescript-dev": ["staff-engineer"],
  "frontend-svelte": ["staff-engineer"],
  "frontend-react": ["staff-engineer"],
  "frontend-vue": ["staff-engineer"],
  "mobile-flutter": ["staff-engineer"],
  "qa-playwright": ["staff-engineer"]
};

/** Get communication graph from config or fallback to default */
export function getCommunicationGraph(projectRoot: string): Record<string, string[]> {
  try {
    const configPath = join(projectRoot, ".cliclaw", "config.json");
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (config.graph) return config.graph;
    }
  } catch { /* fallback */ }
  return DEFAULT_COMMUNICATION_GRAPH;
}

/** Get tracker file path */
export function getTrackerPath(projectRoot: string): string {
  return join(projectRoot, ".cliclaw", "tracker.jsonl");
}

/** Append event to tracker log */
export function appendTrackerEvent(projectRoot: string, event: TrackerEvent): void {
  const path = getTrackerPath(projectRoot);
  appendFileSync(path, JSON.stringify(event) + "\n", "utf-8");
}

/** Read all tracker events */
export function readTrackerEvents(projectRoot: string): TrackerEvent[] {
  const path = getTrackerPath(projectRoot);
  if (!existsSync(path)) return [];
  
  const content = readFileSync(path, "utf-8");
  return content
    .split("\n")
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as TrackerEvent);
}

/** Get unread messages for an agent */
export function getUnreadMessages(projectRoot: string, agentAlias: string): TrackerMessageEvent[] {
  const events = readTrackerEvents(projectRoot);
  return events.filter(
    (e): e is TrackerMessageEvent => 
      e.type === "message" && 
      e.to === agentAlias && 
      !e.read
  );
}

/** Mark message as read */
export function markMessageRead(projectRoot: string, messageId: string): void {
  const path = getTrackerPath(projectRoot);
  const events = readTrackerEvents(projectRoot);
  
  // Find and update the message
  const updated = events.map(e => {
    if (e.type === "message" && e.id === messageId) {
      return { ...e, read: true };
    }
    return e;
  });
  
  // Rewrite file
  writeFileSync(path, updated.map(e => JSON.stringify(e)).join("\n") + "\n", "utf-8");
}

/** Send message from one agent to another */
export function sendMessage(
  projectRoot: string,
  from: string,
  to: string,
  content: string
): { success: boolean; error?: string } {
  // Validate communication is allowed
  const graph = getCommunicationGraph(projectRoot);
  const allowed = graph[from] || [];
  if (!allowed.includes(to)) {
    return { 
      success: false, 
      error: `Agent '${from}' cannot communicate with '${to}'. Allowed: ${allowed.join(", ")}` 
    };
  }
  
  const event: TrackerMessageEvent = {
    type: "message",
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    from,
    to,
    content,
    timestamp: new Date().toISOString(),
    read: false
  };
  
  appendTrackerEvent(projectRoot, event);
  return { success: true };
}

/** Get all tasks for an agent */
export function getAgentTasks(projectRoot: string, agentAlias: string): Array<{
  task_id: string;
  title: string;
  status: string;
  agent: string;
  assignee: string;
  created: string;
  updated: string;
}> {
  const events = readTrackerEvents(projectRoot);
  const taskMap = new Map<string, any>();
  
  // First pass: build all tasks
  events
    .filter((e): e is TrackerTaskEvent => e.type === "task")
    .forEach(e => {
      if (e.action === "create") {
        taskMap.set(e.task_id, {
          task_id: e.task_id,
          title: e.title || "",
          status: e.status || "todo",
          agent: e.agent,
          assignee: e.assignee || e.agent,
          created: e.timestamp,
          updated: e.timestamp
        });
      } else if (e.action === "update") {
        const task = taskMap.get(e.task_id);
        if (task) {
          if (e.title) task.title = e.title;
          if (e.status) task.status = e.status;
          if (e.assignee) task.assignee = e.assignee;
          task.updated = e.timestamp;
        }
      } else if (e.action === "delete") {
        taskMap.delete(e.task_id);
      }
    });
  
  // Return tasks created by OR assigned to this agent
  return Array.from(taskMap.values()).filter(
    (t: any) => t.agent === agentAlias || t.assignee === agentAlias
  );
}

/** Get all tasks (for Kanban view) */
export function getAllTasks(projectRoot: string): Array<{
  task_id: string;
  agent: string;
  title: string;
  status: string;
  created: string;
  updated: string;
}> {
  const events = readTrackerEvents(projectRoot);
  const taskMap = new Map<string, any>();
  
  events
    .filter((e): e is TrackerTaskEvent => e.type === "task")
    .forEach(e => {
      if (e.action === "create") {
        taskMap.set(e.task_id, {
          task_id: e.task_id,
          agent: e.agent,
          title: e.title || "",
          status: e.status || "todo",
          created: e.timestamp,
          updated: e.timestamp
        });
      } else if (e.action === "update") {
        const task = taskMap.get(e.task_id);
        if (task) {
          if (e.title) task.title = e.title;
          if (e.status) task.status = e.status;
          task.updated = e.timestamp;
        }
      } else if (e.action === "delete") {
        taskMap.delete(e.task_id);
      }
    });
  
  return Array.from(taskMap.values());
}

/** Log token usage for an agent */
export function logTokenUsage(
  projectRoot: string,
  agent: string,
  cycle: number,
  tokens: number,
  cost: number
): void {
  const event: TrackerTokenEvent = {
    type: "token",
    agent,
    cycle,
    tokens,
    cost,
    timestamp: new Date().toISOString()
  };
  
  appendTrackerEvent(projectRoot, event);
}

/** Get token/cost summary per agent */
export function getTokenSummary(projectRoot: string): Record<string, { tokens: number; cost: number }> {
  const events = readTrackerEvents(projectRoot);
  const summary: Record<string, { tokens: number; cost: number }> = {};
  
  events
    .filter((e): e is TrackerTokenEvent => e.type === "token")
    .forEach(e => {
      if (!summary[e.agent]) {
        summary[e.agent] = { tokens: 0, cost: 0 };
      }
      summary[e.agent]!.tokens += e.tokens;
      summary[e.agent]!.cost += e.cost;
    });
  
  return summary;
}

/** Check if agent can communicate with target */
export function canCommunicate(projectRoot: string, from: string, to: string): boolean {
  const graph = getCommunicationGraph(projectRoot);
  return (graph[from] || []).includes(to);
}

/** Get allowed communication targets for an agent */
export function getAllowedTargets(projectRoot: string, agent: string): string[] {
  return getCommunicationGraph(projectRoot)[agent] || [];
}
