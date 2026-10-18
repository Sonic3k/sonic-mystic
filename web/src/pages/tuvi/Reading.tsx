/* How grandma's sentences are shown in the Tử vi room: each with a dot for good or bad, her words in the room's
   typeface with the stars and palaces it names in their colours, why it applies, the paragraph of her notes it comes
   from, and — when the machine had to interpret her — how it read her. "Bổ sung" (not hers) always sits apart, under
   its 補 seal, in the plain UI typeface. And how a written reading (AI or Claude) is drawn here. */
import { createContext, useContext, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Chart, Principle } from '@mystic/engine/tuvi';
import type { AiReadingDto, AiSectionDto, GroupDto, MatchDto, RuleDto, TuViReadingDto } from '@mystic/engine/api';
import { api } from '../../api';
import { errorText, needsToken } from '../../components/Owner';
import { highlight, parseTitle, wordsRe, type RoomReading } from '../../components/Reading';

export const TONE_NAME = { cat: 'tốt', hung: 'xấu', mixed: 'tốt xấu lẫn', trung: 'mô tả' } as const;
export type ToneFilter = 'all' | 'cat' | 'hung';

/** the rules a reading mentions, by code (the API sends each rule once, the groups refer to them) */
export const RulesContext = createContext<Record<string, RuleDto>>({});
/** how the running text of this chart is highlighted (its stars and palaces) */
export const HlContext = createContext<(t: string) => React.ReactNode>(t => t);

export const ruleHref = (r: Pick<RuleDto, 'entryRef' | 'paraRef'>) =>
  r.entryRef === null ? null : `/tu-vi/books/${r.entryRef}${r.paraRef !== null ? `#p${r.paraRef}` : ''}`;

export const ROLE_HZ: Record<string, string> = { 'Mệnh': '命宮', 'Phụ Mẫu': '父母', 'Phúc Đức': '福德', 'Điền Trạch': '田宅', 'Quan Lộc': '官祿', 'Nô Bộc': '奴僕', 'Thiên Di': '遷移', 'Tật Ách': '疾厄', 'Tài Bạch': '財帛', 'Tử Tức': '子息', 'Phu Thê': '夫妻', 'Huynh Đệ': '兄弟' };
export const ROLE_SEAL: Record<string, string> = { 'Mệnh': '命', 'Phụ Mẫu': '父', 'Phúc Đức': '福', 'Điền Trạch': '田', 'Quan Lộc': '官', 'Nô Bộc': '僕', 'Thiên Di': '遷', 'Tật Ách': '疾', 'Tài Bạch': '財', 'Tử Tức': '子', 'Phu Thê': '妻', 'Huynh Đệ': '兄', 'Thân': '身' };
export const HOA_SHORT: Record<string, string> = { 'Hóa Lộc': 'Lộc', 'Hóa Quyền': 'Quyền', 'Hóa Khoa': 'Khoa', 'Hóa Kỵ': 'Kỵ' };
export const HOA_IDS = new Set(['hoa_loc', 'hoa_quyen', 'hoa_khoa', 'hoa_ky']);

/** a seal: the room's emblem, a Hán character cut in plum (o: outlined, kim: gold for the years, chu: the added layer's) */
export const Seal = ({ c, k = '', s, style }: { c: string; k?: string; s?: number; style?: React.CSSProperties }) => (
  <span className={`seal ${k}`} style={s || style ? { ...(s ? { width: s, height: s, fontSize: Math.round(s * 0.55) } : {}), ...style } : undefined} aria-hidden="true">{c}</span>
);
export const ChuSeal = ({ c = '補' }: { c?: string }) => <Seal c={c} k="chu" s={22} />;

/** a star's tone on this chart ('chinh' for a chính tinh), by its id, its name and its name in lower case — for
    colouring the text and the headings of grandma's entries (she writes "Văn khúc", the chart "Văn Khúc") */
export function starTones(chart: Chart): Record<string, string> {
  const t: Record<string, string> = {};
  for (const p of chart.palaces) for (const s of p.stars) {
    const tone = s.kind === 'chinh' ? 'chinh' : s.tone ?? 'trung';
    t[s.id] = t[s.name] = t[s.name.toLowerCase()] = tone;
  }
  return t;
}
/** "Văn khúc" → "Văn Khúc", as the chart writes a star */
export const starCase = (s: string) => s.replace(/(^|[\s-])(\p{Ll})/gu, (_, a: string, c: string) => a + c.toUpperCase());

