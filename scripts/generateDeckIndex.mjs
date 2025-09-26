import { promises as fs } from 'node:fs';
import path from 'node:path';

const DECKS_DIR = path.resolve('public/decks');
const OUT_FILE  = path.join(DECKS_DIR, 'index.json');

function toPosix(p) { return p.split(path.sep).join('/'); }

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readJSON(p) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return null; }
}

async function main() {
  const entries = await fs.readdir(DECKS_DIR, { withFileTypes: true }).catch(() => []);
  const decks = [];

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const id = ent.name;

    const base      = path.join(DECKS_DIR, id);
    const cfgPath   = path.join(base, 'deck.config.json');
    const frontPath = path.join(base, 'templates', 'front.svg');
    const backPath  = path.join(base, 'templates', 'back.svg');

    if (!(await exists(cfgPath)) || !(await exists(frontPath)) || !(await exists(backPath))) {
      // missing essentials → skip from index
      continue;
    }

    const cfg = await readJSON(cfgPath);
    // Optional friendly name; fall back to id
    const title = cfg?.title || cfg?.name || id;

    decks.push({
      id,
      title,
      // Handy metadata for UI/debug (paths are public)
      paths: {
        config: toPosix(path.relative('public', cfgPath)),
        front : toPosix(path.relative('public', frontPath)),
        back  : toPosix(path.relative('public', backPath)),
      },
      version: cfg?.version ?? 1
    });
  }

  await fs.writeFile(OUT_FILE, JSON.stringify({ decks }, null, 2), 'utf8');
  console.log(`[deck-index] wrote ${OUT_FILE} with ${decks.length} deck(s).`);
}

main().catch((e) => {
  console.error('[deck-index] failed:', e);
  process.exit(1);
});
