/* The condition every passage of the book carries, saying for whom the book wrote it — readable as the book's words:
     ruling(7)                 Con số chủ đạo 7 (any of several: ruling(2, 11); 22/4 is written 22/4)
     day(22/4) · day_is_ruling()            Con số ngày sinh; the same number as the ruling one
     count(1, 2) · count(1, 5+) · count(3, 2-3) · has(5) · lacks(7)    how many of a number the birth chart holds
     arrow(1-5-9) · empty(4-5-6) · double(1-5-9)      a full arrow, an empty arrow, an arrow of pairs (11-55-99)
     isolated(9) · isolated(9, 2)           a corner number cut off from the chart (with that many of it)
     arrows(0) · empties(3+)                how many full / empty arrows the birth chart has
     plane(mind, 0)                         digits on a plane: mind (3-6-9), spirit (2-5-8), physical (1-4-7)
     pyear(9)                  the personal year read          stage(2)   the stage of life (1 niên thiếu, 2 trưởng thành, 3 viên mãn)
     peak(10) · peak_at(3, 10)  the peak read has that number / the third peak has it
     soul(5) · expression(22/4) · name_number(7)       the numbers of the name read
     name_is_ruling() · name_same_plane() · name_other_plane()   its name number against the ruling one
     name_compensates() · name_reinforces()   the name makes up for a weakness / adds to what is there already
     name_breaks(4-5-6) · name_has(5)        the name breaks that empty arrow / brings that number
     male() · female() · any()
   joined with & | ! and ( ). Every call says why it held, in the book's words. */
import type { NumerologyChart, NameReading, Peak } from './chart.js';
import { ARROWS, COUNT_WORDS, PLANES, cellText, findArrow, label, parseNumber, type Plane } from './numbers.js';

export type Node = { t: 'and' | 'or'; a: Node[] } | { t: 'not'; a: Node } | { t: 'call'; fn: string; args: string[] };
export interface Parsed { node?: Node; errors: string[] }
export interface Ctx { chart: NumerologyChart; name?: NameReading | null; peak?: Peak | null; pyear?: number | null }
export interface Result { ok: boolean; why: string[] }

type ArgKind = 'num' | 'digit' | 'spec' | 'arrow' | 'plane' | 'peak' | 'stage';
const SPEC: Record<string, { kinds?: ArgKind[]; rest?: ArgKind; min: number; max?: number }> = {
  ruling: { rest: 'num', min: 1 }, day: { rest: 'num', min: 1 }, day_is_ruling: { min: 0, max: 0 },
  count: { kinds: ['digit', 'spec'], min: 2, max: 2 }, has: { rest: 'digit', min: 1 }, lacks: { rest: 'digit', min: 1 },
  arrow: { kinds: ['arrow'], min: 1, max: 1 }, empty: { kinds: ['arrow'], min: 1, max: 1 }, double: { kinds: ['arrow'], min: 1, max: 1 },
  isolated: { kinds: ['digit', 'spec'], min: 1, max: 2 }, plane: { kinds: ['plane', 'spec'], min: 2, max: 2 },
  arrows: { kinds: ['spec'], min: 1, max: 1 }, empties: { kinds: ['spec'], min: 1, max: 1 },
  pyear: { rest: 'num', min: 1 }, stage: { rest: 'stage', min: 1 },
  peak: { rest: 'num', min: 1 }, peak_at: { kinds: ['peak', 'num'], rest: 'num', min: 2 },
  soul: { rest: 'num', min: 1 }, expression: { rest: 'num', min: 1 }, name_number: { rest: 'num', min: 1 },
  name_is_ruling: { min: 0, max: 0 }, name_same_plane: { min: 0, max: 0 }, name_other_plane: { min: 0, max: 0 },
  name_compensates: { min: 0, max: 0 }, name_reinforces: { min: 0, max: 0 },
  name_breaks: { kinds: ['arrow'], min: 1, max: 1 }, name_has: { rest: 'digit', min: 1 },
  male: { min: 0, max: 0 }, female: { min: 0, max: 0 }, any: { min: 0, max: 0 },
};
export const FUNCTIONS = Object.keys(SPEC);

/** "2" · "5+" · "2-3" → [min, max] */
function specOf(s: string): [number, number] | null {
  const t = s.trim();
  let m = /^(\d+)$/.exec(t); if (m) return [Number(m[1]), Number(m[1])];
  m = /^(\d+)\+$/.exec(t); if (m) return [Number(m[1]), Infinity];
  m = /^(\d+)-(\d+)$/.exec(t); if (m) return [Number(m[1]), Number(m[2])];
  return null;
}
const PLANE_CODES = new Set(PLANES.map(p => p.code));

