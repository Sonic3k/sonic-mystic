/* The written readings of a profile — by the app's AI call (Tử vi, for now) or written with Claude and saved here.
   An idea that retells the source cites the passages it retells; one that cites none of the passages its reading
   matched is shown as added, never as the source's. A reading is marked stale when what it was written from — the
   chart, the names, the matched passages — has changed. */
import { createHash } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { AiReadingDto, Layer } from '@mystic/engine/api';
import { DB, type Db } from '../db/db.js';
import { readingItemRefs, readingItems, readingSections, readings, rules } from '../db/schema.js';
import { KnowledgeService } from '../kb/knowledge.service.js';
import { NumerologyService, todayVn, type Computed } from '../numerology/numerology.service.js';
import { AstrologyService } from '../astrology/astrology.service.js';
import type { AstrologyChartDto } from '@mystic/engine/api';
import { PeopleService } from '../people/people.service.js';
import { SyncService } from '../sync/sync.service.js';
import { scopeOk, tuviInput } from '../ai/lines.js';

export const WrittenBody = z.object({
  viewYear: z.number().int().min(1800).max(2200).optional(),
  author: z.string().trim().min(1).max(40).default('claude'),
  model: z.string().trim().max(80).nullable().default(null),
  caution: z.string().trim().max(1000).nullable().default(null),
  sections: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    items: z.array(z.object({ layer: z.enum(['primary', 'added']), text: z.string().trim().min(1).max(6000), refs: z.array(z.string().max(60)).max(80).default([]) })).min(1).max(40),
  })).min(1).max(30),
});
export type WrittenBodyT = z.infer<typeof WrittenBody>;

/** nhân số học: the synthesis of the whole chart, or of one year */
export const numerologyScopeOk = (scope: string) => scope === 'tong-hop' || /^nam-\d{4}$/.test(scope);
/** chiêm tinh: the reading of the whole chart */
export const astrologyScopeOk = (scope: string) => scope === 'tong-hop';
/** the scopes whose reading is the one a brief quotes */
const OVERVIEW = new Set(['tong-quan', 'tong-hop']);

export interface StoredReading {
  scope: string; viewYear: number; author: string; model: string | null; caution: string | null; inputHash: string;
  sections: { title: string; items: { layer: Layer; text: string; refs: string[] }[] }[];
}

