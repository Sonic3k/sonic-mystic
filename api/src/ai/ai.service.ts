/* Readings Claude writes for a profile. The server matches grandma's sentences itself and hands them over, so the
   first layer can only retell her lines (each idea cites them, and an idea that cites none is shown as added). */
import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  PALACES, chartSummary, hashOf, lineOf, principlesFor, readHan, readView,
  type Chart, type Group, type ReadingLine, type View,
} from '@mystic/engine/tuvi';
import type { AiReadingDto, AiStatusDto } from '@mystic/engine/api';
import { APP_CONFIG } from '../common/tokens.js';
import { oneLine } from '../common/text.js';
import type { AppConfig } from '../config.js';
import { DB, type Db } from '../db/db.js';
import { readingItemRefs, readingItems, readingSections, readings, rules } from '../db/schema.js';
import { KnowledgeService, type Knowledge } from '../kb/knowledge.service.js';
import { PeopleService } from '../people/people.service.js';
import { SyncService } from '../sync/sync.service.js';
import { chartOf, optionsOf } from '../tuvi/tuvi.service.js';

const MAX_LINES = 400, MAX_TEXT = 1200;

export const SYSTEM = `Bạn giúp một gia đình đọc lá số tử vi theo ghi chép tử vi của bà (bà ngoại của chủ nhà) để lại.

Bạn sẽ nhận được:
- Phạm vi cần luận và năm xem. Ví dụ: "tong-quan" là tổng quan cả lá số; tên một cung như "Quan Lộc" là riêng cung đó; "han-2026" là vận hạn năm 2026.
- Lá số: dữ liệu lá số đã an sao (các cung, các sao, đại hạn, tiểu hạn…).
- Các câu đã khớp với lá số, mỗi dòng một câu: [mã] (cung · nguồn) nội dung — why.
  Nguồn "ba" là câu trong ghi chép của bà; nguồn "bo-sung" là câu lấy từ sách khác, không phải của bà.
  Phần why là lý do câu khớp với lá số: sao nào, ở cung nào, miếu hay hãm, có gặp Tuần, Triệt không…

Bài luận gồm hai lớp, phải tách bạch tuyệt đối.

Lớp "ba" (lời của bà):
- Chỉ được tóm lược, sắp xếp, nối ý những câu có nguồn "ba" được đưa vào.
- Mỗi ý phải kèm "refs": mã của các câu gốc, chép đúng như trong ngoặc vuông.
- Không thêm bất cứ ý nào không có trong các câu đó, kể cả những điều sách tử vi nào cũng nói.
- Câu nguồn "bo-sung" không bao giờ được đưa vào lớp "ba".
- Giữ thuật ngữ của bà.
- Khi các câu trái nhau thì nói rõ là trái nhau, và nêu yếu tố làm nặng hay nhẹ có trong phần why (miếu hãm, Tuần Triệt…).
- Nhóm ý nào không có câu nguồn "ba" thì để "ba" là mảng rỗng.

Lớp "them" (luận giải thêm):
- Luận giải thêm theo kiến thức tử vi phổ thông, sách khác và hiểu biết của bạn; có thể dựa vào các câu nguồn "bo-sung".
- Viết như ý kiến bổ sung, không bao giờ gán cho bà (không viết "bà dặn", "theo bà", "theo ghi chép"…).
- Không lặp lại những gì đã có ở lớp "ba".

Mỗi section ứng với một nhóm ý: theo cung; hoặc theo tính cách, công danh, tài lộc, gia đạo… khi phạm vi là tổng quan; hoặc theo đại hạn, tiểu hạn khi phạm vi là vận hạn. "title" là tên ngắn của nhóm ý; mỗi ý trong "ba" và "them" là một đoạn ngắn. Viết gọn: tối đa 8 nhóm ý, mỗi lớp trong một nhóm tối đa 5 ý.

Văn phong: tiếng Việt tự nhiên, ấm áp, mạch lạc. Nói xu hướng chứ không phán định mệnh. Những ý về bệnh tật, tai nạn, chết chóc, con cái, hôn nhân đổ vỡ phải nói nhẹ nhàng, như điều nên lưu tâm. Không đưa lời khuyên y tế, pháp lý, tài chính cụ thể.

Không bịa sao, vị trí sao, tuổi hay số liệu không có trong dữ liệu lá số.

"caution": một câu nhắc rằng tử vi chỉ để tham khảo, chiêm nghiệm.

Chỉ trả về một đối tượng JSON đúng cấu trúc sau, không kèm chữ nào khác (không markdown, không lời dẫn):
{"sections":[{"title":"…","ba":[{"text":"…","refs":["<mã>"]}],"them":[{"text":"…"}]}],"caution":"…"}`;

