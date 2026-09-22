import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await cp(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

const html = await stat(path.join(dist, 'index.html'));
const model = await stat(path.join(dist, 'src', 'sim', 'model.js'));
if (html.size === 0 || model.size === 0) {
  throw new Error('Build produced an empty required artifact.');
}

console.log(`Kinetic build complete: ${dist}`);
console.log(`index.html ${html.size} bytes`);
console.log(`src/sim/model.js ${model.size} bytes`);
