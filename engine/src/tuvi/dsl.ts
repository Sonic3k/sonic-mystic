/* The condition language every digitized rule carries — written with grandma's own names so a person can read it:
     in(Tử Vi, Thiên Phủ) & meet(Tả Hữu) & !meet(Lục Sát)
   Read against one palace P of a chart (the palace the rule speaks of):
     in(…)    every item sits in P (đồng cung, thủ, cư, tọa)        meet(…)  every item is in P's tam phương tứ chính (gặp, ngộ, hội)
     aim(…)   every item shines on P from the opposite or a tam hợp palace (chiếu)
     opp(…)   from the opposite palace (xung chiếu)                tri(…)   from a tam hợp palace
     flank(A, B) / flank(Tả Hữu)   the two palaces either side of P hold A and B (giáp)
     at(Tý, Ngọ) P's branch · pos(Thái Dương, Dần, Mão…) where a star itself sits · cung_hanh(Kim) P's element
     mieu(X) vuong(X) dac(X) binh(X) ham(X) bright(X)=miếu/vượng/đắc · dim(X)=hãm — grandma's tables
     is(Mệnh) P is that palace (or Thân, Hạn) · pal(Tật Ách, …) evaluate at another palace · dai(…) tieu(…) at the hạn palaces
     empty() no main star in P · alone(X) X is P's only main star
     male() female() yang() yin() stem(Giáp, Kỷ) branch(Dần, Thân) menh(Hỏa) cuc(Thủy)
     count(2, A, B, C) at least that many meet P · count_in(…) at least that many in P
   Items: a star, a group ("Tả Hữu", "Lục Sát", "Cát tinh"…), or alternatives "Lộc Tồn/Hóa Lộc". & | ! and ( ).
   Tuần and Triệt sit on two palaces and act on their own palaces and the opposite ones (grandma's note on Tuần Triệt:
   "Tuần Triệt cư Dần Mão thì Dần Mão Thân Dậu là 4 cung xung chiếu"), never on the tam hợp: for them meet = P or
   the opposite palace, aim/opp = the opposite palace, tri = nothing. */
import { BRANCHES, BRANCH_ELEMENT, BRANCH_SETS, ELEMENTS, STARS, STEMS, brightOf, findBranch, findGroup, findStar, findTarget, mod12, norm, type GroupDef, type StarDef, type Target } from './names.js';
import { placesOf, type Chart } from './chart.js';

type Ref = { k: 'star'; star: StarDef } | { k: 'group'; group: GroupDef };
type Item = Ref[];
type Arg =
  | { t: 'item'; item: Item; text: string } | { t: 'branches'; set: number[] } | { t: 'star'; star: StarDef }
  | { t: 'target'; target: Target } | { t: 'stem'; stem: number } | { t: 'element'; el: string } | { t: 'int'; n: number } | { t: 'expr'; node: Node };
export type Node = { t: 'and' | 'or'; a: Node[] } | { t: 'not'; a: Node } | { t: 'lit'; v: boolean } | { t: 'call'; fn: string; args: Arg[] };

type Kind = 'item' | 'branch' | 'star' | 'target' | 'stem' | 'element' | 'int' | 'expr';
const SPEC: Record<string, { kinds?: Kind[]; rest?: Kind; min: number; max?: number }> = {
  in: { rest: 'item', min: 1 }, meet: { rest: 'item', min: 1 }, aim: { rest: 'item', min: 1 }, opp: { rest: 'item', min: 1 }, tri: { rest: 'item', min: 1 },
  flank: { rest: 'item', min: 1, max: 2 },
  at: { rest: 'branch', min: 1 }, branch: { rest: 'branch', min: 1 }, pos: { kinds: ['star'], rest: 'branch', min: 2 },
  mieu: { rest: 'star', min: 1 }, vuong: { rest: 'star', min: 1 }, dac: { rest: 'star', min: 1 }, binh: { rest: 'star', min: 1 },
  ham: { rest: 'star', min: 1 }, bright: { rest: 'star', min: 1 }, dim: { rest: 'star', min: 1 },
  is: { rest: 'target', min: 1 }, pal: { kinds: ['target', 'expr'], min: 2, max: 2 }, dai: { kinds: ['expr'], min: 1, max: 1 }, tieu: { kinds: ['expr'], min: 1, max: 1 },
  empty: { min: 0, max: 0 }, alone: { kinds: ['star'], min: 1, max: 1 },
  male: { min: 0, max: 0 }, female: { min: 0, max: 0 }, yang: { min: 0, max: 0 }, yin: { min: 0, max: 0 },
  stem: { rest: 'stem', min: 1 }, menh: { rest: 'element', min: 1 }, cuc: { rest: 'element', min: 1 }, cung_hanh: { rest: 'element', min: 1 },
  count: { kinds: ['int'], rest: 'item', min: 2 }, count_in: { kinds: ['int'], rest: 'item', min: 2 },
};

