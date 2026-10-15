/* Nhân số học on the server: the numbers of a birth date and a name (anyone may compute them), and what Lê Đỗ Quỳnh
   Hương's book says of them — a reading, the book itself section by section, and lookups by number or arrow. The book
   is under its author's copyright, so its text is the owner's to read unless its source is opened to the public. */
import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { asc, count, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ENGINE_VERSION } from '@mystic/engine';
import { BirthError, solarDateOf, type SolarDate } from '@mystic/engine/birth';
import {
  NumerologyError, TOPICS, buildNumerology, nameVariants, readNumerology, symbolCatalogue,
  type NameInput, type NumerologyChart, type Topic, type YMD,
} from '@mystic/engine/numerology';
import type {
  BirthDto, Gender, NumerologyBookDto, NumerologyCatalogDto, NumerologyEntryDto, NumerologyLookupDto, NumerologyNameDto,
  NumerologyPassageDto, NumerologyReadingDto, NumerologyRuleDto, NumerologySymbolDto, TableDto,
} from '@mystic/engine/api';
import { DB, type Db } from '../db/db.js';
import { entryTableRows, entryTables, passages } from '../db/schema.js';
import { KnowledgeService, type NumerologyKnowledge } from '../kb/knowledge.service.js';

export const NameBody = z.object({
  label: z.string().trim().max(60).nullable().default(null),
  text: z.string().trim().min(1, 'Chưa nhập tên').max(200),
  primary: z.boolean().default(false),
});
export const NumerologyBody = z.object({
  birth: z.object({
    calendar: z.enum(['solar', 'lunar']).default('solar'),
    year: z.number().int().min(1800).max(2200), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
    leapMonth: z.boolean().default(false),
    latitude: z.number().min(-90).max(90).nullable().default(null),
  }),
  gender: z.enum(['male', 'female']).nullable().default(null),
  names: z.array(NameBody).max(8).default([]),
  viewYear: z.number().int().min(1800).max(2200).optional(),
});
export type NumerologyBodyT = z.infer<typeof NumerologyBody>;

/** today in Vietnam (the server runs in UTC): the personal year and the stage of life turn on the date there */
export function todayVn(): YMD {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-').map(Number);
  return { year, month, day };
}

/** the names read by default: the given name first (the name used most — the book's), then the fuller forms */
export function defaultNames(displayName: string): NumerologyNameDto[] {
  return nameVariants(displayName).map((v, i) => ({ label: v.label, text: v.text, primary: i === 0 }));
}

/** exactly one primary name (the first marked, else the first) */
export function normalizeNames(names: NumerologyNameDto[]): NumerologyNameDto[] {
  const list = names.map(n => ({ label: n.label?.trim() || null, text: n.text.trim(), primary: !!n.primary })).filter(n => n.text);
  const p = Math.max(0, list.findIndex(n => n.primary));
  return list.map((n, i) => ({ ...n, primary: i === p }));
}

export interface Computed { solar: SolarDate & { note: string | null }; chart: NumerologyChart }

/** a chart from a birth (solar, or lunar as the family wrote it), or a 400 that says what is wrong with it */
export function numerologyOf(birth: Pick<BirthDto, 'calendar' | 'year' | 'month' | 'day' | 'leapMonth' | 'latitude'>, gender: Gender | null, names: NumerologyNameDto[], asOf: YMD = todayVn()): Computed {
  let solar: SolarDate;
  try { solar = solarDateOf(birth); } catch (e) { if (e instanceof BirthError) throw new BadRequestException(e.message); throw e; }
  const note = solar.fromLunar
    ? `Đổi từ ngày ${birth.day}/${birth.month}${birth.leapMonth ? ' nhuận' : ''}/${birth.year} âm lịch${solar.zone === 8 ? ', theo lịch tính cho UTC+8 (lịch dùng trước năm 1968, ở miền Nam đến 1975)' : ''}.`
    : null;
  try {
    const chart = buildNumerology({ year: solar.year, month: solar.month, day: solar.day, gender, names: names.map((n): NameInput => ({ label: n.label, text: n.text, primary: n.primary })), asOf });
    return { solar: { ...solar, note }, chart };
  } catch (e) {
    if (e instanceof NumerologyError) throw new BadRequestException(e.message);
    throw e;
  }
}

