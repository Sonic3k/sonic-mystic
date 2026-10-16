/* The knowledge the engines read, built from the database and kept in memory until something is edited or imported.
   Tử vi: grandma's rules become the engine's 'ba' rules; every other source (the supplement now, other books later)
   'bo-sung'. Nhân số học: Lê Đỗ Quỳnh Hương's book, each rule read with its paragraph's text (so rewording a passage
   rewords what a reading shows). */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, like } from 'drizzle-orm';
import { compile, type Kb, type Principle, type Rule, type Tone } from '@mystic/engine/tuvi';
import {
  BOOK_SOURCE, TOPICS, compile as compileNumerology, parse as parseNumerology, symbolsOf,
  type Kb as NumerologyKb, type RuleKind, type Topic,
} from '@mystic/engine/numerology';
import {
  TOPICS as ASTROLOGY_TOPICS, compile as compileAstrology, parse as parseAstrology, symbolsOf as astrologySymbolsOf,
  type Kb as AstrologyKb, type RuleKind as AstrologyRuleKind, type Topic as AstrologyTopic,
} from '@mystic/engine/astrology';
import type { AstrologyRuleDto, AstrologySourceDto, AstrologyVoice, NumerologyRuleDto, NumerologySourceDto, RuleDto, SourceKind } from '@mystic/engine/api';
import { DB, type Db } from '../db/db.js';
import { entries, passages, ruleTargets, rules, sources, symbols } from '../db/schema.js';

export interface NumerologyEntry { id: number; code: string; title: string; parent: string | null; page: number | null; ordinal: number; depth: number }
export interface NumerologyKnowledge {
  kb: NumerologyKb;
  version: string;
  /** every rule by code (inactive ones too, marked), as the API shows it */
  rules: Map<string, NumerologyRuleDto>;
  /** the numbers and arrows each rule's condition speaks of */
  symbols: Map<string, string[]>;
  /** passage id → the code of the rule it is */
  ruleOfPassage: Map<number, string>;
  entries: Map<string, NumerologyEntry>;
  /** entries in the book's order */
  order: NumerologyEntry[];
  source: NumerologySourceDto & { id: number };
}
const TOPIC_CODES = new Set<string>(TOPICS.map(t => t.code));
const RULE_KINDS = new Set(['rule', 'advice', 'child', 'general']);

/** Chiêm tinh: an entry of one of its sources (entry codes are unique within their source) */
export interface AstrologyEntry { id: number; key: string; source: string; code: string; title: string; parent: string | null; page: number | null; ordinal: number; depth: number }
export interface AstrologyKnowledge {
  kb: AstrologyKb;
  version: string;
  rules: Map<string, AstrologyRuleDto>;
  symbols: Map<string, string[]>;
  ruleOfPassage: Map<number, string>;
  /** the sources in the order a reading quotes them, each with who may read it */
  sources: (AstrologySourceDto & { id: number })[];
  /** entries by "source/code", in each source's order */
  entries: Map<string, AstrologyEntry>;
  order: AstrologyEntry[];
}
/** how a reading names whose words a passage is */
export const VOICE_LABEL: Record<AstrologyVoice, string> = { hk: 'Lời cô', tierney: 'Bản dịch Tierney', woolfolk: 'Woolfolk' };
const ASTROLOGY_TOPIC_CODES = new Set<string>(ASTROLOGY_TOPICS.map(t => t.code));
export const entryKey = (source: string, code: string) => `${source}/${code}`;

export interface Knowledge {
  kb: Kb;
  version: string;
  /** every active rule by code, as the API shows it */
  rules: Map<string, RuleDto>;
  sources: Record<string, { title: string; kind: SourceKind }>;
}

@Injectable()
export class KnowledgeService {
  private cache: Promise<Knowledge> | null = null;
  private numerologyCache: Promise<NumerologyKnowledge | null> | null = null;
  private astrologyCache: Promise<AstrologyKnowledge | null> | null = null;

  constructor(@Inject(DB) private readonly db: Db) {}

  invalidate(): void { this.cache = null; this.numerologyCache = null; this.astrologyCache = null; }

  get(): Promise<Knowledge> {
    this.cache ??= this.load().catch(e => { this.cache = null; throw e; });
    return this.cache;
  }

  /** Nhân số học: the book as the engine reads it — null while the book is not loaded */
  numerology(): Promise<NumerologyKnowledge | null> {
    this.numerologyCache ??= this.loadNumerology().catch(e => { this.numerologyCache = null; throw e; });
    return this.numerologyCache;
  }

