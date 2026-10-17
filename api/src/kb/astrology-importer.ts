/* Loads the Chiêm tinh bundle — cô Hương Kiều's textbook, keyword table, test of the dominant planets and handout on
   Bạch Dương, the class's translation of Bil Tierney's book on aspects, and Woolfolk's book in Claude's translation —
   into the database, one source per book. The sources' text is not kept in the repository, so the bundle comes from
   disk (kb/bundle/astrology, built where the sources are) or is uploaded (PUT /api/astrology/bundle). As with Nhân số học,
   everything is written by its stable key and what was edited in the database is kept. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { TOPICS, parse, symbolCatalogue, symbolsOf, type AstrologyBundle } from '@mystic/engine/astrology';
import { chunks, fold } from '../common/text.js';
import type { Db } from '../db/db.js';
import { entries, entrySymbols, entryTableRows, entryTables, imports, passages, ruleSymbols, ruleTargets, rules, sources, symbols } from '../db/schema.js';
import { upsertDisciplines, type ImportReport } from './importer.js';
import { BundleError } from './numerology-importer.js';

const TOPIC = z.enum(TOPICS.map(t => t.code) as [string, ...string[]]);
const KIND = z.enum(['rule', 'general']);
const VOICE = z.enum(['hk', 'tierney', 'woolfolk']);
const BundleSchema = z.object({
  manifest: z.object({ discipline: z.literal('astrology'), version: z.string().min(4), sources: z.number().int(), entries: z.number().int(), passages: z.number().int(), rules: z.number().int(), built: z.string() }),
  book: z.object({
    books: z.array(z.object({
      source: z.object({
        code: z.string().regex(/^astrology\.[a-z0-9-]+$/), file: z.string(), title: z.string().min(1), author: z.string(), label: z.string(),
        translator: z.string().optional(), description: z.string().optional(), note: z.string().optional(),
      }),
      entries: z.array(z.object({
        code: z.string().min(1), title: z.string(), parent: z.string().nullable(), page: z.number().int().nullable(), at: z.number().int(),
        topic: TOPIC.nullable(), symbols: z.array(z.string()), en: z.string().optional(),
        paras: z.array(z.object({
          id: z.number().int(), kind: z.string(), role: KIND, page: z.number().int().nullable(), pages: z.array(z.number().int()).optional(), text: z.string(), voice: VOICE,
          label: z.string().optional(), en: z.string().optional(), labelEn: z.string().optional(), items: z.array(z.string()).optional(),
          columns: z.array(z.tuple([z.string(), z.string()])).optional(), rows: z.array(z.record(z.string(), z.unknown())).optional(), title: z.string().nullable().optional(),
          forms: z.array(z.string()).optional(), usage: z.string().optional(), facet: z.string().optional(),
        })),
      })).min(1),
    })).min(1),
  }),
  rules: z.array(z.object({
    i: z.string(), s: z.string(), e: z.string(), p: z.number().int(), pg: z.number().int().nullable(), t: z.string(), w: z.string(), k: KIND, tp: TOPIC, o: z.number().int(),
    sy: z.array(z.string()), v: VOICE, lb: z.string().optional(), en: z.string().optional(), it: z.array(z.string()).optional(),
  })),
});

/** a bundle as it was given (from disk or uploaded), checked whole before anything is written */
export function checkAstrologyBundle(raw: unknown): AstrologyBundle {
  const r = BundleSchema.safeParse(raw);
  if (!r.success) throw new BundleError(`Gói chiêm tinh không đúng cấu trúc: ${r.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const b = r.data as AstrologyBundle;
  const errors: string[] = [];
  const paras = new Map<string, { entry: string; text: string }>();
  let entryCount = 0;
  const srcCodes = new Set<string>();
  for (const book of b.book.books) {
    const s = book.source.code;
    if (srcCodes.has(s)) errors.push(`nguồn trùng mã ${s}`);
    srcCodes.add(s);
    const codes = new Set<string>();
    for (const e of book.entries) {
      entryCount++;
      if (codes.has(e.code)) errors.push(`${s}: mục trùng mã ${e.code}`);
      codes.add(e.code);
      for (const p of e.paras) { const k = `${s}#${p.id}`; if (paras.has(k)) errors.push(`${s}: đoạn ${p.id} xuất hiện hai lần`); paras.set(k, { entry: e.code, text: p.text }); }
    }
    for (const e of book.entries) if (e.parent && !codes.has(e.parent)) errors.push(`${s}/${e.code}: không có mục cha ${e.parent}`);
  }
  const ruleCodes = new Set<string>();
  for (const x of b.rules) {
    if (ruleCodes.has(x.i)) errors.push(`câu trùng mã ${x.i}`);
    ruleCodes.add(x.i);
    const p = paras.get(`${x.s}#${x.p}`);
    if (!p || p.entry !== x.e) errors.push(`${x.i}: không có đoạn ${x.p} trong mục ${x.e} của ${x.s}`);
    else if (p.text !== x.t) errors.push(`${x.i}: chữ khác với đoạn ${x.p}`);
    const parsed = parse(x.w);
    if (parsed.errors.length) errors.push(`${x.i}: điều kiện lỗi — ${parsed.errors.join('; ')}`);
  }
  const m = b.manifest;
  if (m.sources !== b.book.books.length || m.entries !== entryCount || m.rules !== b.rules.length || m.passages !== paras.size) errors.push('manifest không khớp với nội dung');
  if (errors.length) throw new BundleError(`Gói chiêm tinh có lỗi: ${errors.slice(0, 8).join('; ')}${errors.length > 8 ? ` (và ${errors.length - 8} lỗi khác)` : ''}`);
  return b;
}

