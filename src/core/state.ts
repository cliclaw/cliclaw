/**
 * State management — JSON-backed persistent state.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ClawState } from "./types.js";

let statePath: string | null = null;

export function initState(path: string): void {
  statePath = path;
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({}, null, 2));
  } else {
    // Validate JSON
    try {
      JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      writeFileSync(path, JSON.stringify({}, null, 2));
    }
  }
}

function load(): ClawState {
  if (!statePath) return {};
  try {
    return JSON.parse(readFileSync(statePath, "utf-8")) as ClawState;
  } catch {
    return {};
  }
}

function save(state: ClawState): void {
  if (!statePath) return;
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function readState<K extends keyof ClawState>(key: K): ClawState[K] {
  return load()[key];
}

export function writeState<K extends keyof ClawState>(key: K, value: ClawState[K]): void {
  const state = load();
  state[key] = value;
  save(state);
}

export function getFullState(): ClawState {
  return load();
}
