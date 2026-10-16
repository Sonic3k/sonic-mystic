import { gunzipSync } from 'node:zlib';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseIntPipe, Patch, PayloadTooLargeException, Post, Put, Query, Req } from '@nestjs/common';
import { asc, desc, eq, sql } from 'drizzle-orm';
import type { Request } from 'express';
import { z } from 'zod';
import type { DisciplineDto } from '@mystic/engine/api';
import { AiService } from '../ai/ai.service.js';
import { BooksService } from '../books/books.service.js';
import { Access, ZodPipe } from '../common/access.js';
import { DB, type Db } from '../db/db.js';
import { disciplines, imports } from '../db/schema.js';
import { KnowledgeService } from '../kb/knowledge.service.js';
import { BundleError, importNumerology } from '../kb/numerology-importer.js';
import { importAstrology } from '../kb/astrology-importer.js';
import { AstrologyBody, AstrologyService, type AstrologyBodyT } from '../astrology/astrology.service.js';
import { NumerologyBody, NumerologyService, type NumerologyBodyT } from '../numerology/numerology.service.js';
import { PeopleService, ProfileBody, ProfilePatch, SubjectBody, type ProfileInput, type SubjectInput } from '../people/people.service.js';
import { ReadingsService, WrittenBody, type WrittenBodyT } from '../readings/readings.service.js';
import { SyncService } from '../sync/sync.service.js';
import type { SonicHubPerson } from '../sync/sonic-hub.client.js';
import { TuViService } from '../tuvi/tuvi.service.js';

const Birth = z.object({
  gender: z.enum(['nam', 'nu']),
  calendar: z.enum(['solar', 'lunar']),
  year: z.number().int(), month: z.number().int(), day: z.number().int(),
  leap: z.boolean().optional(),
  hour: z.number().int(), minute: z.number().int().min(0).max(59).optional(),
  latitude: z.number().min(-90).max(90).nullish(), longitude: z.number().min(-180).max(180).nullish(),
  utcOffsetMinutes: z.number().int().min(-720).max(840).nullish(),
});
const Settings = z.object({
  variant: z.enum(['ba', 'sach']), leapMonth: z.enum(['same', 'split15']), tyNextDay: z.boolean(),
  lunarCalendar: z.enum(['auto', 'utc7', 'utc8']), hourBasis: z.enum(['clock', 'true_solar']),
}).partial();
const TuViBody = z.object({ birth: Birth, settings: Settings.optional(), viewYear: z.number().int().min(1800).max(2200).optional() });
type TuViBodyT = z.infer<typeof TuViBody>;
const RulePatch = z.object({
  text: z.string().optional(), context: z.string().nullable().optional(), condition: z.string().nullable().optional(),
  tone: z.enum(['cat', 'hung', 'trung', 'mixed']).optional(), active: z.boolean().optional(), reviewNote: z.string().nullable().optional(),
});
const AiBody = z.object({ scope: z.string().min(1).max(60), viewYear: z.number().int().min(1800).max(2200).optional() });
const optInt = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

@Controller('health')
@Access('public')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db, @Inject(KnowledgeService) private readonly knowledge: KnowledgeService) {}

  @Get()
  async health() {
    await this.db.execute(sql`select 1`);
    const k = await this.knowledge.get();
    const n = await this.knowledge.numerology();
    const a = await this.knowledge.astrology();
    return {
      ok: true, knowledgeVersion: k.version, rules: k.rules.size,
      numerology: n ? { knowledgeVersion: n.version, rules: n.rules.size } : null,
      astrology: a ? { knowledgeVersion: a.version, rules: a.rules.size, sources: a.sources.length } : null,
    };
  }
}

@Controller()
export class MetaController {
  constructor(@Inject(DB) private readonly db: Db, @Inject(AiService) private readonly ai: AiService, @Inject(SyncService) private readonly sync: SyncService) {}

  @Get('disciplines')
  @Access('public')
  async disciplines(): Promise<DisciplineDto[]> {
    return (await this.db.select().from(disciplines).orderBy(asc(disciplines.sortOrder))).map(d => ({ code: d.code, name: d.name, description: d.description, ready: d.ready }));
  }

  @Get('ai/status')
  @Access('public')
  aiStatus() { return this.ai.status(); }

