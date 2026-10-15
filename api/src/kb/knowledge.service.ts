/* The knowledge the engine reads, built from the database and kept in memory until something is edited or imported.
   Grandma's rules become the engine's 'ba' rules; every other source (the supplement now, other books later) 'bo-sung'. */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, like } from 'drizzle-orm';
import { compile, type Kb, type Principle, type Rule, type Tone } from '@mystic/engine/tuvi';
import type { RuleDto, SourceKind } from '@mystic/engine/api';
import { DB, type Db } from '../db/db.js';
import { entries, passages, ruleTargets, rules, sources, symbols } from '../db/schema.js';

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

  constructor(@Inject(DB) private readonly db: Db) {}

  invalidate(): void { this.cache = null; }

  get(): Promise<Knowledge> {
    this.cache ??= this.load().catch(e => { this.cache = null; throw e; });
    return this.cache;
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
