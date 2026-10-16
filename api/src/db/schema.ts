import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/*
 * One database for every Huyền học discipline (tử vi and nhân số học now; chiêm tinh, Kinh Dịch, tarot later).
 * Nothing here is shaped for one discipline alone except its own settings table (tuvi_profile_settings,
 * numerology_profile_names): a new discipline brings its engine and, when it needs one, such a table — knowledge,
 * people, profiles and readings are shared.
 *
 *  knowledge   disciplines → sources (a notebook, a book, the supplement layer) → entries → passages,
 *              plus symbols (stars, later planets, numbers, hexagrams, cards) and rules (what a passage says,
 *              with a condition the engine can test). Imported from the kb bundle, then the database is the
 *              source of truth: text can be reworded here (original_text keeps what was imported) and a later
 *              import never overwrites a row someone edited.
 *  people      subjects (the person read) ← subject_links (who else knows them: Sonic Hub) → profiles (one reading
 *              of one person at one moment, with the birth exactly as read) → readings (written ones: AI for now).
 *  sync        outbox — briefs waiting to be sent to Sonic Hub.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
/** the BaseEntity of this service */
const audit = {
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
};
const serialId = () => integer('id').primaryKey().generatedAlwaysAsIdentity();

// ── knowledge ─────────────────────────────────────────────────────────────────

export const disciplines = pgTable('disciplines', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  ready: boolean('ready').notNull().default(false),
  sortOrder: smallint('sort_order').notNull().default(0),
  ...audit,
});

/** where knowledge comes from: 'family' = grandma's own notes (the primary voice), 'book' = another book, 'supplement' = the summarized common layer */
export const sources = pgTable('sources', {
  id: serialId(),
  disciplineCode: text('discipline_code').notNull().references(() => disciplines.code),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  author: text('author'),
  kind: text('kind', { enum: ['family', 'book', 'supplement'] }).notNull(),
  description: text('description'),
  sourceFile: text('source_file'),
  note: text('note'),
  sortOrder: smallint('sort_order').notNull().default(0),
  ...audit,
});

/** a part of a source: a star's entry, a step of setting up a chart, a palace, a principle, a chapter later */
export const entries = pgTable('entries', {
  id: serialId(),
  sourceId: integer('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id').references((): AnyPgColumn => entries.id, { onDelete: 'cascade' }),
  /** stable within its source ("e158", "preface", "step.1", "palace.Mệnh", "principle.than_cu.Mệnh") */
  code: text('code').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  /** where it starts in the source document (a line number) */
  sourceRef: integer('source_ref'),
  ordinal: integer('ordinal').notNull(),
  ...audit,
}, t => [uniqueIndex('entries_source_code').on(t.sourceId, t.code), index('entries_source_ordinal').on(t.sourceId, t.ordinal)]);

export const passages = pgTable('passages', {
  id: serialId(),
  entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
  /** stable within its entry ("p159" = grandma's paragraph at line 159, "about", "l2", "note") */
  key: text('key').notNull(),
  ordinal: integer('ordinal').notNull(),
  /** meta | section | item | text | line | about | app_note — app_note is never grandma's; a book: para | item | figure | note */
  kind: text('kind').notNull(),
  /** what the paragraph is to the person read (Nhân số học: rule, advice, child, general, method, example, figure, note) */
  role: text('role'),
  /** whose words it is, when a source carries more than one voice (chiêm tinh: hk = cô Hương Kiều, tierney, woolfolk) */
  voice: text('voice'),
  /** the run-in label of an item ("Biểu tượng", "Sao Thủy ở Bạch Dương") */
  label: text('label'),
  /** a translated source keeps its original beside the translation (Woolfolk's English) */
  sourceText: text('source_text'),
  /** a list kept as a list (her keywords), one entry per line */
  items: jsonb('items').$type<string[]>(),
  /** the palaces a paragraph speaks of ("Mệnh · Thân") */
  section: text('section'),
  sourceRef: integer('source_ref'),
  originalText: text('original_text').notNull(),
  text: text('text').notNull(),
  /** lower case, no tone marks, đ → d: what "tra cứu" matches against */
  searchText: text('search_text').notNull(),
  editedAt: ts('edited_at'),
  ...audit,
}, t => [uniqueIndex('passages_entry_key').on(t.entryId, t.key), index('passages_entry_ordinal').on(t.entryId, t.ordinal)]);

