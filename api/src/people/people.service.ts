/* The people a reading is about, their links to Sonic Hub, and their profiles — one reading of one person at one
   moment. A profile keeps the birth exactly as it was read; editing the person later never changes an old profile. */
import { BadGatewayException, BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { ENGINE_VERSION } from '@mystic/engine';
import type { BirthDto, Gender, LinkDto, ProfileDto, ProfileSummaryDto, SonicHubPersonDto, SubjectDto, TuViReadingDto, TuViSettings } from '@mystic/engine/api';
import { DB, type Db } from '../db/db.js';
import { accounts, outbox, profiles, readings, subjectLinks, subjects, tuviProfileSettings } from '../db/schema.js';
import { KnowledgeService } from '../kb/knowledge.service.js';
import { SyncService } from '../sync/sync.service.js';
import { SonicHubClient, type SonicHubPerson } from '../sync/sonic-hub.client.js';
import { TuViService, chartOf, optionsOf } from '../tuvi/tuvi.service.js';
import { BirthBody, birthColumns, birthDto, birthInputOf, offsetOf, type BirthColumns } from './birth.js';

export const SONIC_HUB = 'sonic-hub';
const thisYear = () => new Date().getFullYear();

export const SubjectBody = z.object({
  displayName: z.string().trim().min(1, 'Chưa nhập tên').max(200),
  gender: z.enum(['male', 'female']).nullable().default(null),
  birth: BirthBody.default(BirthBody.parse({})),
  note: z.string().max(2000).nullable().default(null),
});
export type SubjectInput = z.infer<typeof SubjectBody>;

export const SettingsBody = z.object({
  variant: z.enum(['ba', 'sach']).default('ba'),
  leapMonth: z.enum(['same', 'split15']).default('same'),
  tyNextDay: z.boolean().default(true),
  lunarCalendar: z.enum(['auto', 'utc7', 'utc8']).default('auto'),
  hourBasis: z.enum(['clock', 'true_solar']).default('clock'),
});

export const ProfileBody = z.object({
  subjectId: z.string().uuid(),
  discipline: z.literal('tuvi').default('tuvi'),
  label: z.string().trim().max(200).nullable().default(null),
  viewYear: z.number().int().min(1800).max(2200).nullable().default(null),
  note: z.string().max(2000).nullable().default(null),
  /** when the person has none, or to read another hour or date than the person's */
  gender: z.enum(['male', 'female']).nullable().default(null),
  birth: BirthBody.partial().nullable().default(null),
  settings: SettingsBody.default(SettingsBody.parse({})),
});
export type ProfileInput = z.infer<typeof ProfileBody>;

export const ProfilePatch = z.object({
  label: z.string().trim().max(200).nullable().optional(),
  viewYear: z.number().int().min(1800).max(2200).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  settings: SettingsBody.partial().optional(),
});

type SubjectRow = typeof subjects.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;
type SettingsRow = typeof tuviProfileSettings.$inferSelect;

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const settingsDto = (s: SettingsRow | undefined): TuViSettings => ({
  variant: s?.variant ?? 'ba', leapMonth: s?.leapMonth ?? 'same', tyNextDay: s?.tyNextDay ?? true, lunarCalendar: s?.lunarCalendar ?? 'auto', hourBasis: s?.hourBasis ?? 'clock',
});

@Injectable()
export class PeopleService {
  private owner: Promise<string> | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(TuViService) private readonly tuvi: TuViService,
    @Inject(SonicHubClient) private readonly hub: SonicHubClient,
    @Inject(SyncService) private readonly sync: SyncService,
  ) {}

  /** the owner's account (made on first use) */
  ownerId(name = 'Chủ nhà'): Promise<string> {
    this.owner ??= (async () => {
      const [a] = await this.db.select({ id: accounts.id }).from(accounts).orderBy(asc(accounts.createdAt)).limit(1);
      if (a) return a.id;
      const [made] = await this.db.insert(accounts).values({ name }).returning({ id: accounts.id });
      return made.id;
    })().catch(e => { this.owner = null; throw e; });
    return this.owner;
  }

  // ── subjects ──

  async subjects(): Promise<SubjectDto[]> {
    const rows = await this.db.select().from(subjects).orderBy(desc(subjects.updatedAt));
    return this.subjectDtos(rows);
  }

  async subject(id: string): Promise<SubjectDto> {
    const [s] = await this.db.select().from(subjects).where(eq(subjects.id, id));
    if (!s) throw new NotFoundException('Không tìm thấy người này');
    return (await this.subjectDtos([s]))[0];
  }

  private async subjectDtos(rows: SubjectRow[]): Promise<SubjectDto[]> {
    if (!rows.length) return [];
    const ids = rows.map(s => s.id);
    const links = await this.db.select().from(subjectLinks).where(inArray(subjectLinks.subjectId, ids));
    const ps = await this.db.select().from(profiles).where(inArray(profiles.subjectId, ids)).orderBy(desc(profiles.createdAt));
    const ai = ps.length ? await this.db.select({ profileId: readings.profileId, n: count() }).from(readings).where(inArray(readings.profileId, ps.map(p => p.id))).groupBy(readings.profileId) : [];
    const aiOf = new Map(ai.map(a => [a.profileId, a.n]));
    return rows.map(s => ({
      id: s.id, displayName: s.displayName, gender: s.gender, birth: birthDto(s), note: s.note,
      links: links.filter(l => l.subjectId === s.id).map(linkDto),
      profiles: ps.filter(p => p.subjectId === s.id).map(p => profileSummary(p, aiOf.get(p.id) ?? 0)),
      createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async createSubject(input: SubjectInput): Promise<SubjectDto> {
    const birth = withOffset(input.birth);
    const [s] = await this.db.insert(subjects).values({ accountId: await this.ownerId(), displayName: input.displayName, gender: input.gender, note: input.note, ...birthColumns(birth) }).returning();
    return this.subject(s.id);
  }

  async updateSubject(id: string, input: SubjectInput): Promise<SubjectDto> {
    const owned = await this.db.select().from(subjectLinks).where(and(eq(subjectLinks.subjectId, id), eq(subjectLinks.ownsIdentity, true)));
    if (owned.length) {
      // the name and the birth are edited where the person lives (Sonic Hub); only the note is kept here
      await this.db.update(subjects).set({ note: input.note }).where(eq(subjects.id, id));
      return this.subject(id);
    }
    const [s] = await this.db.update(subjects).set({ displayName: input.displayName, gender: input.gender, note: input.note, ...birthColumns(withOffset(input.birth)) }).where(eq(subjects.id, id)).returning();
    if (!s) throw new NotFoundException('Không tìm thấy người này');
    return this.subject(id);
  }

  async deleteSubject(id: string): Promise<void> {
    const links = await this.db.select().from(subjectLinks).where(eq(subjectLinks.subjectId, id));
    const ps = await this.db.select({ discipline: profiles.disciplineCode }).from(profiles).where(eq(profiles.subjectId, id));
    const done = await this.db.delete(subjects).where(eq(subjects.id, id)).returning({ id: subjects.id });
    if (!done.length) throw new NotFoundException('Không tìm thấy người này');
    for (const l of links) for (const d of new Set(ps.map(p => p.discipline))) await this.sync.withdraw(l.system, l.externalId, d);
  }

  // ── Sonic Hub ──

  async sonicHubPersons(): Promise<SonicHubPersonDto[]> {
    try { return await this.hub.persons(); } catch (e) { throw new BadGatewayException(`Không đọc được danh sách người từ Sonic Hub: ${(e as Error).message}`); }
  }

  /** links a Sonic Hub person (pulling their name and birth) — or refreshes an existing link */
  async linkSonicHub(personId: string): Promise<SubjectDto> {
    let person: SonicHubPerson;
    try { person = await this.hub.person(personId); } catch (e) { throw new BadRequestException(`Không đọc được người này từ Sonic Hub: ${(e as Error).message}`); }
    return this.upsertFromSonicHub(personId, person);
  }

  /** Sonic Hub pushes a person's identity after it changed there (signed with the sync token) */
  async upsertFromSonicHub(personId: string, person: SonicHubPerson): Promise<SubjectDto> {
    const identity = identityOf(person);
    const [link] = await this.db.select().from(subjectLinks).where(and(eq(subjectLinks.system, SONIC_HUB), eq(subjectLinks.externalId, personId)));
    let id: string;
    if (link) {
      id = link.subjectId;
      await this.db.update(subjects).set(identity).where(eq(subjects.id, id));
      await this.db.update(subjectLinks).set({ syncedAt: new Date() }).where(and(eq(subjectLinks.system, SONIC_HUB), eq(subjectLinks.externalId, personId)));
    } else {
      const [s] = await this.db.insert(subjects).values({ accountId: await this.ownerId(), ...identity }).returning({ id: subjects.id });
      id = s.id;
      await this.db.insert(subjectLinks).values({ system: SONIC_HUB, externalId: personId, subjectId: id, ownsIdentity: true, syncedAt: new Date() });
    }
    await this.sync.briefChanged(id);
    return this.subject(id);
  }

  /** a push from Sonic Hub: refreshes a linked person, and ignores anyone not linked here (null) */
  async refreshFromSonicHub(personId: string, person: SonicHubPerson): Promise<SubjectDto | null> {
    const [link] = await this.db.select({ id: subjectLinks.subjectId }).from(subjectLinks).where(and(eq(subjectLinks.system, SONIC_HUB), eq(subjectLinks.externalId, personId)));
    return link ? this.upsertFromSonicHub(personId, person) : null;
  }

  /** the person is gone from Sonic Hub: drop the link (and any brief still waiting to go there); the subject keeps its own copy */
  async unlinkSonicHub(personId: string): Promise<void> {
    const [link] = await this.db.delete(subjectLinks).where(and(eq(subjectLinks.system, SONIC_HUB), eq(subjectLinks.externalId, personId))).returning({ subjectId: subjectLinks.subjectId });
    await this.db.delete(outbox).where(and(eq(outbox.system, SONIC_HUB), eq(outbox.externalId, personId), isNull(outbox.sentAt)));
    if (link) await this.db.update(subjects).set({ updatedAt: new Date() }).where(eq(subjects.id, link.subjectId));
  }

  async subjectOfSonicHub(personId: string): Promise<SubjectDto | null> {
    const [link] = await this.db.select().from(subjectLinks).where(and(eq(subjectLinks.system, SONIC_HUB), eq(subjectLinks.externalId, personId)));
    return link ? this.subject(link.subjectId) : null;
  }

  // ── profiles ──

  async createProfile(input: ProfileInput): Promise<ProfileDto> {
    const [s] = await this.db.select().from(subjects).where(eq(subjects.id, input.subjectId));
    if (!s) throw new NotFoundException('Không tìm thấy người này');
    const gender = input.gender ?? s.gender;
    if (!gender) throw new BadRequestException('Chưa có giới tính của người này');
    const birth = withOffset({ ...birthDto(s), ...stripNulls(input.birth ?? {}) } as BirthDto);
    // a profile that cannot be read is refused now, not when it is opened
    chartOf(birthInputOf(gender, birth), optionsOf(input.settings, input.viewYear ?? thisYear()));
    const k = await this.knowledge.get();
    const id = await this.db.transaction(async tx => {
      const [p] = await tx.insert(profiles).values({
        subjectId: s.id, disciplineCode: input.discipline, label: input.label, viewYear: input.viewYear, note: input.note, gender,
        ...birthColumns(birth), engineVersion: ENGINE_VERSION, knowledgeVersion: k.version,
      }).returning({ id: profiles.id });
      await tx.insert(tuviProfileSettings).values({ profileId: p.id, ...input.settings });
      await tx.update(subjects).set({ updatedAt: new Date() }).where(eq(subjects.id, s.id));
      return p.id;
    });
    await this.sync.briefChanged(s.id);
    return this.profile(id);
  }

  private async profileRows(id: string): Promise<{ p: ProfileRow; s: SubjectRow; settings: SettingsRow | undefined }> {
    const [row] = await this.db.select({ p: profiles, s: subjects, settings: tuviProfileSettings }).from(profiles)
      .innerJoin(subjects, eq(subjects.id, profiles.subjectId)).leftJoin(tuviProfileSettings, eq(tuviProfileSettings.profileId, profiles.id)).where(eq(profiles.id, id));
    if (!row) throw new NotFoundException('Không tìm thấy profile này');
    return { p: row.p, s: row.s, settings: row.settings ?? undefined };
  }

  async profile(id: string): Promise<ProfileDto> {
    const { p, s, settings } = await this.profileRows(id);
    const links = await this.db.select().from(subjectLinks).where(eq(subjectLinks.subjectId, s.id));
    const k = await this.knowledge.get();
    return {
      id: p.id, discipline: p.disciplineCode, label: p.label, viewYear: p.viewYear, note: p.note,
      subject: { id: s.id, displayName: s.displayName, links: links.map(linkDto) },
      gender: p.gender, birth: birthDto(p), settings: settingsDto(settings),
      engineVersion: p.engineVersion, knowledgeVersion: p.knowledgeVersion, knowledgeChanged: p.knowledgeVersion !== k.version,
      createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    };
  }

  /** the engine input and settings of a profile */
  async profileInput(id: string) {
    const { p, s, settings } = await this.profileRows(id);
    return { profile: p, subject: s, birth: birthInputOf(p.gender, birthDto(p)), settings: settingsDto(settings) };
  }

  async profileReading(id: string, year?: number): Promise<TuViReadingDto> {
    const { profile, birth, settings } = await this.profileInput(id);
    return this.tuvi.reading(birth, settings, year ?? profile.viewYear ?? thisYear());
  }

  async updateProfile(id: string, patch: z.infer<typeof ProfilePatch>): Promise<ProfileDto> {
    const { p, settings } = await this.profileRows(id);
    const set: Partial<typeof profiles.$inferInsert> = {};
    if (patch.label !== undefined) set.label = patch.label;
    if (patch.viewYear !== undefined) set.viewYear = patch.viewYear;
    if (patch.note !== undefined) set.note = patch.note;
    if (patch.settings) {
      const next = { ...settingsDto(settings), ...patch.settings };
      chartOf(birthInputOf(p.gender, birthDto(p)), optionsOf(next, p.viewYear ?? thisYear()));
      await this.db.insert(tuviProfileSettings).values({ profileId: id, ...next }).onConflictDoUpdate({ target: tuviProfileSettings.profileId, set: { ...next, updatedAt: new Date() } });
    }
    await this.db.update(profiles).set({ ...set, updatedAt: new Date() }).where(eq(profiles.id, id));
    await this.sync.briefChanged(p.subjectId);
    return this.profile(id);
  }

  async deleteProfile(id: string): Promise<void> {
    const [p] = await this.db.delete(profiles).where(eq(profiles.id, id)).returning({ subjectId: profiles.subjectId, discipline: profiles.disciplineCode });
    if (!p) throw new NotFoundException('Không tìm thấy profile này');
    await this.sync.briefChanged(p.subjectId, [p.discipline]);
  }
}

const linkDto = (l: typeof subjectLinks.$inferSelect): LinkDto => ({ system: l.system, externalId: l.externalId, ownsIdentity: l.ownsIdentity, syncedAt: iso(l.syncedAt) });
const profileSummary = (p: ProfileRow, aiReadings: number): ProfileSummaryDto => ({
  id: p.id, discipline: p.disciplineCode, label: p.label, viewYear: p.viewYear, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), aiReadings,
});

function stripNulls<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as Partial<T>;
}

/** fills the UTC offset from the zone when only the zone is known */
function withOffset(b: BirthDto): BirthDto {
  if (b.utcOffsetMinutes !== null || !b.timeZone || b.calendar !== 'solar' || b.year === null || b.month === null || b.day === null) return b;
  return { ...b, utcOffsetMinutes: offsetOf(b.timeZone, b.year, b.month, b.day, b.time ?? '12:00') };
}

/** a Sonic Hub person as a subject's identity */
function identityOf(p: SonicHubPerson): Pick<SubjectRow, 'displayName' | 'gender'> & BirthColumns {
  let [y, m, d] = [p.birthYear ?? null, p.birthMonth ?? null, p.birthDay ?? null];
  if (p.dateOfBirth) [y, m, d] = p.dateOfBirth.split('-').map(Number);
  const time = p.birthTime ? p.birthTime.slice(0, 5) : null;
  const birth = withOffset({
    calendar: 'solar', year: y, month: m, day: d, leapMonth: false, time, hourBranch: null, timeApprox: !!p.birthTimeApprox,
    timeZone: p.birthTimeZone ?? (time ? 'Asia/Ho_Chi_Minh' : null), utcOffsetMinutes: p.birthUtcOffsetMinutes ?? null,
    place: p.birthPlace ?? null, latitude: p.birthLatitude ?? null, longitude: p.birthLongitude ?? null,
  });
  const gender: Gender | null = p.gender === 'MALE' ? 'male' : p.gender === 'FEMALE' ? 'female' : null;
  return { displayName: p.name || p.displayName || 'Không tên', gender, ...birthColumns(birth) };
}