function checkArg(kind: ArgKind, a: string): string | null {
  switch (kind) {
    case 'num': return parseNumber(a) === null ? `không phải một con số của sách: "${a}"` : null;
    case 'digit': { const n = parseNumber(a); return n === null || n < 1 || n > 9 ? `cần một số 1–9: "${a}"` : null; }
    case 'spec': return specOf(a) ? null : `cần một số lượng như 2, 5+ hoặc 2-3: "${a}"`;
    case 'arrow': return findArrow(a) ? null : `không có mũi tên "${a}"`;
    case 'plane': return PLANE_CODES.has(a.trim() as Plane) ? null : `không có trục "${a}" (mind, spirit, physical)`;
    case 'peak': return /^[1-4]$/.test(a.trim()) ? null : `đỉnh phải là 1–4: "${a}"`;
    case 'stage': return /^[1-3]$/.test(a.trim()) ? null : `giai đoạn phải là 1–3: "${a}"`;
  }
}

export function parse(src: string): Parsed {
  const errors: string[] = [];
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const peek = (c: string) => { ws(); return src[i] === c; };
  const expect = (c: string) => { ws(); if (src[i] !== c) throw new Error(`thiếu "${c}" ở vị trí ${i}`); i++; };
  const call = (): Node => {
    ws();
    const s = i;
    while (i < src.length && /[a-z_]/.test(src[i])) i++;
    const fn = src.slice(s, i);
    if (!fn) throw new Error(`cần tên hàm ở vị trí ${s}`);
    const spec = SPEC[fn];
    if (!spec) errors.push(`không có hàm "${fn}"`);
    expect('(');
    const args: string[] = [];
    ws();
    if (src[i] !== ')') {
      for (;;) {
        ws();
        const a0 = i;
        while (i < src.length && !',()'.includes(src[i])) i++;
        args.push(src.slice(a0, i).trim());
        if (peek(',')) { i++; continue; }
        break;
      }
    }
    expect(')');
    if (spec) {
      if (args.length < spec.min || (spec.max !== undefined && args.length > spec.max)) errors.push(`${fn}: số tham số không đúng (${args.length})`);
      args.forEach((a, k) => {
        const kind = spec.kinds?.[k] ?? spec.rest;
        if (!kind) return;
        const e = checkArg(kind, a);
        if (e) errors.push(`${fn}: ${e}`);
      });
    }
    return { t: 'call', fn, args };
  };
  const factor = (): Node => {
    ws();
    if (src[i] === '!') { i++; return { t: 'not', a: factor() }; }
    if (src[i] === '(') { i++; const n = or(); expect(')'); return n; }
    return call();
  };
  const and = (): Node => { const a = [factor()]; while (peek('&')) { i++; a.push(factor()); } return a.length === 1 ? a[0] : { t: 'and', a }; };
  const or = (): Node => { const a = [and()]; while (peek('|')) { i++; a.push(and()); } return a.length === 1 ? a[0] : { t: 'or', a }; };
  try {
    const node = or();
    ws();
    if (i < src.length) throw new Error(`thừa "${src.slice(i)}"`);
    return errors.length ? { errors } : { node, errors };
  } catch (e) {
    return { errors: [...errors, (e as Error).message] };
  }
}

const nums = (args: string[]) => args.map(a => parseNumber(a)!);
const countText = (n: number, c: number) => (c === 0 ? `không có số ${n}` : `${COUNT_WORDS[c] ?? c} số ${n}${c > 1 ? ` (${cellText(n, c)})` : ''}`);
const PLANE_NAME = Object.fromEntries(PLANES.map(p => [p.code, p.name])) as Record<Plane, string>;

