import fs from 'fs';
import path from 'path';

const SRC_DIRS = ['src', 'public'];
const TEXT_EXTS = new Set(['.js','.jsx','.ts','.tsx','.mjs','.cjs','.html','.css','.json','.md','.svg']);
const ASSET_EXTS = new Set(['.svg','.png','.jpg','.jpeg','.gif','.webp','.mp3','.wav']);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = SRC_DIRS.flatMap(d => fs.existsSync(d) ? walk(d) : []);
const textFiles = files.filter(f => TEXT_EXTS.has(path.extname(f).toLowerCase()));
const assetFiles = files.filter(f => ASSET_EXTS.has(path.extname(f).toLowerCase()));

const corpus = textFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const referenced = new Set();
for (const a of assetFiles) {
  const name = path.basename(a);
  if (corpus.includes(name)) referenced.add(a);
}

const dead = assetFiles.filter(a => !referenced.has(a));
const lines = ['# Dead asset candidates',
               '',
               `Scanned ${files.length} files; ${assetFiles.length} assets; found ${dead.length} unreferenced.`,
               '',
               ...dead.map(p => `- ${p}`)];
fs.writeFileSync('DEAD_ASSETS.md', lines.join('\n'));
console.log(`Wrote DEAD_ASSETS.md with ${dead.length} candidates.`);
