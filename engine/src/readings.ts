/* What every written reading is held to, whatever the discipline. Each room has two: the Căn cứ looks the chart up in
   the sources and weighs it (scope "synthesis"; Tử vi "overview"), and the Luận giải is the reading given to the
   person (scope "summary"), written for them in plain words the way a reader of charts writes it — it rests on the
   Căn cứ and cites nothing. The person's Nhận định reads every room at once in the same voice. These checks warn;
   they never refuse: the writer decides, but what goes against the rules is said out loud. */

export interface WrittenItemIn { layer: string; text: string; refs?: string[] }
export interface WrittenSectionIn { title: string; weight?: string | null; basis?: string[]; factors?: string[]; items: WrittenItemIn[] }

/** the length a Luận giải (and the person's Nhận định) is written to, in words */
export const SUMMARY_WORDS = { min: 1000, max: 1500 } as const;
/** a paragraph of it, at most (words) */
export const SUMMARY_PARA_WORDS = 230;

export const wordCount = (s: string) => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

/** how the reading given to the person is written (a room's Luận giải; the person's Nhận định) */
export const SUMMARY_SPEC = `Luận giải (scope "summary" của một hồ sơ): bài giải giao cho người được xem
- Viết cho chính người ấy đọc, như bản giải của một người xem lá số: nói thẳng với họ («Anh có…», «Anh là người…»; xưng anh, chị hay bạn tùy người), bằng lời thường. Phần Căn cứ (scope "synthesis"; tử vi "overview") là chỗ kiểm mỗi ý lấy từ đâu; bài này dựa trên đó nhưng không kể lại nó, không dẫn nguồn.
- Mở đầu bằng một hai câu nêu khung lá số bằng lời người xem lá số hay nói (ví dụ «Chị có cung mọc Nhân Mã, chủ tinh lá số là Mộc tinh ở Song Tử, cung 6; Mặt trời ở Bảo Bình, cung 2»), rồi ngay sau đó một câu nói người ấy là người thế nào.
- Gọi tên vị trí là để giải thích, và giải thích liền bằng chuyện đời («Kim tinh ở cung 10 nên…»): người đọc phải biết cung, sao của mình là gì và hiểu vì sao người viết nói vậy. Không mô tả lá số cho chính nó («đây là chỗ mạnh nhất lá số»).
- Nói chuyện cụ thể của đời sống: tính cách thật ngoài đời; hợp vai trò, kiểu việc gì, nên tránh gì; tiền đến từ đâu, hở ở đâu; tình yêu, hôn nhân, người bạn đời hợp; cha mẹ, gia đình; vận năm nay và vài năm tới, có mốc thời gian; một lời khuyên. Mỗi đoạn ghép nhiều yếu tố thành một nhận xét; điều chi phối lá số nói trước và nói kỹ; chỗ các yếu tố kéo nhau thì nói nó hiện ra lúc nào, ở đâu.
- Nói có mức độ («thường», «có thể», «hứa hẹn»); nói cả chỗ khó, nhẹ nhàng, như điều nên lưu tâm chứ không phải lời phán số phận.
- Không có chữ của phần căn cứ: không độ lệch, không điểm số, không «bài test», «cháy máy đo», không «trọng điểm», «tô thêm», không tên sách, tên tác giả, «lời cô», «câu của bà», không mã nguồn.
- Chia vài phần theo chuyện đời, mỗi phần một tiêu đề ngắn bằng lời thường (Con người; Sự nghiệp; Tiền bạc; Tình cảm và hôn nhân; Gia đình; Năm 2026; Lời khuyên…), không lấy tên vị trí làm tiêu đề; mỗi đoạn văn là một mục (item), dưới khoảng ${SUMMARY_PARA_WORDS} chữ. Cả bài khoảng ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} chữ.

Nhận định (scope "summary" của người, gộp các môn)
- Cùng giọng, cùng cách viết như Luận giải, nhưng nhìn mọi môn một lúc: chỗ các môn cùng nói một điều thì nói chắc hơn; chỗ các môn nói khác nhau thì nói rõ môn nào thấy gì. Không kể lại từng bài Luận giải.`;