function call(fn: string, args: string[], x: Ctx): Result {
  const c = x.chart, g = c.grid;
  const yes = (...why: string[]): Result => ({ ok: true, why });
  const no: Result = { ok: false, why: [] };
  const inList = (v: number | null | undefined, what: string) => (v !== null && v !== undefined && nums(args).includes(v) ? yes(`${what} ${label(v)}`) : no);
  const nm = x.name ?? null;
  const of = nm ? ` (tên ${nm.text})` : '';
  switch (fn) {
    case 'ruling': return inList(c.ruling, 'Con số chủ đạo');
    case 'day': return inList(c.birthday, 'Con số ngày sinh');
    case 'day_is_ruling': return c.birthday === c.ruling ? yes(`Con số ngày sinh trùng Con số chủ đạo (${label(c.ruling)})`) : no;
    case 'count': {
      const n = parseNumber(args[0])!, [lo, hi] = specOf(args[1])!, k = g.counts[n];
      return k >= lo && k <= hi ? yes(countText(n, k)) : no;
    }
    case 'has': { const ns = nums(args); return ns.every(n => g.counts[n] > 0) ? yes(...ns.map(n => countText(n, g.counts[n]))) : no; }
    case 'lacks': { const ns = nums(args); return ns.every(n => !g.counts[n]) ? yes(...ns.map(n => `không có số ${n}`)) : no; }
    case 'arrow': { const a = findArrow(args[0])!; return g.arrows.includes(a.code) ? yes(`${a.full} (${a.code})`) : no; }
    case 'empty': { const a = findArrow(args[0])!; return g.empty.includes(a.code) ? yes(`${a.empty} (trống ${a.code})`) : no; }
    case 'double': {
      const a = findArrow(args[0])!;
      return a.nums.every(n => g.counts[n] >= 2) ? yes(`${a.full} kép (${a.nums.map(n => cellText(n, g.counts[n])).join('-')})`) : no;
    }
    case 'isolated': {
      const n = parseNumber(args[0])!;
      if (!g.isolated.includes(n)) return no;
      if (args[1]) { const [lo, hi] = specOf(args[1])!; if (g.counts[n] < lo || g.counts[n] > hi) return no; }
      return yes(`số ${cellText(n, g.counts[n])} bị cô lập`);
    }
    case 'arrows': case 'empties': {
      const [lo, hi] = specOf(args[0])!, k = (fn === 'arrows' ? g.arrows : g.empty).length;
      return k >= lo && k <= hi ? yes(k === 0 ? (fn === 'arrows' ? 'không có mũi tên nào' : 'không có mũi tên trống nào') : `${k} mũi tên${fn === 'empties' ? ' trống' : ''}`) : no;
    }
    case 'plane': {
      const p = args[0].trim() as Plane, [lo, hi] = specOf(args[1])!, k = g.planes[p];
      return k >= lo && k <= hi ? yes(`${PLANE_NAME[p]}: ${k === 0 ? 'không có số nào' : `${k} con số`}`) : no;
    }
    case 'pyear': return inList(x.pyear ?? c.now.year.n, 'Năm cá nhân');
    case 'stage': return args.map(Number).includes(c.now.stage) ? yes(['', 'Giai đoạn niên thiếu', 'Giai đoạn trưởng thành', 'Giai đoạn viên mãn'][c.now.stage]) : no;
    case 'peak': return x.peak ? inList(x.peak.n, `Đỉnh thứ ${x.peak.index} mang số`) : no;
    case 'peak_at': {
      const p = c.pyramid.peaks[Number(args[0]) - 1];
      return nums(args.slice(1)).includes(p.n) ? yes(`Đỉnh thứ ${p.index} mang số ${p.n}`) : no;
    }
    case 'soul': return inList(nm?.soul, `Con số linh hồn${of}`);
    case 'expression': return inList(nm?.expression, `Con số biểu đạt${of}`);
    case 'name_number': return inList(nm?.nameNumber, `Con số tên riêng${of}`);
    case 'name_is_ruling': return nm?.relation === 'same' ? yes(`Con số tên riêng${of} trùng Con số chủ đạo`) : no;
    case 'name_same_plane': return nm?.relation === 'same_plane' ? yes(`Con số tên riêng${of} cùng trục với Con số chủ đạo`) : no;
    case 'name_other_plane': return nm?.relation === 'other_plane' ? yes(`Con số tên riêng${of} khác trục với Con số chủ đạo`) : no;
    case 'name_compensates': return nm?.effect.compensates ? yes(`Tên ${nm.text} bù đắp cho Biểu đồ ngày sinh`) : no;
    case 'name_reinforces': return nm?.effect.reinforces ? yes(`Tên ${nm.text} dồn thêm vào những gì Biểu đồ ngày sinh đã có`) : no;
    case 'name_breaks': {
      const a = findArrow(args[0])!;
      return nm?.effect.broken.includes(a.code) ? yes(`Tên ${nm.text} phá thế ${a.empty}`) : no;
    }
    case 'name_has': { const ns = nums(args); return nm && ns.every(n => nm.effect.added[n] > 0) ? yes(...ns.map(n => `Tên ${nm.text} có số ${n}`)) : no; }
    case 'male': return c.input.gender === 'male' ? yes('Nam') : no;
    case 'female': return c.input.gender === 'female' ? yes('Nữ') : no;
    case 'any': return yes();
  }
  return no;
}