  /** sends the queued briefs now instead of waiting for the next round */
  @Post('sync/run')
  @HttpCode(200)
  async runSync() { const sent = await this.sync.run(); return { sent, pending: await this.sync.pending() }; }
}

@Controller()
@Access('public')
export class BooksController {
  constructor(@Inject(BooksService) private readonly books: BooksService) {}

  @Get('sources')
  sources(@Query('discipline') discipline = 'tuvi') { return this.books.sources(discipline); }

  @Get('sources/:code/entries')
  entries(@Param('code') code: string) { return this.books.entries(code); }

  @Get('sources/:code/entries/:key')
  entry(@Param('code') code: string, @Param('key') key: string) { return this.books.entry(code, key); }

  @Get('search')
  search(@Query('q') q = '', @Query('discipline') discipline = 'tuvi', @Query('limit') limit?: string) {
    return this.books.search(q, discipline, optInt(limit));
  }

  @Patch('passages/:id')
  @Access('owner')
  editPassage(@Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(z.object({ text: z.string() }))) body: { text: string }) { return this.books.editPassage(id, body.text); }

  @Patch('rules/:code')
  @Access('owner')
  editRule(@Param('code') code: string, @Body(new ZodPipe(RulePatch)) body: z.infer<typeof RulePatch>) { return this.books.editRule(code, body); }

  @Patch('symbols/:discipline/:code')
  @Access('owner')
  editSymbol(@Param('discipline') discipline: string, @Param('code') code: string, @Body(new ZodPipe(z.object({ description: z.string().nullable() }))) body: { description: string | null }) {
    return this.books.editSymbol(discipline, code, body.description);
  }
}

@Controller('tuvi')
@Access('public')
export class TuViController {
  constructor(@Inject(TuViService) private readonly tuvi: TuViService, @Inject(BooksService) private readonly books: BooksService) {}

  @Post('chart')
  @HttpCode(200)
  chart(@Body(new ZodPipe(TuViBody)) body: TuViBodyT) { return this.tuvi.chart(body.birth, body.settings, body.viewYear); }

  @Post('reading')
  @HttpCode(200)
  reading(@Body(new ZodPipe(TuViBody)) body: TuViBodyT) { return this.tuvi.reading(body.birth, body.settings, body.viewYear); }

  @Get('lookup')
  lookup(@Query('stars') stars = '', @Query('target') target?: string) { return this.books.lookup(stars.split(',').map(s => s.trim()).filter(Boolean), target || undefined); }

  @Get('setup')
  setup() { return this.books.setup(); }

  @Get('catalog')
  catalog() { return this.books.catalog(); }
}

const BUNDLE_MAX = 8 * 1024 * 1024;

/** a gzipped JSON bundle from the request body */
async function readGzipBody(req: Request, max: number, hint: string): Promise<unknown> {
  if (!/gzip/.test(req.headers['content-type'] ?? '')) throw new BadRequestException(`Gửi gói dạng application/gzip (${hint})`);
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) throw new PayloadTooLargeException('Gói quá lớn');
    parts.push(chunk as Buffer);
  }
  try { return JSON.parse(gunzipSync(Buffer.concat(parts), { maxOutputLength: 96 * 1024 * 1024 }).toString('utf8')); } catch (e) { throw new BadRequestException(`Không đọc được gói: ${(e as Error).message}`); }
}