/** the symbols an entry is about (a pair entry like "Thiên Quan - Thiên Phúc" is about two) */
export const entrySymbols = pgTable('entry_symbols', {
  entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
  symbolId: integer('symbol_id').notNull().references((): AnyPgColumn => symbols.id, { onDelete: 'cascade' }),
  ordinal: smallint('ordinal').notNull().default(0),
}, t => [primaryKey({ columns: [t.entryId, t.symbolId] }), index('entry_symbols_symbol').on(t.symbolId)]);

/** a table copied in a source (Lục thập hoa giáp, Tìm Cục…) */
export const entryTables = pgTable('entry_tables', {
  id: serialId(),
  entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  ordinal: smallint('ordinal').notNull().default(0),
  title: text('title'),
  columns: text('columns').array().notNull(),
  ...audit,
}, t => [uniqueIndex('entry_tables_entry_key').on(t.entryId, t.key)]);

export const entryTableRows = pgTable('entry_table_rows', {
  id: serialId(),
  tableId: integer('table_id').notNull().references(() => entryTables.id, { onDelete: 'cascade' }),
  ordinal: integer('ordinal').notNull(),
  cells: text('cells').array().notNull(),
}, t => [uniqueIndex('entry_table_rows_table_ordinal').on(t.tableId, t.ordinal)]);

/** the things a discipline reads: tử vi stars (later planets and signs, numbers, hexagrams, cards) */
export const symbols = pgTable('symbols', {
  id: serialId(),
  disciplineCode: text('discipline_code').notNull().references(() => disciplines.code),
  /** the engine's id ("tu_vi") — computing uses the engine's own catalogue, never this table */
  code: text('code').notNull(),
  name: text('name').notNull(),
  /** tử vi: chinh | phu | khong */
  kind: text('kind').notNull(),
  tone: text('tone'),
  ring: text('ring'),
  sourceId: integer('source_id').references(() => sources.id),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...audit,
}, t => [uniqueIndex('symbols_discipline_code').on(t.disciplineCode, t.code)]);

