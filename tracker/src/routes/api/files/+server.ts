import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const CLICLAW_DIR = join(process.cwd(), '../.cliclaw');

export function GET() {
  try {
    const files: any[] = [];
    
    function scanDir(dir: string, basePath = '') {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const relativePath = join(basePath, item);
        const stats = statSync(fullPath);
        
        if (stats.isDirectory()) {
          scanDir(fullPath, relativePath);
        } else if (item.endsWith('.md') || item === 'config.json') {
          files.push({
            name: item,
            path: relativePath,
            fullPath,
            type: item.endsWith('.md') ? 'markdown' : 'json',
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
    }
    
    scanDir(CLICLAW_DIR);
    return json(files);
  } catch (err) {
    return json({ error: String(err) }, { status: 500 });
  }
}
