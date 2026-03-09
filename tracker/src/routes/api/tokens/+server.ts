import { json } from '@sveltejs/kit';
import { readTrackerEvents } from '$lib/tracker';

export function GET() {
  const events = readTrackerEvents();
  const tokens = events.filter(e => e.type === 'token');
  return json(tokens);
}
