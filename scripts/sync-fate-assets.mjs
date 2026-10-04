import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.argv[2] || resolve(root, '../fate-same-origin-20261004/game/public'));
const target = resolve(root, 'static/fate/runtime');
mkdirSync(target, { recursive: true });
function copyDirectory(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) copyDirectory(resolve(from, entry.name), resolve(to, entry.name));
    else if (entry.isFile()) copyFileSync(resolve(from, entry.name), resolve(to, entry.name));
  }
}
copyDirectory(source, target);
console.log('Synced game assets to static/fate/runtime');
