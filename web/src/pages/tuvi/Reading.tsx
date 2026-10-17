/* How a reading is shown. Grandma's sentences: her words in her typeface, a bar for good / bad, the reason each one
   applies, the paragraph it comes from, and — when the machine had to interpret her — how it read her.
   "Bổ sung" (not hers) always sits apart, in its own box and the plain UI typeface. */
import { createContext, useContext, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiReadingDto, GroupDto, MatchDto, RuleDto } from '@mystic/engine/api';
import type { Principle } from '@mystic/engine/tuvi';
import { api } from '../../api';
import { errorText, needsToken } from '../../components/Owner';

export const TONE_NAME = { cat: 'tốt', hung: 'xấu', mixed: 'tốt xấu lẫn', trung: 'mô tả' } as const;
export type ToneFilter = 'all' | 'cat' | 'hung';

/** the rules a reading mentions, by code (the API sends each rule once, the groups refer to them) */
export const RulesContext = createContext<Record<string, RuleDto>>({});

export const ruleHref = (r: Pick<RuleDto, 'entryRef' | 'paraRef'>) =>
  r.entryRef === null ? null : `/tu-vi/books/${r.entryRef}${r.paraRef !== null ? `#p${r.paraRef}` : ''}`;

export function Line({ m, hl }: { m: MatchDto; hl?: boolean }) {
  const [open, setOpen] = useState(false);
  const r = useContext(RulesContext)[m.rule];
  if (!r) return null;
  const href = ruleHref(r);
  return (
    <div className={`tv-line t-${r.tone} ${hl ? 'hl' : ''}`} id={`r-${r.code}`} title={TONE_NAME[r.tone]}>
      <p>{r.ctx && <span className="ctx">{r.ctx}</span>}{r.text}{r.edited && <span className="tv-edited" title="Câu này đã được sửa chữ trong cơ sở dữ liệu">đã sửa chữ</span>}</p>
      <div className="tv-why">
        {m.why.map((w, i) => <span key={i}>{w}</span>)}
        {href && <span><Link to={href}>đoạn {r.paraRef}</Link></span>}
        {r.review && <span><button type="button" onClick={() => setOpen(o => !o)}>{open ? 'ẩn cách hiểu' : 'cách máy hiểu câu này'}</button></span>}
      </div>
      {open && r.review && <div className="tv-review"><b>Cần người nhà xem lại:</b> {r.review}{r.when && <code>{r.when}</code>}</div>}
    </div>
  );
}

export function Groups({ groups, filter = 'all', limit = 6, hlRef, entryLink = true }: {
  groups: GroupDto[]; filter?: ToneFilter; limit?: number; hlRef?: string | null; entryLink?: boolean;
}) {
  const rules = useContext(RulesContext);
  const [openAll, setOpenAll] = useState<Record<string, boolean>>({});
  const keep = (m: MatchDto) => { const t = rules[m.rule]?.tone; return filter === 'all' || t === filter || t === 'mixed'; };
  const shown = groups.map(g => ({ ...g, matches: g.matches.filter(keep) })).filter(g => g.matches.length);
  if (!shown.length) return <div className="tv-empty">{filter === 'all' ? 'Không có câu nào trong ghi chép của bà khớp với cung này.' : 'Không có câu nào thuộc loại này.'}</div>;
  return (
    <>
      {shown.map(g => {
        const all = openAll[g.key] || g.matches.some(m => m.rule === hlRef);
        const list = all ? g.matches : g.matches.slice(0, limit);
        return (
          <section key={g.key} className="tv-group">
            <div className="tv-gh"><b>{g.name}</b><span>{g.inPalace ? 'tại cung' : 'từ cung khác chiếu, hội'} · {g.matches.length} câu</span>
              {entryLink && g.entryRef !== null && <Link to={`/tu-vi/books/${g.entryRef}`}>Mục {g.name} ›</Link>}</div>
            <div className="tv-lines">{list.map(m => <Line key={m.rule} m={m} hl={m.rule === hlRef} />)}</div>
            {!all && g.matches.length > limit && <button type="button" className="tv-morebtn" onClick={() => setOpenAll(o => ({ ...o, [g.key]: true }))}>Xem thêm {g.matches.length - limit} câu</button>}
          </section>
        );
      })}
    </>
  );
}

export function Supplement({ about, groups, principles, title = 'Bổ sung' }: { about?: string | null; groups: GroupDto[]; principles?: Principle[]; title?: string }) {
  const rules = useContext(RulesContext);
  const lines = groups.flatMap(g => g.matches.map(m => ({ g, m, r: rules[m.rule] }))).filter(x => x.r);
  if (!about && !lines.length && !principles?.length) return null;
  return (
    <aside className="tv-added-box">
      <h4><span className="tv-voice added">{title}</span></h4>
      <small>Kiến thức tử vi phổ thông — không phải ghi chép của bà.</small>
      {about && <p>{about}</p>}
      {lines.map(({ g, m, r }) => <div key={m.rule} className="added-line">{r.text}<small>{g.name} · {m.why.join(' · ')}</small></div>)}
      {principles?.map(p => <div key={p.id} className="pr"><b>{p.title}</b><p>{p.text}</p></div>)}
    </aside>
  );
}

