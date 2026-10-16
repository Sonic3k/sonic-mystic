/* Loads the Tử vi bundle (kb/bundle/tuvi) into the database.
   Runs at start-up and does nothing when the bundle's version was imported before. When it runs it writes everything
   by its stable key, except what was edited in the database: an edited passage or rule keeps its text (only its
   original_text follows the bundle), and an edited rule is never removed. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { DISCIPLINES } from '@mystic/engine';
import { GROUPS, STARS, parse, starsOf, type Level } from '@mystic/engine/tuvi';
import { chunks, fold } from '../common/text.js';
import type { Db, DbExecutor } from '../db/db.js';
import {
  disciplines, entries, entrySymbols, entryTableRows, entryTables, imports, passages, ruleSymbols, ruleTargets, rules, sources,
  symbolAliases, symbolDignities, symbolGroupAliases, symbolGroupMembers, symbolGroups, symbols, variants,
} from '../db/schema.js';

interface BookPara { id: number; kind: string; sec: string[] | null; text: string }
interface BookEntry { star: string; stars?: string[]; name: string; line: number; paras: BookPara[] }
interface Book { source: { title: string; file: string; note: string }; preface: { id: number; text: string }[]; entries: BookEntry[] }
interface RawRule { i: string; e: number; p: number; at: string[]; t: string; o: string; c?: string; w?: string; r?: string }
interface Supplement {
  about: string;
  palaces: { palace: string; about: string }[];
  principles: { id: string; title: string; text: string }[];
  stars: { star: string; about: string; rules: { id: string; palaces: string[]; text: string; when: string; tone: string }[] }[];
}
interface Table { cols: string[]; rows: (string | number)[][] }
interface Phan1 {
  source: string; hoaGiap: Table;
  steps: { title: string; lines?: string[]; table?: Table; note?: string }[];
  triet: string[][];
  differences: { what: string; ba: string; sach: string }[];
}

export const SOURCE_CODES = { luan: 'tuvi.ba.luan', phan1: 'tuvi.ba.phan1', supplement: 'tuvi.bo-sung' } as const;

const DESCRIPTIONS: Record<string, string> = {
  tuvi: 'Tử vi đẩu số theo ghi chép của bà: lập lá số, luận từng cung, vận hạn.',
  astrology: 'Lá số chiêm tinh phương Tây theo giáo trình của cô Hương Kiều: hành tinh, dấu hiệu hoàng đạo, cung địa bàn, góc chiếu.',
  numerology: 'Những con số rút từ ngày sinh và họ tên.',
  iching: 'Sáu mươi tư quẻ Kinh Dịch.',
  tarot: 'Bảy mươi tám lá bài tarot.',
};

export interface ImportReport { skipped: boolean; version: string; written: number; keptEdited: number; removed: number; ms: number }

const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const now = sql`now()`;

/** every discipline the engine knows, so pages can list what is coming (a description edited here is kept) */
export async function upsertDisciplines(tx: DbExecutor): Promise<void> {
  await tx.insert(disciplines).values(DISCIPLINES.map((d, i) => ({ code: d.code, name: d.name, ready: d.ready, sortOrder: i, description: DESCRIPTIONS[d.code] ?? null })))
    .onConflictDoUpdate({ target: disciplines.code, set: { name: sql`excluded.name`, ready: sql`excluded.ready`, sortOrder: sql`excluded.sort_order`, description: sql`coalesce(${disciplines.description}, excluded.description)`, updatedAt: now } });
}

/** the bundle as files on disk */
export function readBundle(dir: string) {
  const d = join(dir, 'tuvi');
  const read = <T>(f: string) => JSON.parse(readFileSync(join(d, f), 'utf8')) as T;
  return {
    manifest: read<{ version: string; rules: number; entries: number }>('manifest.json'),
    book: read<Book>('book.json'),
    rules: read<{ rules: RawRule[] }>('rules.json').rules,
    supplement: read<Supplement>('supplement.json'),
    phan1: read<Phan1>('phan1.json'),
  };
}

