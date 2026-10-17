/* Reads a chart with the book: which passages speak of this person, grouped by the book's own sections and in the
   book's order. Nothing here writes text — every line shown is the book's, and every one says why it was chosen. */
import { personalYear, type NumerologyChart } from './chart.js';
import { evaluate, parse, type Ctx, type Node } from './dsl.js';
import { label } from './numbers.js';

/** where a passage is read: the parts of a reading, in the book's order */
export type Topic = 'ruling' | 'birthday' | 'grid' | 'arrows' | 'name' | 'peaks' | 'stages' | 'year';
export const TOPICS: { code: Topic; title: string; part: number }[] = [
  { code: 'ruling', title: 'Con số chủ đạo', part: 5 },
  { code: 'birthday', title: 'Con số ngày sinh', part: 8 },
  { code: 'grid', title: 'Biểu đồ ngày sinh', part: 6 },
  { code: 'arrows', title: 'Các mũi tên chỉ đặc điểm', part: 7 },
  { code: 'name', title: 'Sức mạnh của tên riêng', part: 12 },
  { code: 'peaks', title: 'Bốn đỉnh cao của đời người', part: 11 },
  { code: 'stages', title: 'Ba giai đoạn của đời người', part: 10 },
  { code: 'year', title: 'Năm cá nhân', part: 9 },
];

/** what a passage is to the person read: the book describing them, its advice, its words about children, or the
    book's own explanation of the part being read (shown once, at the top of it) */
export type RuleKind = 'rule' | 'advice' | 'child' | 'general';

/** one passage of the book with the condition under which it speaks of a person */
export interface Rule {
  id: string; topic: Topic; entry: string; ord: number; page?: number;
  kind: RuleKind; text: string; when: string;
  node?: Node;
}
export interface Entry { code: string; title: string; parent?: string; ord: number }
export interface Kb { rules: Rule[]; entries: Record<string, Entry> }

export interface Match { rule: Rule; why: string[] }
/** a section of the book, with the passages of it that matched */
export interface Group { entry: string; title: string; path: string[]; matches: Match[] }
export interface Section { topic: Topic; title: string; focus: string | null; groups: Group[] }
export interface NumerologyReading { sections: Section[]; matched: number; pyear: number }

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
      g = { entry: r.entry, title: path[path.length - 1] ?? r.entry, path, matches: [] };
      by.set(r.entry, g);
    }
    g.matches.push({ rule: r, why: [...new Set(res.why)] });
  }
  const groups = [...by.values()];
  for (const g of groups) g.matches.sort((a, b) => a.rule.ord - b.rule.ord);
  return groups.sort((a, b) => a.matches[0].rule.ord - b.matches[0].rule.ord);
}

/**
 * The whole reading: the ruling number, the birthday number, the chart and its numbers, the arrows, the name read,
 * each of the four peaks, the stage of life, and the personal year (the one lived on the chart's date, or `year`'s).
 */
export function readNumerology(chart: NumerologyChart, kb: Kb, opts: { year?: number; name?: number } = {}): NumerologyReading {
  const ni = opts.name ?? chart.primary;
  const name = ni !== null && ni !== undefined ? chart.names[ni] ?? null : null;
  const pyear = opts.year ? personalYear(chart.input.day, chart.input.month, opts.year).n : chart.now.year.n;
  const base: Ctx = { chart, name, pyear };
  const title = (t: Topic) => TOPICS.find(x => x.code === t)!.title;
  const sections: Section[] = [];
  const add = (topic: Topic, focus: string | null, x: Ctx) => {
    const groups = match(kb, topic, x, !sections.some(s => s.topic === topic));
    if (groups.length) sections.push({ topic, title: title(topic), focus, groups });
  };
  add('ruling', `Con số chủ đạo ${label(chart.ruling)}`, base);
  add('birthday', `Con số ngày sinh ${label(chart.birthday)}`, base);
  add('grid', null, base);
  add('arrows', null, base);
  if (name) add('name', name.text, base);
  for (const p of chart.pyramid.peaks) add('peaks', `Đỉnh thứ ${p.index} · ${p.age} tuổi (${p.year}) · số ${p.n}`, { ...base, peak: p });
  add('stages', null, base);
  add('year', `Năm cá nhân ${pyear}${opts.year ? ` (${opts.year})` : ''}`, base);
  return { sections, matched: sections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.matches.length, 0), 0), pyear };
}
