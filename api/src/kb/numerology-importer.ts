/* Loads the Nhân số học bundle — Lê Đỗ Quỳnh Hương's book mapped paragraph by paragraph — into the database. The
   book's text is not kept in the repository, so the bundle comes from disk (kb/bundle/numerology, built where the
   book is) or is uploaded (PUT /api/numerology/bundle); with neither, nothing is imported and the pages say the book is not loaded.
   As with Tử vi, everything is written by its stable key and what was edited in the database is kept: an edited
   passage keeps its text, an edited rule its condition, and neither is removed when the book no longer has it. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { BOOK_SOURCE, TOPICS, parse, symbolCatalogue, symbolsOf, type NumerologyBundle } from '@mystic/engine/numerology';
import { chunks, fold } from '../common/text.js';
import type { Db } from '../db/db.js';
import { entries, entrySymbols, entryTableRows, entryTables, imports, passages, ruleSymbols, ruleTargets, rules, sources, symbols } from '../db/schema.js';
import { upsertDisciplines, type ImportReport } from './importer.js';

const TOPIC = z.enum(TOPICS.map(t => t.code) as [string, ...string[]]);
const KIND = z.enum(['rule', 'advice', 'child', 'general']);
const BundleSchema = z.object({
  manifest: z.object({ discipline: z.literal('numerology'), version: z.string().min(4), entries: z.number().int(), passages: z.number().int(), rules: z.number().int(), built: z.string() }),
  book: z.object({
    source: z.object({ code: z.literal(BOOK_SOURCE), title: z.string().min(1), author: z.string(), basedOn: z.string().optional(), publisher: z.string().optional(), file: z.string().optional(), note: z.string().optional() }),
    entries: z.array(z.object({
      code: z.string().min(1), title: z.string(), parent: z.string().nullable(), kind: z.enum(['part', 'section']), page: z.number().int(), at: z.number().int(),
      topic: TOPIC.nullable(), symbols: z.array(z.string()),
      paras: z.array(z.object({
        id: z.number().int(), kind: z.string(), role: z.enum(['rule', 'advice', 'child', 'general', 'method', 'example', 'figure', 'note']),
        page: z.number().int(), pages: z.array(z.number().int()).optional(), text: z.string(),
      })),
    })).min(1),
  }),
  rules: z.array(z.object({ i: z.string(), e: z.string(), p: z.number().int(), pg: z.number().int(), t: z.string(), w: z.string(), k: KIND, tp: TOPIC, o: z.number().int(), s: z.array(z.string()) })),
  tables: z.object({ about: z.string().optional(), tables: z.array(z.object({ entry: z.string(), key: z.string(), title: z.string().nullable(), columns: z.array(z.string()), rows: z.array(z.array(z.string())) })) }),
});

export class BundleError extends Error {}

/** a bundle as it was given (from disk or uploaded), checked whole before anything is written */
export function checkNumerologyBundle(raw: unknown): NumerologyBundle {
  const r = BundleSchema.safeParse(raw);
  if (!r.success) throw new BundleError(`Gói sách không đúng cấu trúc: ${r.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const b = r.data as NumerologyBundle;
  const errors: string[] = [];
  const codes = new Set<string>(), paras = new Map<number, { entry: string; text: string }>();
  for (const e of b.book.entries) {
    if (codes.has(e.code)) errors.push(`mục trùng mã ${e.code}`);
    codes.add(e.code);
    for (const p of e.paras) { if (paras.has(p.id)) errors.push(`đoạn ${p.id} xuất hiện hai lần`); paras.set(p.id, { entry: e.code, text: p.text }); }
  }
  for (const e of b.book.entries) if (e.parent && !codes.has(e.parent)) errors.push(`${e.code}: không có mục cha ${e.parent}`);
  const ruleCodes = new Set<string>();
  for (const x of b.rules) {
    if (ruleCodes.has(x.i)) errors.push(`câu trùng mã ${x.i}`);
    ruleCodes.add(x.i);
    const p = paras.get(x.p);
    if (!p || p.entry !== x.e) errors.push(`${x.i}: không có đoạn ${x.p} trong mục ${x.e}`);
    else if (p.text !== x.t) errors.push(`${x.i}: chữ khác với đoạn ${x.p}`);
    const parsed = parse(x.w);
    if (parsed.errors.length) errors.push(`${x.i}: điều kiện lỗi — ${parsed.errors.join('; ')}`);
  }
  for (const t of b.tables.tables) if (!codes.has(t.entry)) errors.push(`bảng ${t.key}: không có mục ${t.entry}`);
  if (b.manifest.entries !== b.book.entries.length || b.manifest.rules !== b.rules.length || b.manifest.passages !== paras.size) errors.push('manifest không khớp với nội dung');
  if (errors.length) throw new BundleError(`Gói sách có lỗi: ${errors.slice(0, 8).join('; ')}${errors.length > 8 ? ` (và ${errors.length - 8} lỗi khác)` : ''}`);
  return b;
}

/** the bundle as files on disk (null when it is not there: the book is then loaded by upload) */
export function readNumerologyBundle(dir: string): NumerologyBundle | null {
  if (!existsSync(join(dir, 'manifest.json'))) return null;
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  return checkNumerologyBundle({ manifest: read('manifest.json'), book: read('book.json'), rules: read('rules.json').rules, tables: read('tables.json') });
}

const now = sql`now()`;
const keyOf = (paraId: number) => `b${paraId}`;

export async function importNumerology(db: Db, raw: NumerologyBundle, opts: { force?: boolean } = {}): Promise<ImportReport> {
  const started = Date.now();
  const b = checkNumerologyBundle(raw);
  const last = await db.select({ v: imports.bundleVersion }).from(imports).where(eq(imports.disciplineCode, 'numerology')).orderBy(desc(imports.id)).limit(1);
  if (!opts.force && last[0]?.v === b.manifest.version) return { skipped: true, version: b.manifest.version, written: 0, keptEdited: 0, removed: 0, ms: Date.now() - started };

  const report = await db.transaction(async tx => {
    await upsertDisciplines(tx);
    const s = b.book.source;
    const [src] = await tx.insert(sources).values({
      disciplineCode: 'numerology', code: s.code, title: s.title, author: s.author, kind: 'book', sourceFile: s.file ?? null, note: s.note ?? null, sortOrder: 0,
      description: [s.basedOn ? `Dựa trên ${s.basedOn}` : null, s.publisher ?? null].filter(Boolean).join(' · ') || null,
    }).onConflictDoUpdate({ target: sources.code, set: { title: sql`excluded.title`, author: sql`excluded.author`, kind: sql`excluded.kind`, sourceFile: sql`excluded.source_file`, note: sql`excluded.note`, description: sql`excluded.description`, updatedAt: now } })
      .returning({ id: sources.id });
    const sourceId = src.id;

    // symbols: the book's numbers and arrows
    const cat = symbolCatalogue();
    const symRows = await tx.insert(symbols).values(cat.map((c, i) => ({ disciplineCode: 'numerology', code: c.code, name: c.name, kind: c.kind, sourceId, sortOrder: i })))
      .onConflictDoUpdate({ target: [symbols.disciplineCode, symbols.code], set: { name: sql`excluded.name`, kind: sql`excluded.kind`, sourceId: sql`excluded.source_id`, sortOrder: sql`excluded.sort_order`, updatedAt: now } })
      .returning({ id: symbols.id, code: symbols.code });
    await tx.delete(symbols).where(and(eq(symbols.disciplineCode, 'numerology'), notInArray(symbols.code, cat.map(c => c.code))));
    const symbolId = new Map(symRows.map(x => [x.code, x.id]));

    // entries (one per heading of the book), then where each sits
    const savedEntries = await tx.insert(entries).values(b.book.entries.map((e, i) => ({ sourceId, code: e.code, kind: e.kind, title: e.title, sourceRef: e.page, ordinal: i })))
      .onConflictDoUpdate({ target: [entries.sourceId, entries.code], set: { kind: sql`excluded.kind`, title: sql`excluded.title`, sourceRef: sql`excluded.source_ref`, ordinal: sql`excluded.ordinal`, updatedAt: now } })
      .returning({ id: entries.id, code: entries.code });
    const entryId = new Map(savedEntries.map(e => [e.code, e.id]));
    const eid = (code: string) => entryId.get(code)!;
    for (const part of chunks(b.book.entries, 1000)) {
      const values = sql.join(part.map(e => sql`(${eid(e.code)}::int, ${e.parent ? eid(e.parent) : null}::int)`), sql`, `);
      await tx.execute(sql`update entries set parent_id = v.parent from (values ${values}) as v(id, parent) where entries.id = v.id and entries.parent_id is distinct from v.parent`);
    }

    // passages, keyed by their block of the book ("b412") — one the map moved to another entry follows it, edit and all
    const pRows = b.book.entries.flatMap(e => e.paras.map((p, i) => ({
      entryId: eid(e.code), key: keyOf(p.id), ordinal: i, kind: p.kind, role: p.role, section: null, sourceRef: p.page, originalText: p.text, text: p.text, searchText: fold(p.text),
    })));
    for (const part of chunks(pRows, 2000)) {
      const values = sql.join(part.map(r => sql`(${r.key}, ${r.entryId}::int)`), sql`, `);
      await tx.execute(sql`update passages set entry_id = v.entry_id from (values ${values}) as v(key, entry_id), entries e
        where passages.key = v.key and passages.entry_id = e.id and e.source_id = ${sourceId} and passages.entry_id <> v.entry_id`);
    }
    for (const part of chunks(pRows, 500)) {
      await tx.insert(passages).values(part).onConflictDoUpdate({
        target: [passages.entryId, passages.key],
        set: {
          ordinal: sql`excluded.ordinal`, kind: sql`excluded.kind`, role: sql`excluded.role`, section: sql`excluded.section`, sourceRef: sql`excluded.source_ref`,
          originalText: sql`excluded.original_text`,
          text: sql`case when ${passages.editedAt} is null then excluded.text else ${passages.text} end`,
          searchText: sql`case when ${passages.editedAt} is null then excluded.search_text else ${passages.searchText} end`,
          updatedAt: now,
        },
      });
    }

    // what the book no longer has: entries (unless they hold an edit) and passages (unless edited)
    let removed = 0;
    const stale = (await tx.select({ id: entries.id }).from(entries).where(and(eq(entries.sourceId, sourceId), notInArray(entries.code, [...entryId.keys()])))).map(x => x.id);
    if (stale.length) {
      const held = new Set([
        ...(await tx.selectDistinct({ id: passages.entryId }).from(passages).where(and(inArray(passages.entryId, stale), isNotNull(passages.editedAt)))).map(x => x.id),
        ...(await tx.selectDistinct({ id: rules.entryId }).from(rules).where(and(inArray(rules.entryId, stale), isNotNull(rules.editedAt)))).map(x => x.id),
      ]);
      const drop = stale.filter(id => !held.has(id));
      if (drop.length) removed += (await tx.delete(entries).where(inArray(entries.id, drop)).returning({ id: entries.id })).length;
    }
    const sourceEntryIds = (await tx.select({ id: entries.id }).from(entries).where(eq(entries.sourceId, sourceId))).map(x => x.id);
    removed += (await tx.delete(passages).where(and(inArray(passages.entryId, sourceEntryIds), notInArray(passages.key, pRows.map(r => r.key)), isNull(passages.editedAt))).returning({ id: passages.id })).length;
    const pIds = await tx.select({ id: passages.id, key: passages.key, editedAt: passages.editedAt }).from(passages).where(inArray(passages.entryId, sourceEntryIds));
    const passageId = new Map(pIds.map(p => [p.key, p.id]));
    const keptPassages = pIds.filter(p => p.editedAt).length;

    // the book's tables
    await tx.delete(entryTables).where(inArray(entryTables.entryId, sourceEntryIds));
    let tableRows = 0;
    for (const [i, t] of b.tables.tables.entries()) {
      const [row] = await tx.insert(entryTables).values({ entryId: eid(t.entry), key: t.key, ordinal: i, title: t.title, columns: t.columns }).returning({ id: entryTables.id });
      if (t.rows.length) await tx.insert(entryTableRows).values(t.rows.map((r, k) => ({ tableId: row.id, ordinal: k, cells: r.map(String) })));
      tableRows += t.rows.length;
    }

    // rules: every paragraph that speaks of a person, with its condition
    const firstSymbol = new Map(b.book.entries.map(e => [e.code, e.symbols[0] ? symbolId.get(e.symbols[0]) ?? null : null]));
    const rRows = b.rules.map(r => ({
      disciplineCode: 'numerology', code: r.i, sourceId, entryId: eid(r.e), passageId: passageId.get(keyOf(r.p)) ?? null, symbolId: firstSymbol.get(r.e) ?? null,
      ordinal: r.o, originalText: r.t, text: r.t, context: null, condition: r.w, tone: 'trung', reviewNote: null,
    }));
    for (const part of chunks(rRows, 400)) {
      await tx.insert(rules).values(part).onConflictDoUpdate({
        target: rules.code,
        set: {
          sourceId: sql`excluded.source_id`, entryId: sql`excluded.entry_id`, passageId: sql`excluded.passage_id`, symbolId: sql`excluded.symbol_id`, ordinal: sql`excluded.ordinal`,
          originalText: sql`excluded.original_text`,
          text: sql`case when ${rules.editedAt} is null then excluded.text else ${rules.text} end`,
          condition: sql`case when ${rules.editedAt} is null then excluded.condition else ${rules.condition} end`,
          updatedAt: now,
        },
      });
    }
    const codes = rRows.map(r => r.code);
    removed += (await tx.delete(rules).where(and(eq(rules.sourceId, sourceId), notInArray(rules.code, codes), isNull(rules.editedAt))).returning({ id: rules.id })).length;
    const savedRules = await tx.select({ id: rules.id, code: rules.code, condition: rules.condition, editedAt: rules.editedAt }).from(rules).where(eq(rules.sourceId, sourceId));
    const keptRules = savedRules.filter(r => r.editedAt).length;

    // where each rule is read (its part of a reading), and the numbers its condition speaks of
    const topicOf = new Map(b.rules.map(r => [r.i, r.tp]));
    const inBundle = savedRules.filter(r => topicOf.has(r.code));
    for (const part of chunks(inBundle.map(r => r.id), 2000)) await tx.delete(ruleTargets).where(inArray(ruleTargets.ruleId, part));
    for (const part of chunks(savedRules.map(r => r.id), 2000)) await tx.delete(ruleSymbols).where(inArray(ruleSymbols.ruleId, part));
    for (const part of chunks(inBundle.map(r => ({ ruleId: r.id, target: topicOf.get(r.code)!, ordinal: 0 })), 1000)) await tx.insert(ruleTargets).values(part).onConflictDoNothing();
    const sRows = savedRules.flatMap(r => [...symbolsOf(r.condition ? parse(r.condition).node : undefined)].map(c => ({ ruleId: r.id, symbolId: symbolId.get(c) })))
      .filter((x): x is { ruleId: number; symbolId: number } => x.symbolId !== undefined);
    for (const part of chunks(sRows, 1000)) await tx.insert(ruleSymbols).values(part).onConflictDoNothing();

    // what each entry is about
    await tx.delete(entrySymbols).where(inArray(entrySymbols.entryId, sourceEntryIds));
    const esRows = b.book.entries.flatMap(e => e.symbols.map((c, i) => ({ entryId: eid(e.code), symbolId: symbolId.get(c), ordinal: i })))
      .filter((x): x is { entryId: number; symbolId: number; ordinal: number } => x.symbolId !== undefined);
    for (const part of chunks(esRows, 1000)) await tx.insert(entrySymbols).values(part).onConflictDoNothing();

    const written = savedEntries.length + pRows.length + rRows.length + tableRows;
    const keptEdited = keptPassages + keptRules;
    await tx.insert(imports).values({ disciplineCode: 'numerology', bundleVersion: b.manifest.version, written, keptEdited, removed });
    return { written, keptEdited, removed };
  });
  return { skipped: false, version: b.manifest.version, ...report, ms: Date.now() - started };
}