export function useHighlighter(chart: Chart) {
  return useMemo(() => {
    const tones = starTones(chart);
    /* a palace as written (lower case "mệnh" is the word, not the palace); a star of two words or more in any case
       (one-word rings such as Tử, Suy, Bệnh are ordinary words too) */
    const pal = wordsRe(Object.keys(ROLE_HZ));
    const names = [...new Set(chart.palaces.flatMap(p => p.stars.map(s => s.name)))].filter(n => n.includes(' ') && !ROLE_HZ[n]);
    const star = new RegExp(wordsRe(names).source, 'giu');
    return (text: string) => highlight(text, [
      { re: pal, draw: (m, k) => <span key={k} className="e-pal">{m}</span> },
      { re: star, draw: (m, k) => <span key={k} className={`e-st ${tones[m.toLowerCase()] ?? 'trung'}`}>{m}</span> },
    ]);
  }, [chart]);
}

// ── grandma's sentences ──

export function Line({ m, hl }: { m: MatchDto; hl?: boolean }) {
  const [open, setOpen] = useState(false);
  const r = useContext(RulesContext)[m.rule];
  const text = useContext(HlContext);
  if (!r) return null;
  const href = ruleHref(r);
  return (
    <div className={`ln ${r.tone}${hl ? ' hl' : ''}`} id={`r-${r.code}`}>
      <i className="dot" aria-hidden="true" title={TONE_NAME[r.tone]} />
      <p>{r.ctx && <span className="ctx">{r.ctx}</span>}{text(r.text)}{r.edited && <span className="tv-edited" title="Câu này đã được sửa chữ trong cơ sở dữ liệu">đã sửa chữ</span>}</p>
      <div className="why">
        {m.why.length > 0 && <><b>{m.why.join(' · ')}</b> · </>}
        {href ? <Link to={href}>đoạn {r.paraRef}</Link> : r.paraRef !== null ? `đoạn ${r.paraRef}` : null}
        {r.tone === 'cat' ? ' · câu tốt' : r.tone === 'hung' ? ' · câu xấu' : r.tone === 'mixed' ? ' · tốt xấu lẫn' : ''}
        {r.review && <> · <button type="button" className="rv" onClick={() => setOpen(o => !o)}>{open ? 'ẩn cách hiểu' : 'cách máy hiểu câu này'}</button></>}
      </div>
      {open && r.review && <div className="tv-review"><b>Cần người nhà xem lại:</b> {r.review}{r.when && <code>{r.when}</code>}</div>}
    </div>
  );
}

const toneClass = (t: string | undefined) => (t === 'chinh' ? 'm' : t === 'cat' ? 'c' : t === 'hung' ? 'h' : 't');

/** grandma's sentences star by star: three of each, the rest one tap away */
export function Groups({ groups, where, tones, filter = 'all', limit = 3, hlRef, empty }: {
  groups: GroupDto[]; where: string; tones: Record<string, string>; filter?: ToneFilter; limit?: number; hlRef?: string | null; empty?: string;
}) {
  const rules = useContext(RulesContext);
  const [openAll, setOpenAll] = useState<Record<string, boolean>>({});
  const keep = (m: MatchDto) => { const t = rules[m.rule]?.tone; return filter === 'all' || t === filter || t === 'mixed'; };
  const shown = groups.map(g => ({ ...g, matches: g.matches.filter(keep) })).filter(g => g.matches.length);
  if (!shown.length) return <p className="gm-empty">{empty ?? (filter === 'all' ? 'Không có câu nào trong ghi chép của bà khớp ở đây.' : 'Không có câu nào thuộc loại này.')}</p>;
  return <>{shown.map(g => {
    const all = openAll[g.key] || g.matches.some(m => m.rule === hlRef);
    const list = all ? g.matches : g.matches.slice(0, limit);
    return (
      <div key={g.key} className="gm-star">
        <div className="gm-sh"><b className={toneClass(tones[g.star ?? ''] ?? tones[g.name.toLowerCase()] ?? 'trung')}>{starCase(g.name)}</b>
          <span>{g.inPalace ? `đóng tại ${where}` : `chiếu về ${where}`} · {g.matches.length} câu</span>
          {g.entryRef !== null && <Link className="gm-entry" to={`/tu-vi/books/${g.entryRef}`}>Mục {g.name} ›</Link>}</div>
        {list.map(m => <Line key={m.rule} m={m} hl={m.rule === hlRef} />)}
        {g.matches.length > limit && <button type="button" className="more" onClick={() => setOpenAll(o => ({ ...o, [g.key]: !all }))}>{all ? 'Thu gọn' : `Thêm ${g.matches.length - limit} câu của bà`}</button>}
      </div>
    );
  })}</>;
}

