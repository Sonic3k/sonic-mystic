/* Tử vi readings the app's own AI call writes for a profile (readings written with Claude are saved through
   ReadingsService.put instead). The server matches grandma's sentences itself and hands them over, so the first layer
   can only retell her lines (each idea cites them, and an idea that cites none is shown as added). */
import Anthropic from '@anthropic-ai/sdk';
import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { AiReadingDto, AiStatusDto } from '@mystic/engine/api';
import { APP_CONFIG } from '../common/tokens.js';
import { oneLine } from '../common/text.js';
import type { AppConfig } from '../config.js';
import { KnowledgeService } from '../kb/knowledge.service.js';
import { PeopleService } from '../people/people.service.js';
import { ReadingsService } from '../readings/readings.service.js';
import { chartSummary, linesFor, scopeOk, tuviInput } from './lines.js';

export { linesFor, scopeOk };

const MAX_TEXT = 1200;

export const SYSTEM = `Bạn giúp một gia đình đọc lá số tử vi theo ghi chép tử vi của bà (bà ngoại của chủ nhà) để lại.

Bạn sẽ nhận được:
- Phạm vi cần luận và năm xem. Ví dụ: "overview" là tổng quan cả lá số; tên một cung như "Quan Lộc" là riêng cung đó; "han-2026" là vận hạn năm 2026.
- Lá số: dữ liệu lá số đã an sao (các cung, các sao, đại hạn, tiểu hạn…).
- Các câu đã khớp với lá số, mỗi dòng một câu: [mã] (cung · nguồn) nội dung — why.
  Nguồn "grandma" là câu trong ghi chép của bà; nguồn "supplement" là câu lấy từ sách khác, không phải của bà.
  Phần why là lý do câu khớp với lá số: sao nào, ở cung nào, miếu hay hãm, có gặp Tuần, Triệt không…

Bài luận gồm hai lớp, phải tách bạch tuyệt đối.

Lớp "primary" (lời của bà):
- Chỉ được tóm lược, sắp xếp, nối ý những câu có nguồn "grandma" được đưa vào.
- Mỗi ý phải kèm "refs": mã của các câu gốc, chép đúng như trong ngoặc vuông.
- Không thêm bất cứ ý nào không có trong các câu đó, kể cả những điều sách tử vi nào cũng nói.
- Câu nguồn "supplement" không bao giờ được đưa vào lớp "primary".
- Giữ thuật ngữ của bà.
- Khi các câu trái nhau thì nói rõ là trái nhau, và nêu yếu tố làm nặng hay nhẹ có trong phần why (miếu hãm, Tuần Triệt…).
- Nhóm ý nào không có câu nguồn "grandma" thì để "primary" là mảng rỗng.

Lớp "added" (luận giải thêm):
- Luận giải thêm theo kiến thức tử vi phổ thông, sách khác và hiểu biết của bạn; có thể dựa vào các câu nguồn "supplement".
- Viết như ý kiến bổ sung, không bao giờ gán cho bà (không viết "bà dặn", "theo bà", "theo ghi chép"…).
- Không lặp lại những gì đã có ở lớp "primary".

Mỗi section ứng với một nhóm ý: theo cung; hoặc theo tính cách, công danh, tài lộc, gia đạo… khi phạm vi là tổng quan; hoặc theo đại hạn, tiểu hạn khi phạm vi là vận hạn. "title" là tên ngắn của nhóm ý; mỗi ý trong "primary" và "added" là một đoạn ngắn. Viết gọn: tối đa 8 nhóm ý, mỗi lớp trong một nhóm tối đa 5 ý.

Văn phong: tiếng Việt tự nhiên, ấm áp, mạch lạc. Nói xu hướng chứ không phán định mệnh. Những ý về bệnh tật, tai nạn, chết chóc, con cái, hôn nhân đổ vỡ phải nói nhẹ nhàng, như điều nên lưu tâm. Không đưa lời khuyên y tế, pháp lý, tài chính cụ thể.

Không bịa sao, vị trí sao, tuổi hay số liệu không có trong dữ liệu lá số.

"caution": một câu nhắc rằng tử vi chỉ để tham khảo, chiêm nghiệm.

Chỉ trả về một đối tượng JSON đúng cấu trúc sau, không kèm chữ nào khác (không markdown, không lời dẫn):
{"sections":[{"title":"…","primary":[{"text":"…","refs":["<mã>"]}],"added":[{"text":"…"}]}],"caution":"…"}`;

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
          primary: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' } } }, required: ['text', 'refs'], additionalProperties: false } },
          added: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } },
        },
        required: ['title', 'primary', 'added'],
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
    primary: z.array(z.object({ text: z.string(), refs: z.array(z.string()).default([]) })).default([]),
    added: z.array(z.object({ text: z.string() })).default([]),
  })).min(1),
  caution: z.string().nullish(),
});
type AnswerT = z.infer<typeof Answer>;

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
    @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
    @Inject(PeopleService) private readonly people: PeopleService,
    @Inject(ReadingsService) private readonly readings: ReadingsService,
  ) {
    this.client = config.ai.apiKey ? new Anthropic({ apiKey: config.ai.apiKey, timeout: 240_000, maxRetries: 2 }) : null;
  }

  status(): AiStatusDto { return { ai: !!this.client, model: this.config.ai.model }; }

  /** asks Claude for a reading of one scope (Tử vi); it replaces the profile's older reading of the same scope and year */
  async generate(profileId: string, scope: string, viewYear?: number): Promise<AiReadingDto> {
    if (!this.client) throw new ServiceUnavailableException('AI chưa được bật trên máy chủ (thiếu ANTHROPIC_API_KEY)');
    if (!scopeOk(scope)) throw new BadRequestException(`Phạm vi không hợp lệ: ${scope}`);
    const pi = await this.people.profileInput(profileId), { profile } = pi;
    const year = viewYear ?? (scope.startsWith('han-') ? Number(scope.slice(4)) : profile.viewYear ?? new Date().getFullYear());
    const k = await this.knowledge.get();
    const { chart, lines, hash: inputHash } = tuviInput(pi.birth, pi.settings, k, scope, year);
    const grandmaRefs = new Set(lines.filter(l => l.source === 'grandma').map(l => l.ref));
    if (!grandmaRefs.size) throw new BadRequestException('Không có câu nào của bà khớp với phạm vi này để luận');
    const text = lines.map(l => {
      let t = oneLine(l.text);
      if (t.length > MAX_TEXT) t = `${t.slice(0, MAX_TEXT - 1)}…`;
      const why = oneLine(l.why);
      return `[${l.ref}] (${l.palace ? `${l.palace} · ` : ''}${l.source}) ${t}${why ? ` — ${why}` : ''}`;
    });
    const user = `Phạm vi: ${scope} (năm xem ${year})\n\nLá số:\n${chartSummary(chart, year)}\n\nCác câu đã khớp:\n${text.join('\n')}`;
    const answer = await this.ask(user);
    const quote = new Map<string, string>();
    for (const l of lines) quote.set(l.ref, k.rules.get(l.ref)?.text ?? l.text);
    return this.readings.store(profileId, {
      scope, viewYear: year, author: 'ai', model: this.config.ai.model, caution: answer.caution ?? null, inputHash,
      sections: answer.sections.map(s => ({ title: s.title, items: [...s.primary.map(b => ({ layer: 'primary' as const, text: b.text, refs: b.refs })), ...s.added.map(t => ({ layer: 'added' as const, text: t.text, refs: [] }))] })),
    }, grandmaRefs, quote);
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
}
