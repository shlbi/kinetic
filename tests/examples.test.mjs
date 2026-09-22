import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseProjectText } from '../src/project/format.js';
import { buildTimeline } from '../src/sim/model.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = [
  ['sparse-ring.json', '9c47fc48', 22],
  ['dense-ring.json', '217e2608', 37],
];

for (const [filename, fingerprint, vehicleCount] of fixtures) {
  test(`example ${filename} is valid and reproducible`, async () => {
    const text = await readFile(path.join(root, 'examples', filename), 'utf8');
    const project = parseProjectText(text);
    const first = buildTimeline(project);
    const second = buildTimeline(project);
    assert.equal(first.fingerprint, fingerprint);
    assert.equal(first.vehicleCount, vehicleCount);
    assert.deepEqual(first.frames, second.frames);
  });
}
