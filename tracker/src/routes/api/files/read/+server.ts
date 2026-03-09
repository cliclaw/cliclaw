import { json } from '@sveltejs/kit';
import { readFileSync } from 'fs';

export function GET({ url }: { url: URL }) {
  const path = url.searchParams.get('path');
  
  if (!path) {
    return json({ error: 'Path required' }, { status: 400 });
  }
  
  try {
    const content = readFileSync(path, 'utf-8');
    return json({ content });
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
}