/** words of the Căn cứ that have no place in a reading given to the person */
const INTERNAL: [RegExp, string][] = [
  [/\d+\s*°|\d+′/, 'số đo độ'],
  [/bài test|cháy máy đo|\b\d+ điểm\b/i, 'điểm số, bài test'],
  [/trọng điểm|tô thêm|ít tác dụng|luật cân|cách áp|phần căn cứ/i, 'chữ của phần Căn cứ'],
  [/woolfolk|tierney|forrest|heindel|rudhyar|cunningham|lời cô|cô (viết|gọi|ghi|lưu ý|dạy)\b|câu của bà|bà (viết|ghi)\b|theo sách|sách (viết|nói)\b/i, 'tên nguồn, tên tác giả'],
  [/\b(hk|woolfolk|tierney|books|method|hk-[a-z]+)\.b\d+|\bp:\d+/, 'mã nguồn'],
];
/** a part's title that names a placement rather than what in life it is about */
const PLACEMENT_TITLE = /(Mặt Trời|Mặt Trăng|Sao (Thủy|Kim|Hỏa|Mộc|Thổ)|Thiên Vương|Hải Vương|Diêm Vương|cung Mọc|La Hầu|Kế Đô|Chiron|cung \d|Mệnh|Thân cư|Ngày sinh \d|Biểu đồ|mũi tên|Đỉnh thứ|số chủ đạo)/i;

/** what is wrong with a Luận giải (or a person's Nhận định) as written */
export function checkSummary(sections: WrittenSectionIn[]): string[] {
  const out: string[] = [];
  const items = sections.flatMap(s => s.items.map(i => ({ s, text: i.text })));
  const text = items.map(i => i.text).join('\n');
  const n = wordCount(text);
  if (n < SUMMARY_WORDS.min * 0.9) out.push(`Bài mới có ${n} chữ: viết khoảng ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} chữ.`);
  else if (n > SUMMARY_WORDS.max * 1.2) out.push(`Bài dài ${n} chữ: nên gọn lại khoảng ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} chữ.`);
  if (sections.some(s => s.items.some(i => i.refs?.length))) out.push('Bài giao cho người được xem không dẫn nguồn: các refs bị bỏ khi lưu (căn cứ nằm ở phần Căn cứ).');
  const multi = sections.filter(s => s.items.some(i => /\n\s*\n/.test(i.text)));
  if (multi.length) out.push(`${multi.length} mục có nhiều đoạn trong một item (${multi.slice(0, 3).map(s => `«${s.title}»`).join(', ')}): mỗi đoạn văn là một item.`);
  const long = items.filter(i => wordCount(i.text) > SUMMARY_PARA_WORDS * 1.15);
  if (long.length) out.push(`${long.length} đoạn quá dài (${[...new Set(long.map(i => `«${i.s.title}»`))].slice(0, 3).join(', ')}): mỗi đoạn nên dưới khoảng ${SUMMARY_PARA_WORDS} chữ.`);
  const named = sections.filter(s => PLACEMENT_TITLE.test(s.title));
  if (named.length) out.push(`${named.length} tiêu đề là tên vị trí (${named.slice(0, 3).map(s => `«${s.title}»`).join(', ')}): tiêu đề nói chuyện đời (Sự nghiệp, Tình cảm…), tên vị trí để trong câu văn.`);
  for (const [re, what] of INTERNAL) {
    const hits = items.filter(i => re.test(i.text));
    if (hits.length) out.push(`Bài có ${what} (${[...new Set(hits.map(i => `«${i.s.title}»`))].slice(0, 3).join(', ')}): người được xem không cần, để ở phần Căn cứ.`);
  }
  return out;
}

/** what is wrong with a Căn cứ as written, whatever the discipline */
export function checkLookup(sections: WrittenSectionIn[]): string[] {
  const out: string[] = [];
  const bare = sections.flatMap(s => s.items.filter(i => i.layer === 'primary' && !i.refs?.length).map(() => s.title));
  if (bare.length) out.push(`${bare.length} ý ghi là của nguồn mà không dẫn đoạn nào (${[...new Set(bare)].slice(0, 3).map(t => `«${t}»`).join(', ')}): sẽ lưu thành ý thêm.`);
  return out;
}
