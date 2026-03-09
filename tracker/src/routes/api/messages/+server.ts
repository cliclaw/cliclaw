import { json } from '@sveltejs/kit';
import { readTrackerEvents } from '$lib/tracker';

export function GET() {
  const events = readTrackerEvents();
  const messages = events.filter(e => e.type === 'message');
  return json(messages);
}
