/* The knowledge as something to read and search: sources, their entries paragraph by paragraph, the rules each
   paragraph became, the setup tables, and a few edits (rewording a passage or a rule keeps the imported text). */
import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { and, asc, count, eq, gt, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { CUC, STARS, findStar, parse, starsOf, tuViPosition, type Tone } from '@mystic/engine/tuvi';
import { parse as parseNumerology, symbolsOf as numerologySymbolsOf } from '@mystic/engine/numerology';
import type {
  CatalogDto, EntryDto, EntrySummaryDto, LookupResultDto, NumerologyRuleDto, PassageDto, RuleDto, SearchResultDto, SetupDto, SourceDto, SymbolDto, TableDto,
} from '@mystic/engine/api';
import { fold } from '../common/text.js';
import { DB, type Db } from '../db/db.js';
import {
  entries, entrySymbols, entryTableRows, entryTables, passages, ruleSymbols, ruleTargets, rules, sources,
  symbolAliases, symbolDignities, symbolGroupAliases, symbolGroupMembers, symbolGroups, symbols, variants,
} from '../db/schema.js';
import { SOURCE_CODES } from '../kb/importer.js';
import { KnowledgeService } from '../kb/knowledge.service.js';

const TONES = new Set(['cat', 'hung', 'trung', 'mixed']);
type SourceRow = typeof sources.$inferSelect;

@Injectable()
export class BooksService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  // ── sources ──

  async sources(discipline = 'tuvi'): Promise<SourceDto[]> {
    const rows = await this.db.select().from(sources).where(eq(sources.disciplineCode, discipline)).orderBy(asc(sources.sortOrder));
    return Promise.all(rows.map(s => this.sourceDto(s)));
  }

  private async sourceRow(code: string): Promise<SourceRow> {
    const [s] = await this.db.select().from(sources).where(eq(sources.code, code));
    if (!s) throw new NotFoundException(`Không có nguồn ${code}`);
    return s;
  }

  /** a source whose text the caller may read (a source marked for the owner answers a 401 to anyone else) */
  private async readable(code: string, owner: boolean): Promise<SourceRow> {
    const s = await this.sourceRow(code);
    if (s.access === 'owner' && !owner) throw new UnauthorizedException('Nguồn này chỉ chủ nhà đọc được (cần mã chủ nhà)');
    return s;
  }

  private async sourceDto(s: SourceRow): Promise<SourceDto> {
    const [e] = await this.db.select({ n: count() }).from(entries).where(eq(entries.sourceId, s.id));
    const [p] = await this.db.select({ n: count() }).from(passages).innerJoin(entries, eq(entries.id, passages.entryId)).where(eq(entries.sourceId, s.id));
    const [r] = await this.db.select({ n: count(), review: sql<number>`count(${rules.reviewNote})::int` }).from(rules).where(and(eq(rules.sourceId, s.id), eq(rules.active, true)));
    return {
      code: s.code, discipline: s.disciplineCode, title: s.title, author: s.author, kind: s.kind, description: s.description, note: s.note, sourceFile: s.sourceFile,
      access: s.access, entries: e.n, passages: p.n, rules: r.n, reviewNotes: r.review,
    };
  }

  /** the entries of a source in order, each with its symbols and how much it holds */
  async entries(code: string, owner = true): Promise<EntrySummaryDto[]> {
    const s = await this.readable(code, owner);
    const rows = await this.db.select().from(entries).where(eq(entries.sourceId, s.id)).orderBy(asc(entries.ordinal));
    if (!rows.length) return [];
    const ids = rows.map(e => e.id);
    const syms = await this.db.select({ entryId: entrySymbols.entryId, code: symbols.code }).from(entrySymbols).innerJoin(symbols, eq(symbols.id, entrySymbols.symbolId)).where(inArray(entrySymbols.entryId, ids)).orderBy(asc(entrySymbols.ordinal));
    const pc = await this.db.select({ entryId: passages.entryId, n: count() }).from(passages).where(inArray(passages.entryId, ids)).groupBy(passages.entryId);
    const rc = await this.db.select({ entryId: rules.entryId, n: count(), review: sql<number>`count(${rules.reviewNote})::int` }).from(rules).where(and(inArray(rules.entryId, ids), eq(rules.active, true))).groupBy(rules.entryId);
    const firsts = await this.db.select({ entryId: passages.entryId, kind: passages.kind, text: passages.text, ordinal: passages.ordinal }).from(passages).where(and(inArray(passages.entryId, ids), lt(passages.ordinal, 8))).orderBy(asc(passages.entryId), asc(passages.ordinal));
    const first = new Map<number, string>();
    for (const p of firsts) {
      const trait = /^[-*•+]?\s*Tính cách\s*[:-]?\s*/i;
      if (trait.test(p.text)) first.set(p.entryId, p.text.replace(trait, ''));
      else if (!first.has(p.entryId) && p.kind !== 'meta') first.set(p.entryId, p.text.replace(/^[-*•+]\s*/, ''));
    }
    const symOf = new Map<number, string[]>();
    for (const x of syms) { const l = symOf.get(x.entryId) ?? []; l.push(x.code); symOf.set(x.entryId, l); }
    const pn = new Map(pc.map(x => [x.entryId, x.n])), rn = new Map(rc.map(x => [x.entryId, x]));
    const codeOf = new Map(rows.map(e => [e.id, e.code]));
    return rows.map(e => ({
      id: e.id, code: e.code, ref: e.sourceRef, kind: e.kind, title: e.title, symbols: symOf.get(e.id) ?? [], parent: e.parentId !== null ? codeOf.get(e.parentId) ?? null : null,
      passages: pn.get(e.id) ?? 0, rules: rn.get(e.id)?.n ?? 0, reviewNotes: rn.get(e.id)?.review ?? 0, firstLine: first.get(e.id) ?? null,
    }));
  }

  /** one entry, found by its line in the source (grandma's book) or by its code */
  async entry(code: string, key: string, owner = true): Promise<EntryDto> {
    const s = await this.readable(code, owner);
    const where = /^\d+$/.test(key) ? and(eq(entries.sourceId, s.id), eq(entries.sourceRef, Number(key))) : and(eq(entries.sourceId, s.id), eq(entries.code, key));
    const [e] = await this.db.select().from(entries).where(where).orderBy(asc(entries.ordinal)).limit(1);
    if (!e) throw new NotFoundException('Không có mục này');
    const k = await this.knowledge.get();
    const ps = await this.db.select().from(passages).where(eq(passages.entryId, e.id)).orderBy(asc(passages.ordinal));
    const rs = await this.db.select({ code: rules.code, passageId: rules.passageId }).from(rules).where(and(eq(rules.entryId, e.id), eq(rules.active, true))).orderBy(asc(rules.ordinal));
    const byPassage = new Map<number, RuleDto[]>();
    for (const r of rs) { const d = k.rules.get(r.code); if (!d || r.passageId === null) continue; const l = byPassage.get(r.passageId) ?? []; l.push(d); byPassage.set(r.passageId, l); }
    const passagesOut: PassageDto[] = ps.map(p => ({
      id: p.id, key: p.key, kind: p.kind, section: p.section, ref: p.sourceRef, text: p.text,
      originalText: p.editedAt ? p.originalText : null, rules: byPassage.get(p.id) ?? [],
    }));
    const symCodes = (await this.db.select({ code: symbols.code }).from(entrySymbols).innerJoin(symbols, eq(symbols.id, entrySymbols.symbolId)).where(eq(entrySymbols.entryId, e.id)).orderBy(asc(entrySymbols.ordinal))).map(x => x.code);
    const symbolDtos = await this.symbolDtos(s.disciplineCode, symCodes);
    // the supplement about the same stars (only shown beside a family source, never mixed into it)
    let supplement: EntryDto['supplement'] = [];
    if (s.kind === 'family' && symCodes.length) {
      supplement = symCodes.map(c => ({
        symbol: c, name: STARS.find(x => x.id === c)?.name ?? c, about: k.kb.starAbout[c] ?? null,
        rules: [...k.rules.values()].filter(r => r.source === 'bo-sung' && r.star === c),
      })).filter(x => x.about || x.rules.length);
    }
    const [prev] = await this.db.select({ ref: entries.sourceRef, code: entries.code, title: entries.title }).from(entries).where(and(eq(entries.sourceId, s.id), lt(entries.ordinal, e.ordinal))).orderBy(sql`${entries.ordinal} desc`).limit(1);
    const [next] = await this.db.select({ ref: entries.sourceRef, code: entries.code, title: entries.title }).from(entries).where(and(eq(entries.sourceId, s.id), gt(entries.ordinal, e.ordinal))).orderBy(asc(entries.ordinal)).limit(1);
    return {
      id: e.id, code: e.code, ref: e.sourceRef, kind: e.kind, title: e.title, ordinal: e.ordinal, source: await this.sourceDto(s),
      symbols: symbolDtos, passages: passagesOut, tables: await this.tables([e.id]), supplement, prev: prev ?? null, next: next ?? null,
    };
  }

  private async tables(entryIds: number[]): Promise<TableDto[]> {
    if (!entryIds.length) return [];
    const ts = await this.db.select().from(entryTables).where(inArray(entryTables.entryId, entryIds)).orderBy(asc(entryTables.ordinal));
    if (!ts.length) return [];
    const rows = await this.db.select().from(entryTableRows).where(inArray(entryTableRows.tableId, ts.map(t => t.id))).orderBy(asc(entryTableRows.tableId), asc(entryTableRows.ordinal));
    return ts.map(t => ({ key: t.key, title: t.title, columns: t.columns, rows: rows.filter(r => r.tableId === t.id).map(r => r.cells) }));
  }

  private async symbolDtos(discipline: string, codes: string[]): Promise<SymbolDto[]> {
    if (!codes.length) return [];
    const rows = await this.db.select({ s: symbols, sourceCode: sources.code }).from(symbols).leftJoin(sources, eq(sources.id, symbols.sourceId)).where(and(eq(symbols.disciplineCode, discipline), inArray(symbols.code, codes)));
    const ids = rows.map(r => r.s.id);
    const al = ids.length ? await this.db.select().from(symbolAliases).where(inArray(symbolAliases.symbolId, ids)) : [];
    const dg = ids.length ? await this.db.select().from(symbolDignities).where(inArray(symbolDignities.symbolId, ids)) : [];
    const out = rows.map(({ s, sourceCode }) => {
      const dignities: Record<string, string[]> = {};
      for (const d of dg.filter(x => x.symbolId === s.id)) (dignities[d.level] ??= []).push(d.position);
      return { code: s.code, name: s.name, kind: s.kind, tone: s.tone, ring: s.ring, description: s.description, aliases: al.filter(a => a.symbolId === s.id).map(a => a.alias), dignities, sourceCode };
    });
    return codes.map(c => out.find(o => o.code === c)).filter((x): x is SymbolDto => !!x);
  }

  // ── tra cứu ──

  async search(q: string, discipline = 'tuvi', limit = 120, owner = true): Promise<SearchResultDto> {
    const needle = fold(q);
    if (needle.length < 2) return { query: q, total: 0, hits: [] };
    const pattern = `%${needle.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    const where = and(eq(sources.disciplineCode, discipline), sql`${passages.searchText} like ${pattern}`, owner ? undefined : eq(sources.access, 'public'));
    const [{ n }] = await this.db.select({ n: count() }).from(passages).innerJoin(entries, eq(entries.id, passages.entryId)).innerJoin(sources, eq(sources.id, entries.sourceId)).where(where);
    const rows = await this.db.select({
      passageId: passages.id, passageRef: passages.sourceRef, sourceCode: sources.code, sourceKind: sources.kind, entryRef: entries.sourceRef, entryCode: entries.code, entryTitle: entries.title, section: passages.section, text: passages.text,
    }).from(passages).innerJoin(entries, eq(entries.id, passages.entryId)).innerJoin(sources, eq(sources.id, entries.sourceId))
      .where(where).orderBy(asc(sources.sortOrder), asc(entries.ordinal), asc(passages.ordinal)).limit(Math.min(Math.max(limit, 1), 500));
    return { query: q, total: n, hits: rows };
  }

  /** every rule whose condition speaks of all the given stars, optionally read at one palace */
  async lookup(stars: string[], target?: string): Promise<LookupResultDto> {
    const codes = [...new Set(stars.map(s => findStar(s)?.id ?? s))];
    if (!codes.length) return { total: 0, rules: [], entryTitles: {} };
    const syms = await this.db.select({ id: symbols.id }).from(symbols).where(and(eq(symbols.disciplineCode, 'tuvi'), inArray(symbols.code, codes)));
    if (syms.length !== codes.length) return { total: 0, rules: [], entryTitles: {} };
    const matching = this.db.select({ ruleId: ruleSymbols.ruleId }).from(ruleSymbols).where(inArray(ruleSymbols.symbolId, syms.map(s => s.id)))
      .groupBy(ruleSymbols.ruleId).having(sql`count(*) = ${codes.length}`);
    const conds = [inArray(rules.id, matching), eq(rules.active, true)];
    if (target) conds.push(inArray(rules.id, this.db.select({ id: ruleTargets.ruleId }).from(ruleTargets).where(inArray(ruleTargets.target, [target, '*']))));
    const rows = await this.db.select({ code: rules.code }).from(rules).where(and(...conds)).orderBy(asc(rules.ordinal)).limit(400);
    const k = await this.knowledge.get();
    const list = rows.map(r => k.rules.get(r.code)).filter((r): r is RuleDto => !!r);
    const entryTitles: Record<string, string> = {};
    for (const r of list) if (r.entryRef !== null) entryTitles[r.entryRef] = k.kb.entryName[r.entryRef] ?? '';
    return { total: list.length, rules: list, entryTitles };
  }

  // ── Phần I and the catalogue ──

  async setup(): Promise<SetupDto> {
    const s = await this.sourceRow(SOURCE_CODES.phan1);
    const es = await this.db.select().from(entries).where(eq(entries.sourceId, s.id)).orderBy(asc(entries.ordinal));
    const ps = await this.db.select().from(passages).where(inArray(passages.entryId, es.map(e => e.id))).orderBy(asc(passages.entryId), asc(passages.ordinal));
    const tables = new Map<number, TableDto>();
    for (const e of es) { const [t] = await this.tables([e.id]); if (t) tables.set(e.id, t); }
    const luan = await this.sourceRow(SOURCE_CODES.luan);
    const [pre] = await this.db.select({ id: entries.id }).from(entries).where(and(eq(entries.sourceId, luan.id), eq(entries.code, 'preface')));
    const preface = pre ? (await this.db.select({ text: passages.text }).from(passages).where(eq(passages.entryId, pre.id)).orderBy(asc(passages.ordinal))).map(p => p.text) : [];
    const vs = await this.db.select().from(variants).where(eq(variants.disciplineCode, 'tuvi')).orderBy(asc(variants.ordinal));
    const byCode = (c: string) => es.find(e => e.code === c);
    return {
      source: await this.sourceDto(s), note: s.note,
      steps: es.filter(e => e.kind === 'step').map(e => ({
        code: e.code, title: e.title,
        lines: ps.filter(p => p.entryId === e.id && p.kind === 'line').map(p => p.text),
        appNote: ps.find(p => p.entryId === e.id && p.kind === 'app_note')?.text ?? null,
        table: tables.get(e.id) ?? null,
      })),
      hoaGiap: tables.get(byCode('hoa-giap')?.id ?? -1) ?? null,
      triet: tables.get(byCode('triet')?.id ?? -1) ?? null,
      preface,
      variants: vs.map(v => ({ code: v.code, title: v.title, primaryText: v.primaryText, alternativeText: v.alternativeText })),
      tuViTable: Object.values(CUC).sort((a, b) => a.n - b.n).map(c => {
        const days: number[][] = Array.from({ length: 12 }, () => []);
        for (let d = 1; d <= 30; d++) days[tuViPosition(c.n, d)].push(d);
        return { cuc: c.n, name: c.name, days };
      }),
    };
  }

  async catalog(): Promise<CatalogDto> {
    const luan = await this.sourceRow(SOURCE_CODES.luan);
    const withEntry = new Set((await this.db.select({ code: symbols.code }).from(entrySymbols).innerJoin(symbols, eq(symbols.id, entrySymbols.symbolId)).innerJoin(entries, eq(entries.id, entrySymbols.entryId)).where(eq(entries.sourceId, luan.id))).map(x => x.code));
    const groups = await this.db.select().from(symbolGroups).where(eq(symbolGroups.disciplineCode, 'tuvi')).orderBy(asc(symbolGroups.id));
    const members = await this.db.select({ groupId: symbolGroupMembers.groupId, code: symbols.code, ordinal: symbolGroupMembers.ordinal }).from(symbolGroupMembers).innerJoin(symbols, eq(symbols.id, symbolGroupMembers.symbolId)).orderBy(asc(symbolGroupMembers.ordinal));
    const gAliases = await this.db.select().from(symbolGroupAliases);
    return {
      stars: STARS.map(s => ({ code: s.id, name: s.name, kind: s.kind, tone: s.tone ?? null, ring: s.ring ?? null, aliases: s.aliases ?? [], hasEntry: withEntry.has(s.id) })),
      groups: groups.map(g => ({ code: g.code, name: g.name, mode: g.mode, aliases: gAliases.filter(a => a.groupId === g.id).map(a => a.alias), stars: members.filter(m => m.groupId === g.id).map(m => m.code) })),
    };
  }

  // ── edits (the imported text is kept in original_text; a later import never overwrites them) ──

  async editPassage(id: number, text: string): Promise<PassageDto> {
    const t = text?.trim();
    if (!t) throw new BadRequestException('Đoạn văn không được để trống');
    const [old] = await this.db.select({ originalText: passages.originalText }).from(passages).where(eq(passages.id, id));
    if (!old) throw new NotFoundException('Không có đoạn này');
    // writing the imported text back undoes the edit
    const [p] = await this.db.update(passages).set({ text: t, searchText: fold(t), editedAt: t === old.originalText ? null : new Date() }).where(eq(passages.id, id)).returning();
    this.knowledge.invalidate();
    return { id: p.id, key: p.key, kind: p.kind, section: p.section, ref: p.sourceRef, text: p.text, originalText: p.editedAt ? p.originalText : null, rules: [] };
  }

  async editRule(code: string, patch: { text?: string; context?: string | null; condition?: string | null; tone?: string; active?: boolean; reviewNote?: string | null }): Promise<RuleDto | NumerologyRuleDto> {
    const [r] = await this.db.select().from(rules).where(eq(rules.code, code));
    if (!r) throw new NotFoundException(`Không có câu ${code}`);
    if (r.disciplineCode === 'numerology') return this.editNumerologyRule(r, patch);
    const set: Partial<typeof rules.$inferInsert> = { editedAt: new Date() };
    if (patch.text !== undefined) { const t = patch.text.trim(); if (!t) throw new BadRequestException('Câu luận không được để trống'); set.text = t; }
    if (patch.context !== undefined) set.context = patch.context?.trim() || null;
    if (patch.tone !== undefined) { if (!TONES.has(patch.tone)) throw new BadRequestException('Tính chất phải là cat, hung, trung hoặc mixed'); set.tone = patch.tone as Tone; }
    if (patch.active !== undefined) set.active = !!patch.active;
    if (patch.reviewNote !== undefined) set.reviewNote = patch.reviewNote?.trim() || null;
    if (patch.condition !== undefined) {
      const c = patch.condition?.trim() || null;
      if (c) { const p = parse(c); if (!p.node) throw new BadRequestException(`Điều kiện chưa đúng: ${p.errors.join('; ')}`); }
      set.condition = c;
    }
    await this.db.transaction(async tx => {
      await tx.update(rules).set(set).where(eq(rules.id, r.id));
      if (set.condition !== undefined) {
        await tx.delete(ruleSymbols).where(eq(ruleSymbols.ruleId, r.id));
        const ids = set.condition ? [...starsOf(parse(set.condition).node)] : [];
        if (ids.length) {
          const syms = await tx.select({ id: symbols.id }).from(symbols).where(and(eq(symbols.disciplineCode, r.disciplineCode), inArray(symbols.code, ids)));
          if (syms.length) await tx.insert(ruleSymbols).values(syms.map(s => ({ ruleId: r.id, symbolId: s.id })));
        }
      }
    });
    this.knowledge.invalidate();
    const k = await this.knowledge.get();
    const dto = k.rules.get(code);
    if (dto) return dto;
    const [after] = await this.db.select().from(rules).where(eq(rules.id, r.id));
    return { code, source: 'ba', sourceCode: '', text: after.text, ctx: after.context, when: after.condition, tone: after.tone as Tone, review: after.reviewNote, at: [], star: null, entryRef: null, paraRef: null, edited: true, active: after.active };
  }

  /** a rule of the numerology book: its condition (checked with the book's condition language), whether it is read,
      a review note. Its text is its paragraph's — reword the passage instead. */
  private async editNumerologyRule(r: typeof rules.$inferSelect, patch: { text?: string; condition?: string | null; active?: boolean; reviewNote?: string | null }): Promise<NumerologyRuleDto> {
    if (patch.text !== undefined) throw new BadRequestException('Câu của sách là chính đoạn văn: sửa đoạn văn thay vì sửa câu');
    const set: Partial<typeof rules.$inferInsert> = { editedAt: new Date() };
    if (patch.active !== undefined) set.active = !!patch.active;
    if (patch.reviewNote !== undefined) set.reviewNote = patch.reviewNote?.trim() || null;
    if (patch.condition !== undefined) {
      const c = patch.condition?.trim();
      if (!c) throw new BadRequestException('Câu của sách cần một điều kiện');
      const p = parseNumerology(c);
      if (!p.node) throw new BadRequestException(`Điều kiện chưa đúng: ${p.errors.join('; ')}`);
      set.condition = c;
    }
    await this.db.transaction(async tx => {
      await tx.update(rules).set(set).where(eq(rules.id, r.id));
      if (set.condition !== undefined) {
        await tx.delete(ruleSymbols).where(eq(ruleSymbols.ruleId, r.id));
        const codes = [...numerologySymbolsOf(parseNumerology(set.condition!).node)];
        if (codes.length) {
          const syms = await tx.select({ id: symbols.id }).from(symbols).where(and(eq(symbols.disciplineCode, 'numerology'), inArray(symbols.code, codes)));
          if (syms.length) await tx.insert(ruleSymbols).values(syms.map(s => ({ ruleId: r.id, symbolId: s.id })));
        }
      }
    });
    this.knowledge.invalidate();
    const dto = (await this.knowledge.numerology())?.rules.get(r.code);
    if (!dto) throw new NotFoundException(`Không có câu ${r.code}`);
    return dto;
  }

  async editSymbol(discipline: string, code: string, description: string | null): Promise<SymbolDto> {
    const [s] = await this.db.update(symbols).set({ description: description?.trim() || null }).where(and(eq(symbols.disciplineCode, discipline), eq(symbols.code, code))).returning();
    if (!s) throw new NotFoundException('Không có sao này');
    return (await this.symbolDtos(discipline, [code]))[0];
  }

  /** how many rows were reworded in the database (shown on the about page) */
  async editedCounts(): Promise<{ passages: number; rules: number }> {
    const [p] = await this.db.select({ n: count() }).from(passages).where(isNotNull(passages.editedAt));
    const [r] = await this.db.select({ n: count() }).from(rules).where(isNotNull(rules.editedAt));
    return { passages: p.n, rules: r.n };
  }
}
