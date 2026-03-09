import { readFileSync, existsSync, watchFile } from 'fs';
import { join } from 'path';

const TRACKER_FILE = join(process.cwd(), '../.cliclaw/tracker.jsonl');

export interface TrackerEvent {
  type: 'message' | 'task' | 'token';
  timestamp: string;
  [key: string]: any;
}

export function readTrackerEvents(): TrackerEvent[] {
  if (!existsSync(TRACKER_FILE)) {
    return [];
  }
  
  const content = readFileSync(TRACKER_FILE, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

export function watchTrackerFile(callback: () => void) {
  if (!existsSync(TRACKER_FILE)) {
    return;
  }
  
  watchFile(TRACKER_FILE, { interval: 1000 }, callback);
}
