import { json } from '@sveltejs/kit';
import { readTrackerEvents } from '$lib/tracker';

export function GET() {
  const events = readTrackerEvents();
  const tasks = events.filter(e => e.type === 'task');
  return json(tasks);
}