export interface Parsed { node?: Node; errors: string[]; warnings: string[] }

export function parse(src: string): Parsed {
  const errors: string[] = [], warnings: string[] = [];
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const peek = (c: string) => { ws(); return src[i] === c; };
  const expect = (c: string) => { ws(); if (src[i] !== c) throw new Error(`thiếu "${c}" ở vị trí ${i}`); i++; };

  const raw = (): string => { ws(); const s = i; while (i < src.length && !',)('.includes(src[i])) i++; return src.slice(s, i).trim(); };
  const resolveItem = (text: string): Item => text.split('/').map(t => t.trim()).filter(Boolean).map(t => {
    const g = findGroup(t);
    if (g) return { k: 'group', group: g } as Ref;
    const s = findStar(t);
    if (!s) { errors.push(`không rõ sao hay nhóm sao: "${t}"`); return null; }
    if (s.id === 'tu' || s.id === 'thai' || s.id === 'mo' || s.id === 'benh' || s.id === 'suy') warnings.push(`"${t}" là sao vòng Tràng Sinh — kiểm lại`);
    return { k: 'star', star: s } as Ref;
  }).filter((r): r is Ref => !!r);

  const arg = (kind: Kind): Arg[] => {
    if (kind === 'expr') return [{ t: 'expr', node: or() }];
    const text = raw();
    if (!text) { errors.push('thiếu tham số'); return []; }
    switch (kind) {
      case 'item': return [{ t: 'item', item: resolveItem(text), text }];
      case 'branch': {
        const set = BRANCH_SETS[norm(text)] ?? (findBranch(text) !== undefined ? [findBranch(text)!] : null);
        if (!set) { errors.push(`không rõ cung (chi): "${text}"`); return []; }
        return [{ t: 'branches', set }];
      }
      case 'star': { const s = findStar(text); if (!s) { errors.push(`không rõ sao: "${text}"`); return []; } return [{ t: 'star', star: s }]; }
      case 'target': { const tg = findTarget(text); if (!tg) { errors.push(`không rõ cung: "${text}"`); return []; } return [{ t: 'target', target: tg }]; }
      case 'stem': { const n = STEMS.findIndex(s => norm(s) === norm(text)); if (n < 0) { errors.push(`không rõ can: "${text}"`); return []; } return [{ t: 'stem', stem: n }]; }
      case 'element': { const e = ELEMENTS.find(x => norm(x) === norm(text)); if (!e) { errors.push(`không rõ hành: "${text}"`); return []; } return [{ t: 'element', el: e }]; }
      case 'int': { const n = Number(text); if (!Number.isInteger(n)) { errors.push(`cần một số: "${text}"`); return []; } return [{ t: 'int', n }]; }
    }
    return [];
  };

  const primary = (): Node => {
    ws();
    if (src[i] === '(') { i++; const n = or(); expect(')'); return n; }
    const m = /^[a-z_]+/.exec(src.slice(i));
    if (!m) throw new Error(`không đọc được ở vị trí ${i}: "${src.slice(i, i + 12)}"`);
    i += m[0].length;
    if (m[0] === 'true' || m[0] === 'false') return { t: 'lit', v: m[0] === 'true' };
    const spec = SPEC[m[0]];
    if (!spec) throw new Error(`không có hàm "${m[0]}"`);
    expect('(');
    const args: Arg[] = [];
    let slot = 0;
    if (!peek(')')) {
      for (;;) {
        const kind = spec.kinds?.[slot] ?? spec.rest;
        if (!kind) throw new Error(`"${m[0]}" có quá nhiều tham số`);
        args.push(...arg(kind)); slot++;
        if (peek(',')) { i++; continue; }
        break;
      }
    }
    expect(')');
    if (slot < spec.min) errors.push(`"${m[0]}" cần ít nhất ${spec.min} tham số`);
    if (spec.max !== undefined && slot > spec.max) errors.push(`"${m[0]}" chỉ nhận ${spec.max} tham số`);
    return { t: 'call', fn: m[0], args };
  };
  const unary = (): Node => (peek('!') ? (i++, { t: 'not', a: unary() }) : primary());
  const and = (): Node => { const a = [unary()]; while (peek('&')) { i++; a.push(unary()); } return a.length === 1 ? a[0] : { t: 'and', a }; };
  const or = (): Node => { const a = [and()]; while (peek('|')) { i++; a.push(and()); } return a.length === 1 ? a[0] : { t: 'or', a }; };

  try {
    const node = or(); ws();
    if (i < src.length) throw new Error(`thừa ở vị trí ${i}: "${src.slice(i, i + 12)}"`);
    return { node: errors.length ? undefined : node, errors, warnings };
  } catch (e) {
    return { errors: [...errors, (e as Error).message], warnings };
  }
}

