/* The condition a passage carries, saying for whom its source wrote it — readable as the source's words:
     in(sun, aries)  in(self, leo, sagittarius)     a body in one of these signs (self: the body the section is about)
     house(moon, 4) · house(self, 1-3)              a body in one of these houses (needs the time of birth)
     cusp(2, taurus) · cusp(self, aries)            the sign on a house's cusp (self: the house the section is about)
     aspect(sun, moon) · aspect(sun, saturn, square, opposition) · aspect(self, mars, hard)
                                                    two bodies in aspect (any, or of these kinds; groups: strong, hard, soft, weak)
     has_aspect(square) · out_of_sign(trine)        the chart has an aspect of that kind / one out of sign (Tierney ch. 3)
     pattern(t-square) · pattern(grand-trine, fire) · pattern(t-square, out-of-sign) · pattern(grand-cross, angular)
     apex(t-square, sun) · apex(yod, self)          a structure, of that element / mode / kind; with that planet at its đỉnh
     dominant(mars) · dominant(self, very-strong)   her test of the dominant planets: strong (26+) or more, or that level
     retro(mercury) · dignity(venus, exaltation)    retrograde; Vượng / Tử / Tướng / Tù
     decan(sun, aries, 2) · sun_cusp(aries, taurus) the ten degrees of a sign; Mặt Trời within 5° of where one sign meets the next
     element(fire, 4+) · modality(fixed, 0) · hemisphere(east, 6+)   how many of the ten planets
     ruler(mars) · sun_ruler(saturn) · moon_ruler(venus)              chủ tinh of the AC / of Mặt Trời's / of Mặt Trăng's sign
     in_own(self) · reception(venus, mars)          in a sign it rules; two planets each in the other's sign
     focus(sun) · focus_house(7) · focus_sign(aries)   what the section being read is about (a body, a house, a sign)
     male() · female() · time() · any()
   joined with & | ! and ( ). Every call says why it held, in Vietnamese. */
import type { AstroChart, Pattern, PatternKind } from './chart.js';
import { PATTERN_NAME } from './chart.js';
import { LEVEL_NAME, type DominantLevel } from './dominant.js';
import {
  ASPECT, BODY, DIGNITY_NAME, ELEMENT_NAME, MODALITY_NAME, PLANETS, SIGN, SIGNS, dm, isPlanet, lowerFirst, separation,
  type AspectCode, type BodyCode, type Dignity, type Element, type Modality, type PlanetCode, type SignCode,
} from './zodiac.js';

export type Node = { t: 'and' | 'or'; a: Node[] } | { t: 'not'; a: Node } | { t: 'call'; fn: string; args: string[] };
export interface Parsed { node?: Node; errors: string[] }
/** the chart, and what the section being read is about: a body (self), a house, a structure */
export interface Ctx { chart: AstroChart; focus?: BodyCode | null; house?: number | null; sign?: SignCode | null; pattern?: Pattern | null }
export interface Result { ok: boolean; why: string[] }

type ArgKind = 'body' | 'sign' | 'house' | 'aspect' | 'pattern' | 'qualifier' | 'level' | 'spec' | 'decan' | 'element'
  | 'modality' | 'hemisphere' | 'dignity';
