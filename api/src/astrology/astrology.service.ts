/* Chiêm tinh on the server: the chart of a birth (positions from the Swiss Ephemeris; anyone may compute it), and what
   the sources say of it — a reading, the sources themselves section by section, and lookups by planet, sign, house,
   aspect or structure. The sources are under their authors' copyright, so their text is the owner's to read. */
import { BadRequestException, Inject, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { asc, count, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ENGINE_VERSION } from '@mystic/engine';
import { BirthError, solarDateOf } from '@mystic/engine/birth';
import { TOPICS, buildAstroChart, readAstrology, symbolCatalogue, weighChart, type Topic } from '@mystic/engine/astrology';
import type {
  AstrologyBirthDto, AstrologyBookDto, AstrologyCatalogDto, AstrologyChartDto, AstrologyEntryDto, AstrologyLookupDto,
  AstrologyPassageDto, AstrologyReadingDto, AstrologyRuleDto, AstrologySourceDto, AstrologySymbolDto, AstrologyVoice, BirthDto, Gender, TableDto,
} from '@mystic/engine/api';
import { DB, type Db } from '../db/db.js';
import { entryTableRows, entryTables, passages } from '../db/schema.js';
import { KnowledgeService, entryKey, type AstrologyKnowledge } from '../kb/knowledge.service.js';
import { EphemerisError, astroInputOf, shiftedInput, stableWindow } from './ephemeris.js';

export const AstrologyBirth = z.object({
  year: z.number().int().min(1800).max(2399), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
  time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Giờ sinh dạng HH:MM').nullable().default(null),
  timeApprox: z.boolean().default(false),
  utcOffsetMinutes: z.number().int().min(-720).max(840).nullable().default(null),
  timeZone: z.string().trim().max(60).nullable().default(null),
  place: z.string().trim().max(200).nullable().default(null),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
});
export const AstrologyBody = z.object({ birth: AstrologyBirth, gender: z.enum(['male', 'female']).nullable().default(null) });
export type AstrologyBodyT = z.infer<typeof AstrologyBody>;

/** a stored birth as the chart reads it: the solar date (converted when the family wrote it in the lunar calendar),
    the clock time when there is one (a giờ alone is not precise enough for cung Mọc), the place */
export function astroBirthOf(b: BirthDto): AstrologyBirthDto {
  let solar;
  try { solar = solarDateOf(b); } catch (e) { if (e instanceof BirthError) throw new BadRequestException(e.message); throw e; }
  return {
    year: solar.year, month: solar.month, day: solar.day, time: b.time, timeApprox: b.timeApprox,
    utcOffsetMinutes: b.utcOffsetMinutes, timeZone: b.timeZone, place: b.place, latitude: b.latitude, longitude: b.longitude,
  };
}

/** a chart from a birth, or a 400 that says what is wrong with it */
export function astrologyOf(birth: AstrologyBirthDto, gender: Gender | null): AstrologyChartDto {
  const t = new Date(Date.UTC(birth.year, birth.month - 1, birth.day));
  if (t.getUTCMonth() !== birth.month - 1) throw new BadRequestException(`Không có ngày ${birth.day}/${birth.month}/${birth.year} dương lịch`);
  if (birth.timeZone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: birth.timeZone }); } catch { throw new BadRequestException(`Không có múi giờ "${birth.timeZone}"`); }
  }
  try {
    const { input, offsetMinutes, notes } = astroInputOf(birth, gender);
    const chart = buildAstroChart(input);
    const window = birth.time && chart.timeKnown ? stableWindow(birth, offsetMinutes) : null;
    // an estimated time: what weighs differently at the ends of the window it may be off by (a point's house, an orb)
    if (window && birth.timeApprox) {
      const ends = ([[-window.before, window.from], [window.after, window.to]] as [number, string][]).filter(([d]) => d !== 0);
      chart.weights = weighChart(chart, { alternates: ends.map(([d, label]) => ({ label, chart: buildAstroChart(shiftedInput(input, d)) })) });
    }
    return { chart, offsetMinutes, notes, window };
  } catch (e) {
    if (e instanceof EphemerisError) throw new InternalServerErrorException(e.message);
    throw e;
  }
}