/** the bundle as files on disk (null when it is not there: the sources are then loaded by upload) */
export function readAstrologyBundle(dir: string): AstrologyBundle | null {
  if (!existsSync(join(dir, 'manifest.json'))) return null;
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
  return checkAstrologyBundle({ manifest: read('manifest.json'), book: read('book.json'), rules: read('rules.json').rules });
}

const now = sql`now()`;
const keyOf = (paraId: number) => `b${paraId}`;
/** a table as rows of text, column by column (her dignities: Hành tinh, Vượng, Tử, Tướng, Tù) */
function tableOf(columns: [string, string][], rows: Record<string, unknown>[]): { columns: string[]; rows: string[][] } {
  return {
    columns: columns.map(c => c[1]),
    rows: rows.map(r => columns.map(([k]) => { const v = r[k]; return Array.isArray(v) ? v.join(', ') : String(v ?? ''); })),
  };
}

export async function importAstrology(db: Db, raw: AstrologyBundle, opts: { force?: boolean } = {}): Promise<ImportReport> {
  const started = Date.now();
  const b = checkAstrologyBundle(raw);
  const last = await db.select({ v: imports.bundleVersion }).from(imports).where(eq(imports.disciplineCode, 'astrology')).orderBy(desc(imports.id)).limit(1);
  if (!opts.force && last[0]?.v === b.manifest.version) return { skipped: true, version: b.manifest.version, written: 0, keptEdited: 0, removed: 0, ms: Date.now() - started };

  const report = await db.transaction(async tx => {
    await upsertDisciplines(tx);
    // symbols: bodies, signs, houses, aspects, structures, and a body in a sign / house, two bodies together
    const cat = symbolCatalogue();
    const symbolId = new Map<string, number>();
    for (const part of chunks(cat.map((c, i) => ({ disciplineCode: 'astrology', code: c.code, name: c.name, kind: c.kind, sourceId: null, sortOrder: i })), 500)) {
      const rows = await tx.insert(symbols).values(part)
        .onConflictDoUpdate({ target: [symbols.disciplineCode, symbols.code], set: { name: sql`excluded.name`, kind: sql`excluded.kind`, sortOrder: sql`excluded.sort_order`, updatedAt: now } })
        .returning({ id: symbols.id, code: symbols.code });
      for (const x of rows) symbolId.set(x.code, x.id);
    }
    await tx.delete(symbols).where(and(eq(symbols.disciplineCode, 'astrology'), notInArray(symbols.code, cat.map(c => c.code))));

    let written = 0, keptEdited = 0, removed = 0;
    for (const [order, book] of b.book.books.entries()) {
      const s = book.source;
      const [src] = await tx.insert(sources).values({
        disciplineCode: 'astrology', code: s.code, title: s.title, author: s.author, kind: 'book', sourceFile: s.file, note: s.note ?? null, sortOrder: order,
        description: s.description ?? null,
      }).onConflictDoUpdate({ target: sources.code, set: { title: sql`excluded.title`, author: sql`excluded.author`, kind: sql`excluded.kind`, sourceFile: sql`excluded.source_file`, note: sql`excluded.note`, description: sql`excluded.description`, sortOrder: sql`excluded.sort_order`, updatedAt: now } })
        .returning({ id: sources.id });
      const sourceId = src.id;

      const savedEntries: { id: number; code: string }[] = [];
      for (const part of chunks(book.entries.map((e, i) => ({ sourceId, code: e.code, kind: 'section', title: e.title, sourceRef: e.page, ordinal: i })), 500)) {
        savedEntries.push(...await tx.insert(entries).values(part)
          .onConflictDoUpdate({ target: [entries.sourceId, entries.code], set: { kind: sql`excluded.kind`, title: sql`excluded.title`, sourceRef: sql`excluded.source_ref`, ordinal: sql`excluded.ordinal`, updatedAt: now } })
          .returning({ id: entries.id, code: entries.code }));
      }
      const entryId = new Map(savedEntries.map(e => [e.code, e.id]));
      const eid = (code: string) => entryId.get(code)!;
      for (const part of chunks(book.entries, 1000)) {
        const values = sql.join(part.map(e => sql`(${eid(e.code)}::int, ${e.parent ? eid(e.parent) : null}::int)`), sql`, `);
        await tx.execute(sql`update entries set parent_id = v.parent from (values ${values}) as v(id, parent) where entries.id = v.id and entries.parent_id is distinct from v.parent`);
      }

      // passages keyed by their block of the source ("b412"); one the map moved to another entry follows it, edit and all
      const pRows = book.entries.flatMap(e => e.paras.map((p, i) => ({
        entryId: eid(e.code), key: keyOf(p.id), ordinal: i, kind: p.kind, role: p.role, voice: p.voice, label: p.label ?? null, sourceText: p.en ?? null,
        items: p.items ?? null, section: null, sourceRef: p.page, originalText: p.text, text: p.text, searchText: fold([p.label, p.text].filter(Boolean).join(' ')),
      })));
      for (const part of chunks(pRows, 2000)) {
        const values = sql.join(part.map(r => sql`(${r.key}, ${r.entryId}::int)`), sql`, `);
        await tx.execute(sql`update passages set entry_id = v.entry_id from (values ${values}) as v(key, entry_id), entries e
          where passages.key = v.key and passages.entry_id = e.id and e.source_id = ${sourceId} and passages.entry_id <> v.entry_id`);
      }
      for (const part of chunks(pRows, 400)) {
        await tx.insert(passages).values(part).onConflictDoUpdate({
          target: [passages.entryId, passages.key],
          set: {
            ordinal: sql`excluded.ordinal`, kind: sql`excluded.kind`, role: sql`excluded.role`, voice: sql`excluded.voice`, label: sql`excluded.label`,
            sourceText: sql`excluded.source_text`, items: sql`excluded.items`, section: sql`excluded.section`, sourceRef: sql`excluded.source_ref`,
            originalText: sql`excluded.original_text`,
            text: sql`case when ${passages.editedAt} is null then excluded.text else ${passages.text} end`,
            searchText: sql`case when ${passages.editedAt} is null then excluded.search_text else ${passages.searchText} end`,
            updatedAt: now,
          },
        });
      }

      // what the source no longer has: entries (unless they hold an edit) and passages (unless edited)
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
      for (const part of chunks(sourceEntryIds, 5000)) {
        removed += (await tx.delete(passages).where(and(inArray(passages.entryId, part), notInArray(passages.key, pRows.map(r => r.key)), isNull(passages.editedAt))).returning({ id: passages.id })).length;
      }
      const pIds: { id: number; key: string; editedAt: Date | null }[] = [];
      for (const part of chunks(sourceEntryIds, 5000)) pIds.push(...await tx.select({ id: passages.id, key: passages.key, editedAt: passages.editedAt }).from(passages).where(inArray(passages.entryId, part)));
      const passageId = new Map(pIds.map(p => [p.key, p.id]));
      keptEdited += pIds.filter(p => p.editedAt).length;

      // the tables (her dignities, Woolfolk's), each keyed as the passage it stands for; captioned with the entry's
      // title unless the source gives one (or none)
      await tx.delete(entryTables).where(inArray(entryTables.entryId, sourceEntryIds));
      for (const e of book.entries) for (const [i, p] of e.paras.entries()) {
        if (p.kind !== 'table' || !p.columns || !p.rows) continue;
        const t = tableOf(p.columns, p.rows);
        const [row] = await tx.insert(entryTables).values({ entryId: eid(e.code), key: keyOf(p.id), ordinal: i, title: p.title !== undefined ? p.title : e.title, columns: t.columns }).returning({ id: entryTables.id });
        await tx.insert(entryTableRows).values(t.rows.map((r, k) => ({ tableId: row.id, ordinal: k, cells: r })));
        written += t.rows.length;
      }

      // rules: every passage of this source that speaks of a person, with its condition
      const mine = b.rules.filter(r => r.s === s.code);
      const firstSymbol = new Map(book.entries.map(e => [e.code, e.symbols[0] ? symbolId.get(e.symbols[0]) ?? null : null]));
      const rRows = mine.map(r => ({
        disciplineCode: 'astrology', code: r.i, sourceId, entryId: eid(r.e), passageId: passageId.get(keyOf(r.p)) ?? null, symbolId: firstSymbol.get(r.e) ?? null,
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
      removed += (await tx.delete(rules).where(and(eq(rules.sourceId, sourceId), codes.length ? notInArray(rules.code, codes) : sql`true`, isNull(rules.editedAt))).returning({ id: rules.id })).length;
      const savedRules = await tx.select({ id: rules.id, code: rules.code, condition: rules.condition, editedAt: rules.editedAt }).from(rules).where(eq(rules.sourceId, sourceId));
      keptEdited += savedRules.filter(r => r.editedAt).length;

      // where each rule is read (its part of a reading), and what its condition speaks of
      const topicOf = new Map(mine.map(r => [r.i, r.tp]));
      const inBundle = savedRules.filter(r => topicOf.has(r.code));
      for (const part of chunks(inBundle.map(r => r.id), 2000)) await tx.delete(ruleTargets).where(inArray(ruleTargets.ruleId, part));
      for (const part of chunks(savedRules.map(r => r.id), 2000)) await tx.delete(ruleSymbols).where(inArray(ruleSymbols.ruleId, part));
      for (const part of chunks(inBundle.map(r => ({ ruleId: r.id, target: topicOf.get(r.code)!, ordinal: 0 })), 1000)) await tx.insert(ruleTargets).values(part).onConflictDoNothing();
      const sRows = savedRules.flatMap(r => [...symbolsOf(r.condition ? parse(r.condition).node : undefined)].map(c => ({ ruleId: r.id, symbolId: symbolId.get(c) })))
        .filter((x): x is { ruleId: number; symbolId: number } => x.symbolId !== undefined);
      for (const part of chunks(sRows, 1000)) await tx.insert(ruleSymbols).values(part).onConflictDoNothing();

      await tx.delete(entrySymbols).where(inArray(entrySymbols.entryId, sourceEntryIds));
      const esRows = book.entries.flatMap(e => e.symbols.map((c, i) => ({ entryId: eid(e.code), symbolId: symbolId.get(c), ordinal: i })))
        .filter((x): x is { entryId: number; symbolId: number; ordinal: number } => x.symbolId !== undefined);
      for (const part of chunks(esRows, 1000)) await tx.insert(entrySymbols).values(part).onConflictDoNothing();

      written += savedEntries.length + pRows.length + rRows.length;
    }
    // a source the bundle no longer has goes, unless something in it was edited
    const kept = b.book.books.map(x => x.source.code);
    const gone = await tx.select({ id: sources.id }).from(sources).where(and(eq(sources.disciplineCode, 'astrology'), notInArray(sources.code, kept)));
    for (const g of gone) {
      const edited = await tx.select({ id: passages.id }).from(passages).innerJoin(entries, eq(entries.id, passages.entryId)).where(and(eq(entries.sourceId, g.id), isNotNull(passages.editedAt))).limit(1);
      if (!edited.length) { await tx.delete(sources).where(eq(sources.id, g.id)); removed++; }
    }
    await tx.insert(imports).values({ disciplineCode: 'astrology', bundleVersion: b.manifest.version, written, keptEdited, removed });
    return { written, keptEdited, removed };
  });
  return { skipped: false, version: b.manifest.version, ...report, ms: Date.now() - started };
}