export const symbolAliases = pgTable('symbol_aliases', {
  symbolId: integer('symbol_id').notNull().references(() => symbols.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
}, t => [primaryKey({ columns: [t.symbolId, t.alias] })]);

/** grandma's miếu/vượng/đắc/bình/hãm (tử vi); dignities by sign later (chiêm tinh) */
export const symbolDignities = pgTable('symbol_dignities', {
  symbolId: integer('symbol_id').notNull().references(() => symbols.id, { onDelete: 'cascade' }),
  position: text('position').notNull(),
  level: text('level').notNull(),
  sourceId: integer('source_id').references(() => sources.id),
}, t => [primaryKey({ columns: [t.symbolId, t.position] })]);

export const symbolGroups = pgTable('symbol_groups', {
  id: serialId(),
  disciplineCode: text('discipline_code').notNull().references(() => disciplines.code),
  code: text('code').notNull(),
  name: text('name').notNull(),
  /** all = every member · any = at least one · min = at least min_count */
  mode: text('mode').notNull(),
  minCount: smallint('min_count'),
  note: text('note'),
  ...audit,
}, t => [uniqueIndex('symbol_groups_discipline_code').on(t.disciplineCode, t.code)]);

export const symbolGroupAliases = pgTable('symbol_group_aliases', {
  groupId: integer('group_id').notNull().references(() => symbolGroups.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
}, t => [primaryKey({ columns: [t.groupId, t.alias] })]);

export const symbolGroupMembers = pgTable('symbol_group_members', {
  groupId: integer('group_id').notNull().references(() => symbolGroups.id, { onDelete: 'cascade' }),
  symbolId: integer('symbol_id').notNull().references(() => symbols.id, { onDelete: 'cascade' }),
  ordinal: smallint('ordinal').notNull().default(0),
}, t => [primaryKey({ columns: [t.groupId, t.symbolId] })]);

/** one sentence a source says, with the condition (in the discipline's condition language) under which it applies */
export const rules = pgTable('rules', {
  id: serialId(),
  disciplineCode: text('discipline_code').notNull().references(() => disciplines.code),
  code: text('code').notNull().unique(),
  sourceId: integer('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),
  entryId: integer('entry_id').notNull().references(() => entries.id, { onDelete: 'cascade' }),
  passageId: integer('passage_id').references(() => passages.id, { onDelete: 'set null' }),
  /** the symbol the rule is listed under (its entry's star) */
  symbolId: integer('symbol_id').references(() => symbols.id, { onDelete: 'set null' }),
  ordinal: integer('ordinal').notNull(),
  originalText: text('original_text').notNull(),
  text: text('text').notNull(),
  context: text('context'),
  /** null: kept as text only, never matched against a chart */
  condition: text('condition'),
  tone: text('tone').notNull(),
  reviewNote: text('review_note'),
  active: boolean('active').notNull().default(true),
  editedAt: ts('edited_at'),
  ...audit,
}, t => [index('rules_source').on(t.sourceId), index('rules_entry').on(t.entryId), index('rules_passage').on(t.passageId)]);

/** where a rule is read: a palace, Thân, Hạn, or * (any palace) */
export const ruleTargets = pgTable('rule_targets', {
  ruleId: integer('rule_id').notNull().references(() => rules.id, { onDelete: 'cascade' }),
  target: text('target').notNull(),
  ordinal: smallint('ordinal').notNull().default(0),
}, t => [primaryKey({ columns: [t.ruleId, t.target] })]);

/** the symbols a rule's condition speaks of — for looking rules up by stars */
export const ruleSymbols = pgTable('rule_symbols', {
  ruleId: integer('rule_id').notNull().references(() => rules.id, { onDelete: 'cascade' }),
  symbolId: integer('symbol_id').notNull().references(() => symbols.id, { onDelete: 'cascade' }),
}, t => [primaryKey({ columns: [t.ruleId, t.symbolId] }), index('rule_symbols_symbol').on(t.symbolId)]);

/** where schools differ: grandma's way and the common books' way of placing the same thing */
export const variants = pgTable('variants', {
  id: serialId(),
  disciplineCode: text('discipline_code').notNull().references(() => disciplines.code),
  code: text('code').notNull(),
  title: text('title').notNull(),
  primaryText: text('primary_text').notNull(),
  alternativeText: text('alternative_text').notNull(),
  primarySourceId: integer('primary_source_id').references(() => sources.id),
  ordinal: smallint('ordinal').notNull().default(0),
  ...audit,
}, t => [uniqueIndex('variants_discipline_code').on(t.disciplineCode, t.code)]);

/** every bundle that was imported */
export const imports = pgTable('imports', {
  id: serialId(),
  disciplineCode: text('discipline_code').notNull(),
  bundleVersion: text('bundle_version').notNull(),
  written: integer('written').notNull().default(0),
  keptEdited: integer('kept_edited').notNull().default(0),
  removed: integer('removed').notNull().default(0),
  importedAt: ts('imported_at').notNull().defaultNow(),
});

// ── people ────────────────────────────────────────────────────────────────────

/** whose data it is — one account (the owner) for now, so a public web can open to others later */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...audit,
});

const birthColumns = {
  birthCalendar: text('birth_calendar', { enum: ['solar', 'lunar'] }).notNull().default('solar'),
  birthYear: smallint('birth_year'),
  birthMonth: smallint('birth_month'),
  birthDay: smallint('birth_day'),
  birthLeapMonth: boolean('birth_leap_month').notNull().default(false),
  /** "HH:MM" as the clock showed it */
  birthTime: text('birth_time'),
  /** the giờ 0 Tý … 11 Hợi, when that is all a family record says */
  birthHourBranch: smallint('birth_hour_branch'),
  birthTimeApprox: boolean('birth_time_approx').notNull().default(false),
  /** IANA name; Vietnam is Asia/Ho_Chi_Minh, whose history before 13/6/1975 is the South's — the offset below is the truth */
  birthTimeZone: text('birth_time_zone'),
  birthUtcOffsetMinutes: smallint('birth_utc_offset_minutes'),
  birthPlace: text('birth_place'),
  birthLatitude: doublePrecision('birth_latitude'),
  birthLongitude: doublePrecision('birth_longitude'),
};

/** the person a reading is about */
export const subjects = pgTable('subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  gender: text('gender', { enum: ['male', 'female'] }),
  ...birthColumns,
  note: text('note'),
  ...audit,
}, t => [index('subjects_account').on(t.accountId)]);