@Injectable()
export class NumerologyService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  /** the book, or a 503 while it is not loaded; a 401 when its text is the owner's and the caller is not */
  async book(owner: boolean): Promise<NumerologyKnowledge> {
    const k = await this.knowledge.numerology();
    if (!k) throw new ServiceUnavailableException('Sách Nhân số học chưa được nạp vào cơ sở dữ liệu');
    if (k.source.access === 'owner' && !owner) throw new UnauthorizedException('Sách này chỉ chủ nhà đọc được (cần mã chủ nhà)');
    return k;
  }

  chart(body: NumerologyBodyT): Computed {
    return numerologyOf(body.birth, body.gender, normalizeNames(body.names));
  }

  async reading(body: NumerologyBodyT, owner: boolean): Promise<NumerologyReadingDto> {
    const k = await this.book(owner);
    const c = this.chart(body);
    return this.readingOf(c, k, body.viewYear ?? null);
  }

  /** the reading of a chart: the book's passages for every part, and every rule they cite */
  readingOf(c: Computed, k: NumerologyKnowledge, viewYear: number | null, name?: number): NumerologyReadingDto {
    const nameRead = name !== undefined && c.chart.names[name] ? name : c.chart.primary;
    const r = readNumerology(c.chart, k.kb, { ...(viewYear ? { year: viewYear } : {}), ...(nameRead !== null ? { name: nameRead } : {}) });
    const used = new Set<string>();
    const sections = r.sections.map(s => ({
      topic: s.topic, title: s.title, focus: s.focus,
      groups: s.groups.map(g => ({ entry: g.entry, title: g.title, path: g.path, matches: g.matches.map(m => { used.add(m.rule.id); return { rule: m.rule.id, why: m.why }; }) })),
    }));
    const rules: Record<string, NumerologyRuleDto> = {};
    for (const code of used) { const d = k.rules.get(code); if (d) rules[code] = d; }
    const { id: _id, access: _a, ...source } = k.source;
    return {
      engineVersion: ENGINE_VERSION, knowledgeVersion: k.version,
      solar: { year: c.solar.year, month: c.solar.month, day: c.solar.day, fromLunar: c.solar.fromLunar, note: c.solar.note },
      chart: c.chart, pyear: r.pyear, viewYear, name: nameRead, sections, rules, source,
    };
  }

  /** the rule codes a reading of this chart cites (what a written reading may quote) */
  matched(c: Computed, k: NumerologyKnowledge, viewYear: number | null): string[] {
    return Object.keys(this.readingOf(c, k, viewYear).rules);
  }

  // ── the book ──

  async toc(owner: boolean): Promise<NumerologyBookDto> {
    const k = await this.book(owner);
    const pc = await this.db.select({ entryId: passages.entryId, n: count() }).from(passages).where(inArray(passages.entryId, k.order.map(e => e.id))).groupBy(passages.entryId);
    const pn = new Map(pc.map(x => [x.entryId, x.n]));
    const rn = new Map<string, number>();
    for (const r of k.rules.values()) if (r.active) rn.set(r.entry, (rn.get(r.entry) ?? 0) + 1);
    const topicOfEntry = this.topicOfEntries(k);
    const { id: _id, access: _a, ...source } = k.source;
    return {
      source,
      toc: k.order.map(e => ({ code: e.code, title: e.title, parent: e.parent, depth: e.depth, kind: e.depth === 0 && /^p\d+$/.test(e.code) ? 'part' : 'section', page: e.page, topic: topicOfEntry.get(e.code) ?? null, passages: pn.get(e.id) ?? 0, rules: rn.get(e.code) ?? 0 })),
      topics: TOPICS.map(t => ({ code: t.code, title: t.title, part: t.part, entry: k.entries.has(`p${t.part}`) ? `p${t.part}` : null })),
    };
  }

  /** an entry with every section under it, paragraph by paragraph, each paragraph with the rule it is */
  async entry(code: string, owner: boolean): Promise<NumerologyEntryDto> {
    const k = await this.book(owner);
    const e = k.entries.get(code);
    if (!e) throw new NotFoundException('Không có mục này trong sách');
    const under = new Set([code]);
    const unit = k.order.filter(x => { if (x.code === code) return true; if (x.parent && under.has(x.parent)) { under.add(x.code); return true; } return false; });
    const ps = await this.db.select().from(passages).where(inArray(passages.entryId, unit.map(x => x.id))).orderBy(asc(passages.entryId), asc(passages.ordinal));
    const tables = await this.tablesOf(unit.map(x => x.id));
    const topicOfEntry = this.topicOfEntries(k);
    const sections = unit.map(x => ({
      code: x.code, title: x.title, depth: x.depth - e.depth, page: x.page,
      passages: ps.filter(p => p.entryId === x.id).map((p): NumerologyPassageDto => {
        const rc = k.ruleOfPassage.get(p.id);
        return { id: p.id, key: p.key, kind: p.kind, role: (p.role ?? 'general') as NumerologyPassageDto['role'], page: p.sourceRef, text: p.text, originalText: p.editedAt ? p.originalText : null, rule: rc ? k.rules.get(rc) ?? null : null };
      }),
      tables: tables.filter(t => t.entryId === x.id).map(({ entryId: _e, ...t }) => t),
    }));
    const path: { code: string; title: string }[] = [];
    for (let p = e.parent; p; p = k.entries.get(p)?.parent ?? null) { const x = k.entries.get(p); if (x) path.unshift({ code: x.code, title: x.title }); }
    const siblings = k.order.filter(x => x.parent === e.parent);
    const i = siblings.findIndex(x => x.code === code);
    const near = (x: typeof e | undefined) => (x ? { code: x.code, title: x.title } : null);
    const { id: _id, access: _a, ...source } = k.source;
    return { code: e.code, title: e.title, page: e.page, topic: topicOfEntry.get(e.code) ?? null, path, sections, prev: near(siblings[i - 1]), next: near(siblings[i + 1]), source };
  }

  /** every passage whose condition speaks of all the given numbers or arrows ("chu-dao:7", "muiten-trong:4-5-6"…) */
  async lookup(codes: string[], owner: boolean, topic?: string): Promise<NumerologyLookupDto> {
    const k = await this.book(owner);
    const cat = this.symbols(k);
    const want = [...new Set(codes)];
    const symbols = want.map(c => cat.find(s => s.code === c)).filter((s): s is NumerologySymbolDto => !!s);
    if (!want.length || symbols.length !== want.length) return { symbols, total: 0, groups: [] };
    const hits = [...k.rules.values()].filter(r => r.active && (!topic || r.topic === topic) && want.every(c => k.symbols.get(r.code)?.includes(c)));
    const groups = new Map<string, NumerologyLookupDto['groups'][number]>();
    for (const r of hits) {
      let g = groups.get(r.entry);
      if (!g) {
        const path: string[] = [];
        for (let p: string | null = r.entry; p; p = k.entries.get(p)?.parent ?? null) path.unshift(k.entries.get(p)?.title ?? p);
        g = { entry: r.entry, title: path[path.length - 1] ?? r.entry, path, rules: [] };
        groups.set(r.entry, g);
      }
      g.rules.push(r);
    }
    return { symbols, total: hits.length, groups: [...groups.values()] };
  }

  async catalog(owner: boolean): Promise<NumerologyCatalogDto> {
    const k = await this.book(owner);
    const tables = await this.tablesOf(k.order.map(e => e.id));
    const codeOf = new Map(k.order.map(e => [e.id, e.code]));
    return {
      symbols: this.symbols(k),
      topics: TOPICS.map(t => ({ code: t.code, title: t.title, part: t.part })),
      tables: tables.map(({ entryId, ...t }) => ({ ...t, entry: codeOf.get(entryId) ?? '' })),
    };
  }

  private symbols(k: NumerologyKnowledge): NumerologySymbolDto[] {
    const n = new Map<string, number>();
    for (const [code, list] of k.symbols) if (k.rules.get(code)?.active) for (const s of list) n.set(s, (n.get(s) ?? 0) + 1);
    return symbolCatalogue().map(s => ({ ...s, rules: n.get(s.code) ?? 0 }));
  }

  /** the part of a reading each entry belongs to: that of its rules, or of the entry it sits under */
  private topicOfEntries(k: NumerologyKnowledge): Map<string, Topic> {
    const direct = new Map<string, Topic>();
    for (const r of k.rules.values()) if (!direct.has(r.entry)) direct.set(r.entry, r.topic);
    const out = new Map<string, Topic>();
    for (const e of k.order) {
      let t = direct.get(e.code);
      for (let p = e.parent; !t && p; p = k.entries.get(p)?.parent ?? null) t = direct.get(p);
      if (!t) { const part = TOPICS.find(x => e.code === `p${x.part}` || e.code.startsWith(`p${x.part}.`)); t = part?.code; }
      if (t) out.set(e.code, t);
    }
    return out;
  }

  private async tablesOf(entryIds: number[]): Promise<(TableDto & { entryId: number })[]> {
    if (!entryIds.length) return [];
    const ts = await this.db.select().from(entryTables).where(inArray(entryTables.entryId, entryIds)).orderBy(asc(entryTables.ordinal));
    if (!ts.length) return [];
    const rows = await this.db.select().from(entryTableRows).where(inArray(entryTableRows.tableId, ts.map(t => t.id))).orderBy(asc(entryTableRows.tableId), asc(entryTableRows.ordinal));
    return ts.map(t => ({ entryId: t.entryId, key: t.key, title: t.title, columns: t.columns, rows: rows.filter(r => r.tableId === t.id).map(r => r.cells) }));
  }
}

