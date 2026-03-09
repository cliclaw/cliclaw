import { json } from '@sveltejs/kit';
import { writeFileSync } from 'fs';

export async function POST({ request }: { request: Request }) {
  try {
    const { path, content } = await request.json();
    
    if (!path || content === undefined) {
      return json({ error: 'Path and content required' }, { status: 400 });
    }
    
    writeFileSync(path, content, 'utf-8');
    return json({ success: true });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
}
