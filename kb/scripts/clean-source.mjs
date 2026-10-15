// Builds the clean text of grandma's "Luận TV 11.2011" from two extractions of the same .doc:
//   raw/*.fixed.txt — the "Font fixed" copy: every run converted from TCVN3 (.VnTime) to Unicode
//   raw/*.orig.txt  — the original copy: TCVN3 runs still as legacy bytes, but the paragraphs typed later
//                     in Unicode are intact there (the font fixer converted those a second time: "thì" → "thỡ").
// The two files have the same lines and the same words per line, so the merge is word by word.
// Run: npm run kb:book (from the repo root)  → kb/sources/tuvi/luan-tv-2011-11.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const kb = path.resolve(dir, '..');
const read = f => fs.readFileSync(path.join(kb, 'sources/tuvi/raw', f), 'utf8').split('\n');
const fixed = read('luan-tv-2011-11.fixed.txt'), orig = read('luan-tv-2011-11.orig.txt');
if (fixed.length !== orig.length) throw new Error('line counts differ');

const VALID_LATIN1 = 'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúý';
/** A Latin-1 byte that no Unicode Vietnamese text uses (µ ¸ ª « × Ö …) — so it can only be a TCVN3 letter */
const isTcvnOnly = ch => { const c = ch.codePointAt(0); return c >= 0xa1 && c <= 0xff && !VALID_LATIN1.includes(ch); };
const hasTcvnOnly = w => [...w].some(isTcvnOnly);
const hasUnicodeViet = w => /[Ā-ɏḀ-ỿ]/.test(w);
const core = w => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLowerCase();
/** a capital Latin-1 letter inside a word ("trÊn", "TÝ") is a TCVN3 lowercase letter, never typed Unicode */
const tcvnCapsInside = w => /\p{L}[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝ]/u.test(w);

// Syllable frequencies from text whose reading is certain: pure-TCVN3 lines (fixed copy) and pure-Unicode lines (original)
const freq = new Map();
const add = line => { for (const w of line.split(/\s+/)) { const k = core(w); if (k) freq.set(k, (freq.get(k) ?? 0) + 1); } };
fixed.forEach((f, i) => {
  const o = orig[i] ?? '';
  if (hasTcvnOnly(o) && !hasUnicodeViet(o)) add(f);
  else if (hasUnicodeViet(o) && !hasTcvnOnly(o)) add(o);
});
const count = w => freq.get(core(w)) ?? 0;
const score = ws => ws.reduce((s, w) => s + (count(w) > 0 ? 1 : 0), 0);

/** "GiảI", "TháI", "phảI": a final capital I after lowercase letters comes from a .VnTimeH run.
 *  Other capitals inside a word are grandma's own ("ThKhông" = Thiên Không, "LiêmTrinh") and stay. */
const fixCaps = w => w.replace(/^(\P{L}*\p{Lu}?\p{Ll}+)I(\P{L}*)$/u, '$1i$2');

const report = [];
const out = fixed.map((f, i) => {
  const o = orig[i] ?? '';
  const tcvn = hasTcvnOnly(o), uni = hasUnicodeViet(o);
  let merged;
  if (f === o) merged = f;
  else if (tcvn && !uni) merged = f.split(/(\s+)/).map(fixCaps).join('');   // a TCVN3 paragraph: the converted copy
  else if (uni && !tcvn) merged = o;                                         // typed in Unicode: exactly as typed
  else if (!tcvn && !uni) merged = score(o.split(/\s+/)) > score(f.split(/\s+/)) ? o : f.split(/(\s+)/).map(fixCaps).join('');
  else {
    // a paragraph that mixes both (a Unicode word added into an old TCVN3 line): word by word
    const fw = f.split(/(\s+)/), ow = o.split(/(\s+)/);
    merged = fw.length !== ow.length ? f : fw.map((w, k) => {
      const u = ow[k];
      if (/^\s*$/.test(w) || w === u) return w;
      if (hasUnicodeViet(u) && !hasTcvnOnly(u)) return u;
      if (hasTcvnOnly(u) || tcvnCapsInside(u)) return fixCaps(w);
      return count(u) > count(w) ? u : fixCaps(w);
    }).join('');
  }
  if (merged !== f) report.push(`${i + 1}: ${f}\n${' '.repeat(String(i + 1).length)}→ ${merged}`);
  return merged;
});

fs.writeFileSync(path.join(kb, 'sources/tuvi/luan-tv-2011-11.txt'), out.join('\n'));
fs.writeFileSync(path.join(kb, 'sources/tuvi/clean-report.txt'), report.join('\n'));
console.log(`lines: ${out.length}, changed: ${report.length}`);
