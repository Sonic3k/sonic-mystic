// The import bundle is whole: every rule points at a paragraph of its entry, every condition parses, the manifest
// matches what is there. Run: npm test -w @mystic/kb (after npm run build -w @mystic/engine)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, findTarget } from '@mystic/engine/tuvi';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bundle/tuvi');
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const book = read('book.json'), { rules } = read('rules.json'), supp = read('supplement.json'), phan1 = read('phan1.json'), manifest = read('manifest.json');

test('manifest matches the bundle', () => {
  assert.equal(manifest.rules, rules.length);
  assert.equal(manifest.entries, book.entries.length);
});

test('every rule points at a paragraph of its own entry', () => {
  const paras = new Map(book.entries.map(e => [e.line, new Set(e.paras.map(p => p.id))]));
  for (const r of rules) {
    assert.ok(paras.has(r.e), `${r.i}: entry ${r.e}`);
    assert.ok(paras.get(r.e).has(r.p), `${r.i}: paragraph ${r.p} in entry ${r.e}`);
    for (const t of r.at) assert.ok(t === '*' || findTarget(t), `${r.i}: target ${t}`);
  }
});

test('every condition parses', () => {
  for (const r of rules) if (r.w) assert.deepEqual(parse(r.w).errors, [], r.i);
  for (const s of supp.stars) for (const r of s.rules) if (r.when) assert.deepEqual(parse(r.when).errors, [], r.id);
});

test('Phần I has its steps, tables and the three differences', () => {
  assert.ok(phan1.steps.length >= 7);
  assert.equal(phan1.hoaGiap.rows.length, 30);
  assert.equal(phan1.differences.length, 3);
});