/** what is not hers: general tử vi knowledge, under its seal and in the plain typeface */
export function Supplement({ title = 'Bổ sung, không phải lời bà', about, groups = [], principles, className = '' }: {
  title?: string; about?: string | null; groups?: GroupDto[]; principles?: Principle[]; className?: string;
}) {
  const rules = useContext(RulesContext);
  const text = useContext(HlContext);
  const lines = groups.flatMap(g => g.matches.map(m => ({ g, m, r: rules[m.rule] }))).filter(x => x.r);
  if (!about && !lines.length && !principles?.length) return null;
  return (
    <div className={`bsn ${className}`}>
      <div className="bsn-h"><ChuSeal />{title}</div>
      {about && <p>{text(about)}</p>}
      {lines.map(({ g, m, r }) => <div key={m.rule}><p>{text(r.text)}</p><div className="why">{g.name}{m.why.length ? ` · ${m.why.join(' · ')}` : ''}</div></div>)}
      {principles?.map(p => <p key={p.id} id={`pr-${p.id}`}><b>{p.title}.</b> {p.text}</p>)}
    </div>
  );
}

// ── written readings ──

/** which palaces (branches) a section of a reading speaks of, from its title */
export function sectionPalaces(s: AiSectionDto, r: TuViReadingDto): number[] {
  const t = s.title, out = new Set<number>();
  const byRole = (role: string) => r.chart.palaces.find(p => p.role === role)?.branch;
  for (const role of Object.keys(ROLE_HZ)) if (new RegExp(`(?<![\\p{L}])${role}(?![\\p{L}])`, 'u').test(t)) { const b = byRole(role); if (b !== undefined) out.add(b); }
  const add = (role: string) => { const b = byRole(role); if (b !== undefined) out.add(b); };
  if (/Tài lộc/.test(t)) add('Tài Bạch');
  if (/Hôn nhân/.test(t)) add('Phu Thê');
  if (/Thân cư/.test(t)) out.add(r.chart.than);
  const y = /năm (\d{4})/.exec(t);
  if (y && Number(y[1]) === r.han.year) { if (r.han.dai) out.add(r.han.dai.branch); out.add(r.han.tieu.branch); }
  return [...out];
}

/** a section's seal: 運 for the year, the palace's own (命, 財, 妻…), 身 for Thân, 論 otherwise */
export function tvSealOf(s: AiSectionDto, r: TuViReadingDto): { c: string; k: string } {
  if (/năm \d{4}/.test(s.title)) return { c: '運', k: 'kim' };
  if (/Thân cư/.test(s.title)) return { c: '身', k: '' };
  const p = r.chart.palaces[sectionPalaces(s, r)[0] ?? -1];
  return { c: (p && ROLE_SEAL[p.role]) ?? '論', k: '' };
}

export function tuviRoom(r: TuViReadingDto, hl: (t: string) => React.ReactNode, tones: Record<string, string>): RoomReading {
  return {
    hl,
    emblem: (s, _t, _added, small) => { const { c, k } = tvSealOf(s, r); return <Seal c={c} k={`${k}${small ? '' : ' lg'}`} s={small ? 26 : undefined} />; },
    srcLabel: refs => `${refs.length} câu của bà`,
    srcList: refs => refs.map(x => {
      const rule = r.rules[x.code], href = rule ? ruleHref(rule) : null;
      return (
        <blockquote key={x.code}>{hl(rule?.text ?? x.quoted)}
          <cite>{rule?.source === 'supplement' ? 'Bổ sung' : 'Lời bà'}{rule?.paraRef != null && <>, {href ? <Link to={href}>đoạn {rule.paraRef}</Link> : `đoạn ${rule.paraRef}`}</>}
            {rule?.tone === 'cat' ? ' · câu tốt' : rule?.tone === 'hung' ? ' · câu xấu' : ''}</cite></blockquote>
      );
    }),
    added: <><ChuSeal c="論" />Luận thêm, không phải lời bà</>,
    keyChip: (k, i) => { const t = tones[k]; return <span key={i} className={`key ${t === 'chinh' ? 'st-m' : t === 'cat' ? 'st-c' : t === 'hung' ? 'st-h' : ''}`}>{k}</span>; },
  };
}