const RETRY = 'Trả lời lại, chỉ một đối tượng JSON hợp lệ đúng cấu trúc đã yêu cầu.';
const SHORTER = 'Lần trước bài viết dài quá giới hạn. Lần này viết gọn: tối đa 7 nhóm ý, mỗi lớp trong một nhóm tối đa 4 ý, mỗi ý 1–3 câu.';

/** the answer's shape, for structured output (the same as Answer below) */
const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          ba: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } }, required: ['text', 'refs'], additionalProperties: false } },
          them: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } },
        },
        required: ['title', 'ba', 'them'],
        additionalProperties: false,
      },
    },
    caution: { type: 'string' },
  },
  required: ['sections', 'caution'],
  additionalProperties: false,
} as const;

const Answer = z.object({
  sections: z.array(z.object({
    title: z.string().default(''),
    ba: z.array(z.object({ text: z.string(), refs: z.array(z.string()).default([]) })).default([]),
    them: z.array(z.object({ text: z.string() })).default([]),
  })).min(1),
  caution: z.string().nullish(),
});
type AnswerT = z.infer<typeof Answer>;

const KEY_VIEWS: View[] = ['Mệnh', 'Thân', 'Phúc Đức', 'Quan Lộc', 'Tài Bạch', 'Phu Thê'];

/** the scopes one can ask for: the overview, a palace or Thân, the hạn of a year */
export function scopeOk(scope: string): boolean {
  return scope === 'tong-quan' || scope === 'Thân' || (PALACES as readonly string[]).includes(scope) || /^han-\d{4}$/.test(scope);
}

/** the matched lines a scope is written from — grandma's and the added ones, labelled */
export function linesFor(chart: Chart, k: Knowledge, scope: string, year: number): ReadingLine[] {
  const of = (gs: Group[], palace: string) => gs.flatMap(g => g.matches.map(m => lineOf(m, palace)));
  const principle = (id: string, palace: string): ReadingLine[] => { const p = k.kb.principles[id]; return p ? [{ ref: p.id, palace, source: 'bo-sung', text: `${p.title}: ${p.text}`, why: '' }] : []; };
  if (scope === 'tong-quan') {
    return [...KEY_VIEWS.flatMap(v => { const r = readView(chart, k.kb, v, year); return [...of(r.ba, v), ...of(r.boSung, v)]; }),
      ...principlesFor(chart, k.kb).flatMap(p => principle(p.id, 'Tổng quan'))];
  }
  const han = /^han-(\d{4})$/.exec(scope);
  if (han) {
    const h = readHan(chart, k.kb, Number(han[1]));
    const dai = h.dai ? chart.palaces[h.dai.branch].role : '', tieu = chart.palaces[h.tieu.branch].role;
    return [...(h.dai ? [...of(h.dai.ba, `Đại hạn ${dai}`), ...of(h.dai.boSung, `Đại hạn ${dai}`)] : []),
      ...of(h.tieu.ba, `Tiểu hạn ${tieu}`), ...of(h.tieu.boSung, `Tiểu hạn ${tieu}`), ...principle('dai_han', 'Hạn'), ...principle('tieu_han', 'Hạn')];
  }
  const v = scope as View, r = readView(chart, k.kb, v, year);
  return [...of(r.ba, v), ...of(r.boSung, v), ...(v === 'Mệnh' ? principlesFor(chart, k.kb).flatMap(p => principle(p.id, v)) : [])];
}

/** the text of a JSON object in an answer, read leniently: raw line breaks inside strings are allowed */
export function jsonIn(answer: string | null | undefined): unknown {
  if (!answer) return null;
  const a = answer.indexOf('{'), b = answer.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  let s = answer.slice(a, b + 1), out = '', inStr = false, esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      else if (ch === '\n') { out += '\\n'; continue; } else if (ch === '\r') continue; else if (ch === '\t') { out += '\\t'; continue; }
    } else if (ch === '"') inStr = true;
    out += ch;
  }
  s = out;
  try { return JSON.parse(s); } catch { return null; }
}

