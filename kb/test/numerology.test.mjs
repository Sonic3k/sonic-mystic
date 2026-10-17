// The Nhân số học bundle is whole: every rule points at a paragraph of its own entry and parses, every number the
// book writes about has its passages, and the book's own examples read the way the book reads them.
// Run: npm test -w @mystic/kb (after npm run build -w @mystic/engine and npm run kb:numerology)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as N from '@mystic/engine/numerology';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bundle/numerology');
const present = fs.existsSync(path.join(dir, 'manifest.json'));
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const opts = { skip: present ? false : 'the numerology bundle is not built here (npm run kb:numerology)' };
const load = () => {
  const book = read('book.json'), { rules } = read('rules.json'), manifest = read('manifest.json'), tables = read('tables.json');
  const kb = {
    rules: N.compile(rules.map(r => ({ id: r.i, topic: r.tp, entry: r.e, ord: r.o, page: r.pg, kind: r.k, text: r.t, when: r.w }))),
    entries: Object.fromEntries(book.entries.map((e, i) => [e.code, { code: e.code, title: e.title, parent: e.parent ?? undefined, ord: i }])),
  };
  return { book, rules, manifest, tables, kb };
};

test('manifest matches the bundle, and every rule points at a paragraph of its entry', opts, () => {
  const { book, rules, manifest } = load();
  assert.equal(manifest.rules, rules.length);
  assert.equal(manifest.entries, book.entries.length);
  const paras = new Map(book.entries.map(e => [e.code, new Map(e.paras.map(p => [p.id, p]))]));
  const topics = new Set(N.TOPICS.map(t => t.code));
  for (const r of rules) {
    const p = paras.get(r.e)?.get(r.p);
    assert.ok(p, `${r.i}: paragraph ${r.p} in ${r.e}`);
    assert.equal(p.text, r.t, r.i);
    assert.ok(topics.has(r.tp), `${r.i}: topic ${r.tp}`);
    assert.ok(['rule', 'advice', 'child', 'general'].includes(r.k), `${r.i}: kind ${r.k}`);
    assert.deepEqual(N.parse(r.w).errors, [], r.i);
  }
  assert.equal(new Set(rules.map(r => r.i)).size, rules.length);
});

test('every number the book writes about has its passages', opts, () => {
  const { rules } = load();
  const has = s => rules.some(r => r.s.includes(s));
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]) {
    assert.ok(has(`ruling:${n}`), `chủ đạo ${n}`);
    for (const part of ['purpose', 'conditions', 'traits', 'to-overcome', 'growth', 'careers', 'summary']) assert.ok(rules.some(r => r.e === `p5.${n}.${part}`), `p5.${n}.${part}`);
  }
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]) assert.ok(has(`birthday:${n}`), `ngày sinh ${n}`);
  for (let n = 1; n <= 9; n++) assert.ok(has(`digit:${n}`) && has(`year:${n}`), `số ${n}`);
  for (const a of N.ARROWS) assert.ok(rules.some(r => r.e === `p7.${a.code.replace(/-/g, '')}`) && (!a.empty || rules.some(r => r.e === `p7.${a.code.replace(/-/g, '')}-empty`)), a.code);
  for (let n = 1; n <= 11; n++) { assert.ok(has(`peak:${n}`), `đỉnh ${n}`); assert.ok(has(`soul:${n}`) && has(`expression:${n}`), `tên ${n}`); }
  assert.ok(has('expression:22'));
  for (const s of [1, 2, 3]) assert.ok(has(`stage:${s}`), `giai đoạn ${s}`);
  // a full arrow and the same arrow empty are looked up apart
  for (const a of N.ARROWS) {
    assert.ok(has(`arrow:${a.code}`), `arrow:${a.code}`);
    if (a.empty) assert.ok(has(`empty-arrow:${a.code}`), `empty-arrow:${a.code}`);
  }
  assert.ok(rules.filter(r => r.e === 'p7.456-empty').every(r => !r.s.includes('arrow:4-5-6')));
});