/** the voices of a reading here: grandma's retold, and what is added */
export const TuviVoices = () => (
  <div className="voices">
    <span><Seal c="外婆" k="two" style={{ width: 20, height: 24, fontSize: 9 }} />Tóm lược lời bà, kèm câu gốc</span>
    <span><ChuSeal c="論" />Luận thêm, không phải lời bà</span>
  </div>
);

export const subjOf = (s: AiSectionDto) => parseTitle(s.title).subj;

// ── asking the AI for a reading ──

export function useAiReadings(profileId: string | null) {
  const status = useQuery({ queryKey: ['ai-status'], queryFn: api.aiStatus, staleTime: 600_000, retry: false });
  const stored = useQuery({ queryKey: ['ai-readings', profileId], queryFn: () => api.aiReadings(profileId!), enabled: !!profileId, retry: false });
  return { status, stored, list: stored.data ?? [] };
}

/** the reading of a scope: this year's, else (a palace, the overview) the latest of any year; a hạn is its own year */
export const readingOf = (list: AiReadingDto[], scope: string, year: number) =>
  list.find(x => x.scope === scope && x.viewYear === year) ?? (scope.startsWith('han-') ? undefined : list.find(x => x.scope === scope));

/** An AI reading of one scope of a saved profile. Its first layer may only retell grandma's matched lines (each idea
 *  cites them, the server checks the citations); the second is labelled as added. */
export function AiWriter({ profileId, scope, year, grandmaLines, mine, what }: {
  profileId: string | null; scope: string; year: number; grandmaLines: number; mine: AiReadingDto | undefined; what: string;
}) {
  const qc = useQueryClient();
  const { status, stored } = useAiReadings(profileId);
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['ai-readings', profileId] });
    void qc.invalidateQueries({ queryKey: ['subjects'] });
    void qc.invalidateQueries({ queryKey: ['brief'] });
  };
  const gen = useMutation({ mutationFn: () => api.generate(profileId!, scope, year), onSuccess: done });
  const del = useMutation({ mutationFn: (id: string) => api.removeReading(id), onSuccess: done });
  const ready = status.data?.ai;
  if (stored.isError && needsToken(stored.error)) return null;
  return (
    <div className="writer">
      {!profileId && <p>Lưu lá số để nhờ AI luận giải {what}: bài viết được giữ lại cùng lá số và tóm tắt sang trang người ở Sonic Hub.</p>}
      {profileId && !mine && <p>AI đọc {grandmaLines} câu của bà đã khớp và viết thành bài luận {what}: phần đầu chỉ tóm lược lời bà, mỗi ý dẫn về câu gốc; phần sau là luận thêm, ghi rõ không phải của bà.</p>}
      {mine && mine.viewYear !== year && <p>Bài này viết khi xem năm {mine.viewYear}.</p>}
      {status.data && !ready && profileId && <p>AI chưa được bật trên máy chủ (thiếu ANTHROPIC_API_KEY).</p>}
      {profileId && ready && (
        <div className="tv-acts">
          <button type="button" className={`btn${mine ? '' : ' solid'}`} disabled={gen.isPending || !grandmaLines} onClick={() => gen.mutate()}>
            {gen.isPending ? <><span className="tv-spin" />Đang viết… (khoảng một phút)</> : mine ? 'Viết lại bài này' : 'Nhờ AI luận giải'}
          </button>
          {mine && !gen.isPending && <button type="button" className="tv-link" disabled={del.isPending} onClick={() => del.mutate(mine.id)}>Xoá bài này</button>}
          {mine?.model && <span className="tv-muted" style={{ fontSize: 12 }}>{mine.model}</span>}
        </div>
      )}
      {!grandmaLines && profileId && ready && <p>Không có câu nào của bà khớp để luận.</p>}
      {gen.isError && <p className="tv-err">{errorText(gen.error)}</p>}
      {del.isError && <p className="tv-err">{errorText(del.error)}</p>}
    </div>
  );
}