@Injectable()
export class AstrologyService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  /** the sources, or a 503 while none is loaded */
  async book(): Promise<AstrologyKnowledge> {
    const k = await this.knowledge.astrology();
    if (!k) throw new ServiceUnavailableException('Tài liệu Chiêm tinh chưa được nạp vào cơ sở dữ liệu');
    return k;
  }

  chart(body: AstrologyBodyT): AstrologyChartDto {
    return astrologyOf(body.birth, body.gender);
  }

  async reading(body: AstrologyBodyT): Promise<AstrologyReadingDto> {
    const k = await this.book();
    return this.readingOf(this.chart(body), k);
  }

  /** the reading of a chart: the sources' passages for every part, and every rule they cite */
  readingOf(c: AstrologyChartDto, k: AstrologyKnowledge): AstrologyReadingDto {
    const r = readAstrology(c.chart, k.kb);
    const used = new Set<string>();
    const sections = r.sections.map(s => ({
      topic: s.topic, title: s.title, focus: s.focus,
      groups: s.groups.map(g => {
        const e = k.entries.get(g.entry);
        return { entry: e?.code ?? g.entry, source: g.source, title: g.title, path: g.path, matches: g.matches.map(m => { used.add(m.rule.id); return { rule: m.rule.id, why: m.why }; }) };
      }),
    }));
    const rules: Record<string, AstrologyRuleDto> = {};
    for (const code of used) { const d = k.rules.get(code); if (d) rules[code] = d; }
    return { engineVersion: ENGINE_VERSION, knowledgeVersion: k.version, ...c, sections, rules, sources: k.sources.map(sourceDto) };
  }

  /** the rule codes a reading of this chart cites (what a written reading may quote) */
  matched(c: AstrologyChartDto, k: AstrologyKnowledge): string[] {
    return Object.keys(this.readingOf(c, k).rules);
  }

  // ── the sources ──

  async toc(): Promise<AstrologyBookDto> {
    const k = await this.book();
    const pc = await this.db.select({ entryId: passages.entryId, n: count() }).from(passages).where(inArray(passages.entryId, k.order.map(e => e.id))).groupBy(passages.entryId);
    const pn = new Map(pc.map(x => [x.entryId, x.n]));
    const rn = new Map<string, number>();
    for (const r of k.rules.values()) if (r.active) rn.set(entryKey(r.source, r.entry), (rn.get(entryKey(r.source, r.entry)) ?? 0) + 1);
    const topics = this.topicOfEntries(k);
    return {
      sources: k.sources.map(s => ({
        source: sourceDto(s),
        toc: k.order.filter(e => e.source === s.code).map(e => ({ code: e.code, title: e.title, parent: e.parent, depth: e.depth, page: e.page, topic: topics.get(e.key) ?? null, passages: pn.get(e.id) ?? 0, rules: rn.get(e.key) ?? 0 })),
      })),
      topics: TOPICS.map(t => ({ code: t.code, title: t.title })),
    };
  }

  /** an entry with every section under it, passage by passage, each passage with the rule it is; shallow: only its own
      passages and the titles of the sections under it (a whole chapter) */
  async entry(source: string, code: string, shallow = false): Promise<AstrologyEntryDto> {
    const k = await this.book();
    const src = k.sources.find(s => s.code === source || s.code === `astrology.${source}`);
    const e = src ? k.entries.get(entryKey(src.code, code)) : undefined;
    if (!src || !e) throw new NotFoundException('Không có mục này trong tài liệu');
    const under = new Set([code]);
    const unit = k.order.filter(x => {
      if (x.source !== src.code) return false;
      if (x.code === code) return true;
      if (x.parent && under.has(x.parent)) { if (!shallow) under.add(x.code); return true; }
      return false;
    });
    const read = shallow ? [e.id] : unit.map(x => x.id);
    const ps = await this.db.select().from(passages).where(inArray(passages.entryId, read)).orderBy(asc(passages.entryId), asc(passages.ordinal));
    const tables = await this.tablesOf(read);
    const topics = this.topicOfEntries(k);
    const sections = unit.map(x => ({
      code: x.code, title: x.title, depth: x.depth - e.depth, page: x.page,
      passages: ps.filter(p => p.entryId === x.id).map((p): AstrologyPassageDto => {
        const rc = k.ruleOfPassage.get(p.id);
        return {
          id: p.id, key: p.key, kind: p.kind, role: p.role ?? 'general', voice: (p.voice as AstrologyVoice | null) ?? null, page: p.sourceRef,
          text: p.text, en: p.sourceText, label: p.label, items: p.items ?? null, originalText: p.editedAt ? p.originalText : null,
          rule: rc ? k.rules.get(rc) ?? null : null,
        };
      }),
      tables: tables.filter(t => t.entryId === x.id).map(({ entryId: _e, ...t }) => t),
    }));
    const path: { code: string; title: string }[] = [];
    for (let p = e.parent; p; p = k.entries.get(entryKey(src.code, p))?.parent ?? null) { const x = k.entries.get(entryKey(src.code, p)); if (x) path.unshift({ code: x.code, title: x.title }); }
    const siblings = k.order.filter(x => x.source === src.code && x.parent === e.parent);
    const i = siblings.findIndex(x => x.code === code);
    const near = (x: typeof e | undefined) => (x ? { code: x.code, title: x.title } : null);
    return { code: e.code, title: e.title, page: e.page, topic: topics.get(e.key) ?? null, path, sections, prev: near(siblings[i - 1]), next: near(siblings[i + 1]), source: sourceDto(src) };
  }

  /** every passage whose condition speaks of all the given things ("sun@aries", "house:7", "pattern:t-square"…) */
  async lookup(codes: string[], topic?: string): Promise<AstrologyLookupDto> {
    const k = await this.book();
    const cat = this.symbols(k);
    const want = [...new Set(codes)];
    const symbols = want.map(c => cat.find(s => s.code === c)).filter((s): s is AstrologySymbolDto => !!s);
    if (!want.length || symbols.length !== want.length) return { symbols, total: 0, groups: [] };
    const hits = [...k.rules.values()].filter(r => r.active && (!topic || r.topic === topic) && want.every(c => k.symbols.get(r.code)?.includes(c)));
    const groups = new Map<string, AstrologyLookupDto['groups'][number]>();
    for (const r of hits) {
      const key = entryKey(r.source, r.entry);
      let g = groups.get(key);
      if (!g) {
        const path: string[] = [];
        for (let p: string | null = r.entry; p; p = k.entries.get(entryKey(r.source, p))?.parent ?? null) path.unshift(k.entries.get(entryKey(r.source, p))?.title ?? p);
        g = { entry: r.entry, source: r.source, title: path[path.length - 1] ?? r.entry, path, rules: [] };
        groups.set(key, g);
      }
      g.rules.push(r);
    }
    return { symbols, total: hits.length, groups: [...groups.values()] };
  }

  async catalog(): Promise<AstrologyCatalogDto> {
    const k = await this.book();
    return { symbols: this.symbols(k), topics: TOPICS.map(t => ({ code: t.code, title: t.title })), sources: k.sources.map(sourceDto) };
  }

  private symbols(k: AstrologyKnowledge): AstrologySymbolDto[] {
    const n = new Map<string, number>();
    for (const [code, list] of k.symbols) if (k.rules.get(code)?.active) for (const s of list) n.set(s, (n.get(s) ?? 0) + 1);
    return symbolCatalogue().map(s => ({ ...s, rules: n.get(s.code) ?? 0 }));
  }

  /** the part of a reading each entry belongs to: that of its rules, or of the entry it sits under */
  private topicOfEntries(k: AstrologyKnowledge): Map<string, Topic> {
    const direct = new Map<string, Topic>();
    for (const r of k.rules.values()) { const key = entryKey(r.source, r.entry); if (!direct.has(key)) direct.set(key, r.topic); }
    const out = new Map<string, Topic>();
    for (const e of k.order) {
      let t = direct.get(e.key);
      for (let p = e.parent; !t && p; p = k.entries.get(entryKey(e.source, p))?.parent ?? null) t = direct.get(entryKey(e.source, p));
      if (t) out.set(e.key, t);
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

const sourceDto = (s: AstrologyKnowledge['sources'][number]): AstrologySourceDto => {
  const { id: _id, ...rest } = s;
  return rest;
};