export function evaluate(node: Node, x: Ctx): Result {
  switch (node.t) {
    case 'call': return call(node.fn, node.args, x);
    case 'not': return { ok: !evaluate(node.a, x).ok, why: [] };
    case 'and': {
      const why: string[] = [];
      for (const n of node.a) { const r = evaluate(n, x); if (!r.ok) return { ok: false, why: [] }; why.push(...r.why); }
      return { ok: true, why };
    }
    case 'or': {
      for (const n of node.a) { const r = evaluate(n, x); if (r.ok) return r; }
      return { ok: false, why: [] };
    }
  }
}

/** the numbers and arrows a condition speaks of ("digit:7", "arrow:1-5-9", "empty-arrow:4-5-6", "ruling:22"…), for
    looking passages up — a full arrow and the same arrow empty are two different things in the book */
export function symbolsOf(node: Node | undefined): Set<string> {
  const out = new Set<string>();
  const walk = (n: Node | undefined): void => {
    if (!n || n.t === 'not') return;   // what a passage is not about does not make it about that
    if (n.t !== 'call') { n.a.forEach(walk); return; }
    const a: string[] = n.args;
    const each = (prefix: string, list: string[]) => list.forEach(v => { const p = parseNumber(v); if (p !== null) out.add(`${prefix}:${p}`); });
    switch (n.fn) {
      case 'ruling': each('ruling', a); break;
      case 'day': each('birthday', a); break;
      case 'count': case 'isolated': each('digit', [a[0]]); break;
      case 'has': case 'lacks': each('digit', a); break;
      case 'arrow': case 'double': { const ar = findArrow(a[0]); if (ar) out.add(`arrow:${ar.code}`); break; }
      case 'empty': case 'name_breaks': { const ar = findArrow(a[0]); if (ar) out.add(`empty-arrow:${ar.code}`); break; }
      case 'pyear': each('year', a); break;
      case 'peak': each('peak', a); break;
      case 'peak_at': each('peak', a.slice(1)); break;
      case 'soul': each('soul', a); break;
      case 'expression': each('expression', a); break;
      case 'name_number': each('name-number', a); break;
      case 'stage': a.forEach(v => out.add(`stage:${v.trim()}`)); break;
    }
  };
  walk(node);
  return out;
}

/** every symbol a passage can be about, with the book's name for it */
export function symbolCatalogue(): { code: string; name: string; kind: string }[] {
  const out: { code: string; name: string; kind: string }[] = [];
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]) out.push({ code: `ruling:${n}`, name: `Con số chủ đạo ${label(n)}`, kind: 'ruling' });
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]) out.push({ code: `birthday:${n}`, name: `Con số ngày sinh ${label(n)}`, kind: 'birthday' });
  for (let n = 1; n <= 9; n++) out.push({ code: `digit:${n}`, name: `Số ${n} trong Biểu đồ ngày sinh`, kind: 'digit' });
  for (const a of ARROWS) out.push({ code: `arrow:${a.code}`, name: `${a.full} (${a.code})`, kind: 'arrow' });
  for (const a of ARROWS) if (a.empty) out.push({ code: `empty-arrow:${a.code}`, name: `${a.empty} (trống ${a.code})`, kind: 'empty-arrow' });
  for (let n = 1; n <= 9; n++) out.push({ code: `year:${n}`, name: `Năm cá nhân ${n}`, kind: 'year' });
  for (let n = 1; n <= 11; n++) out.push({ code: `peak:${n}`, name: `Đỉnh cao mang số ${n}`, kind: 'peak' });
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]) out.push({ code: `soul:${n}`, name: `Con số linh hồn ${label(n)}`, kind: 'soul' });
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]) out.push({ code: `expression:${n}`, name: `Con số biểu đạt ${label(n)}`, kind: 'expression' });
  for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 22]) out.push({ code: `name-number:${n}`, name: `Con số tên riêng ${label(n)}`, kind: 'name-number' });
  for (const [n, s] of [[1, 'niên thiếu'], [2, 'trưởng thành'], [3, 'viên mãn']] as const) out.push({ code: `stage:${n}`, name: `Giai đoạn ${s}`, kind: 'stage' });
  return out;
}