// ── AI ───────────────────────────────────────────────────────────────────────

/** An AI reading of one scope of a saved profile. Its first layer may only retell grandma's matched lines (each idea
 *  cites them, the server checks the citations); the second is labelled as added. */
export function AiBox({ profileId, scope, year, grandmaLines, onRef, wide }: {
  profileId: string | null; scope: string; year: number; grandmaLines: number;
  /** scrolls to a cited line when it is on the page; false when it is not */
  onRef: (code: string) => boolean; wide?: boolean;
}) {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['ai-status'], queryFn: api.aiStatus, staleTime: 600_000, retry: false });
  const stored = useQuery({ queryKey: ['ai-readings', profileId], queryFn: () => api.aiReadings(profileId!), enabled: !!profileId, retry: false });
  const list = stored.data ?? [];
  /* a palace or the overview: the reading of this year, else the latest of any year; a hạn is always its own year */
  const mine = list.find(x => x.scope === scope && x.viewYear === year) ?? (scope.startsWith('han-') ? undefined : list.find(x => x.scope === scope));
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
    <div className={`tv-ai ${wide ? 'wide' : ''}`}>
      <h4><span className="tv-voice ai">AI luận giải</span></h4>
      {!profileId && <p>Lưu lá số để nhờ AI luận giải — bài viết được giữ lại cùng lá số và tóm tắt sang trang người ở Sonic Hub.</p>}
      {profileId && !mine && <p>AI đọc {grandmaLines} câu của bà đã khớp và viết thành bài: phần đầu chỉ tóm lược lời bà, mỗi ý dẫn về câu gốc; phần sau là luận giải thêm, ghi rõ không phải của bà.</p>}
      {mine && <AiOut r={mine} onRef={onRef} />}
      {mine && mine.viewYear !== year && <p className="tv-ai-caution">Bài này viết khi xem năm {mine.viewYear}.</p>}
      {mine?.stale && <p className="tv-ai-caution">Lá số, cách an hoặc ghi chép đã đổi từ lúc viết bài này — nên viết lại.</p>}
      {status.data && !ready && profileId && <p className="tv-muted">AI chưa được bật trên máy chủ (thiếu ANTHROPIC_API_KEY).</p>}
      {profileId && ready && (
        <>
          <button type="button" className="tv-btn" disabled={gen.isPending || !grandmaLines} onClick={() => gen.mutate()}>
            {gen.isPending ? <><span className="tv-spin" />Đang viết… (khoảng một phút)</> : mine ? 'Viết lại' : 'Nhờ AI luận giải'}
          </button>
          {mine && !gen.isPending && <button type="button" className="tv-link tv-ai-del" disabled={del.isPending} onClick={() => del.mutate(mine.id)}>Xoá bài này</button>}
        </>
      )}
      {!grandmaLines && profileId && ready && <p className="tv-muted">Không có câu nào của bà khớp để luận.</p>}
      {gen.isError && <p className="tv-err">{errorText(gen.error)}</p>}
      {del.isError && <p className="tv-err">{errorText(del.error)}</p>}
    </div>
  );
}

function AiOut({ r, onRef }: { r: AiReadingDto; onRef: (code: string) => boolean }) {
  const [quote, setQuote] = useState<string | null>(null);
  return (
    <div className="tv-ai-out">
      <div className="tv-ai-lbl"><span className="tv-voice primary">Tóm lược lời bà</span><span className="tv-voice added">Luận thêm — không phải của bà</span></div>
      {r.sections.map((s, i) => (
        <div key={i} className="tv-ai-sec">
          <h5>{s.title}</h5>
          {s.items.map((it, k) => {
            const id = `${i}.${k}`;
            if (it.layer !== 'primary') return <p key={k} className="tv-ai-added">{it.text}</p>;
            const open = quote?.startsWith(`${id}|`) ? it.refs.find(x => x.code === quote.slice(id.length + 1)) : undefined;
            return (
              <div key={k}>
                <p className="tv-ai-primary">{it.text}<sup>{it.refs.map((x, n) => (
                  <a key={x.code} title={x.quoted} onClick={() => { if (!onRef(x.code)) setQuote(q => (q === `${id}|${x.code}` ? null : `${id}|${x.code}`)); }}>[{n + 1}]</a>
                ))}</sup></p>
                {open && <blockquote className="tv-ai-quote">«{open.quoted}»<small>câu gốc của bà · {open.code}</small></blockquote>}
              </div>
            );
          })}
        </div>
      ))}
      {r.caution && <p className="tv-ai-caution">{r.caution}</p>}
      <div className="tv-ai-meta"><span>{r.model}</span><span>{new Date(r.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span></div>
    </div>
  );
}
