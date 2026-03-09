import { json } from '@sveltejs/kit';
import { readTrackerEvents } from '$lib/tracker';

export function GET() {
  const events = readTrackerEvents();
  return json(events);
}