export async function importTuvi(db: Db, bundleDir: string, opts: { force?: boolean } = {}): Promise<ImportReport> {
  const started = Date.now();
  const b = readBundle(bundleDir);
  const last = await db.select({ v: imports.bundleVersion }).from(imports).where(eq(imports.disciplineCode, 'tuvi')).orderBy(desc(imports.id)).limit(1);
  if (!opts.force && last[0]?.v === b.manifest.version) return { skipped: true, version: b.manifest.version, written: 0, keptEdited: 0, removed: 0, ms: Date.now() - started };

  const report = await db.transaction(async tx => {
    let written = 0;

    await upsertDisciplines(tx);

    // sources
    const src = await tx.insert(sources).values([
      { disciplineCode: 'tuvi', code: SOURCE_CODES.luan, title: b.book.source.title, author: 'Bà ngoại', kind: 'family' as const, sourceFile: b.book.source.file, note: b.book.source.note, sortOrder: 0,
        description: 'Bà viết dở năm 2011: phần mở đầu về an sao, tính hạn, rồi từng sao, luận ở từng cung.' },
      { disciplineCode: 'tuvi', code: SOURCE_CODES.phan1, title: 'Tử vi đẩu số — Phần I: Lập lá số tử vi', author: 'Bà ngoại', kind: 'family' as const, sourceFile: 'TT. so bo.doc', note: b.phan1.source, sortOrder: 1,
        description: 'Cách bà lập lá số: tìm Mệnh, Cục, âm dương, giờ, an Mệnh Thân, an Tử Vi và các chính tinh.' },
      { disciplineCode: 'tuvi', code: SOURCE_CODES.supplement, title: 'Bổ sung — kiến thức tử vi phổ thông', author: null, kind: 'supplement' as const, sourceFile: null, note: null, sortOrder: 9, description: b.supplement.about },
    ]).onConflictDoUpdate({ target: sources.code, set: { title: sql`excluded.title`, author: sql`excluded.author`, kind: sql`excluded.kind`, sourceFile: sql`excluded.source_file`, note: sql`excluded.note`, description: sql`excluded.description`, sortOrder: sql`excluded.sort_order`, updatedAt: now } })
      .returning({ id: sources.id, code: sources.code });
    const sourceId = Object.fromEntries(src.map(s => [s.code, s.id])) as Record<string, number>;
    const luan = sourceId[SOURCE_CODES.luan], phan1 = sourceId[SOURCE_CODES.phan1], supp = sourceId[SOURCE_CODES.supplement];

    // symbols: the engine's star catalogue
    const symRows = await tx.insert(symbols).values(STARS.map((s, i) => ({
      disciplineCode: 'tuvi', code: s.id, name: s.name, kind: s.kind, tone: s.tone ?? null, ring: s.ring ?? null,
      sourceId: s.source === 'bo-sung' ? supp : luan, sortOrder: i,
    }))).onConflictDoUpdate({ target: [symbols.disciplineCode, symbols.code], set: { name: sql`excluded.name`, kind: sql`excluded.kind`, tone: sql`excluded.tone`, ring: sql`excluded.ring`, sourceId: sql`excluded.source_id`, sortOrder: sql`excluded.sort_order`, updatedAt: now } })
      .returning({ id: symbols.id, code: symbols.code });
    const symbolId = Object.fromEntries(symRows.map(s => [s.code, s.id])) as Record<string, number>;
    const allSymbolIds = symRows.map(s => s.id);
    await tx.delete(symbolAliases).where(inArray(symbolAliases.symbolId, allSymbolIds));
    const aliasRows = STARS.flatMap(s => [...new Set(s.aliases ?? [])].map(alias => ({ symbolId: symbolId[s.id], alias })));
    if (aliasRows.length) await tx.insert(symbolAliases).values(aliasRows);
    await tx.delete(symbolDignities).where(inArray(symbolDignities.symbolId, allSymbolIds));
    const dignityRows = STARS.flatMap(s => (['M', 'V', 'D', 'B', 'H'] as Level[]).flatMap(level => (s.bright?.[level] ?? []).map(position => ({ symbolId: symbolId[s.id], position, level, sourceId: luan }))));
    if (dignityRows.length) await tx.insert(symbolDignities).values(dignityRows).onConflictDoNothing();
    const groupRows = await tx.insert(symbolGroups).values(GROUPS.map(g => ({ disciplineCode: 'tuvi', code: slug(g.name), name: g.name, mode: g.mode, minCount: g.min ?? null, note: g.note ?? null })))
      .onConflictDoUpdate({ target: [symbolGroups.disciplineCode, symbolGroups.code], set: { name: sql`excluded.name`, mode: sql`excluded.mode`, minCount: sql`excluded.min_count`, note: sql`excluded.note`, updatedAt: now } })
      .returning({ id: symbolGroups.id, code: symbolGroups.code });
    const groupId = Object.fromEntries(groupRows.map(g => [g.code, g.id])) as Record<string, number>;
    const allGroupIds = groupRows.map(g => g.id);
    await tx.delete(symbolGroupAliases).where(inArray(symbolGroupAliases.groupId, allGroupIds));
    await tx.delete(symbolGroupMembers).where(inArray(symbolGroupMembers.groupId, allGroupIds));
    const byName = new Map(STARS.map(s => [s.name, s.id]));
    const gAliases = GROUPS.flatMap(g => [...new Set(g.aliases ?? [])].map(alias => ({ groupId: groupId[slug(g.name)], alias })));
    if (gAliases.length) await tx.insert(symbolGroupAliases).values(gAliases);
    const gMembers = GROUPS.flatMap(g => g.stars.map((n, i) => ({ groupId: groupId[slug(g.name)], symbolId: symbolId[byName.get(n) ?? ''], ordinal: i }))).filter(m => m.symbolId);
    if (gMembers.length) await tx.insert(symbolGroupMembers).values(gMembers).onConflictDoNothing();

    // entries of the three sources
    type EntryRow = typeof entries.$inferInsert & { symbols?: string[] };
    const entryRows: EntryRow[] = [
      { sourceId: luan, code: 'preface', kind: 'preface', title: 'Mở đầu — an Tuần, trung tinh, các vòng sao, tính hạn', sourceRef: b.book.preface[0]?.id ?? null, ordinal: 0 },
      ...b.book.entries.map((e, i) => ({ sourceId: luan, code: `e${e.line}`, kind: 'symbol', title: e.name, sourceRef: e.line, ordinal: i + 1, symbols: e.stars ?? [e.star] })),
      { sourceId: phan1, code: 'hoa-giap', kind: 'table', title: 'Lục thập hoa giáp', sourceRef: null, ordinal: 0 },
      ...b.phan1.steps.map((s, i) => ({ sourceId: phan1, code: `step.${i + 1}`, kind: 'step', title: s.title, sourceRef: null, ordinal: i + 1 })),
      { sourceId: phan1, code: 'triet', kind: 'table', title: 'An Triệt Lộ', sourceRef: null, ordinal: b.phan1.steps.length + 1 },
      { sourceId: supp, code: 'about', kind: 'about', title: 'Lớp bổ sung là gì', sourceRef: null, ordinal: 0 },
      ...b.supplement.palaces.map((p, i) => ({ sourceId: supp, code: `palace.${p.palace}`, kind: 'palace', title: p.palace, sourceRef: null, ordinal: 10 + i })),
      ...b.supplement.principles.map((p, i) => ({ sourceId: supp, code: `principle.${p.id}`, kind: 'principle', title: p.title, sourceRef: null, ordinal: 100 + i })),
      ...b.supplement.stars.map((s, i) => ({ sourceId: supp, code: `symbol.${s.star}`, kind: 'symbol', title: STARS.find(x => x.id === s.star)?.name ?? s.star, sourceRef: null, ordinal: 200 + i, symbols: [s.star] })),
    ];
    const savedEntries = await tx.insert(entries).values(entryRows.map(({ symbols: _s, ...e }) => e))
      .onConflictDoUpdate({ target: [entries.sourceId, entries.code], set: { kind: sql`excluded.kind`, title: sql`excluded.title`, sourceRef: sql`excluded.source_ref`, ordinal: sql`excluded.ordinal`, updatedAt: now } })
      .returning({ id: entries.id, sourceId: entries.sourceId, code: entries.code });
    const entryId = new Map(savedEntries.map(e => [`${e.sourceId}:${e.code}`, e.id]));
    const eid = (source: number, code: string) => entryId.get(`${source}:${code}`)!;
    const allEntryIds = savedEntries.map(e => e.id);
    // the symbols each entry is about
    await tx.delete(entrySymbols).where(inArray(entrySymbols.entryId, allEntryIds));
    const esRows = entryRows.flatMap(e => (e.symbols ?? []).map((s, i) => ({ entryId: eid(e.sourceId, e.code), symbolId: symbolId[s], ordinal: i }))).filter(r => r.symbolId);
    if (esRows.length) await tx.insert(entrySymbols).values(esRows).onConflictDoNothing();

    // passages
    type PassageRow = typeof passages.$inferInsert;
    const pRows: PassageRow[] = [];
    const push = (entry: number, key: string, ordinal: number, kind: string, text: string, section: string | null = null, sourceRef: number | null = null) =>
      pRows.push({ entryId: entry, key, ordinal, kind, section, sourceRef, originalText: text, text, searchText: fold(text) });
    b.book.preface.forEach((l, i) => push(eid(luan, 'preface'), `p${l.id}`, i, 'line', l.text, null, l.id));
    for (const e of b.book.entries) e.paras.forEach((p, i) => push(eid(luan, `e${e.line}`), `p${p.id}`, i, p.kind, p.text, p.sec?.length ? p.sec.join(' · ') : null, p.id));
    b.phan1.steps.forEach((s, i) => {
      const id = eid(phan1, `step.${i + 1}`);
      (s.lines ?? []).forEach((l, k) => push(id, `l${k + 1}`, k, 'line', l));
      if (s.note) push(id, 'note', 1000, 'app_note', s.note);
    });
    push(eid(supp, 'about'), 'about', 0, 'about', b.supplement.about);
    for (const p of b.supplement.palaces) push(eid(supp, `palace.${p.palace}`), 'about', 0, 'about', p.about);
    for (const p of b.supplement.principles) push(eid(supp, `principle.${p.id}`), 'about', 0, 'about', p.text);
    for (const s of b.supplement.stars) push(eid(supp, `symbol.${s.star}`), 'about', 0, 'about', s.about);
    for (const part of chunks(pRows, 500)) {
      await tx.insert(passages).values(part).onConflictDoUpdate({
        target: [passages.entryId, passages.key],
        set: {
          ordinal: sql`excluded.ordinal`, kind: sql`excluded.kind`, section: sql`excluded.section`, sourceRef: sql`excluded.source_ref`,
          originalText: sql`excluded.original_text`,
          text: sql`case when ${passages.editedAt} is null then excluded.text else ${passages.text} end`,
          searchText: sql`case when ${passages.editedAt} is null then excluded.search_text else ${passages.searchText} end`,
          updatedAt: now,
        },
      });
    }
    written += pRows.length;
    const keptPassages = (await tx.select({ n: sql<number>`count(*)::int` }).from(passages).where(and(inArray(passages.entryId, allEntryIds), sql`${passages.editedAt} is not null`)))[0].n;
    const pIds = await tx.select({ id: passages.id, entryId: passages.entryId, key: passages.key }).from(passages).where(inArray(passages.entryId, allEntryIds));
    const passageId = new Map(pIds.map(p => [`${p.entryId}:${p.key}`, p.id]));

    // tables (Phần I)
    const tabled = [eid(phan1, 'hoa-giap'), eid(phan1, 'triet'), ...b.phan1.steps.map((_, i) => eid(phan1, `step.${i + 1}`))];
    await tx.delete(entryTables).where(inArray(entryTables.entryId, tabled));
    const addTable = async (entry: number, key: string, title: string | null, t: Table) => {
      const [row] = await tx.insert(entryTables).values({ entryId: entry, key, title, columns: t.cols.map(String) }).returning({ id: entryTables.id });
      if (t.rows.length) await tx.insert(entryTableRows).values(t.rows.map((r, i) => ({ tableId: row.id, ordinal: i, cells: r.map(c => String(c)) })));
    };
    await addTable(eid(phan1, 'hoa-giap'), 'table', 'Lục thập hoa giáp', b.phan1.hoaGiap);
    await addTable(eid(phan1, 'triet'), 'table', 'An Triệt Lộ', { cols: ['Tuổi (can)', 'Triệt ở giữa hai cung'], rows: b.phan1.triet });
    for (const [i, s] of b.phan1.steps.entries()) if (s.table) await addTable(eid(phan1, `step.${i + 1}`), 'table', null, s.table);

    // rules: grandma's, then the supplement's
    type RuleRow = typeof rules.$inferInsert & { at: string[] };
    const entryByLine = new Map(b.book.entries.map(e => [e.line, e]));
    const rRows: RuleRow[] = [];
    b.rules.forEach((r, i) => {
      const e = entryByLine.get(r.e)!, entry = eid(luan, `e${r.e}`);
      rRows.push({ disciplineCode: 'tuvi', code: r.i, sourceId: luan, entryId: entry, passageId: passageId.get(`${entry}:p${r.p}`) ?? null, symbolId: symbolId[e.star] ?? null,
        ordinal: i, originalText: r.t, text: r.t, context: r.c ?? null, condition: r.w ?? null, tone: r.o, reviewNote: r.r ?? null, at: r.at });
    });
    let k = 0;
    for (const s of b.supplement.stars) {
      const entry = eid(supp, `symbol.${s.star}`);
      for (const r of s.rules) rRows.push({ disciplineCode: 'tuvi', code: r.id, sourceId: supp, entryId: entry, passageId: null, symbolId: symbolId[s.star] ?? null,
        ordinal: 100_000 + k++, originalText: r.text, text: r.text, context: null, condition: r.when || null, tone: r.tone, reviewNote: null, at: r.palaces });
    }
    for (const part of chunks(rRows, 400)) {
      await tx.insert(rules).values(part.map(({ at: _a, ...r }) => r)).onConflictDoUpdate({
        target: rules.code,
        set: {
          sourceId: sql`excluded.source_id`, entryId: sql`excluded.entry_id`, passageId: sql`excluded.passage_id`, symbolId: sql`excluded.symbol_id`, ordinal: sql`excluded.ordinal`,
          originalText: sql`excluded.original_text`,
          text: sql`case when ${rules.editedAt} is null then excluded.text else ${rules.text} end`,
          context: sql`case when ${rules.editedAt} is null then excluded.context else ${rules.context} end`,
          condition: sql`case when ${rules.editedAt} is null then excluded.condition else ${rules.condition} end`,
          tone: sql`case when ${rules.editedAt} is null then excluded.tone else ${rules.tone} end`,
          reviewNote: sql`case when ${rules.editedAt} is null then excluded.review_note else ${rules.reviewNote} end`,
          updatedAt: now,
        },
      });
    }
    written += rRows.length;
    const codes = rRows.map(r => r.code);
    const removed = await tx.delete(rules).where(and(inArray(rules.sourceId, [luan, supp]), notInArray(rules.code, codes), isNull(rules.editedAt))).returning({ id: rules.id });
    const keptRules = (await tx.select({ n: sql<number>`count(*)::int` }).from(rules).where(and(inArray(rules.sourceId, [luan, supp]), sql`${rules.editedAt} is not null`)))[0].n;

    // where each rule is read, and the stars its condition speaks of
    const saved = await tx.select({ id: rules.id, code: rules.code, condition: rules.condition }).from(rules).where(inArray(rules.sourceId, [luan, supp]));
    const ruleId = new Map(saved.map(r => [r.code, r.id]));
    const savedIds = saved.map(r => r.id);
    for (const part of chunks(savedIds, 2000)) { await tx.delete(ruleTargets).where(inArray(ruleTargets.ruleId, part)); await tx.delete(ruleSymbols).where(inArray(ruleSymbols.ruleId, part)); }
    const tRows = rRows.flatMap(r => [...new Set(r.at)].map((target, i) => ({ ruleId: ruleId.get(r.code)!, target, ordinal: i }))).filter(t => t.ruleId);
    for (const part of chunks(tRows, 1000)) await tx.insert(ruleTargets).values(part).onConflictDoNothing();
    const sRows = saved.flatMap(r => {
      const p = r.condition ? parse(r.condition) : null;
      return [...starsOf(p?.node)].map(code => ({ ruleId: r.id, symbolId: symbolId[code] })).filter(x => x.symbolId);
    });
    for (const part of chunks(sRows, 1000)) await tx.insert(ruleSymbols).values(part).onConflictDoNothing();

    // where grandma differs from the books
    await tx.insert(variants).values(b.phan1.differences.map((d, i) => ({ disciplineCode: 'tuvi', code: slug(d.what), title: d.what, primaryText: d.ba, alternativeText: d.sach, primarySourceId: phan1, ordinal: i })))
      .onConflictDoUpdate({ target: [variants.disciplineCode, variants.code], set: { title: sql`excluded.title`, primaryText: sql`excluded.primary_text`, alternativeText: sql`excluded.alternative_text`, ordinal: sql`excluded.ordinal`, updatedAt: now } });

    const keptEdited = keptPassages + keptRules;
    await tx.insert(imports).values({ disciplineCode: 'tuvi', bundleVersion: b.manifest.version, written, keptEdited, removed: removed.length });
    return { written, keptEdited, removed: removed.length };
  });
  return { skipped: false, version: b.manifest.version, ...report, ms: Date.now() - started };
}

/** for tests: the executor type is shared */
export type { DbExecutor };