const SPEC: Record<string, { kinds?: ArgKind[]; rest?: ArgKind; min: number; max?: number }> = {
  in: { kinds: ['body'], rest: 'sign', min: 2 }, house: { kinds: ['body'], rest: 'house', min: 2 }, cusp: { kinds: ['house'], rest: 'sign', min: 2 },
  aspect: { kinds: ['body', 'body'], rest: 'aspect', min: 2 }, has_aspect: { rest: 'aspect', min: 1 }, out_of_sign: { rest: 'aspect', min: 0 },
  pattern: { kinds: ['pattern'], rest: 'qualifier', min: 1 }, apex: { kinds: ['pattern', 'body'], min: 2, max: 2 },
  dominant: { kinds: ['body', 'level'], min: 1, max: 2 }, retro: { kinds: ['body'], min: 1, max: 1 }, dignity: { kinds: ['body'], rest: 'dignity', min: 2 },
  decan: { kinds: ['body', 'sign', 'decan'], min: 3, max: 3 }, sun_cusp: { kinds: ['sign', 'sign'], min: 2, max: 2 },
  element: { kinds: ['element', 'spec'], min: 2, max: 2 }, modality: { kinds: ['modality', 'spec'], min: 2, max: 2 },
  hemisphere: { kinds: ['hemisphere', 'spec'], min: 2, max: 2 },
  ruler: { rest: 'body', min: 1 }, sun_ruler: { rest: 'body', min: 1 }, moon_ruler: { rest: 'body', min: 1 },
  in_own: { kinds: ['body'], min: 1, max: 1 }, reception: { kinds: ['body', 'body'], min: 2, max: 2 },
  focus: { rest: 'body', min: 1 }, focus_house: { rest: 'house', min: 1 }, focus_sign: { rest: 'sign', min: 1 },
  male: { min: 0, max: 0 }, female: { min: 0, max: 0 }, time: { min: 0, max: 0 }, any: { min: 0, max: 0 },
};
export const FUNCTIONS = Object.keys(SPEC);

const BODY_CODES = new Set<string>([...Object.keys(BODY), 'self']);
const SIGN_CODES = new Set<string>(SIGNS.map(s => s.code));
const ASPECT_GROUPS: Record<string, AspectCode[]> = {
  strong: ['conjunction', 'square', 'trine', 'opposition'],
  hard: ['square', 'opposition', 'semisquare', 'sesquiquadrate'],
  soft: ['trine', 'sextile'],
  weak: ['semisextile', 'semisquare', 'sextile', 'quintile', 'sesquiquadrate', 'biquintile', 'quincunx'],
};
const PATTERNS = new Set<string>(Object.keys(PATTERN_NAME));
const QUALIFIERS = new Set<string>(['fire', 'earth', 'air', 'water', 'fire-air', 'earth-water', 'cardinal', 'fixed', 'mutable', 'out-of-sign', 'angular']);
const LEVELS = new Set<string>(['low', 'medium', 'strong', 'very-strong']);
const HEMIS: Record<string, string> = { above: 'nửa trên (cung 7–12)', below: 'nửa dưới (cung 1–6)', east: 'bán cầu Đông (cung 10–3)', west: 'bán cầu Tây (cung 4–9)' };

/** "2" · "5+" · "2-3" → [min, max] */
function specOf(s: string): [number, number] | null {
  const t = s.trim();
  let m = /^(\d+)$/.exec(t); if (m) return [Number(m[1]), Number(m[1])];
  m = /^(\d+)\+$/.exec(t); if (m) return [Number(m[1]), Infinity];
  m = /^(\d+)-(\d+)$/.exec(t); if (m) return [Number(m[1]), Number(m[2])];
  return null;
}
/** "4" · "1-3" (houses) */
function housesOf(s: string): number[] | null {
  const r = specOf(s);
  if (!r || !Number.isFinite(r[1]) || r[0] < 1 || r[1] > 12 || r[0] > r[1]) return null;
  return Array.from({ length: r[1] - r[0] + 1 }, (_, i) => r[0] + i);
}

