/* A written Chiêm tinh reading against the chart's weighing (weigh.ts), before it is saved — and how such a reading is
   written, for whoever writes the next one (a person, or an AI given the chart's plan). Warnings, never refusals. */
import { SUMMARY_SPEC, checkLookup, type WrittenSectionIn } from '../readings.js';
import { WEIGH_LEVEL_NAME, WEIGH_PRINCIPLES, WEIGH_RULES, ownerName, type Weighing, type WeighLevel } from './weigh.js';

const ORDER = ['intro', 'key', 'normal', 'current', 'minor'];
/** what the rules never let make a part minor */
const FORBIDDEN: [RegExp, string][] = [
  [/không phải (là )?hành tinh/i, '«không phải hành tinh»'],
  [/bài test[^.]{0,40}không (tính|chấm)/i, '«bài test không tính»'],
  [/\b\d+ điểm\b[^.]{0,20}(thấp|trung bình)|điểm (test )?thấp/i, 'điểm test thấp'],
  [/điểm phụ/i, '«điểm phụ»'],
  [/(vị trí|thế|ở) (Tù|Tử)\b/, 'Tù hay Tử một mình'],
];

/** what is wrong with a Luận giải of a chart, by the rules the chart was weighed with */
export function checkAstrologyReading(sections: WrittenSectionIn[], w: Weighing): string[] {
  const out = checkLookup(sections);
  const byId = new Map(w.factors.map(f => [f.id, f]));
  const name = (l: string | null | undefined) => (l && l in WEIGH_LEVEL_NAME ? WEIGH_LEVEL_NAME[l as WeighLevel] : l ?? 'chưa cân');
  if (sections[0]?.weight !== 'intro') out.push('Phần đầu nên là «Cách cân» (weight intro): bộ luật đã dùng, có dẫn nguồn.');
  for (let i = 1; i < sections.length; i++) {
    const a = ORDER.indexOf(sections[i - 1].weight ?? ''), b = ORDER.indexOf(sections[i].weight ?? '');
    if (a > b && b >= 0) { out.push(`Phần «${sections[i].title}» (${name(sections[i].weight)}) đứng sau một phần ${name(sections[i - 1].weight)}: xếp Trọng điểm trước, Tô thêm sau, Ít tác dụng cuối.`); break; }
  }
  const declared = sections.filter(s => s.factors?.length);
  if (!declared.length) {
    out.push('Không phần nào khai báo factors (các yếu tố nó đọc): không đối chiếu được với luật cân của lá số.');
  } else {
    for (const s of declared) {
      const fs = s.factors!.map(id => byId.get(id));
      const unknown = s.factors!.filter((id, i) => !fs[i]);
      if (unknown.length) out.push(`Phần «${s.title}»: lá số không có yếu tố ${unknown.slice(0, 4).join(', ')}.`);
      const known = fs.filter((f): f is NonNullable<typeof f> => !!f);
      if (!known.length) continue;
      const levels = new Set(known.map(f => f.level));
      if (s.weight === 'key' && !levels.has('key')) out.push(`Phần «${s.title}» ghi Trọng điểm, nhưng theo luật cân không yếu tố nào của nó là trọng điểm (${known.map(f => `${f.id}: ${name(f.level)}`).slice(0, 4).join('; ')}).`);
      if (s.weight === 'minor' && (levels.has('key') || levels.has('normal'))) out.push(`Phần «${s.title}» ghi Ít tác dụng, nhưng ${known.filter(f => f.level !== 'minor').map(f => `${f.id} là ${name(f.level)}`).slice(0, 4).join('; ')}: Ít tác dụng chỉ dành cho góc chiếu lỏng đứng riêng và hành tinh yếu mọi mặt.`);
      if (s.weight === 'normal' && known.every(f => f.level === 'minor')) out.push(`Phần «${s.title}» ghi Tô thêm, nhưng mọi yếu tố của nó đều Ít tác dụng.`);
      const attached = known.filter(f => f.attachedTo && !s.factors!.includes(f.attachedTo));
      for (const f of attached) {
        const home = sections.find(x => x.factors?.includes(f.attachedTo!));
        if (!home) out.push(`${f.title} chạm sát ${ownerName(f.attachedTo!)} (trong 3°): đọc trong phần của ${ownerName(f.attachedTo!)}, như nét tô thêm.`);
      }
    }
    // every key planet, stellium and structure read at key level somewhere
    const atKey = new Set(sections.filter(s => s.weight === 'key').flatMap(s => s.factors ?? []));
    const missing = w.factors.filter(f => f.level === 'key' && (f.kind === 'body' || f.kind === 'stellium' || f.kind === 'pattern') && !atKey.has(f.id));
    if (missing.length) out.push(`Trọng điểm chưa được đọc ở phần Trọng điểm nào: ${missing.map(f => f.title).join('; ')}.`);
  }
  for (const s of sections.filter(x => x.weight === 'minor')) {
    // a part the weighing itself puts here needs no other reason
    if (s.factors?.length && s.factors.every(id => byId.get(id)?.level === 'minor')) continue;
    const text = s.items.map(i => i.text).join(' ');
    for (const [re, what] of FORBIDDEN) if (re.test(text)) out.push(`Phần «${s.title}» (Ít tác dụng) lấy ${what} làm lý do — luật cân không cho hạ mức vì lý do ấy.`);
  }
  return out;
}

