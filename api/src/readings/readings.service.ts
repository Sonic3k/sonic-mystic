/* The written readings of a profile — by the app's AI call (Tử vi, for now) or written with Claude and saved here — and
   the one written of a person as a whole (the Nhận định chung, from all their profiles).
   An idea that retells the source cites the passages it retells; one that cites none is shown as added, never as the
   source's. A citation is a passage the profile's own reading matched, or a passage of the same discipline's sources on
   how a chart is weighed (grandma's Tuần Triệt, cô Hương Kiều's orbs…): "p:<passage id>", or the code of a rule the
   chart did not match. A reading is marked stale when what it was written from — the chart, the names, the matched
   passages — has changed. Sections carry how much they weigh on the chart, and why. */
import { createHash } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { WEIGHTS, type AiReadingDto, type AstrologyChartDto, type Layer, type ReadingPlanDto, type RefSourceDto, type SourceKind, type Weight } from '@mystic/engine/api';
import { ASTROLOGY_READING_SPEC, WEIGH_RULES, checkAstrologyReading } from '@mystic/engine/astrology';
import { SUMMARY_SPEC, checkLookup, checkSummary } from '@mystic/engine/readings';
import { DB, type Db } from '../db/db.js';
import { entries, passages, readingItemRefs, readingItems, readingSections, readings, rules, sources } from '../db/schema.js';
import { KnowledgeService } from '../kb/knowledge.service.js';
import { NumerologyService, todayVn, type Computed } from '../numerology/numerology.service.js';
import { AstrologyService } from '../astrology/astrology.service.js';
import { PeopleService } from '../people/people.service.js';
import { SyncService } from '../sync/sync.service.js';
import { allTuviLines, scopeOk, tuviInput } from '../ai/lines.js';

export const WrittenBody = z.object({
  viewYear: z.number().int().min(1800).max(2200).optional(),
  author: z.string().trim().min(1).max(40).default('claude'),
  model: z.string().trim().max(80).nullable().default(null),
  caution: z.string().trim().max(1000).nullable().default(null),
  sections: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    weight: z.enum(WEIGHTS as [Weight, ...Weight[]]).nullable().default(null),
    basis: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
    /** chiêm tinh: the ids of the chart's factors the section reads — checked against the weighing, not stored */
    factors: z.array(z.string().trim().min(1).max(80)).max(60).optional(),
    items: z.array(z.object({ layer: z.enum(['primary', 'added']), text: z.string().trim().min(1).max(6000), refs: z.array(z.string().max(60)).max(80).default([]) })).min(1).max(40),
  })).min(1).max(60),
});
export type WrittenBodyT = z.infer<typeof WrittenBody>;

/** the Nhận định: what a chart (or a person) says, in plain words, read before the Luận giải */
export const SUMMARY = 'summary';
/** nhân số học: the synthesis of the whole chart, or of one year; its Nhận định */
export const numerologyScopeOk = (scope: string) => scope === 'synthesis' || scope === SUMMARY || /^year-\d{4}$/.test(scope);
/** chiêm tinh: the reading of the whole chart; its Nhận định */
export const astrologyScopeOk = (scope: string) => scope === 'synthesis' || scope === SUMMARY;
/** the reading a profile's Nhận định is drawn from (its hash says when the chart under both has changed) */
const MAIN: Record<string, string> = { tuvi: 'overview', astrology: 'synthesis', numerology: 'synthesis' };
/** the scopes whose reading is the one a brief quotes */
const OVERVIEW = new Set(['overview', 'synthesis']);

export interface StoredSection { title: string; weight?: Weight | null; basis?: string[]; items: { layer: Layer; text: string; refs: string[] }[] }
export interface StoredReading {
  scope: string; viewYear: number; author: string; model: string | null; caution: string | null; inputHash: string | null;
  sections: StoredSection[];
}
/** what a reading may cite: the passages its chart matched, with their text as the reading shows it */
interface Citable { allowed: Set<string>; quote: Map<string, string> }
/** a cited passage the chart did not match: how a chart is weighed, in the same discipline's sources */
interface Method { ruleId: number | null; text: string }

const hash16 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const passageId = (code: string) => (/^p:\d+$/.test(code) ? Number(code.slice(2)) : null);

/** what a chiêm tinh reading is written from: the moment and place read, the gender, and the passages matched */
export function astrologyHash(c: AstrologyChartDto, scope: string, codes: string[]): string {
  const i = c.chart.input;
  return hash16(`${i.jd.toFixed(6)}|${i.place ? `${i.place.latitude},${i.place.longitude}` : ''}|${i.timeKnown ? 1 : 0}|${i.gender ?? ''}|${scope}|${codes.join(',')}`);
}