  /** Chiêm tinh: every source as the engine reads it — null while none is loaded */
  astrology(): Promise<AstrologyKnowledge | null> {
    this.astrologyCache ??= this.loadAstrology().catch(e => { this.astrologyCache = null; throw e; });
    return this.astrologyCache;
  }

  private async loadAstrology(): Promise<AstrologyKnowledge | null> {
    const db = this.db;
    const srcs = await db.select().from(sources).where(eq(sources.disciplineCode, 'astrology')).orderBy(asc(sources.sortOrder));
    if (!srcs.length) return null;
    const srcById = new Map(srcs.map(x => [x.id, x]));
    const es = await db.select({ id: entries.id, sourceId: entries.sourceId, code: entries.code, title: entries.title, parentId: entries.parentId, page: entries.sourceRef, ordinal: entries.ordinal })
      .from(entries).where(inArray(entries.sourceId, srcs.map(x => x.id))).orderBy(asc(entries.sourceId), asc(entries.ordinal));
    const byId = new Map(es.map(e => [e.id, e]));
    const order: AstrologyEntry[] = es.map(e => {
      const src = srcById.get(e.sourceId)!.code, parent = e.parentId !== null ? byId.get(e.parentId)?.code ?? null : null;
      return { id: e.id, key: entryKey(src, e.code), source: src, code: e.code, title: e.title, parent, page: e.page, ordinal: e.ordinal, depth: 0 };
    });
    order.sort((a, b) => srcs.findIndex(x => x.code === a.source) - srcs.findIndex(x => x.code === b.source) || a.ordinal - b.ordinal);
    const byKey = new Map(order.map(e => [e.key, e]));
    for (const e of order) { let d = 0; for (let p = e.parent; p; p = byKey.get(entryKey(e.source, p))?.parent ?? null) d++; e.depth = d; }

    const rows = await db.select({
      id: rules.id, code: rules.code, sourceId: rules.sourceId, entryId: rules.entryId, passageId: rules.passageId, ordinal: rules.ordinal, ruleText: rules.text, when: rules.condition,
      active: rules.active, ruleEdited: rules.editedAt, text: passages.text, passageEdited: passages.editedAt, role: passages.role, page: passages.sourceRef,
      voice: passages.voice, label: passages.label, en: passages.sourceText, items: passages.items,
    }).from(rules).leftJoin(passages, eq(passages.id, rules.passageId)).where(eq(rules.disciplineCode, 'astrology')).orderBy(asc(rules.ordinal));
    const topicOf = new Map<number, string>();
    const ids = rows.map(r => r.id);
    for (let i = 0; i < ids.length; i += 5000) {
      const part = await db.select({ ruleId: ruleTargets.ruleId, target: ruleTargets.target }).from(ruleTargets).where(inArray(ruleTargets.ruleId, ids.slice(i, i + 5000)));
      for (const t of part) if (ASTROLOGY_TOPIC_CODES.has(t.target)) topicOf.set(t.ruleId, t.target);
    }
    const dtos = new Map<string, AstrologyRuleDto>(), syms = new Map<string, string[]>(), ruleOfPassage = new Map<number, string>();
    const raw: Parameters<typeof compileAstrology>[0] = [];
    const hash = createHash('sha256');
    for (const e of order) hash.update(`${e.key}|${e.title}|${e.parent ?? ''}\n`);
    for (const r of rows) {
      const topic = topicOf.get(r.id) as AstrologyTopic | undefined, e = byId.get(r.entryId), src = srcById.get(r.sourceId);
      if (!topic || !e || !src) continue;
      const kind = (r.role === 'general' ? 'general' : 'rule') as AstrologyRuleKind;
      const text = r.text ?? r.ruleText, when = r.when ?? '';
      const dto: AstrologyRuleDto = {
        code: r.code, source: src.code, voice: (r.voice ?? 'hk') as AstrologyVoice, text, en: r.en ?? null, label: r.label ?? null, items: r.items ?? null,
        page: r.page, kind, topic, entry: e.code, when, edited: !!(r.ruleEdited || r.passageEdited), active: r.active,
      };
      hash.update(`${r.code}|${text}|${when}|${r.active}|${topic}|${kind}|${e.code}\n`);
      dtos.set(r.code, dto);
      if (r.passageId !== null) ruleOfPassage.set(r.passageId, r.code);
      syms.set(r.code, when ? [...astrologySymbolsOf(parseAstrology(when).node)] : []);
      if (r.active && when) raw.push({ id: r.code, topic, entry: entryKey(src.code, e.code), ord: r.ordinal, page: r.page ?? undefined, source: src.code, kind, text, when });
    }
    const label = (code: string) => (code === 'astrology.tierney' ? VOICE_LABEL.tierney : code === 'astrology.woolfolk' ? VOICE_LABEL.woolfolk : VOICE_LABEL.hk);
    return {
      kb: { rules: compileAstrology(raw), entries: Object.fromEntries(order.map(e => [e.key, { code: e.key, title: e.title, parent: e.parent ? entryKey(e.source, e.parent) : undefined, ord: e.ordinal }])) },
      version: hash.digest('hex').slice(0, 16),
      rules: dtos, symbols: syms, ruleOfPassage, entries: byKey, order,
      sources: srcs.map(x => ({ id: x.id, code: x.code, title: x.title, author: x.author, description: x.description, note: x.note, label: label(x.code), translator: x.code === 'astrology.woolfolk' ? 'Claude' : null })),
    };
  }

