import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { asc, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DisciplineDto } from '@mystic/engine/api';
import { AiService } from '../ai/ai.service.js';
import { BooksService } from '../books/books.service.js';
import { Access, ZodPipe } from '../common/access.js';
import { DB, type Db } from '../db/db.js';
import { disciplines } from '../db/schema.js';
import { KnowledgeService } from '../kb/knowledge.service.js';
import { PeopleService, ProfileBody, ProfilePatch, SubjectBody, type ProfileInput, type SubjectInput } from '../people/people.service.js';
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
    return { ok: true, knowledgeVersion: k.version, rules: k.rules.size };
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
  search(@Query('q') q = '', @Query('discipline') discipline = 'tuvi', @Query('limit') limit?: string) { return this.books.search(q, discipline, optInt(limit)); }

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

@Controller()
@Access('owner')
export class PeopleController {
  constructor(@Inject(PeopleService) private readonly people: PeopleService, @Inject(SyncService) private readonly sync: SyncService, @Inject(AiService) private readonly ai: AiService) {}

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

  /** Sonic Hub pushes a person's identity after an edit there */
  @Put('links/sonic-hub/:personId')
  @Access('sync')
  push(@Param('personId') personId: string, @Body() body: SonicHubPerson) { return this.people.upsertFromSonicHub(personId, { ...body, id: personId }); }

  @Post('profiles')
  createProfile(@Body(new ZodPipe(ProfileBody)) body: ProfileInput) { return this.people.createProfile(body); }

  @Get('profiles/:id')
  profile(@Param('id') id: string) { return this.people.profile(id); }

  @Patch('profiles/:id')
  updateProfile(@Param('id') id: string, @Body(new ZodPipe(ProfilePatch)) body: z.infer<typeof ProfilePatch>) { return this.people.updateProfile(id, body); }

  @Delete('profiles/:id')
  @HttpCode(204)
  async deleteProfile(@Param('id') id: string) { await this.people.deleteProfile(id); }

  @Get('profiles/:id/reading')
  profileReading(@Param('id') id: string, @Query('year') year?: string) { return this.people.profileReading(id, optInt(year)); }

  @Get('profiles/:id/ai-readings')
  aiReadings(@Param('id') id: string) { return this.ai.list(id); }

  @Post('profiles/:id/ai-readings')
  generate(@Param('id') id: string, @Body(new ZodPipe(AiBody)) body: z.infer<typeof AiBody>) { return this.ai.generate(id, body.scope, body.viewYear); }

  @Delete('ai-readings/:id')
  @HttpCode(204)
  async removeReading(@Param('id') id: string) { await this.ai.remove(id); }
}