/** how a Chiêm tinh Căn cứ is written (the parts, the weights, the sources), and the Luận giải written from it */
export const ASTROLOGY_READING_SPEC = `Căn cứ Chiêm tinh (scope "synthesis")
- Là phần tra cứu có nguồn, có cân, để kiểm bài Luận giải (scope "summary") lấy từng ý từ đâu: mỗi phần đọc một nhóm yếu tố; ý nào kể lại nguồn thì layer "primary" và refs là các đoạn nó kể lại; ý của người viết là "added".
- refs: mã câu luận lá số này khớp, hoặc bất kỳ đoạn nào của nguồn theo khối "<nguồn>.b<dòng>" (hk, hk-keywords, hk-dominant, hk-aries, hk-notes, tierney, woolfolk, books, cùng các nguồn đã nạp). Trích đúng ý đoạn; phân biệt lời cô Hương Kiều, ghi chép của lớp (hk-notes: học viên ghi, không phải lời cô viết), lời Tierney (12 dấu hiệu trong giáo trình của cô), lời Woolfolk, và các sách khác (books: Forrest, Cunningham, Heindel, Rudhyar, Leo, Libra, Claude dịch) — không gán lời sách cho cô.
- Phần đầu "Cách cân" (weight intro): bộ luật dưới đây, nói ngắn, dẫn đoạn nguồn.
- Mỗi phần có weight theo luật cân của lá số (plan: weights), basis lấy từ reasons của yếu tố (ngắn, mỗi dòng dưới 160 ký tự), factors là id các yếu tố nó đọc — để bộ kiểm tra đối chiếu.
- Trọng điểm: mọi hành tinh, quạt xếp, cấu trúc mà luật cân xếp trọng điểm phải được đọc trong ít nhất một phần Trọng điểm; góc chiếu trọng điểm đọc trong phần của một đầu.
- Tô thêm: khung lá số, các cung lĩnh vực đời (tình yêu đọc qua cung 7: nóc cung, chủ tinh, sao trong cung), trục La Hầu – Kế Đô (hai cung), các điểm theo cung, hành tinh còn lại.
- Điểm có attachedTo thì đọc trong phần của yếu tố ấy, như nét tô thêm — không thành yếu tố chi phối riêng.
- Ít tác dụng: chỉ những gì luật cân xếp vào đó (góc chiếu lỏng đứng riêng, hành tinh yếu mọi mặt); mỗi dòng một câu. Không hạ vì «không phải hành tinh», «bài test không tính», điểm test thấp, hay Tù, Tử một mình.
- Bài test nhân tố trội chỉ gọi tên mẫu người hành tinh; ô cộng 2–5 điểm thì nêu ra để người đọc tự cân.
- Vận năm xem và năm sau (weight current, sau Tô thêm): khách tinh trong plan.transits — Mộc tinh, Thổ tinh, Thiên Vương, Hải Vương, Diêm Vương, như cô định nghĩa (hk.b815; hồi vị hk.b821): cung nó đi qua và từ ngày nào đến ngày nào, góc nó chạm vào hành tinh và AC, MC gốc cùng ngày đúng góc, ngày đứng lại đổi chiều. Nguồn không có chương riêng về cách luận transit: nghĩa của hành tinh và cung lấy theo bảng từ khóa của cô (hk-keywords), có dẫn; phần ghép là ý thêm (added). Bài Luận giải lấy phần vận năm từ đây, có mốc tháng năm.
- Giờ sinh ước lượng: caution ghi khoảng giờ giữ nguyên (window) và những gì đổi trong khoảng ấy (varies của từng yếu tố); yếu tố sát nóc cung thì nói rõ.
- Giữ nguyên lời nguồn; giọng nhẹ nhàng với chuyện bệnh tật, tai nạn, hôn nhân đổ vỡ, như điều nên lưu tâm.

Nguyên tắc cân
${WEIGH_PRINCIPLES.map(p => `- ${p.text}${p.refs.length ? ` Nguồn: ${p.refs.join(', ')}.` : ''}`).join('\n')}

Luật cân
${WEIGH_RULES.map(r => `- ${r.code} ${r.name} (${WEIGH_LEVEL_NAME[r.level]}): ${r.text}${r.applied ? ` Cách áp: ${r.applied}` : ''} Nguồn: ${r.refs.join(', ')}${r.against?.length ? `; sách nói khác: ${r.against.join(', ')}` : ''}.`).join('\n')}

${SUMMARY_SPEC}`;
