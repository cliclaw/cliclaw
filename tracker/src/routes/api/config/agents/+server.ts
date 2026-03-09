import { json } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function GET() {
  try {
    const configPath = join(process.cwd(), '../.cliclaw/config.json');
    
    if (!existsSync(configPath)) {
      return json([]);
    }
    
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return json(config.engines || config.agents || []);
  } catch (err) {
    return json([]);
  }
}