// ── evaluation ────────────────────────────────────────────────────────────────

export interface EvalCtx { chart: Chart; p: number; han?: { dai: number | null; tieu: number }; inHan?: boolean }
export interface Result { ok: boolean; why: string[] }
const T: Result = { ok: true, why: [] }, F: Result = { ok: false, why: [] };

const REL = (p: number, b: number) => (b === p ? 'đồng cung' : b === mod12(p + 6) ? 'xung chiếu' : (b === mod12(p + 4) || b === mod12(p + 8)) ? 'tam hợp' : b === mod12(p + 1) || b === mod12(p - 1) ? 'giáp' : '');
const where = (p: number, star: StarDef, b: number) => `${star.name} ở ${BRANCHES[b]}${b === p ? '' : ` (${REL(p, b)})`}`;

function placesFor(fn: string, p: number): number[] {
  switch (fn) {
    case 'in': case 'count_in': return [p];
    case 'meet': case 'count': return [p, mod12(p + 6), mod12(p + 4), mod12(p + 8)];
    case 'aim': return [mod12(p + 6), mod12(p + 4), mod12(p + 8)];
    case 'opp': return [mod12(p + 6)];
    case 'tri': return [mod12(p + 4), mod12(p + 8)];
  }
  return [];
}

const KHONG = new Set(['tuan', 'triet']);
/** where Tuần / Triệt reach from the places a relation looks at: P itself and the opposite palace only */
const reachOf = (star: StarDef, p: number, places: number[]) =>
  KHONG.has(star.id) ? places.filter(b => b === p || b === mod12(p + 6)) : places;

/** a star found in any of the places → why */
function starIn(chart: Chart, p: number, star: StarDef, places: number[]): string | null {
  const reach = reachOf(star, p, places);
  const at = placesOf(chart, star.id).find(b => reach.includes(b));
  return at === undefined ? null : where(p, star, at);
}

function groupIn(chart: Chart, p: number, g: GroupDef, places: number[]): Result {
  const hits = g.stars.map(n => findStar(n)!).map(s => starIn(chart, p, s, places));
  const found = hits.filter((h): h is string => !!h);
  const need = g.mode === 'all' ? g.stars.length : g.mode === 'min' ? g.min ?? 1 : 1;
  return found.length >= need ? { ok: true, why: g.mode === 'any' ? found.slice(0, 2) : found } : F;
}

function itemIn(chart: Chart, p: number, item: Item, places: number[]): Result {
  for (const r of item) {
    if (r.k === 'star') { const w = starIn(chart, p, r.star, places); if (w) return { ok: true, why: [w] }; }
    else { const res = groupIn(chart, p, r.group, places); if (res.ok) return res; }
  }
  return F;
}

