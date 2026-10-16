/* Reads a chart with the sources: which passages speak of this person, part by part — the chart as a whole, Mặt Trời,
   Mặt Trăng, cung Mọc, each planet, each house, the aspects, each structure, the dominant planets, the other points,
   love — each part with the passages that matched, in the sources' own order. Nothing here writes text: every line
   shown is a source's, and every one says why it was chosen. */
import { patternText, evaluate, parse, type Ctx, type Node } from './dsl.js';
import type { AstroChart } from './chart.js';
import { LEVEL_NAME } from './dominant.js';
import { BODY, PLANETS, SIGN, dm, type BodyCode, type PlanetCode, type SignCode } from './zodiac.js';

export type Topic = 'overview' | 'sun' | 'moon' | 'asc' | 'planet' | 'sign' | 'house' | 'aspect' | 'pattern' | 'dominant' | 'point' | 'love';
export const TOPICS: { code: Topic; title: string }[] = [
  { code: 'overview', title: 'Tổng quan lá số' },
  { code: 'sun', title: 'Mặt Trời' },
  { code: 'moon', title: 'Mặt Trăng' },
  { code: 'asc', title: 'Cung Mọc' },
  { code: 'planet', title: 'Các hành tinh' },
  { code: 'sign', title: 'Các dấu hiệu hoàng đạo' },
  { code: 'house', title: 'Các cung địa bàn' },
  { code: 'aspect', title: 'Góc chiếu' },
  { code: 'pattern', title: 'Các cấu trúc' },
  { code: 'dominant', title: 'Nhân tố trội' },
  { code: 'point', title: 'Các điểm khác' },
  { code: 'love', title: 'Mặt Trời trong tình yêu' },
];
/** what a passage is to the person read: the source describing them, or its explanation of the part (shown once) */
export type RuleKind = 'rule' | 'general';

/** one passage with the condition under which it speaks of a person */
export interface Rule {
  id: string; topic: Topic; entry: string; ord: number; page?: number;
  /** the source it is from (its code) */
  source: string;
  kind: RuleKind; text: string; when: string;
  node?: Node;
}
export interface Entry { code: string; title: string; parent?: string; ord: number }
export interface Kb { rules: Rule[]; entries: Record<string, Entry> }

export interface Match { rule: Rule; why: string[] }
export interface Group { entry: string; title: string; path: string[]; source: string; matches: Match[] }
export interface Section { topic: Topic; title: string; focus: string | null; groups: Group[] }
export interface AstrologyReading { sections: Section[]; matched: number }

export function compile(raw: Omit<Rule, 'node'>[]): Rule[] {
  return raw.map(r => ({ ...r, node: parse(r.when).node }));
}
const pathOf = (kb: Kb, code: string): string[] => {
  const out: string[] = [];
  for (let e: Entry | undefined = kb.entries[code]; e; e = e.parent ? kb.entries[e.parent] : undefined) out.unshift(e.title);
  return out;
};

function match(kb: Kb, topic: Topic, x: Ctx, withGeneral: boolean): Group[] {
  const by = new Map<string, Group>();
  for (const r of kb.rules) {
    if (r.topic !== topic || !r.node || (!withGeneral && r.kind === 'general')) continue;
    const res = evaluate(r.node, x);
    if (!res.ok) continue;
    let g = by.get(r.entry);
    if (!g) {
      const path = pathOf(kb, r.entry);
      g = { entry: r.entry, title: path[path.length - 1] ?? r.entry, path, source: r.source, matches: [] };
      by.set(r.entry, g);
    }
    g.matches.push({ rule: r, why: [...new Set(res.why)] });
  }
  const groups = [...by.values()];
  for (const g of groups) g.matches.sort((a, b) => a.rule.ord - b.rule.ord);
  return groups.sort((a, b) => a.matches[0].rule.ord - b.matches[0].rule.ord);
}

/** "Sao Thủy ở Song Tử 19°09' · cung 3 · nghịch hành" */
export function placementText(c: AstroChart, b: BodyCode): string {
  const p = c.placements[b];
  if (!p) return BODY[b].name;
  const name = b === 'asc' ? 'Cung Mọc' : b === 'mc' ? 'MC' : BODY[b].name;
  return [`${name} ở ${SIGN[p.sign].name} ${dm(p.lon)}`, p.house !== null && BODY[b].kind !== 'angle' ? `cung ${p.house}` : null, p.retro ? 'nghịch hành' : null].filter(Boolean).join(' · ');
}

/** the whole reading of a chart */
export function readAstrology(chart: AstroChart, kb: Kb): AstrologyReading {
  const base: Ctx = { chart };
  const title = (t: Topic) => TOPICS.find(x => x.code === t)!.title;
  const sections: Section[] = [];
  const add = (topic: Topic, focus: string | null, x: Ctx) => {
    const groups = match(kb, topic, x, !sections.some(s => s.topic === topic));
    if (groups.length) sections.push({ topic, title: title(topic), focus, groups });
  };
  add('overview', null, base);
  add('sun', placementText(chart, 'sun'), { chart, focus: 'sun' });
  add('moon', placementText(chart, 'moon'), { chart, focus: 'moon' });
  if (chart.timeKnown) add('asc', placementText(chart, 'asc'), { chart, focus: 'asc' });
  for (const p of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as PlanetCode[])
    if (chart.placements[p]) add('planet', placementText(chart, p), { chart, focus: p });
  // the signs the chart puts its planets and its cung Mọc in, in the order they come up: Mặt Trời's, Mặt Trăng's, AC's, …
  const signs: { sign: SignCode; who: BodyCode[] }[] = [];
  for (const b of ['sun', 'moon', 'asc', ...PLANETS.slice(2)] as BodyCode[]) {
    const p = chart.placements[b];
    if (!p) continue;
    const s = signs.find(x => x.sign === p.sign);
    if (s) s.who.push(b); else signs.push({ sign: p.sign, who: [b] });
  }
  for (const s of signs) add('sign', `${SIGN[s.sign].name} — ${s.who.map(b => (b === 'asc' ? 'cung Mọc' : BODY[b].name)).join(', ')}`, { chart, sign: s.sign });
  if (chart.houses) for (const h of chart.houses) add('house', `Cung ${h.n} · nóc ${SIGN[h.sign].name} ${dm(h.lon)}${h.bodies.length ? ` · ${h.bodies.map(b => BODY[b].name).join(', ')}` : ''}`, { chart, house: h.n });
  add('aspect', null, base);
  for (const p of chart.patterns) add('pattern', patternText(p), { chart, pattern: p, focus: p.apex });
  // her notes before the tests, then each test whose score is high (or low: she reads both)
  add('dominant', null, base);
  for (const t of chart.dominant.tests)
    add('dominant', `${BODY[t.body].name}: ${t.total} điểm (${LEVEL_NAME[t.level]})`, { chart, focus: t.body });
  for (const b of ['north-node', 'south-node', 'lilith', 'ziqi', 'chiron', 'fortune', 'vertex', 'antivertex'] as BodyCode[])
    if (chart.placements[b]) add('point', placementText(chart, b), { chart, focus: b });
  add('love', placementText(chart, 'sun'), { chart, focus: 'sun' });
  return { sections, matched: sections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.matches.length, 0), 0) };
}
