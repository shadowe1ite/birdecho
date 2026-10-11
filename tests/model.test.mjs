import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseCsvLine, parseLabels, planChunks, collectBirds } from '../src/model-utils.mjs';

test('CSV handles quoted names, delimiters, and escaped quotes', () => {
  assert.deepEqual(parseCsvLine('7;"Bird; name";"a ""quote"""'), ['7', 'Bird; name', 'a "quote"']);
});
test('labels use explicit output indices and distinguish birds from other animals', () => {
  const labels = parseLabels('\uFEFFidx;id;sci_name;com_name;class;order\r\n1;2;Rana temporaria;Common frog;Amphibia;Anura\r\n0;1;Erithacus rubecula;European robin;Aves;Passeriformes');
  assert.equal(labels[0].scientific, 'Erithacus rubecula');
  assert.equal(labels[0].isBird, true); assert.equal(labels[1].isBird, false);
  assert.throws(() => parseLabels('name;bird\na;b'), /Invalid/);
});
test('three-second windows preserve the final partial segment for padding', () => {
  assert.deepEqual(planChunks(0), []);
  assert.deepEqual(planChunks(32000), [{ start: 0, end: 32000 }]);
  assert.deepEqual(planChunks(96001), [{ start: 0, end: 96000 }, { start: 96000, end: 96001 }]);
});
test('only real bird scores above threshold become suggestions; strongest segment wins', () => {
  const labels = [{ scientific: 'robin', isBird: true }, { scientific: 'frog', isBird: false }, { scientific: 'tit', isBird: true }];
  const matches = collectBirds([.4, .99, .24], labels, 0, 3);
  collectBirds([.8, .99, NaN], labels, 3, 6, matches);
  assert.equal(matches.size, 1); assert.equal(matches.get('robin').confidence, .8); assert.equal(matches.get('robin').start, 3);
  assert.throws(() => collectBirds([.1], labels, 0, 3), /does not match/);
});
test('bundled chunks reassemble into the checksum-verified official model', async () => {
  const manifest = JSON.parse(await readFile('public/models/manifest.json', 'utf8'));
  const chunks = await Promise.all(manifest.parts.map(part => readFile(`public/models/${part.name}`)));
  const model = Buffer.concat(chunks);
  assert.equal(model.length, 71528628);
  assert.equal(createHash('md5').update(model).digest('hex'), '8278be6e7d1a9fc1717cf953e269b2e3');
  assert.equal(createHash('sha256').update(model).digest('hex'), manifest.sha256);
  for (const part of manifest.parts) assert.ok(part.bytes < 25 * 1024 * 1024);
  const labels = parseLabels(await readFile('public/models/labels.csv', 'utf8'));
  assert.ok(labels.length > 10000); assert.ok(labels.some(x => x.scientific === 'Erithacus rubecula'));
});