function checkArg(kind: ArgKind, a: string): string | null {
  const v = a.trim();
  switch (kind) {
    case 'body': return BODY_CODES.has(v) ? null : `không có sao / điểm "${v}"`;
    case 'sign': return SIGN_CODES.has(v) ? null : `không có cung hoàng đạo "${v}"`;
    case 'house': return v === 'self' || housesOf(v) ? null : `cung địa bàn phải là 1–12: "${v}"`;
    case 'aspect': return v in ASPECT || v in ASPECT_GROUPS ? null : `không có góc chiếu "${v}"`;
    case 'pattern': return PATTERNS.has(v) ? null : `không có cấu trúc "${v}"`;
    case 'qualifier': return QUALIFIERS.has(v) ? null : `không có đặc điểm cấu trúc "${v}"`;
    case 'level': return LEVELS.has(v) ? null : `mức phải là low, medium, strong, very-strong: "${v}"`;
    case 'spec': return specOf(v) ? null : `cần một số lượng như 2, 5+ hoặc 2-3: "${v}"`;
    case 'decan': return /^[1-3]$/.test(v) ? null : `decan phải là 1–3: "${v}"`;
    case 'element': return v in ELEMENT_NAME ? null : `không có nguyên tố "${v}"`;
    case 'modality': return v in MODALITY_NAME ? null : `không có thể thức "${v}"`;
    case 'hemisphere': return v in HEMIS ? null : `không có nửa lá số "${v}"`;
    case 'dignity': return v in DIGNITY_NAME ? null : `không có "${v}" (exaltation, fall, ruler, detriment)`;
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

const NAME = (b: BodyCode) => (b === 'asc' ? 'cung Mọc (AC)' : b === 'mc' ? 'MC (Thiên đỉnh)' : BODY[b].name);
const aspectsOf = (args: string[]): AspectCode[] | null => {
  if (!args.length) return null;
  return [...new Set(args.flatMap(a => ASPECT_GROUPS[a.trim()] ?? [a.trim() as AspectCode]))];
};
const countText = (n: number) => (n === 0 ? 'không có hành tinh nào' : `${n} hành tinh`);
export const patternText = (p: Pattern) => {
  const q = p.outOfSign ? ' phân tách' : p.element ? ` ${p.element === 'fire-air' ? 'Lửa – Khí' : p.element === 'earth-water' ? 'Đất – Nước' : ELEMENT_NAME[p.element as Element]}` : p.modality ? ` ${MODALITY_NAME[p.modality]}` : p.sign ? ` ở ${SIGN[p.sign].name}` : '';
  return `${PATTERN_NAME[p.kind]}${q}: ${p.bodies.map(b => BODY[b].name).join(' – ')}${p.apex ? ` (đỉnh ${BODY[p.apex].name})` : ''}`;
};

function call(fn: string, args: string[], x: Ctx): Result {
  const c = x.chart, pl = c.placements;
  const yes = (...why: string[]): Result => ({ ok: true, why });
  const no: Result = { ok: false, why: [] };
  const body = (a: string): BodyCode | null => { const v = a.trim(); return v === 'self' ? (x.focus ?? null) : (v as BodyCode); };
  const at = (a: string) => { const b = body(a); return b ? pl[b] ?? null : null; };
  switch (fn) {
    case 'in': {
      const b = body(args[0]), p = at(args[0]);
      if (!b || !p) return no;
      return args.slice(1).map(s => s.trim()).includes(p.sign) ? yes(`${NAME(b)} ở ${SIGN[p.sign].name} (${dm(p.lon)})`) : no;
    }
    case 'house': {
      const b = body(args[0]), p = at(args[0]);
      if (!b || !p || p.house === null) return no;
      const hs = args.slice(1).flatMap(h => housesOf(h) ?? []);
      return hs.includes(p.house) ? yes(`${NAME(b)} ở cung ${p.house}`) : no;
    }
    case 'cusp': {
      if (!c.houses) return no;
      const n = args[0].trim() === 'self' ? x.house : housesOf(args[0])?.[0];
      if (!n) return no;
      const h = c.houses[n - 1];
      return args.slice(1).map(s => s.trim()).includes(h.sign) ? yes(`${SIGN[h.sign].name} ở nóc cung ${n} (${dm(h.lon)})`) : no;
    }
    case 'aspect': {
      const a = body(args[0]), b = body(args[1]);
      if (!a || !b || a === b) return no;
      const kinds = aspectsOf(args.slice(2));
      const hit = c.aspects.find(s => ((s.a === a && s.b === b) || (s.a === b && s.b === a)) && (!kinds || kinds.includes(s.aspect)));
      return hit ? yes(`${NAME(a)} ${lowerFirst(ASPECT[hit.aspect].name)} ${NAME(b)} (lệch ${dm(hit.orb)})${hit.outOfSign ? ', phân tách' : ''}`) : no;
    }
    case 'has_aspect': {
      const kinds = aspectsOf(args)!;
      const hits = c.aspects.filter(s => kinds.includes(s.aspect) && isPlanet(s.a) && isPlanet(s.b));
      return hits.length ? yes(...hits.map(s => `${NAME(s.a)} ${lowerFirst(ASPECT[s.aspect].name)} ${NAME(s.b)}`)) : no;
    }
    case 'out_of_sign': {
      const kinds = aspectsOf(args);
      const hits = c.aspects.filter(s => s.outOfSign && (!kinds || kinds.includes(s.aspect)) && isPlanet(s.a) && isPlanet(s.b));
      return hits.length ? yes(...hits.map(s => `${NAME(s.a)} ${lowerFirst(ASPECT[s.aspect].name)} ${NAME(s.b)}, phân tách (${SIGN[pl[s.a]!.sign].name} – ${SIGN[pl[s.b]!.sign].name})`)) : no;
    }
    case 'pattern': {
      const kind = args[0].trim() as PatternKind, qs = args.slice(1).map(a => a.trim());
      const pool = x.pattern ? [x.pattern] : c.patterns;
      const hits = pool.filter(p => p.kind === kind && qs.every(q =>
        q === 'out-of-sign' ? p.outOfSign : q === 'angular' ? p.angular : q === p.element || q === p.modality));
      return hits.length ? yes(...hits.map(patternText)) : no;
    }
    case 'apex': {
      const kind = args[0].trim() as PatternKind, b = body(args[1]);
      const pool = x.pattern ? [x.pattern] : c.patterns;
      const hit = pool.find(p => p.kind === kind && p.apex === b);
      return hit ? yes(patternText(hit)) : no;
    }
    case 'dominant': {
      const b = body(args[0]);
      const t = c.dominant.tests.find(d => d.body === b);
      if (!t) return no;
      const want = args[1]?.trim() as DominantLevel | undefined;
      const ok = want ? t.level === want : t.level === 'strong' || t.level === 'very-strong';
      return ok ? yes(`${NAME(t.body)}: ${t.total} điểm (${LEVEL_NAME[t.level]})`) : no;
    }
    case 'retro': { const b = body(args[0]), p = at(args[0]); return b && p?.retro ? yes(`${NAME(b)} nghịch hành`) : no; }
    case 'dignity': {
      const b = body(args[0]), p = at(args[0]);
      if (!b || !p) return no;
      const ds = args.slice(1).map(a => a.trim() as Dignity).filter(d => p.dignities.includes(d));
      return ds.length ? yes(`${NAME(b)} ở ${SIGN[p.sign].name}: ${ds.map(d => DIGNITY_NAME[d]).join(', ')}`) : no;
    }
    case 'decan': {
      const b = body(args[0]), p = at(args[0]);
      return b && p && p.sign === args[1].trim() && p.decan === Number(args[2]) ? yes(`${NAME(b)} ở decan ${p.decan} của ${SIGN[p.sign].name} (${dm(p.lon)})`) : no;
    }
    case 'sun_cusp': {
      const p = pl.sun;
      if (!p) return no;
      const a = SIGN[args[0].trim() as SignCode], b = SIGN[args[1].trim() as SignCode];
      if ((a.index + 1) % 12 !== b.index) return no;
      const boundary = b.index * 30;
      const off = separation(p.lon, boundary);
      return off <= 5 && (p.sign === a.code || p.sign === b.code) ? yes(`Mặt Trời ở ${dm(p.lon)} ${SIGN[p.sign].name}, cách chỗ giáp ranh ${a.name} – ${b.name} ${dm(off)}`) : no;
    }
    case 'element': case 'modality': {
      const k = args[0].trim(), [lo, hi] = specOf(args[1])!;
      const list = fn === 'element' ? c.balance.elements[k as Element] : c.balance.modalities[k as Modality];
      const name = fn === 'element' ? `nguyên tố ${ELEMENT_NAME[k as Element]}` : `thể thức ${MODALITY_NAME[k as Modality]}`;
      return list.length >= lo && list.length <= hi ? yes(`${name}: ${countText(list.length)}${list.length ? ` (${list.map(p => BODY[p].name).join(', ')})` : ''}`) : no;
    }
    case 'hemisphere': {
      const h = c.balance.hemispheres;
      if (!h) return no;
      const k = args[0].trim() as keyof typeof h, [lo, hi] = specOf(args[1])!, list = h[k];
      return list.length >= lo && list.length <= hi ? yes(`${HEMIS[k]}: ${countText(list.length)}`) : no;
    }
    case 'ruler': case 'sun_ruler': case 'moon_ruler': {
      const rs = fn === 'ruler' ? c.rulers.chart : fn === 'sun_ruler' ? c.rulers.sun : c.rulers.moon;
      if (!rs) return no;
      const want = args.map(a => body(a)).filter(Boolean) as BodyCode[];
      const hit = rs.find(r => want.includes(r));
      const of = fn === 'ruler' ? `lá số (cung Mọc ${SIGN[pl.asc!.sign].name})` : fn === 'sun_ruler' ? `cung Mặt Trời (${SIGN[pl.sun!.sign].name})` : `cung Mặt Trăng (${SIGN[pl.moon!.sign].name})`;
      return hit ? yes(`Chủ tinh ${of}: ${BODY[hit].name}`) : no;
    }
    case 'in_own': {
      const b = body(args[0]), p = at(args[0]);
      return b && p && isPlanet(b) && p.dignities.includes('ruler') ? yes(`${NAME(b)} ở ${SIGN[p.sign].name}, cung nó làm chủ`) : no;
    }
    case 'reception': {
      const a = body(args[0]), b = body(args[1]), pa = at(args[0]), pb = at(args[1]);
      if (!a || !b || !pa || !pb || !isPlanet(a) || !isPlanet(b)) return no;
      const ok = SIGN[pa.sign].rulers.includes(b as PlanetCode) && SIGN[pb.sign].rulers.includes(a as PlanetCode);
      return ok ? yes(`${NAME(a)} ở ${SIGN[pa.sign].name}, ${NAME(b)} ở ${SIGN[pb.sign].name}: tiếp nhận tương hỗ`) : no;
    }
    case 'focus': { const f = x.focus; return f && args.map(a => a.trim()).includes(f) ? yes() : no; }
    case 'focus_house': { const h = x.house; return h && args.flatMap(a => housesOf(a) ?? []).includes(h) ? yes() : no; }
    case 'focus_sign': { const g = x.sign; return g && args.map(a => a.trim()).includes(g) ? yes() : no; }
    case 'male': return c.input.gender === 'male' ? yes('Nam') : no;
    case 'female': return c.input.gender === 'female' ? yes('Nữ') : no;
    case 'time': return c.timeKnown ? yes() : no;
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

/** what a condition speaks of, for looking passages up: "sign:aries", "body:sun", "house:5", "sun@aries",
    "sun@h5", "aspect:square", "sun~moon", "pattern:t-square", "dominant:mars"… (self speaks of nothing in particular) */
export function symbolsOf(node: Node | undefined): Set<string> {
  const out = new Set<string>();
  const walk = (n: Node | undefined): void => {
    if (!n || n.t === 'not') return;
    if (n.t !== 'call') { n.a.forEach(walk); return; }
    const a = n.args.map(s => s.trim());
    const b0 = a[0] && a[0] !== 'self' ? a[0] : null;
    switch (n.fn) {
      case 'in': if (b0) out.add(`body:${b0}`); for (const s of a.slice(1)) { out.add(`sign:${s}`); if (b0) out.add(`${b0}@${s}`); } break;
      case 'house': if (b0) out.add(`body:${b0}`); for (const h of a.slice(1).flatMap(x => housesOf(x) ?? [])) { out.add(`house:${h}`); if (b0) out.add(`${b0}@h${h}`); } break;
      case 'cusp': for (const s of a.slice(1)) out.add(`sign:${s}`); if (a[0] !== 'self') for (const h of housesOf(a[0]) ?? []) out.add(`house:${h}`); break;
      case 'aspect': {
        const bs = a.slice(0, 2).filter(x => x !== 'self');
        bs.forEach(x => out.add(`body:${x}`));
        if (bs.length === 2) out.add(`${[bs[0], bs[1]].sort().join('~')}`);
        for (const k of aspectsOf(a.slice(2)) ?? []) out.add(`aspect:${k}`);
        break;
      }
      case 'has_aspect': case 'out_of_sign': for (const k of aspectsOf(a) ?? []) out.add(`aspect:${k}`); break;
      case 'pattern': out.add(`pattern:${a[0]}`); break;
      case 'apex': out.add(`pattern:${a[0]}`); if (a[1] !== 'self') out.add(`body:${a[1]}`); break;
      case 'dominant': if (b0) out.add(`dominant:${b0}`); break;
      case 'retro': case 'dignity': case 'in_own': if (b0) out.add(`body:${b0}`); break;
      case 'decan': out.add(`sign:${a[1]}`); if (b0) { out.add(`body:${b0}`); out.add(`${b0}@${a[1]}`); } break;
      case 'sun_cusp': out.add('body:sun'); out.add(`sign:${a[0]}`); out.add(`sign:${a[1]}`); break;
      case 'element': out.add(`element:${a[0]}`); break;
      case 'modality': out.add(`modality:${a[0]}`); break;
      case 'ruler': case 'sun_ruler': case 'moon_ruler': a.filter(x => x !== 'self').forEach(x => out.add(`body:${x}`)); break;
      case 'reception': a.filter(x => x !== 'self').forEach(x => out.add(`body:${x}`)); break;
      case 'focus': a.forEach(x => out.add(`body:${x}`)); break;
      case 'focus_house': for (const h of a.flatMap(x => housesOf(x) ?? [])) out.add(`house:${h}`); break;
      case 'focus_sign': a.forEach(x => out.add(`sign:${x}`)); break;
    }
  };
  walk(node);
  return out;
}

/** every symbol a passage can be about, with its name */
export function symbolCatalogue(): { code: string; name: string; kind: string }[] {
  const out: { code: string; name: string; kind: string }[] = [];
  for (const b of Object.values(BODY)) out.push({ code: `body:${b.code}`, name: b.code === 'asc' ? 'Cung Mọc (AC)' : b.code === 'mc' ? 'MC (Thiên đỉnh)' : b.name, kind: 'body' });
  for (const s of SIGNS) out.push({ code: `sign:${s.code}`, name: s.name, kind: 'sign' });
  for (let h = 1; h <= 12; h++) out.push({ code: `house:${h}`, name: `Cung ${h}`, kind: 'house' });
  for (const a of Object.values(ASPECT)) out.push({ code: `aspect:${a.code}`, name: `${a.name} (${a.angle}°)`, kind: 'aspect' });
  for (const [k, n] of Object.entries(PATTERN_NAME)) out.push({ code: `pattern:${k}`, name: n, kind: 'pattern' });
  for (const p of [...PLANETS, 'chiron'] as BodyCode[]) out.push({ code: `dominant:${p}`, name: `${BODY[p].name} trội`, kind: 'dominant' });
  for (const e of Object.keys(ELEMENT_NAME) as Element[]) out.push({ code: `element:${e}`, name: `Nguyên tố ${ELEMENT_NAME[e]}`, kind: 'element' });
  for (const m of Object.keys(MODALITY_NAME) as Modality[]) out.push({ code: `modality:${m}`, name: `Thể thức ${MODALITY_NAME[m]}`, kind: 'modality' });
  return out;
}