  private async loadNumerology(): Promise<NumerologyKnowledge | null> {
    const db = this.db;
    const [src] = await db.select().from(sources).where(eq(sources.code, BOOK_SOURCE));
    if (!src) return null;
    const es = await db.select({ id: entries.id, code: entries.code, title: entries.title, parentId: entries.parentId, page: entries.sourceRef, ordinal: entries.ordinal })
      .from(entries).where(eq(entries.sourceId, src.id)).orderBy(asc(entries.ordinal));
    const codeOf = new Map(es.map(e => [e.id, e.code]));
    const order: NumerologyEntry[] = es.map(e => ({ id: e.id, code: e.code, title: e.title, parent: e.parentId !== null ? codeOf.get(e.parentId) ?? null : null, page: e.page, ordinal: e.ordinal, depth: 0 }));
    const byCode = new Map(order.map(e => [e.code, e]));
    for (const e of order) { let d = 0; for (let p = e.parent; p; p = byCode.get(p)?.parent ?? null) d++; e.depth = d; }

    const rows = await db.select({
      id: rules.id, code: rules.code, entryId: rules.entryId, passageId: rules.passageId, ordinal: rules.ordinal, ruleText: rules.text, when: rules.condition,
      active: rules.active, ruleEdited: rules.editedAt, text: passages.text, passageEdited: passages.editedAt, role: passages.role, page: passages.sourceRef,
    }).from(rules).leftJoin(passages, eq(passages.id, rules.passageId)).where(eq(rules.sourceId, src.id)).orderBy(asc(rules.ordinal));
    const topicOf = new Map<number, string>();
    const ids = rows.map(r => r.id);
    for (let i = 0; i < ids.length; i += 5000) {
      const part = await db.select({ ruleId: ruleTargets.ruleId, target: ruleTargets.target }).from(ruleTargets).where(inArray(ruleTargets.ruleId, ids.slice(i, i + 5000)));
      for (const t of part) if (TOPIC_CODES.has(t.target)) topicOf.set(t.ruleId, t.target);
    }

    const dtos = new Map<string, NumerologyRuleDto>(), syms = new Map<string, string[]>(), ruleOfPassage = new Map<number, string>();
    const raw: Parameters<typeof compileNumerology>[0] = [];
    const hash = createHash('sha256');
    for (const e of order) hash.update(`${e.code}|${e.title}|${e.parent ?? ''}\n`);
    for (const r of rows) {
      const topic = topicOf.get(r.id) as Topic | undefined, entry = codeOf.get(r.entryId);
      if (!topic || !entry) continue;
      const kind = (r.role && RULE_KINDS.has(r.role) ? r.role : 'rule') as RuleKind;
      const text = r.text ?? r.ruleText, when = r.when ?? '';
      const dto: NumerologyRuleDto = { code: r.code, text, page: r.page, kind, topic, entry, when, edited: !!(r.ruleEdited || r.passageEdited), active: r.active };
      hash.update(`${r.code}|${text}|${when}|${r.active}|${topic}|${kind}|${entry}\n`);
      dtos.set(r.code, dto);
      if (r.passageId !== null) ruleOfPassage.set(r.passageId, r.code);
      syms.set(r.code, when ? [...symbolsOf(parseNumerology(when).node)] : []);
      if (r.active && when) raw.push({ id: r.code, topic, entry, ord: r.ordinal, page: r.page ?? undefined, kind, text, when });
    }
    return {
      kb: { rules: compileNumerology(raw), entries: Object.fromEntries(order.map(e => [e.code, { code: e.code, title: e.title, parent: e.parent ?? undefined, ord: e.ordinal }])) },
      version: hash.digest('hex').slice(0, 16),
      rules: dtos, symbols: syms, ruleOfPassage, entries: byCode, order,
      source: { id: src.id, code: src.code, title: src.title, author: src.author, description: src.description, note: src.note },
    };
  }

