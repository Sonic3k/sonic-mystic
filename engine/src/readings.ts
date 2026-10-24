/* What every written reading is held to, whatever the discipline: the Luận giải looks the chart up in the sources and
   weighs it; the Nhận định reads the person — in plain prose, long enough to be a reading — and cites nothing.
   These checks warn; they never refuse: the writer decides, but what goes against the rules is said out loud. */

export interface WrittenItemIn { layer: string; text: string; refs?: string[] }
export interface WrittenSectionIn { title: string; weight?: string | null; basis?: string[]; factors?: string[]; items: WrittenItemIn[] }

/** the length a Nhận định is written to (words): a room's, and the person's as a whole */
export const SUMMARY_WORDS = { min: 1000, max: 1500 } as const;

export const wordCount = (s: string) => s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;

/** how a Nhận định is written (a room's, or the person's from every room) */
export const SUMMARY_SPEC = `Nhận định (scope "summary")
- Là bài đọc thật: ghép mọi thứ của môn (hay của mọi môn, với Nhận định chung) thành một con người. Luận giải là phần tra cứu có nguồn, có cân; Nhận định đứng trên nó.
- Văn xuôi tự nhiên, khoảng ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} chữ. Mỗi phần (section) là một đoạn văn, mở bằng một tiêu đề ngắn nói đoạn ấy về gì — trang đọc hiện mỗi phần thành một đoạn. Đoạn đầu của mỗi nhóm mang tên nhóm (Con người; Công việc và tiền bạc; Tình cảm và gia đình; Giai đoạn này; Một lời khuyên — tùy môn), các đoạn sau mang tiêu đề riêng; câu mở đoạn không lặp lại tiêu đề.
- Gọi tên vài vị trí chính ngay trong câu văn (Chiêm tinh: Mặt Trời, Mặt Trăng, cung Mọc, chủ tinh, quạt xếp…; Tử vi: Mệnh, Thân, các sao chính; Nhân số học: các con số chủ đạo), như một người luận nói chuyện — không liệt kê kỹ thuật, không độ lệch, không mã nguồn, không dẫn refs.
- Nói theo sức nặng của Luận giải: điều chi phối nói trước và nói kỹ, điều tô thêm nói sau; chỗ các yếu tố kéo nhau thì nói cả hai phía, không xóa một phía cho gọn. Nhận định chung giữ cả chỗ các môn nói khác nhau.
- Giữ ý của nguồn; giọng nhẹ nhàng với chuyện bệnh tật, tai nạn, hôn nhân đổ vỡ, như điều nên lưu tâm.`;

/** what is wrong with a Nhận định as written */
export function checkSummary(sections: WrittenSectionIn[]): string[] {
  const out: string[] = [];
  const text = sections.flatMap(s => s.items.map(i => i.text)).join('\n');
  const n = wordCount(text);
  if (n < SUMMARY_WORDS.min * 0.9) out.push(`Nhận định mới có ${n} chữ: viết khoảng ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} chữ.`);
  else if (n > SUMMARY_WORDS.max * 1.2) out.push(`Nhận định dài ${n} chữ: nên gọn lại khoảng ${SUMMARY_WORDS.min}–${SUMMARY_WORDS.max} chữ.`);
  if (sections.some(s => s.items.some(i => i.refs?.length))) out.push('Nhận định không dẫn nguồn: các refs bị bỏ khi lưu.');
  const multi = sections.filter(s => s.items.some(i => /\n\s*\n/.test(i.text)));
  if (multi.length) out.push(`${multi.length} phần có nhiều đoạn (${multi.slice(0, 3).map(s => `«${s.title}»`).join(', ')}): trang đọc hiện mỗi phần thành một đoạn — tách mỗi đoạn thành một phần có tiêu đề riêng.`);
  const long = sections.filter(s => wordCount(s.items.map(i => i.text).join(' ')) > 260);
  if (long.length) out.push(`${long.length} đoạn quá dài (${long.slice(0, 3).map(s => `«${s.title}»`).join(', ')}): mỗi đoạn nên dưới khoảng 250 chữ.`);
  const degrees = (text.match(/\d+°\d*/g) ?? []).length;
  if (degrees > 2) out.push(`Nhận định có ${degrees} số đo độ: đây là văn đọc, không phải bảng kỹ thuật — để số đo ở Luận giải.`);
  const codes = text.match(/\b(hk|woolfolk|tierney|hk-[a-z]+)\.b\d+|p:\d+/g);
  if (codes?.length) out.push(`Nhận định có mã nguồn (${[...new Set(codes)].slice(0, 3).join(', ')}): bỏ khỏi văn.`);
  return out;
}

/** what is wrong with a Luận giải as written, whatever the discipline */
export function checkLookup(sections: WrittenSectionIn[]): string[] {
  const out: string[] = [];
  const bare = sections.flatMap(s => s.items.filter(i => i.layer === 'primary' && !i.refs?.length).map(() => s.title));
  if (bare.length) out.push(`${bare.length} ý ghi là của nguồn mà không dẫn đoạn nào (${[...new Set(bare)].slice(0, 3).map(t => `«${t}»`).join(', ')}): sẽ lưu thành ý thêm.`);
  return out;
}