const levelOf = (chart: Chart, s: StarDef) => { const b = chart.pos[s.id]; return b === undefined ? undefined : brightOf(s, b); };
const MAIN_IDS = STARS.filter(s => s.kind === 'chinh').map(s => s.id);
/** main stars sitting in a palace (from the positions, so it also works on a chart built `fast`) */
const MAIN = (chart: Chart, b: number) => MAIN_IDS.filter(id => chart.pos[id] === b);

/** what a negated condition says, in words ("Hóa Kỵ không sáng", "không gặp Lục Sát") */
function negWhy(n: Node): string[] {
  if (n.t !== 'call') return [];
  const names = n.args.map(a => (a.t === 'item' ? a.text : a.t === 'star' ? a.star.name : '')).filter(Boolean).join(', ');
  switch (n.fn) {
    case 'bright': return [`${names} không sáng`];
    case 'mieu': case 'vuong': case 'dac': return [`${names} không ${({ mieu: 'miếu', vuong: 'vượng', dac: 'đắc địa' } as Record<string, string>)[n.fn]}`];
    case 'dim': case 'ham': return [`${names} không hãm`];
    case 'meet': return [`không gặp ${names}`];
    case 'in': return [`cung không có ${names}`];
    case 'aim': case 'opp': case 'tri': return [`không có ${names} chiếu`];
    case 'empty': return ['có chính tinh'];
  }
  return [];
}

