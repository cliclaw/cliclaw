import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const configPath = join(process.cwd(), '../.cliclaw/config.json');

export function GET() {
  try {
    if (!existsSync(configPath)) return json({});
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return json(config.graph || {});
  } catch {
    return json({});
  }
}

export async function PUT({ request }: { request: Request }) {
  try {
    const graph = await request.json();
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    config.graph = graph;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return json({ ok: true });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}