/** the same person in another system; with owns_identity the other system is where name and birth are edited */
export const subjectLinks = pgTable('subject_links', {
  system: text('system').notNull(),
  externalId: text('external_id').notNull(),
  subjectId: uuid('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  ownsIdentity: boolean('owns_identity').notNull().default(true),
  syncedAt: ts('synced_at'),
  ...audit,
}, t => [primaryKey({ columns: [t.system, t.externalId] }), index('subject_links_subject').on(t.subjectId)]);

/** one reading of one person at one moment: the birth exactly as it was read, so later edits never change it */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectId: uuid('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  disciplineCode: text('discipline_code').notNull().references(() => disciplines.code),
  label: text('label'),
  viewYear: smallint('view_year'),
  /** tử vi needs it; nhân số học reads without it */
  gender: text('gender', { enum: ['male', 'female'] }),
  ...birthColumns,
  engineVersion: text('engine_version').notNull(),
  knowledgeVersion: text('knowledge_version').notNull(),
  note: text('note'),
  ...audit,
}, t => [index('profiles_subject').on(t.subjectId, t.disciplineCode, t.createdAt)]);

/** how a tử vi profile places its stars (settings grandma did not write down are marked so on the chart) */
export const tuviProfileSettings = pgTable('tuvi_profile_settings', {
  profileId: uuid('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  variant: text('variant', { enum: ['ba', 'sach'] }).notNull().default('ba'),
  leapMonth: text('leap_month', { enum: ['same', 'split15'] }).notNull().default('same'),
  tyNextDay: boolean('ty_next_day').notNull().default(true),
  lunarCalendar: text('lunar_calendar', { enum: ['auto', 'utc7', 'utc8'] }).notNull().default('auto'),
  hourBasis: text('hour_basis', { enum: ['clock', 'true_solar'] }).notNull().default('clock'),
  ...audit,
});

/** the names a nhân số học profile reads (the primary one is the name its reading speaks of) */
export const numerologyProfileNames = pgTable('numerology_profile_names', {
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  ordinal: smallint('ordinal').notNull(),
  /** "Tên gọi", "Họ tên đầy đủ", "Tên ở nhà"… */
  label: text('label'),
  text: text('text').notNull(),
  primary: boolean('primary').notNull().default(false),
}, t => [primaryKey({ columns: [t.profileId, t.ordinal] })]);

/** a written reading of a profile — by the app's AI call, or written with Claude and saved here */
export const readings = pgTable('readings', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  /** "tong-quan" · a palace ("Quan Lộc") or "Thân" · "han-2026" */
  scope: text('scope').notNull(),
  viewYear: smallint('view_year').notNull(),
  author: text('author').notNull().default('ai'),
  model: text('model'),
  inputHash: text('input_hash'),
  caution: text('caution'),
  ...audit,
}, t => [uniqueIndex('readings_profile_scope_year').on(t.profileId, t.scope, t.viewYear)]);

export const readingSections = pgTable('reading_sections', {
  id: serialId(),
  readingId: uuid('reading_id').notNull().references(() => readings.id, { onDelete: 'cascade' }),
  ordinal: smallint('ordinal').notNull(),
  title: text('title').notNull(),
}, t => [index('reading_sections_reading').on(t.readingId, t.ordinal)]);

/** primary = retells grandma's matched lines and cites them; added = everything else, never passed off as hers */
export const readingItems = pgTable('reading_items', {
  id: serialId(),
  sectionId: integer('section_id').notNull().references(() => readingSections.id, { onDelete: 'cascade' }),
  ordinal: smallint('ordinal').notNull(),
  layer: text('layer', { enum: ['primary', 'added'] }).notNull(),
  text: text('text').notNull(),
}, t => [index('reading_items_section').on(t.sectionId, t.ordinal)]);

/** a rule a primary item cites, with its text as it was when the reading was written */
export const readingItemRefs = pgTable('reading_item_refs', {
  itemId: integer('item_id').notNull().references(() => readingItems.id, { onDelete: 'cascade' }),
  ruleCode: text('rule_code').notNull(),
  ruleId: integer('rule_id').references(() => rules.id, { onDelete: 'set null' }),
  quotedText: text('quoted_text').notNull(),
}, t => [primaryKey({ columns: [t.itemId, t.ruleCode] })]);

// ── sync ──────────────────────────────────────────────────────────────────────

/** a brief to send (or withdraw) for a linked person; retried until the other side has it */
export const outbox = pgTable('outbox', {
  id: serialId(),
  topic: text('topic').notNull(),
  system: text('system').notNull(),
  externalId: text('external_id').notNull(),
  disciplineCode: text('discipline_code').notNull(),
  subjectId: uuid('subject_id'),
  attempts: smallint('attempts').notNull().default(0),
  nextAttemptAt: ts('next_attempt_at').notNull().defaultNow(),
  lastError: text('last_error'),
  sentAt: ts('sent_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, t => [index('outbox_due').on(t.sentAt, t.nextAttemptAt)]);