export function evaluate(node: Node, ctx: EvalCtx): Result {
  const { chart, p } = ctx;
  switch (node.t) {
    case 'lit': return node.v ? T : F;
    case 'not': return evaluate(node.a, ctx).ok ? F : { ok: true, why: negWhy(node.a) };
    case 'and': { const why: string[] = []; for (const n of node.a) { const r = evaluate(n, ctx); if (!r.ok) return F; why.push(...r.why); } return { ok: true, why }; }
    case 'or': { for (const n of node.a) { const r = evaluate(n, ctx); if (r.ok) return r; } return F; }
  }
  const a = node.args;
  const items = () => a.filter((x): x is Extract<Arg, { t: 'item' }> => x.t === 'item').map(x => x.item);
  const stars = () => a.filter((x): x is Extract<Arg, { t: 'star' }> => x.t === 'star').map(x => x.star);
  const branches = () => a.filter((x): x is Extract<Arg, { t: 'branches' }> => x.t === 'branches').flatMap(x => x.set);
  const els = () => a.filter((x): x is Extract<Arg, { t: 'element' }> => x.t === 'element').map(x => x.el);
  switch (node.fn) {
    case 'in': case 'meet': case 'aim': case 'opp': case 'tri': {
      const places = placesFor(node.fn, p), why: string[] = [];
      for (const it of items()) { const r = itemIn(chart, p, it, places); if (!r.ok) return F; why.push(...r.why); }
      return { ok: true, why };
    }
    case 'count': case 'count_in': {
      const n = (a[0] as Extract<Arg, { t: 'int' }>).n, places = placesFor(node.fn, p), why: string[] = [];
      for (const it of items()) { const r = itemIn(chart, p, it, places); if (r.ok) why.push(...r.why); }
      return why.length >= n ? { ok: true, why } : F;
    }
    case 'flank': {
      const its = items();
      const pair: Item[] = its.length === 2 ? its : its[0]?.length === 1 && its[0][0].k === 'group' && its[0][0].group.stars.length === 2
        ? its[0][0].group.stars.map(n => [{ k: 'star', star: findStar(n)! } as Ref]) : [];
      if (pair.length !== 2) return F;
      const l = [mod12(p - 1)], r = [mod12(p + 1)];
      const a1 = itemIn(chart, p, pair[0], l), b1 = itemIn(chart, p, pair[1], r);
      if (a1.ok && b1.ok) return { ok: true, why: [...a1.why, ...b1.why] };
      const a2 = itemIn(chart, p, pair[0], r), b2 = itemIn(chart, p, pair[1], l);
      if (a2.ok && b2.ok) return { ok: true, why: [...a2.why, ...b2.why] };
      return F;
    }
    case 'at': return branches().includes(p) ? { ok: true, why: [`cung ${BRANCHES[p]}`] } : F;
    case 'pos': { const s = stars()[0]; const b = chart.pos[s.id]; return b !== undefined && branches().includes(b) ? { ok: true, why: [`${s.name} ở ${BRANCHES[b]}`] } : F; }
    case 'cung_hanh': return els().includes(BRANCH_ELEMENT[p]) ? T : F;
    case 'mieu': case 'vuong': case 'dac': case 'binh': case 'ham': case 'bright': case 'dim': {
      const want = { mieu: ['M'], vuong: ['M', 'V'], dac: ['D'], binh: ['B'], ham: ['H'], dim: ['H'], bright: ['M', 'V', 'D'] }[node.fn]!;
      const why: string[] = [];
      for (const s of stars()) {
        const l = levelOf(chart, s);
        if (!l || !want.includes(l)) return F;
        why.push(`${s.name} ${({ M: 'miếu', V: 'vượng', D: 'đắc địa', B: 'bình', H: 'hãm' } as Record<string, string>)[l]}`);
      }
      return { ok: true, why };
    }
    case 'is': {
      for (const x of a) if (x.t === 'target') {
        if (x.target === 'Thân' ? p === chart.than : x.target === 'Hạn' ? !!ctx.inHan : chart.palaces[p].role === x.target) return T;
      }
      return F;
    }
    case 'pal': {
      const tg = (a[0] as Extract<Arg, { t: 'target' }>).target, sub = (a[1] as Extract<Arg, { t: 'expr' }>).node;
      const b = tg === 'Thân' ? chart.than : tg === 'Hạn' ? ctx.han?.tieu : chart.palaces.find(c => c.role === tg)?.branch;
      if (b === undefined || b === null) return F;
      const r = evaluate(sub, { ...ctx, p: b });
      return r.ok ? { ok: true, why: r.why.map(w => `${tg}: ${w}`) } : F;
    }
    case 'dai': case 'tieu': {
      const b = node.fn === 'dai' ? ctx.han?.dai : ctx.han?.tieu;
      if (b === undefined || b === null) return F;
      const r = evaluate((a[0] as Extract<Arg, { t: 'expr' }>).node, { ...ctx, p: b, inHan: true });
      return r.ok ? { ok: true, why: r.why.map(w => `${node.fn === 'dai' ? 'đại hạn' : 'tiểu hạn'}: ${w}`) } : F;
    }
    case 'empty': return MAIN(chart, p).length === 0 ? { ok: true, why: ['vô chính diệu'] } : F;
    case 'alone': {
      const s = stars()[0];
      if (!placesOf(chart, s.id).includes(p)) return F;
      const others = MAIN(chart, p).filter(id => id !== s.id);
      return others.length === 0 ? { ok: true, why: [`${s.name} đơn thủ`] } : F;
    }
    case 'male': return chart.input.gender === 'male' ? T : F;
    case 'female': return chart.input.gender === 'female' ? T : F;
    case 'yang': return chart.yang ? T : F;
    case 'yin': return chart.yang ? F : T;
    case 'stem': return a.some(x => x.t === 'stem' && x.stem === chart.stem) ? { ok: true, why: [`tuổi ${STEMS[chart.stem]}`] } : F;
    case 'branch': return branches().includes(chart.branch) ? { ok: true, why: [`tuổi ${BRANCHES[chart.branch]}`] } : F;
    case 'menh': return els().includes(chart.napAm.element) ? { ok: true, why: [`mệnh ${chart.napAm.element}`] } : F;
    case 'cuc': return els().includes(chart.cuc.element) ? { ok: true, why: [chart.cuc.name] } : F;
  }
  return F;
}

/** the stars a condition speaks of (group members included) — for looking rules up by stars */
export function starsOf(node: Node | undefined, out = new Set<string>()): Set<string> {
  if (!node) return out;
  if (node.t === 'and' || node.t === 'or') node.a.forEach(n => starsOf(n, out));
  else if (node.t === 'not') { /* a star the rule requires absent is not "about" it */ }
  else if (node.t === 'call') for (const x of node.args) {
    if (x.t === 'item') x.item.forEach(r => (r.k === 'star' ? out.add(r.star.id) : r.group.stars.forEach(n => out.add(findStar(n)!.id))));
    else if (x.t === 'star') out.add(x.star.id);
    else if (x.t === 'expr') starsOf(x.node, out);
  }
  return out;
}