test('sections carry what they are about, and figures read back into charts', opts, () => {
  const { book } = load();
  const by = new Map(book.entries.map(e => [e.code, e]));
  assert.deepEqual(by.get('p5.9.summary').symbols, ['ruling:9']);
  assert.deepEqual(by.get('p7.456-empty').symbols, ['empty-arrow:4-5-6']);
  const figures = book.entries.flatMap(e => e.paras).filter(p => p.kind === 'figure');
  const grids = figures.map(p => N.figureOf(p.text).grid).filter(Boolean);
  assert.ok(grids.length >= 79, `${grids.length} charts`);
  assert.deepEqual(grids[0], [['3', '6', '9'], ['2', '5', '8'], ['1', '4', '7']]);
  for (const g of grids) assert.ok(g.length === 3 && g.every(r => r.length === 3));
});

test('the book\'s own examples read as the book reads them', opts, () => {
  const { kb } = load();
  const asOf = { year: 2026, month: 10, day: 15 };
  // the author: 1/5/1974, called Quỳnh — chủ đạo 9, ngày sinh 1, 11 with Mũi tên Quyết tâm and Mũi tên Thực tế
  const c = N.buildNumerology({ day: 1, month: 5, year: 1974, gender: 'female', names: [{ text: 'Quỳnh' }], asOf });
  const r = N.readNumerology(c, kb);
  assert.deepEqual(r.sections.map(s => s.topic), ['ruling', 'birthday', 'grid', 'arrows', 'name', 'peaks', 'peaks', 'peaks', 'peaks', 'stages', 'year']);
  const entries = t => r.sections.filter(s => s.topic === t).flatMap(s => s.groups.map(g => g.entry));
  assert.ok(entries('ruling').includes('p5.9.summary'));
  assert.ok(entries('birthday').includes('p8.1'));
  assert.ok(entries('grid').includes('p6.digit1.c2') && entries('grid').includes('p6.digit4.c1'));
  assert.deepEqual(entries('arrows').filter(e => /^p7\.\d/.test(e)), ['p7.159', 'p7.147']);
  assert.deepEqual(entries('peaks').filter(e => e.startsWith('p11.peak')), ['p11.peak6', 'p11.peak4', 'p11.peak10', 'p11.peak8']);
  // the book's explanation of the peaks is shown once, not under every peak
  assert.equal(r.sections.filter(s => s.topic === 'peaks').flatMap(s => s.groups).filter(g => g.entry === 'p11.life-path').length, 1);
  // 22/2/2000: six empty arrows, four 2s, the passages on breaking them
  const e = N.readNumerology(N.buildNumerology({ day: 22, month: 2, year: 2000, gender: 'female', asOf }), kb);
  const arrows = e.sections.find(s => s.topic === 'arrows').groups.map(g => g.entry);
  for (const a of ['p7.159-empty', 'p7.357-empty', 'p7.369-empty', 'p7.147-empty', 'p7.456-empty', 'p7.789-empty']) assert.ok(arrows.includes(a), a);
  for (const a of ['p7.159-break', 'p7.357-break', 'p7.369-break']) assert.ok(arrows.some(x => x.startsWith(a)), a);
  assert.ok(e.sections.find(s => s.topic === 'grid').groups.some(g => g.entry === 'p6.digit2.c4'));
  // nobody's reading quotes the book's examples of other people or its how-to
  const { book } = load();
  const role = new Map(book.entries.flatMap(x => x.paras.map(p => [p.id, p.role])));
  for (const s of [...r.sections, ...e.sections]) for (const g of s.groups) for (const m of g.matches) assert.ok(!['example', 'method', 'figure', 'note'].includes(role.get(Number(m.rule.id.split('.b')[1]))), m.rule.id);
});

test('the tables of the book', opts, () => {
  const { tables } = load();
  const t = Object.fromEntries(tables.tables.map(x => [x.key, x]));
  assert.equal(t['birthdays'].rows.length, 31);
  assert.deepEqual(t['ages'].rows.at(-1), ['22/4', '32', '41', '50', '59']);
  assert.deepEqual(t['letters'].rows[0], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
});
