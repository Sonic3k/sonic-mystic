/* The brief Sonic Hub keeps beside a person: the newest profile's key facts and a few lines, grandma's apart from the
   added ones. Every change queues a send in the outbox; a background loop delivers it and retries until Sonic Hub has it. */
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, asc, desc, eq, isNull, lte, sql } from 'drizzle-orm';
import { BRANCHES, STEMS, canChiName, readView } from '@mystic/engine/tuvi';
import type { BriefDto } from '@mystic/engine/api';
import { APP_CONFIG } from '../common/tokens.js';
import type { AppConfig } from '../config.js';
import { DB, type Db } from '../db/db.js';
import { outbox, profiles, readingItems, readingSections, readings, subjectLinks, tuviProfileSettings } from '../db/schema.js';
import { KnowledgeService } from '../kb/knowledge.service.js';
import { birthDto, birthInputOf } from '../people/birth.js';
import { chartOf, optionsOf } from '../tuvi/tuvi.service.js';
import { SonicHubClient, SonicHubError } from './sonic-hub.client.js';

const GIO_SPAN = (b: number) => (b === 0 ? '23–1 giờ' : `${2 * b - 1}–${2 * b + 1} giờ`);
const LEVEL = { M: 'miếu', V: 'vượng', D: 'đắc', B: 'bình', H: 'hãm' } as const;
const thisYear = () => new Date().getFullYear();

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('SyncService');
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(SonicHubClient) private readonly hub: SonicHubClient,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
  ) {}

  onModuleInit(): void {
    if (this.config.syncWorker && this.hub.configured) this.timer = setInterval(() => void this.run(), 10_000);
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  /** a subject's profiles or readings changed: queue a brief for each linked system and each discipline it touches */
  async briefChanged(subjectId: string, alsoDisciplines: string[] = []): Promise<void> {
    const links = await this.db.select().from(subjectLinks).where(eq(subjectLinks.subjectId, subjectId));
    if (!links.length) return;
    const ds = await this.db.selectDistinct({ d: profiles.disciplineCode }).from(profiles).where(eq(profiles.subjectId, subjectId));
    const disciplines = new Set([...alsoDisciplines, ...ds.map(x => x.d)]);
    for (const l of links) for (const d of disciplines) await this.enqueue(l.system, l.externalId, d, subjectId);
  }

  /** the person is gone here: ask the other side to drop its brief */
  withdraw(system: string, externalId: string, discipline: string): Promise<void> { return this.enqueue(system, externalId, discipline, null); }

  private async enqueue(system: string, externalId: string, discipline: string, subjectId: string | null): Promise<void> {
    const pending = and(eq(outbox.system, system), eq(outbox.externalId, externalId), eq(outbox.disciplineCode, discipline), isNull(outbox.sentAt));
    const [open] = await this.db.select({ id: outbox.id }).from(outbox).where(pending).limit(1);
    if (open) await this.db.update(outbox).set({ subjectId, nextAttemptAt: new Date(), attempts: 0, lastError: null }).where(eq(outbox.id, open.id));
    else await this.db.insert(outbox).values({ topic: 'brief', system, externalId, disciplineCode: discipline, subjectId });
  }

  /** delivers what is due; returns how many went out */
  async run(): Promise<number> {
    if (this.running || !this.hub.configured) return 0;
    this.running = true;
    let sent = 0;
    try {
      const due = await this.db.select().from(outbox).where(and(isNull(outbox.sentAt), lte(outbox.nextAttemptAt, new Date()))).orderBy(asc(outbox.id)).limit(20);
      for (const row of due) {
        try {
          if (row.system === 'sonic-hub') {
            const brief = row.subjectId ? await this.brief(row.subjectId, row.disciplineCode) : null;
            if (brief) await this.hub.putBrief(row.externalId, brief);
            else await this.hub.deleteBrief(row.externalId, row.disciplineCode);
          }
          await this.db.update(outbox).set({ sentAt: new Date(), lastError: null }).where(eq(outbox.id, row.id));
          sent++;
        } catch (e) {
          if (e instanceof SonicHubError && e.status === 404) {
            // the person is not (or no longer) in Sonic Hub: nothing to deliver to, so this one is done
            await this.db.update(outbox).set({ sentAt: new Date(), lastError: e.message.slice(0, 500) }).where(eq(outbox.id, row.id));
            this.log.warn(`brief for ${row.externalId} (${row.disciplineCode}) dropped: ${e.message}`);
            continue;
          }
          const attempts = row.attempts + 1, wait = Math.min(3600, 30 * 2 ** Math.min(attempts, 7));
          await this.db.update(outbox).set({ attempts, lastError: (e as Error).message.slice(0, 500), nextAttemptAt: new Date(Date.now() + wait * 1000) }).where(eq(outbox.id, row.id));
          this.log.warn(`brief for ${row.externalId} (${row.disciplineCode}) failed, retry in ${wait}s: ${(e as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
    return sent;
  }

  async pending(): Promise<number> {
    const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(outbox).where(isNull(outbox.sentAt));
    return r.n;
  }

  /** the brief of a subject's newest profile in a discipline (null when there is none) */
  async brief(subjectId: string, discipline: string): Promise<BriefDto | null> {
    const [row] = await this.db.select({ p: profiles, settings: tuviProfileSettings }).from(profiles)
      .leftJoin(tuviProfileSettings, eq(tuviProfileSettings.profileId, profiles.id))
      .where(and(eq(profiles.subjectId, subjectId), eq(profiles.disciplineCode, discipline))).orderBy(desc(profiles.updatedAt)).limit(1);
    if (!row) return null;
    const p = row.p;
    const year = p.viewYear ?? thisYear();
    const chart = chartOf(birthInputOf(p.gender, birthDto(p)), optionsOf(row.settings ?? undefined, year));
    const menh = chart.palaces[chart.menh];
    const mains = menh.stars.filter(s => s.kind === 'chinh').map(s => `${s.name}${s.level ? ` (${LEVEL[s.level]})` : ''}`);
    const facts = [
      { label: 'Âm lịch', value: `${chart.lunar.day}/${chart.lunar.month}${chart.lunar.leap ? ' nhuận' : ''} năm ${canChiName(chart.stem, chart.branch)}` },
      { label: 'Giờ sinh', value: `${BRANCHES[chart.hour]} (${GIO_SPAN(chart.hour)})${p.birthTimeApprox ? ', ước chừng' : ''}` },
      { label: 'Mệnh', value: `cung ${STEMS[menh.stem]} ${BRANCHES[menh.branch]} · ${mains.join(', ') || 'vô chính diệu'}` },
      { label: 'Thân cư', value: chart.palaces[chart.than].role },
      { label: 'Âm dương', value: chart.amDuong },
      { label: 'Nạp âm', value: chart.napAm.name },
      { label: 'Cục', value: chart.cuc.name },
    ];

    // lines: the overview the AI wrote for this profile, else grandma's first sentences about the stars in Mệnh
    const lines: BriefDto['lines'] = [];
    const [ai] = await this.db.select({ id: readings.id }).from(readings).where(and(eq(readings.profileId, p.id), eq(readings.scope, 'tong-quan'))).orderBy(desc(readings.updatedAt)).limit(1);
    if (ai) {
      const items = await this.db.select({ layer: readingItems.layer, text: readingItems.text, s: readingSections.ordinal, o: readingItems.ordinal }).from(readingItems)
        .innerJoin(readingSections, eq(readingSections.id, readingItems.sectionId)).where(eq(readingSections.readingId, ai.id)).orderBy(asc(readingSections.ordinal), asc(readingItems.ordinal));
      for (const it of items.filter(i => i.layer === 'primary').slice(0, 3)) lines.push({ layer: 'primary', text: it.text, source: 'Tóm lược lời bà' });
      const added = items.find(i => i.layer === 'added');
      if (added) lines.push({ layer: 'added', text: added.text, source: 'AI luận thêm — không phải lời bà' });
    }
    if (!lines.length) {
      const k = await this.knowledge.get();
      const r = readView(chart, k.kb, 'Mệnh', year);
      for (const g of r.ba.filter(x => x.inPalace)) for (const m of g.matches) {
        if (lines.length >= 3) break;
        lines.push({ layer: 'primary', text: m.rule.ctx ? `(${m.rule.ctx}) ${m.rule.text}` : m.rule.text, source: `Lời bà · ${g.name}` });
      }
    }
    const base = this.config.publicWebUrl;
    return {
      discipline, title: 'Tử vi', subjectId, profileId: p.id, profileLabel: p.label,
      url: base ? `${base}/tu-vi/profile/${p.id}` : null, facts, lines, updatedAt: p.updatedAt.toISOString(),
    };
  }
}