/** Nhân số học: the numbers, the readings, the book and its lookups */
@Controller('numerology')
@Access('public')
export class NumerologyController {
  constructor(
    @Inject(NumerologyService) private readonly numerology: NumerologyService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Post('chart')
  @HttpCode(200)
  chart(@Body(new ZodPipe(NumerologyBody)) body: NumerologyBodyT) { const c = this.numerology.chart(body); return { solar: c.solar, chart: c.chart }; }

  @Post('reading')
  @HttpCode(200)
  reading(@Body(new ZodPipe(NumerologyBody)) body: NumerologyBodyT) { return this.numerology.reading(body); }

  @Get('book')
  toc() { return this.numerology.toc(); }

  @Get('book/:code')
  entry(@Param('code') code: string) { return this.numerology.entry(code); }

  /** ?symbols=chu-dao:7,so:1 — the passages whose condition speaks of all of them (optionally in one part: &topic=bieu_do) */
  @Get('lookup')
  lookup(@Query('symbols') symbols = '', @Query('topic') topic: string | undefined) {
    return this.numerology.lookup(symbols.split(',').map(x => x.trim()).filter(Boolean), topic || undefined);
  }

  @Get('catalog')
  catalog() { return this.numerology.catalog(); }

  /** whether the book is loaded, and which bundle */
  @Get('bundle')
  async bundle() {
    const n = await this.knowledge.numerology();
    const [last] = await this.db.select().from(imports).where(eq(imports.disciplineCode, 'numerology')).orderBy(desc(imports.id)).limit(1);
    return { loaded: !!n, knowledgeVersion: n?.version ?? null, rules: n?.rules.size ?? 0, entries: n?.order.length ?? 0, bundleVersion: last?.bundleVersion ?? null, importedAt: last?.importedAt.toISOString() ?? null };
  }

  /** loads the book: the bundle built where the book is, gzipped (kb: npm run upload:numerology) */
  @Put('bundle')
  @Access('owner')
  async upload(@Req() req: Request, @Query('force') force?: string) {
    const bundle = await readGzipBody(req, BUNDLE_MAX, 'npm run upload:numerology');
    try {
      const report = await importNumerology(this.db, bundle as Parameters<typeof importNumerology>[1], { force: force === '1' || force === 'true' });
      this.knowledge.invalidate();
      return report;
    } catch (e) {
      if (e instanceof BundleError) throw new BadRequestException(e.message);
      throw e;
    }
  }
}

/** Chiêm tinh: the chart, the readings, the sources and their lookups */
@Controller('astrology')
@Access('public')
export class AstrologyController {
  constructor(
    @Inject(AstrologyService) private readonly astrology: AstrologyService,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Post('chart')
  @HttpCode(200)
  chart(@Body(new ZodPipe(AstrologyBody)) body: AstrologyBodyT) { return this.astrology.chart(body); }

  @Post('reading')
  @HttpCode(200)
  reading(@Body(new ZodPipe(AstrologyBody)) body: AstrologyBodyT) { return this.astrology.reading(body); }

  @Get('book')
  toc() { return this.astrology.toc(); }

  /** ?shallow=1: only the entry's own passages and the titles under it */
  @Get('book/:source/:code')
  entry(@Param('source') source: string, @Param('code') code: string, @Query('shallow') shallow?: string) { return this.astrology.entry(source, code, shallow === '1' || shallow === 'true'); }

  /** ?symbols=sun@aries,house:7 — the passages whose condition speaks of all of them (optionally in one part: &topic=sun) */
  @Get('lookup')
  lookup(@Query('symbols') symbols = '', @Query('topic') topic: string | undefined) {
    return this.astrology.lookup(symbols.split(',').map(x => x.trim()).filter(Boolean), topic || undefined);
  }

  @Get('catalog')
  catalog() { return this.astrology.catalog(); }

  /** whether the sources are loaded, and which bundle */
  @Get('bundle')
  async bundle() {
    const a = await this.knowledge.astrology();
    const [last] = await this.db.select().from(imports).where(eq(imports.disciplineCode, 'astrology')).orderBy(desc(imports.id)).limit(1);
    return { loaded: !!a, knowledgeVersion: a?.version ?? null, rules: a?.rules.size ?? 0, sources: a?.sources.length ?? 0, entries: a?.order.length ?? 0, bundleVersion: last?.bundleVersion ?? null, importedAt: last?.importedAt.toISOString() ?? null };
  }

  /** loads the sources: the bundle built where they are, gzipped (kb: npm run upload:astrology) */
  @Put('bundle')
  @Access('owner')
  async upload(@Req() req: Request, @Query('force') force?: string) {
    const bundle = await readGzipBody(req, 24 * 1024 * 1024, 'npm run upload:astrology');
    try {
      const report = await importAstrology(this.db, bundle as Parameters<typeof importAstrology>[1], { force: force === '1' || force === 'true' });
      this.knowledge.invalidate();
      return report;
    } catch (e) {
      if (e instanceof BundleError) throw new BadRequestException(e.message);
      throw e;
    }
  }

}

@Controller()
@Access('owner')
export class PeopleController {
  constructor(
    @Inject(PeopleService) private readonly people: PeopleService,
    @Inject(SyncService) private readonly sync: SyncService,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(ReadingsService) private readonly readings: ReadingsService,
  ) {}

  @Get('subjects')
  subjects() { return this.people.subjects(); }