const hash16 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

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

  /** the hash a reading of (scope, year) would have now — null when it cannot be told (the book is not loaded…) */
  private async currentHash(profileId: string, discipline: string): Promise<((scope: string, year: number) => string | null) | null> {
    try {
      if (discipline === 'astrology') {
        const { computed } = await this.people.astrologyInput(profileId);
        const k = await this.astrology.book();
        return scope => astrologyHash(computed, scope, this.astrology.matched(computed, k));
      }
      if (discipline === 'numerology') {
        const { computed } = await this.people.numerologyInput(profileId);
        const k = await this.numerology.book();
        return (scope, year) => numerologyHash(computed, scope, year, this.numerology.matched(computed, k, year));
      }
      const pi = await this.people.profileInput(profileId);
      const k = await this.knowledge.get();
      return (scope, year) => { try { return tuviInput(pi.birth, pi.settings, k, scope, year).hash; } catch { return null; } };
    } catch {
      return null;
    }
  }

  /**
   * Saves a reading written elsewhere (with Claude): it replaces the profile's reading of the same scope and year.
   * Refs are checked against what the profile's own reading matched — a ref it did not match is dropped, and a
   * primary idea left with none is saved as added.
   */
  async put(profileId: string, scope: string, body: WrittenBodyT): Promise<AiReadingDto> {
    const { profile } = await this.people.profileHead(profileId);
    let year: number, inputHash: string, allowed: Set<string>, quote: Map<string, string>;
    if (profile.disciplineCode === 'astrology') {
      if (!astrologyScopeOk(scope)) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope} (tong-hop)`);
      year = body.viewYear ?? profile.viewYear ?? todayVn().year;
      const { computed } = await this.people.astrologyInput(profileId);
      const k = await this.astrology.book();
      const codes = this.astrology.matched(computed, k);
      inputHash = astrologyHash(computed, scope, codes);
      allowed = new Set(codes);
      quote = new Map(codes.map(c => [c, k.rules.get(c)?.text ?? '']));
    } else if (profile.disciplineCode === 'numerology') {
      if (!numerologyScopeOk(scope)) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope} (tong-hop, hoặc nam-YYYY)`);
      year = body.viewYear ?? (scope.startsWith('nam-') ? Number(scope.slice(4)) : profile.viewYear ?? todayVn().year);
      const { computed } = await this.people.numerologyInput(profileId);
      const k = await this.numerology.book();
      const codes = this.numerology.matched(computed, k, year);
      inputHash = numerologyHash(computed, scope, year, codes);
      allowed = new Set(codes);
      quote = new Map(codes.map(c => [c, k.rules.get(c)?.text ?? '']));
    } else {
      if (!scopeOk(scope)) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope}`);
      year = body.viewYear ?? (scope.startsWith('han-') ? Number(scope.slice(4)) : profile.viewYear ?? new Date().getFullYear());
      const pi = await this.people.profileInput(profileId);
      const k = await this.knowledge.get();
      const input = tuviInput(pi.birth, pi.settings, k, scope, year);
      inputHash = input.hash;
      allowed = new Set(input.lines.filter(l => l.source === 'ba').map(l => l.ref));
      quote = new Map(input.lines.map(l => [l.ref, l.text]));
    }
    const cited = [...new Set(body.sections.flatMap(s => s.items.flatMap(i => i.refs)))];
    const dropped = cited.filter(c => !allowed.has(c));
    // every ref unknown: the reading was written for another chart
    if (cited.length && dropped.length === cited.length) throw new BadRequestException(`Không câu nào được dẫn khớp với lá số này: ${dropped.slice(0, 5).join(', ')}`);
    const saved = await this.store(profileId, { scope, viewYear: year, author: body.author, model: body.model, caution: body.caution, inputHash, sections: body.sections.map(s => ({ title: s.title, items: s.items.map(i => ({ layer: i.layer, text: i.text, refs: i.refs })) })) }, allowed, quote);
    return dropped.length ? { ...saved, dropped } : saved;
  }

  /** writes a reading (replacing the one of the same scope and year), keeping only refs in `allowed` */
  async store(profileId: string, r: StoredReading, allowed: Set<string>, quote: Map<string, string>): Promise<AiReadingDto> {
    const { subject } = await this.people.profileHead(profileId);
    const id = await this.db.transaction(async tx => {
      await tx.delete(readings).where(and(eq(readings.profileId, profileId), eq(readings.scope, r.scope), eq(readings.viewYear, r.viewYear)));
      const [row] = await tx.insert(readings).values({ profileId, scope: r.scope, viewYear: r.viewYear, author: r.author, model: r.model, inputHash: r.inputHash, caution: r.caution?.trim() || null }).returning({ id: readings.id });
      const codes = [...new Set(r.sections.flatMap(s => s.items.flatMap(i => i.refs)))].filter(c => allowed.has(c));
      const ruleRows = codes.length ? await tx.select({ id: rules.id, code: rules.code, text: rules.text }).from(rules).where(inArray(rules.code, codes)) : [];
      const ruleOf = new Map(ruleRows.map(x => [x.code, x]));
      for (const [si, s] of r.sections.entries()) {
        const [sec] = await tx.insert(readingSections).values({ readingId: row.id, ordinal: si, title: s.title.trim() || '—' }).returning({ id: readingSections.id });
        let o = 0;
        for (const it of s.items) {
          const text = it.text.trim();
          if (!text) continue;
          const refs = [...new Set(it.refs)].filter(c => allowed.has(c));
          // an idea that cites none of the matched passages is not shown as the source's
          const layer: Layer = it.layer === 'primary' && refs.length ? 'primary' : 'added';
          const [item] = await tx.insert(readingItems).values({ sectionId: sec.id, ordinal: o++, layer, text }).returning({ id: readingItems.id });
          if (refs.length) await tx.insert(readingItemRefs).values(refs.map(c => ({ itemId: item.id, ruleCode: c, ruleId: ruleOf.get(c)?.id ?? null, quotedText: quote.get(c) || ruleOf.get(c)?.text || '' }))).onConflictDoNothing();
        }
      }
      return row.id;
    });
    if (OVERVIEW.has(r.scope)) await this.sync.briefChanged(subject.id);
    const [saved] = await this.db.select().from(readings).where(eq(readings.id, id));
    return this.dto(saved, false);
  }

  async remove(id: string): Promise<void> {
    const [r] = await this.db.delete(readings).where(eq(readings.id, id)).returning({ profileId: readings.profileId });
    if (!r) throw new NotFoundException('Không có bài luận này');
    const { subject } = await this.people.profileHead(r.profileId);
    await this.sync.briefChanged(subject.id);
  }

  async dto(r: typeof readings.$inferSelect, stale: boolean): Promise<AiReadingDto> {
    const secs = await this.db.select().from(readingSections).where(eq(readingSections.readingId, r.id)).orderBy(asc(readingSections.ordinal));
    const items = secs.length ? await this.db.select().from(readingItems).where(inArray(readingItems.sectionId, secs.map(s => s.id))).orderBy(asc(readingItems.sectionId), asc(readingItems.ordinal)) : [];
    const refs = items.length ? await this.db.select().from(readingItemRefs).where(inArray(readingItemRefs.itemId, items.map(i => i.id))) : [];
    return {
      id: r.id, profileId: r.profileId, scope: r.scope, viewYear: r.viewYear, author: r.author, model: r.model, inputHash: r.inputHash, caution: r.caution,
      sections: secs.map(s => ({
        title: s.title,
        items: items.filter(i => i.sectionId === s.id).map(i => ({ layer: i.layer, text: i.text, refs: refs.filter(x => x.itemId === i.id).map(x => ({ code: x.ruleCode, quoted: x.quotedText })) })),
      })),
      createdAt: r.createdAt.toISOString(), stale,
    };
  }
}