/** what a nhân số học reading is written from: the date read, the names, the gender, and the passages matched */
export function numerologyHash(c: Computed, scope: string, year: number, codes: string[]): string {
  const ch = c.chart;
  return hash16(`${ch.input.year}-${ch.input.month}-${ch.input.day}|${ch.input.gender ?? ''}|${ch.input.names.map(n => `${n.label ?? ''}:${n.text}:${n.primary ? 1 : 0}`).join(',')}|${scope}|${year}|${codes.join(',')}`);
}

@Injectable()
export class ReadingsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(PeopleService) private readonly people: PeopleService,
    @Inject(SyncService) private readonly sync: SyncService,
    @Inject(NumerologyService) private readonly numerology: NumerologyService,
    @Inject(AstrologyService) private readonly astrology: AstrologyService,
  ) {}

  async list(profileId: string): Promise<AiReadingDto[]> {
    const { profile } = await this.people.profileHead(profileId);
    const rs = await this.db.select().from(readings).where(eq(readings.profileId, profileId)).orderBy(desc(readings.updatedAt));
    if (!rs.length) return [];
    const current = await this.currentHash(profileId, profile.disciplineCode);
    return Promise.all(rs.map(r => this.dto(r, current ? r.inputHash !== current(r.scope, r.viewYear) : false)));
  }

  /** the readings of the person as a whole (the Nhận định chung) */
  async listSubject(subjectId: string): Promise<AiReadingDto[]> {
    await this.people.subject(subjectId);
    const rs = await this.db.select().from(readings).where(and(eq(readings.subjectId, subjectId), isNull(readings.profileId))).orderBy(desc(readings.updatedAt));
    return Promise.all(rs.map(r => this.dto(r, false)));
  }

  /** the hash a reading of (scope, year) would have now — null when it cannot be told (the book is not loaded…) */
  private async currentHash(profileId: string, discipline: string): Promise<((scope: string, year: number) => string | null) | null> {
    const main = (scope: string) => (scope === SUMMARY ? MAIN[discipline] ?? scope : scope);
    try {
      if (discipline === 'astrology') {
        const { computed } = await this.people.astrologyInput(profileId);
        const k = await this.astrology.book();
        return scope => astrologyHash(computed, main(scope), this.astrology.matched(computed, k));
      }
      if (discipline === 'numerology') {
        const { computed } = await this.people.numerologyInput(profileId);
        const k = await this.numerology.book();
        return (scope, year) => numerologyHash(computed, main(scope), year, this.numerology.matched(computed, k, year));
      }
      const pi = await this.people.profileInput(profileId);
      const k = await this.knowledge.get();
      return (scope, year) => { try { return tuviInput(pi.birth, pi.settings, k, main(scope), year).hash; } catch { return null; } };
    } catch {
      return null;
    }
  }

  /**
   * Saves a reading written elsewhere (with Claude): it replaces the profile's reading of the same scope and year.
   * A ref the profile's chart did not match is kept only when it is a passage of the discipline's sources (on how a
   * chart is weighed); one that is neither is dropped, and a primary idea left with none is saved as added. A Nhận định
   * ("summary") cites nothing: it is the writer's own synthesis.
   */
  async put(profileId: string, scope: string, body: WrittenBodyT): Promise<AiReadingDto> {
    const { profile } = await this.people.profileHead(profileId);
    const d = profile.disciplineCode;
    const summary = scope === SUMMARY;
    let year: number, inputHash: string, cite: Citable;
    let warnings: string[] = [];
    if (d === 'astrology') {
      if (!astrologyScopeOk(scope)) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope} (synthesis, summary)`);
      year = body.viewYear ?? profile.viewYear ?? todayVn().year;
      const { computed } = await this.people.astrologyInput(profileId);
      const k = await this.astrology.book();
      const codes = this.astrology.matched(computed, k);
      inputHash = astrologyHash(computed, summary ? MAIN[d] : scope, codes);
      cite = { allowed: new Set(codes), quote: new Map(codes.map(c => [c, k.rules.get(c)?.text ?? ''])) };
      warnings = summary ? checkSummary(body.sections) : checkAstrologyReading(body.sections, computed.chart.weights);
    } else if (d === 'numerology') {
      if (!numerologyScopeOk(scope)) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope} (synthesis, summary, hoặc year-YYYY)`);
      year = body.viewYear ?? (scope.startsWith('year-') ? Number(scope.slice(5)) : profile.viewYear ?? todayVn().year);
      const { computed } = await this.people.numerologyInput(profileId);
      const k = await this.numerology.book();
      const codes = this.numerology.matched(computed, k, year);
      inputHash = numerologyHash(computed, summary ? MAIN[d] : scope, year, codes);
      cite = { allowed: new Set(codes), quote: new Map(codes.map(c => [c, k.rules.get(c)?.text ?? ''])) };
    } else {
      if (!summary && !scopeOk(scope)) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope}`);
      year = body.viewYear ?? (scope.startsWith('han-') ? Number(scope.slice(4)) : profile.viewYear ?? new Date().getFullYear());
      const pi = await this.people.profileInput(profileId);
      const k = await this.knowledge.get();
      inputHash = tuviInput(pi.birth, pi.settings, k, summary ? MAIN[d] : scope, year).hash;
      /* any of grandma's lines this chart matched may be cited: a reading of the whole chart speaks of every palace and
         of the year it is read in, not only of the palaces its own lines come from */
      const allowed = new Set<string>(), quote = new Map<string, string>();
      for (const l of allTuviLines(pi.birth, pi.settings, k, year)) {
        quote.set(l.ref, l.text);
        if (l.source === 'grandma') allowed.add(l.ref);
      }
      cite = { allowed, quote };
    }
    if (d !== 'astrology') warnings = summary ? checkSummary(body.sections) : checkLookup(body.sections);
    const sections = body.sections.map(s => ({ title: s.title, weight: s.weight, basis: s.basis, items: s.items.map(i => ({ layer: i.layer, text: i.text, refs: summary ? [] : i.refs })) }));
    // "<source>.b<line>": any passage of the sources by its block — kept as the rule's code when it is one, else as its passage
    const named = await this.blockRefs(d, [...new Set(sections.flatMap(s => s.items.flatMap(i => i.refs)))], cite.allowed);
    if (named.size) for (const s of sections) for (const i of s.items) i.refs = i.refs.map(r => named.get(r) ?? r);
    const cited = [...new Set(sections.flatMap(s => s.items.flatMap(i => i.refs)))];
    const methods = await this.methods(d, cited.filter(c => !cite.allowed.has(c)));
    const chartRefs = cited.filter(c => passageId(c) === null);
    // every ref of a rule unknown to this chart: the reading was written for another chart
    if (chartRefs.length && !chartRefs.some(c => cite.allowed.has(c))) throw new BadRequestException(`Không câu nào được dẫn khớp với lá số này: ${chartRefs.slice(0, 5).join(', ')}`);
    const dropped = cited.filter(c => !cite.allowed.has(c) && !methods.has(c));
    const saved = await this.store({ profileId, subjectId: profile.subjectId }, { scope, viewYear: year, author: body.author, model: body.model, caution: body.caution, inputHash, sections }, cite, methods);
    return { ...saved, ...(dropped.length ? { dropped } : {}), ...(warnings.length ? { warnings } : {}) };
  }

  /** what whoever writes a profile's readings needs beside the chart: how they are written, and (chiêm tinh) how it weighs */
  async plan(profileId: string): Promise<ReadingPlanDto> {
    const { profile } = await this.people.profileHead(profileId);
    const d = profile.disciplineCode;
    if (d === 'astrology') {
      const { computed, profile: p } = await this.people.astrologyInput(profileId);
      return { discipline: d, spec: ASTROLOGY_READING_SPEC, rules: WEIGH_RULES, weights: computed.chart.weights, window: computed.window, timeApprox: p.birthTimeApprox };
    }
    return { discipline: d, spec: SUMMARY_SPEC, rules: null, weights: null, window: null, timeApprox: false };
  }

  /** chiêm tinh: refs written "<source>.b<line>" that are not a rule of the sources: the passage of that block ("p:<id>") */
  private async blockRefs(discipline: string, codes: string[], allowed: Set<string>): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (discipline !== 'astrology') return out;
    const want = codes.filter(c => !allowed.has(c) && /^[a-z][a-z-]*\.b\d+$/.test(c));
    if (!want.length) return out;
    const isRule = new Set((await this.db.select({ code: rules.code }).from(rules).where(and(inArray(rules.code, want), eq(rules.disciplineCode, discipline)))).map(r => r.code));
    const bySource = new Map<string, string[]>();
    for (const c of want.filter(x => !isRule.has(x))) { const [src, key] = c.split('.'); bySource.set(src, [...(bySource.get(src) ?? []), key]); }
    for (const [src, keys] of bySource) {
      const ps = await this.db.select({ id: passages.id, key: passages.key }).from(passages)
        .innerJoin(entries, eq(entries.id, passages.entryId)).innerJoin(sources, eq(sources.id, entries.sourceId))
        .where(and(eq(sources.code, `astrology.${src}`), inArray(passages.key, keys)));
      for (const p of ps) out.set(`${src}.${p.key}`, `p:${p.id}`);
    }
    return out;
  }

  /** saves the reading of a person as a whole (the Nhận định chung): plain words, no citations */
  async putSubject(subjectId: string, scope: string, body: WrittenBodyT): Promise<AiReadingDto> {
    if (scope !== SUMMARY) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope} (summary)`);
    await this.people.subject(subjectId);
    const year = body.viewYear ?? todayVn().year;
    const sections = body.sections.map(s => ({ title: s.title, weight: null, basis: [], items: s.items.map(i => ({ layer: 'added' as const, text: i.text, refs: [] })) }));
    const warnings = checkSummary(body.sections);
    const saved = await this.store({ profileId: null, subjectId }, { scope, viewYear: year, author: body.author, model: body.model, caution: body.caution, inputHash: null, sections }, { allowed: new Set(), quote: new Map() }, new Map());
    return warnings.length ? { ...saved, warnings } : saved;
  }

  /** the cited codes that are passages of this discipline's sources — "p:<id>", or a rule of it the chart did not match */
  private async methods(discipline: string, codes: string[]): Promise<Map<string, Method>> {
    const out = new Map<string, Method>();
    const ids = codes.map(passageId).filter((x): x is number => x !== null);
    if (ids.length) {
      const ps = await this.db.select({ id: passages.id, text: passages.text }).from(passages)
        .innerJoin(entries, eq(entries.id, passages.entryId)).innerJoin(sources, eq(sources.id, entries.sourceId))
        .where(and(inArray(passages.id, ids), eq(sources.disciplineCode, discipline)));
      for (const p of ps) out.set(`p:${p.id}`, { ruleId: null, text: p.text });
    }
    const named = codes.filter(c => passageId(c) === null);
    if (named.length) {
      const rs = await this.db.select({ id: rules.id, code: rules.code, text: rules.text, ptext: passages.text }).from(rules)
        .leftJoin(passages, eq(passages.id, rules.passageId))
        .where(and(inArray(rules.code, named), eq(rules.disciplineCode, discipline), eq(rules.active, true)));
      for (const r of rs) out.set(r.code, { ruleId: r.id, text: r.ptext ?? r.text });
    }
    return out;
  }

  /** writes a reading (replacing the one of the same scope and year), keeping only refs it may cite */
  async store(to: { profileId: string | null; subjectId: string }, r: StoredReading, cite: Citable, methods: Map<string, Method> = new Map()): Promise<AiReadingDto> {
    const ok = (c: string) => cite.allowed.has(c) || methods.has(c);
    const id = await this.db.transaction(async tx => {
      await tx.delete(readings).where(to.profileId
        ? and(eq(readings.profileId, to.profileId), eq(readings.scope, r.scope), eq(readings.viewYear, r.viewYear))
        : and(eq(readings.subjectId, to.subjectId), isNull(readings.profileId), eq(readings.scope, r.scope), eq(readings.viewYear, r.viewYear)));
      const [row] = await tx.insert(readings).values({ profileId: to.profileId, subjectId: to.subjectId, scope: r.scope, viewYear: r.viewYear, author: r.author, model: r.model, inputHash: r.inputHash, caution: r.caution?.trim() || null }).returning({ id: readings.id });
      const codes = [...new Set(r.sections.flatMap(s => s.items.flatMap(i => i.refs)))].filter(c => cite.allowed.has(c));
      const ruleRows = codes.length ? await tx.select({ id: rules.id, code: rules.code, text: rules.text }).from(rules).where(inArray(rules.code, codes)) : [];
      const ruleOf = new Map(ruleRows.map(x => [x.code, x]));
      for (const [si, s] of r.sections.entries()) {
        const basis = (s.basis ?? []).map(b => b.trim()).filter(Boolean);
        const [sec] = await tx.insert(readingSections).values({ readingId: row.id, ordinal: si, title: s.title.trim() || '—', weight: s.weight ?? null, basis: basis.length ? basis : null }).returning({ id: readingSections.id });
        let o = 0;
        for (const it of s.items) {
          const text = it.text.trim();
          if (!text) continue;
          const refs = [...new Set(it.refs)].filter(ok);
          // an idea that cites none of the source's passages is not shown as the source's
          const layer: Layer = it.layer === 'primary' && refs.length ? 'primary' : 'added';
          const [item] = await tx.insert(readingItems).values({ sectionId: sec.id, ordinal: o++, layer, text }).returning({ id: readingItems.id });
          if (refs.length) {
            await tx.insert(readingItemRefs).values(refs.map(c => {
              const m = cite.allowed.has(c) ? null : methods.get(c)!;
              return m ? { itemId: item.id, ruleCode: c, ruleId: m.ruleId, quotedText: m.text }
                : { itemId: item.id, ruleCode: c, ruleId: ruleOf.get(c)?.id ?? null, quotedText: cite.quote.get(c) || ruleOf.get(c)?.text || '' };
            })).onConflictDoNothing();
          }
        }
      }
      return row.id;
    });
    if (OVERVIEW.has(r.scope) && to.profileId) await this.sync.briefChanged(to.subjectId);
    const [saved] = await this.db.select().from(readings).where(eq(readings.id, id));
    return this.dto(saved, false);
  }

  async remove(id: string): Promise<void> {
    const [r] = await this.db.delete(readings).where(eq(readings.id, id)).returning({ subjectId: readings.subjectId });
    if (!r) throw new NotFoundException('Không có bài luận này');
    await this.sync.briefChanged(r.subjectId);
  }

  async dto(r: typeof readings.$inferSelect, stale: boolean): Promise<AiReadingDto> {
    const secs = await this.db.select().from(readingSections).where(eq(readingSections.readingId, r.id)).orderBy(asc(readingSections.ordinal));
    const items = secs.length ? await this.db.select().from(readingItems).where(inArray(readingItems.sectionId, secs.map(s => s.id))).orderBy(asc(readingItems.sectionId), asc(readingItems.ordinal)) : [];
    const refs = items.length ? await this.db.select().from(readingItemRefs).where(inArray(readingItemRefs.itemId, items.map(i => i.id))) : [];
    const where = await this.refSources([...new Set(refs.map(x => x.ruleCode))]);
    return {
      id: r.id, profileId: r.profileId, subjectId: r.subjectId, scope: r.scope, viewYear: r.viewYear, author: r.author, model: r.model, inputHash: r.inputHash, caution: r.caution,
      sections: secs.map(s => ({
        title: s.title, weight: (s.weight as Weight | null) ?? null, basis: s.basis ?? [],
        items: items.filter(i => i.sectionId === s.id).map(i => ({ layer: i.layer, text: i.text, refs: refs.filter(x => x.itemId === i.id).map(x => ({ code: x.ruleCode, quoted: x.quotedText, src: where.get(x.ruleCode) ?? null })) })),
      })),
      createdAt: r.createdAt.toISOString(), stale,
    };
  }

  /** where each cited passage stands in its source (a rule's passage, or a passage by id) */
  private async refSources(codes: string[]): Promise<Map<string, RefSourceDto>> {
    const out = new Map<string, RefSourceDto>();
    if (!codes.length) return out;
    const cols = {
      source: sources.code, kind: sources.kind, voice: passages.voice, label: passages.label,
      entry: entries.code, entryTitle: entries.title, entryRef: entries.sourceRef, paraRef: passages.sourceRef,
    };
    const put = (code: string, x: { source: string; kind: string; voice: string | null; label: string | null; entry: string; entryTitle: string; entryRef: number | null; paraRef: number | null }) =>
      out.set(code, { ...x, kind: x.kind as SourceKind });
    const named = codes.filter(c => passageId(c) === null);
    if (named.length) {
      const rs = await this.db.select({ code: rules.code, ...cols }).from(rules)
        .innerJoin(entries, eq(entries.id, rules.entryId)).innerJoin(sources, eq(sources.id, rules.sourceId))
        .leftJoin(passages, eq(passages.id, rules.passageId)).where(inArray(rules.code, named));
      for (const { code, ...x } of rs) put(code, x);
    }
    const ids = codes.map(passageId).filter((x): x is number => x !== null);
    if (ids.length) {
      const ps = await this.db.select({ id: passages.id, ...cols }).from(passages)
        .innerJoin(entries, eq(entries.id, passages.entryId)).innerJoin(sources, eq(sources.id, entries.sourceId)).where(inArray(passages.id, ids));
      for (const { id, ...x } of ps) put(`p:${id}`, x);
    }
    return out;
  }
}