  @Post('subjects')
  createSubject(@Body(new ZodPipe(SubjectBody)) body: SubjectInput) { return this.people.createSubject(body); }

  @Get('subjects/:id')
  subject(@Param('id') id: string) { return this.people.subject(id); }

  @Put('subjects/:id')
  updateSubject(@Param('id') id: string, @Body(new ZodPipe(SubjectBody)) body: SubjectInput) { return this.people.updateSubject(id, body); }

  @Delete('subjects/:id')
  @HttpCode(204)
  async deleteSubject(@Param('id') id: string) { await this.people.deleteSubject(id); }

  @Get('subjects/:id/brief')
  async brief(@Param('id') id: string, @Query('discipline') discipline = 'tuvi') {
    if (!['tuvi', 'numerology', 'astrology'].includes(discipline)) throw new BadRequestException(`Chưa có môn ${discipline}`);
    await this.people.subject(id);
    const b = await this.sync.brief(id, discipline);
    if (!b) throw new NotFoundException('Người này chưa có profile');
    return b;
  }

  @Get('links/sonic-hub/persons')
  sonicHubPersons() { return this.people.sonicHubPersons(); }

  @Get('links/sonic-hub/:personId')
  async linked(@Param('personId') personId: string) {
    const s = await this.people.subjectOfSonicHub(personId);
    if (!s) throw new NotFoundException('Người này chưa được liên kết');
    return s;
  }

  /** links a Sonic Hub person, pulling their name and birth from Sonic Hub */
  @Post('links/sonic-hub/:personId')
  @HttpCode(200)
  link(@Param('personId') personId: string) { return this.people.linkSonicHub(personId); }

  /** Sonic Hub pushes a person's identity after an edit there; only someone already linked here is updated */
  @Put('links/sonic-hub/:personId')
  @Access('sync')
  async push(@Param('personId') personId: string, @Body() body: SonicHubPerson) {
    const s = await this.people.refreshFromSonicHub(personId, { ...body, id: personId });
    if (!s) throw new NotFoundException('Người này chưa được liên kết');
    return s;
  }

  /** the person was deleted in Sonic Hub: the subject stays here with its profiles, no longer linked */
  @Delete('links/sonic-hub/:personId')
  @Access('sync')
  @HttpCode(204)
  async unlink(@Param('personId') personId: string) { await this.people.unlinkSonicHub(personId); }

  @Post('profiles')
  createProfile(@Body(new ZodPipe(ProfileBody)) body: ProfileInput) { return this.people.createProfile(body); }

  @Get('profiles/:id')
  profile(@Param('id') id: string) { return this.people.profile(id); }

  @Patch('profiles/:id')
  updateProfile(@Param('id') id: string, @Body(new ZodPipe(ProfilePatch)) body: z.infer<typeof ProfilePatch>) { return this.people.updateProfile(id, body); }

  @Delete('profiles/:id')
  @HttpCode(204)
  async deleteProfile(@Param('id') id: string) { await this.people.deleteProfile(id); }

  /** ?year= the calendar year whose personal year is read (tử vi: the year viewed); nhân số học: ?name= another of its names */
  @Get('profiles/:id/reading')
  profileReadingOf(@Param('id') id: string, @Query('year') year?: string, @Query('name') name?: string) { return this.people.profileReading(id, optInt(year), optInt(name)); }

  /** every written reading of a profile (the app's AI ones and those written with Claude) */
  @Get('profiles/:id/ai-readings')
  aiReadings(@Param('id') id: string) { return this.readings.list(id); }

  @Post('profiles/:id/ai-readings')
  generate(@Param('id') id: string, @Body(new ZodPipe(AiBody)) body: z.infer<typeof AiBody>) { return this.ai.generate(id, body.scope, body.viewYear); }

  /** saves a reading written with Claude for one scope ('tong-hop' for nhân số học; a tử vi scope); it replaces the
      one of the same scope and year */
  @Put('profiles/:id/readings/:scope')
  putReading(@Param('id') id: string, @Param('scope') scope: string, @Body(new ZodPipe(WrittenBody)) body: WrittenBodyT) { return this.readings.put(id, scope, body); }

  @Delete('ai-readings/:id')
  @HttpCode(204)
  async removeReading(@Param('id') id: string) { await this.readings.remove(id); }
}
