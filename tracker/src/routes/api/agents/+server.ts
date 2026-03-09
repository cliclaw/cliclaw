import { json } from '@sveltejs/kit';
import { readTrackerEvents } from '$lib/tracker';

export function GET() {
  const events = readTrackerEvents();
  const agents = new Set<string>();
  
  events.forEach(e => {
    if (e.type === 'message') {
      agents.add(e.from);
      agents.add(e.to);
    } else if (e.type === 'task') {
      agents.add(e.agent);
    } else if (e.type === 'token') {
      agents.add(e.agent);
    }
  });
  
  return json(Array.from(agents).filter(Boolean));
}
