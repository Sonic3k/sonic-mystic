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
    assert.ok(has(`chu-dao:${n}`), `chủ đạo ${n}`);
    for (const part of ['muc-dich', 'dieu-kien', 'dac-diem', 'khac-phuc', 'phat-trien', 'nghe-nghiep', 'tom-lai']) assert.ok(rules.some(r => r.e === `p5.${n}.${part}`), `p5.${n}.${part}`);
  }
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]) assert.ok(has(`ngay-sinh:${n}`), `ngày sinh ${n}`);
  for (let n = 1; n <= 9; n++) assert.ok(has(`so:${n}`) && has(`nam:${n}`), `số ${n}`);
  for (const a of N.ARROWS) assert.ok(rules.some(r => r.e === `p7.${a.code.replace(/-/g, '')}`) && (!a.empty || rules.some(r => r.e === `p7.${a.code.replace(/-/g, '')}-trong`)), a.code);
  for (let n = 1; n <= 11; n++) { assert.ok(has(`dinh:${n}`), `đỉnh ${n}`); assert.ok(has(`linh-hon:${n}`) && has(`bieu-dat:${n}`), `tên ${n}`); }
  assert.ok(has('bieu-dat:22'));
  for (const s of [1, 2, 3]) assert.ok(has(`giai-doan:${s}`), `giai đoạn ${s}`);
});

test('the book\'s own examples read as the book reads them', opts, () => {
  const { kb } = load();
  const asOf = { year: 2026, month: 10, day: 15 };
  // the author: 1/5/1974, called Quỳnh — chủ đạo 9, ngày sinh 1, 11 with Mũi tên Quyết tâm and Mũi tên Thực tế
  const c = N.buildNumerology({ day: 1, month: 5, year: 1974, gender: 'female', names: [{ text: 'Quỳnh' }], asOf });
  const r = N.readNumerology(c, kb);
  assert.deepEqual(r.sections.map(s => s.topic), ['chu_dao', 'ngay_sinh', 'bieu_do', 'mui_ten', 'ten', 'dinh', 'dinh', 'dinh', 'dinh', 'giai_doan', 'nam']);
  const entries = t => r.sections.filter(s => s.topic === t).flatMap(s => s.groups.map(g => g.entry));
  assert.ok(entries('chu_dao').includes('p5.9.tom-lai'));
  assert.ok(entries('ngay_sinh').includes('p8.1'));
  assert.ok(entries('bieu_do').includes('p6.so1.c2') && entries('bieu_do').includes('p6.so4.c1'));
  assert.deepEqual(entries('mui_ten').filter(e => /^p7\.\d/.test(e)), ['p7.159', 'p7.147']);
  assert.deepEqual(entries('dinh').filter(e => e.startsWith('p11.dinh')), ['p11.dinh6', 'p11.dinh4', 'p11.dinh10', 'p11.dinh8']);
  // the book's explanation of the peaks is shown once, not under every peak
  assert.equal(r.sections.filter(s => s.topic === 'dinh').flatMap(s => s.groups).filter(g => g.entry === 'p11.duong-doi').length, 1);
  // 22/2/2000: six empty arrows, four 2s, the passages on breaking them
  const e = N.readNumerology(N.buildNumerology({ day: 22, month: 2, year: 2000, gender: 'female', asOf }), kb);
  const arrows = e.sections.find(s => s.topic === 'mui_ten').groups.map(g => g.entry);
  for (const a of ['p7.159-trong', 'p7.357-trong', 'p7.369-trong', 'p7.147-trong', 'p7.456-trong', 'p7.789-trong']) assert.ok(arrows.includes(a), a);
  for (const a of ['p7.159-pha-the', 'p7.357-pha-the', 'p7.369-pha-the']) assert.ok(arrows.some(x => x.startsWith(a)), a);
  assert.ok(e.sections.find(s => s.topic === 'bieu_do').groups.some(g => g.entry === 'p6.so2.c4'));
  // nobody's reading quotes the book's examples of other people or its how-to
  const { book } = load();
  const role = new Map(book.entries.flatMap(x => x.paras.map(p => [p.id, p.role])));
  for (const s of [...r.sections, ...e.sections]) for (const g of s.groups) for (const m of g.matches) assert.ok(!['example', 'method', 'figure', 'note'].includes(role.get(Number(m.rule.id.split('.b')[1]))), m.rule.id);
});

test('the tables of the book', opts, () => {
  const { tables } = load();
  const t = Object.fromEntries(tables.tables.map(x => [x.key, x]));
  assert.equal(t['ngay-sinh'].rows.length, 31);
  assert.deepEqual(t['do-tuoi'].rows.at(-1), ['22/4', '32', '41', '50', '59']);
  assert.deepEqual(t['chu-cai'].rows[0], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
});