  private async load(): Promise<Knowledge> {
    const db = this.db;
    const srcRows = await db.select({ id: sources.id, code: sources.code, title: sources.title, kind: sources.kind }).from(sources).where(eq(sources.disciplineCode, 'tuvi'));
    const srcById = new Map(srcRows.map(s => [s.id, s]));
    const rows = await db.select({
      id: rules.id, code: rules.code, sourceId: rules.sourceId, text: rules.text, ctx: rules.context, when: rules.condition, tone: rules.tone,
      review: rules.reviewNote, active: rules.active, editedAt: rules.editedAt, ordinal: rules.ordinal,
      entryRef: entries.sourceRef, paraRef: passages.sourceRef, star: symbols.code,
    }).from(rules)
      .innerJoin(entries, eq(entries.id, rules.entryId))
      .leftJoin(passages, eq(passages.id, rules.passageId))
      .leftJoin(symbols, eq(symbols.id, rules.symbolId))
      .where(eq(rules.disciplineCode, 'tuvi'))
      .orderBy(asc(rules.ordinal));
    const targets = new Map<number, string[]>();
    const ids = rows.map(r => r.id);
    for (let i = 0; i < ids.length; i += 5000) {
      const part = await db.select({ ruleId: ruleTargets.ruleId, target: ruleTargets.target }).from(ruleTargets).where(inArray(ruleTargets.ruleId, ids.slice(i, i + 5000))).orderBy(asc(ruleTargets.ruleId), asc(ruleTargets.ordinal));
      for (const t of part) { const l = targets.get(t.ruleId) ?? []; l.push(t.target); targets.set(t.ruleId, l); }
    }

    const dtos = new Map<string, RuleDto>();
    const ba: Omit<Rule, 'node' | 'stars'>[] = [], bs: Omit<Rule, 'node' | 'stars'>[] = [];
    const hash = createHash('sha256');
    for (const r of rows) {
      const src = srcById.get(r.sourceId)!;
      const family = src.kind === 'family';
      const at = targets.get(r.id) ?? [];
      const dto: RuleDto = {
        code: r.code, source: family ? 'ba' : 'bo-sung', sourceCode: src.code, text: r.text, ctx: r.ctx, when: r.when, tone: r.tone as Tone,
        review: r.review, at, star: r.star, entryRef: family ? r.entryRef : null, paraRef: family ? r.paraRef : null, edited: !!r.editedAt, active: r.active,
      };
      hash.update(`${r.code}|${r.text}|${r.ctx ?? ''}|${r.when ?? ''}|${r.tone}|${r.active}|${at.join(',')}\n`);
      if (!r.active) continue;
      dtos.set(r.code, dto);
      const rule = {
        id: r.code, source: dto.source, sourceCode: src.code, entry: dto.entryRef ?? undefined, para: dto.paraRef ?? undefined, star: r.star ?? undefined,
        at, text: r.text, ctx: r.ctx ?? undefined, when: r.when ?? undefined, tone: r.tone as Tone, review: r.review ?? undefined,
      };
      (family ? ba : bs).push(rule);
    }

    // the supplement's notes: about each palace, the principles, about the stars grandma did not write about
    const supp = srcRows.find(s => s.kind === 'supplement');
    const notes = supp ? await db.select({ code: entries.code, title: entries.title, text: passages.text }).from(entries)
      .innerJoin(passages, and(eq(passages.entryId, entries.id), eq(passages.key, 'about')))
      .where(eq(entries.sourceId, supp.id)) : [];
    const palaceAbout: Record<string, string> = {}, principles: Record<string, Principle> = {}, starAbout: Record<string, string> = {};
    for (const n of notes) {
      hash.update(`${n.code}|${n.text}\n`);
      if (n.code.startsWith('palace.')) palaceAbout[n.code.slice(7)] = n.text;
      else if (n.code.startsWith('principle.')) { const id = n.code.slice(10); principles[id] = { id, title: n.title, text: n.text }; }
      else if (n.code.startsWith('symbol.')) starAbout[n.code.slice(7)] = n.text;
    }
    const family = srcRows.filter(s => s.kind === 'family').map(s => s.id);
    const names = family.length ? await db.select({ ref: entries.sourceRef, title: entries.title }).from(entries).where(and(inArray(entries.sourceId, family), like(entries.code, 'e%'))) : [];
    const entryName: Record<number, string> = {};
    for (const n of names) if (n.ref !== null) entryName[n.ref] = n.title;

    return {
      kb: { rules: compile(ba), supplement: compile(bs), palaceAbout, principles, starAbout, entryName },
      version: hash.digest('hex').slice(0, 16),
      rules: dtos,
      sources: Object.fromEntries(srcRows.map(s => [s.code, { title: s.title, kind: s.kind }])),
    };
  }
}