@Injectable()
export class AiService {
  private readonly log = new Logger('AiService');
  private readonly client: Anthropic | null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DB) private readonly db: Db,
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(PeopleService) private readonly people: PeopleService,
    @Inject(SyncService) private readonly sync: SyncService,
  ) {
    this.client = config.ai.apiKey ? new Anthropic({ apiKey: config.ai.apiKey, timeout: 240_000, maxRetries: 2 }) : null;
  }

  status(): AiStatusDto { return { ai: !!this.client, model: this.config.ai.model }; }

  async list(profileId: string): Promise<AiReadingDto[]> {
    const input = await this.people.profileInput(profileId);
    const rs = await this.db.select().from(readings).where(eq(readings.profileId, profileId)).orderBy(desc(readings.updatedAt));
    if (!rs.length) return [];
    const k = await this.knowledge.get();
    return Promise.all(rs.map(r => this.dto(r, r.inputHash !== this.input(input, k, r.scope, r.viewYear).hash)));
  }

  /** what a reading of one scope is written from, and the hash that tells when a stored reading no longer matches */
  private input({ birth, settings }: Awaited<ReturnType<PeopleService['profileInput']>>, k: Knowledge, scope: string, year: number) {
    const chart = chartOf(birth, optionsOf(settings, year));
    const lines = linesFor(chart, k, scope, year).slice(0, MAX_LINES);
    return { chart, lines, hash: hashOf(`${JSON.stringify(birth)}|${JSON.stringify(settings)}|${scope}|${year}|${lines.map(l => l.ref).join(',')}`) };
  }

  async remove(id: string): Promise<void> {
    const [r] = await this.db.delete(readings).where(eq(readings.id, id)).returning({ profileId: readings.profileId });
    if (!r) throw new NotFoundException('Không có bài luận này');
    const { subject } = await this.people.profileInput(r.profileId);
    await this.sync.briefChanged(subject.id);
  }

  /** asks Claude for a reading of one scope; it replaces the profile's older reading of the same scope and year */
  async generate(profileId: string, scope: string, viewYear?: number): Promise<AiReadingDto> {
    if (!this.client) throw new ServiceUnavailableException('AI chưa được bật trên máy chủ (thiếu ANTHROPIC_API_KEY)');
    if (!scopeOk(scope)) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope}`);
    const pi = await this.people.profileInput(profileId), { profile, subject } = pi;
    const year = viewYear ?? (scope.startsWith('han-') ? Number(scope.slice(4)) : profile.viewYear ?? new Date().getFullYear());
    const k = await this.knowledge.get();
    const { chart, lines, hash: inputHash } = this.input(pi, k, scope, year);
    const baRefs = new Set(lines.filter(l => l.source === 'ba').map(l => l.ref));
    if (!baRefs.size) throw new BadRequestException('Không có câu nào của bà khớp với phạm vi này để luận');
    const text = lines.map(l => {
      let t = oneLine(l.text);
      if (t.length > MAX_TEXT) t = `${t.slice(0, MAX_TEXT - 1)}…`;
      const why = oneLine(l.why);
      return `[${l.ref}] (${l.palace ? `${l.palace} · ` : ''}${l.source}) ${t}${why ? ` — ${why}` : ''}`;
    });
    const user = `Phạm vi: ${scope} (năm xem ${year})\n\nLá số:\n${chartSummary(chart, year)}\n\nCác câu đã khớp:\n${text.join('\n')}`;
    const answer = await this.ask(user);

    const id = await this.db.transaction(async tx => {
      await tx.delete(readings).where(and(eq(readings.profileId, profileId), eq(readings.scope, scope), eq(readings.viewYear, year)));
      const [r] = await tx.insert(readings).values({ profileId, scope, viewYear: year, author: 'ai', model: this.config.ai.model, inputHash, caution: answer.caution?.trim() || null }).returning({ id: readings.id });
      const codes = [...new Set(answer.sections.flatMap(s => s.ba.flatMap(b => b.refs)))].filter(c => baRefs.has(c));
      const ruleRows = codes.length ? await tx.select({ id: rules.id, code: rules.code, text: rules.text }).from(rules).where(inArray(rules.code, codes)) : [];
      const ruleOf = new Map(ruleRows.map(x => [x.code, x]));
      for (const [si, s] of answer.sections.entries()) {
        const [sec] = await tx.insert(readingSections).values({ readingId: r.id, ordinal: si, title: s.title.trim() || '—' }).returning({ id: readingSections.id });
        let o = 0;
        for (const b of s.ba) {
          const refs = [...new Set(b.refs)].filter(c => baRefs.has(c));
          if (!b.text.trim()) continue;
          // an idea that cites none of her lines is not shown as hers
          const [item] = await tx.insert(readingItems).values({ sectionId: sec.id, ordinal: o++, layer: refs.length ? 'primary' : 'added', text: b.text.trim() }).returning({ id: readingItems.id });
          if (refs.length) await tx.insert(readingItemRefs).values(refs.map(c => ({ itemId: item.id, ruleCode: c, ruleId: ruleOf.get(c)?.id ?? null, quotedText: ruleOf.get(c)?.text ?? k.rules.get(c)?.text ?? '' }))).onConflictDoNothing();
        }
        for (const t of s.them) if (t.text.trim()) await tx.insert(readingItems).values({ sectionId: sec.id, ordinal: o++, layer: 'added', text: t.text.trim() });
      }
      return r.id;
    });
    if (scope === 'tong-quan') await this.sync.briefChanged(subject.id);
    const [saved] = await this.db.select().from(readings).where(eq(readings.id, id));
    return this.dto(saved, false);
  }

  /**
   * One answer as the JSON the reading is stored from. The model is held to ANSWER_SCHEMA (structured output); an
   * answer cut off by the token limit is asked again, shorter. Models without structured output get the plain prompt.
   */
  private async ask(user: string): Promise<AnswerT> {
    let structured = true;
    const call = async (messages: Anthropic.MessageParam[]) => {
      try {
        const msg = await this.client!.messages.create({
          model: this.config.ai.model, max_tokens: this.config.ai.maxTokens, system: SYSTEM, messages,
          ...(structured ? { output_config: { format: { type: 'json_schema' as const, schema: ANSWER_SCHEMA } } } : {}),
        });
        return { text: msg.content.map(b => (b.type === 'text' ? b.text : '')).join(''), stop: msg.stop_reason, tokens: msg.usage.output_tokens };
      } catch (e) {
        const m = (e as Error).message;
        if (structured && e instanceof Anthropic.BadRequestError && /output_config|format|schema/i.test(m)) {
          this.log.warn(`structured output refused, asking without it: ${m}`);
          structured = false;
          return call(messages);
        }
        throw new ServiceUnavailableException(`Không gọi được AI: ${m}`);
      }
    };
    const parsed = (r: { text: string }) => Answer.safeParse(jsonIn(r.text));
    const first = await call([{ role: 'user', content: user }]);
    const a = parsed(first);
    if (a.success) return a.data;
    this.log.warn(`answer not usable (stop ${first.stop}, ${first.tokens} tokens, ${first.text.length} chars), asking again`);
    if (first.stop === 'refusal') throw new ServiceUnavailableException('AI từ chối viết bài này');
    const again = first.stop === 'max_tokens' || !first.text.trim()
      ? await call([{ role: 'user', content: `${user}\n\n${SHORTER}` }])
      : await call([{ role: 'user', content: user }, { role: 'assistant', content: first.text }, { role: 'user', content: RETRY }]);
    const b = parsed(again);
    if (b.success) return b.data;
    this.log.warn(`answer still not usable (stop ${again.stop}, ${again.tokens} tokens, ${again.text.length} chars)`);
    throw new ServiceUnavailableException(again.stop === 'max_tokens' ? 'Bài luận dài quá giới hạn, thử lại sau' : 'AI trả lời không đúng định dạng');
  }

  private async dto(r: typeof readings.$inferSelect, stale: boolean): Promise<AiReadingDto> {
    const secs = await this.db.select().from(readingSections).where(eq(readingSections.readingId, r.id)).orderBy(asc(readingSections.ordinal));
    const items = secs.length ? await this.db.select().from(readingItems).where(inArray(readingItems.sectionId, secs.map(s => s.id))).orderBy(asc(readingItems.sectionId), asc(readingItems.ordinal)) : [];
    const refs = items.length ? await this.db.select().from(readingItemRefs).where(inArray(readingItemRefs.itemId, items.map(i => i.id))) : [];
    return {
      id: r.id, profileId: r.profileId, scope: r.scope, viewYear: r.viewYear, model: r.model, inputHash: r.inputHash, caution: r.caution,
      sections: secs.map(s => ({
        title: s.title,
        items: items.filter(i => i.sectionId === s.id).map(i => ({ layer: i.layer, text: i.text, refs: refs.filter(x => x.itemId === i.id).map(x => ({ code: x.ruleCode, quoted: x.quotedText })) })),
      })),
      createdAt: r.createdAt.toISOString(), stale,
    };
  }
}
