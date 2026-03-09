/**
 * Parse and process tracker commands from agent output
 */

import { sendMessage, markMessageRead, getUnreadMessages } from "../core/tracker.js";
import { logInfo, logWarn } from "../core/logger.js";
import type { TrackerTaskEvent } from "../core/types.js";

interface TrackerCommand {
  type: "message" | "task";
  [key: string]: any;
}

/** Parse JSON tracker commands from agent output */
export function parseTrackerCommands(output: string): TrackerCommand[] {
  const commands: TrackerCommand[] = [];
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
  
  let match;
  while ((match = jsonBlockRegex.exec(output)) !== null) {
    const jsonStr = match[1];
    if (!jsonStr) continue;
    
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.type === "message" || parsed.type === "task") {
        commands.push(parsed);
      }
    } catch {
      // Ignore invalid JSON
    }
  }
  
  return commands;
}

/** Process tracker commands from agent output */
export function processTrackerCommands(
  projectRoot: string,
  agentAlias: string | undefined,
  output: string
): void {
  if (!agentAlias) return;
  
  const commands = parseTrackerCommands(output);
  
  if (commands.length === 0) return;
  
  logInfo(`Processing ${commands.length} tracker command(s) from ${agentAlias}`);
  
  for (const cmd of commands) {
    if (cmd.type === "message") {
      processMessageCommand(projectRoot, agentAlias, cmd);
    } else if (cmd.type === "task") {
      processTaskCommand(projectRoot, agentAlias, cmd);
    }
  }
  
  // Mark all unread messages as read after processing
  const unread = getUnreadMessages(projectRoot, agentAlias);
  for (const msg of unread) {
    markMessageRead(projectRoot, msg.id);
  }
}

function processMessageCommand(
  projectRoot: string,
  from: string,
  cmd: any
): void {
  if (!cmd.to || !cmd.content) {
    logWarn(`Invalid message command from ${from}: missing 'to' or 'content'`);
    return;
  }
  
  const result = sendMessage(projectRoot, from, cmd.to, cmd.content);
  
  if (result.success) {
    logInfo(`Message sent: ${from} → ${cmd.to}`);
  } else {
    logWarn(`Message blocked: ${result.error}`);
  }
}

function processTaskCommand(
  projectRoot: string,
  agent: string,
  cmd: any
): void {
  if (!cmd.action || !cmd.task_id) {
    logWarn(`Invalid task command from ${agent}: missing 'action' or 'task_id'`);
    return;
  }
  
  const { appendTrackerEvent } = require("../core/tracker.js");
  
  const event: TrackerTaskEvent = {
    type: "task",
    action: cmd.action,
    task_id: cmd.task_id,
    agent,
    assignee: cmd.assignee,
    title: cmd.title,
    status: cmd.status,
    timestamp: new Date().toISOString()
  };
  
  appendTrackerEvent(projectRoot, event);
  logInfo(`Task ${cmd.action}: ${agent}/${cmd.task_id}`);
}
