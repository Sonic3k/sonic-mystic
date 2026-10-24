/* One person's numbers in the Nhân số học room: the plate (the ruling number worked out, the chart with its arrows,
   the pyramid, the name letter by letter, the nine-year ruler), then the tabs — the reading given to the person (Luận
   giải), what it rests on, weighed and cited (Căn cứ), the book's passages on the person (Theo sách), and the years
   and peaks (Thời vận). Opened from a link
   (/numerology/view?…) or a saved profile (/numerology/profile/:id).
   Where one is: ?view=synthesis | traits | time, ?part=<topic>, ?peak=<1–4>, ?board=name, ?year=, ?name=. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TOPICS, type Topic } from '@mystic/engine/numerology';
import type { AiReadingDto, NumerologyReadingDto, NumerologySectionDto, NumerologyTocEntryDto, ProfileDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { ProfilePick } from '../../components/ProfilePick';
import { ReadingLayout, SummaryLayout, jump } from '../../components/Reading';
import { useRememberChart } from '../../components/Shell';
import { dmy, fromNumerologySearch, numerologyRequest, toNumerologySearch, withPrimary, type NumerologyParams } from '../../lib/numerology';
import { useTitle } from '../../lib/text';
import { BookBlock, GridFig, L, NameFig, NsCompanion, PyramidFig, Ruling, STAGE, Tri, YearsFig, numHighlighter, numRoom } from './Parts';
import { NamesSheet, ProfileSheet, SaveSheet } from './Sheets';

type Tab = 'summary' | 'synthesis' | 'traits' | 'time';
const TABS: [Tab, string][] = [['summary', 'Luận giải'], ['synthesis', 'Căn cứ'], ['traits', 'Theo sách'], ['time', 'Thời vận']];
export const useNumerologyBook = () => useQuery({ queryKey: ['numerology-book'], queryFn: api.numerologyBook, staleTime: 600_000, retry: false });
const UTC8 = 'Đổi ngày âm ra dương lịch theo lịch tính cho UTC+8, lịch dùng trước năm 1968 (ở miền Nam đến 1975).';
const lunarOf = (b: { calendar: string; day: number | null; month: number | null; year: number | null; leapMonth?: boolean }) =>
  b.calendar === 'lunar' && b.day && b.month && b.year ? `${b.day}/${b.month}${b.leapMonth ? ' nhuận' : ''}/${b.year}` : null;
/** the peak a section of the reading is about («Đỉnh thứ 2 · …»): a peak the book says nothing of has no section */
const peakOf = (s: NumerologySectionDto) => Number(/^Đỉnh thứ (\d)/.exec(s.focus ?? '')?.[1] ?? 0);
const page = (body: React.ReactNode) => <div className="wrap page ns">{body}</div>;
const wait = (t: React.ReactNode) => page(<div className="card empty tv-wait">{t}</div>);

/** a reading opened from a link: the birth and the names are in the URL */
export function NumerologyViewPage() {
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => fromNumerologySearch(sp), [sp]);
  const key = params ? toNumerologySearch(params) : '';
  const reading = useQuery({ queryKey: ['numerology-reading', key], queryFn: () => api.numerologyReading(numerologyRequest(params!)), enabled: !!params, retry: false, placeholderData: keepPreviousData });
  const [sheet, setSheet] = useState<'save' | 'names' | null>(null);
  useTitle(params?.names.find(n => n.primary)?.text || params?.full || 'Nhân số học');
  if (!params) return wait(<>Thiếu ngày sinh. <Link className="tv-link" to="/numerology">Xem các con số</Link></>);
  const edit = <Link className="tv-link" to={`/numerology?${key}`}>Sửa ngày sinh</Link>;
  if (reading.isError) return page(<Failed error={reading.error}>{edit}</Failed>);
  if (!reading.data) return wait('Đang tính các con số…');
  /* the birth and the names change the link; what is being looked at (tab, part, peak, chart) stays */
  const set = (p: Partial<NumerologyParams>) => {
    const n = new URLSearchParams(toNumerologySearch({ ...params, ...p }));
    for (const k of ['view', 'part', 'peak', 'board', 'person']) { const v = sp.get(k); if (v) n.set(k, v); }
    setSp(n, { replace: true });
  };
  return (
    <>
      <ReadingView r={reading.data} sp={sp} setSp={setSp} profile={null} written={null} summary={null} defTab="traits"
        title={params.names.find(n => n.primary)?.text || params.full || 'Các con số'} full={params.full} gender={params.gender} lunar={lunarOf(params.birth)}
        onName={i => set({ names: withPrimary(params.names, i) })} onYear={y => set({ viewYear: y })}
        actions={<>
          <button type="button" className="btn" onClick={() => setSheet('names')}>Sửa tên</button>
          <Link className="btn" to={`/numerology?${key}`}>Sửa ngày sinh</Link>
          <button type="button" className="btn solid" onClick={() => setSheet('save')}>Lưu hồ sơ</button>
        </>} />
      {sheet === 'save' && <SaveSheet params={params} subjectId={sp.get('person')} onClose={() => setSheet(null)} />}
      {sheet === 'names' && <NamesSheet names={params.names} onClose={() => setSheet(null)} onSave={names => { set({ names }); setSheet(null); }} />}
    </>
  );
}

/** a saved profile: the birth and the names as they were saved, and the synthesis written for it */
export function NumerologyProfilePage() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const year = Number(sp.get('year')) || null;
  const nameView = sp.get('name') !== null && Number.isInteger(Number(sp.get('name'))) ? Number(sp.get('name')) : null;
  const profile = useQuery({ queryKey: ['profile', id], queryFn: () => api.profile(id), retry: false });
  const ok = profile.data?.discipline === 'numerology';
  const reading = useQuery({ queryKey: ['numerology-profile-reading', id, year, nameView], queryFn: () => api.numerologyProfileReading(id, year, nameView), enabled: ok, retry: false, placeholderData: keepPreviousData });
  const written = useQuery({ queryKey: ['ai-readings', id], queryFn: () => api.aiReadings(id), enabled: ok, retry: false });
  const [sheet, setSheet] = useState<'names' | 'edit' | null>(null);
  const p = profile.data;
  useTitle(p ? p.names?.find(n => n.primary)?.text ?? p.subject.displayName : 'Nhân số học');
  const back = <Link className="tv-link" to="/numerology">Nhân số học</Link>;
  if (profile.isError) return page(<Failed error={profile.error}>{back}</Failed>);
  if (p && !ok) return wait(<>Đây là lá số tử vi. <Link className="tv-link" to={`/tu-vi/profile/${p.id}`}>Mở lá số</Link></>);
  if (reading.isError) return page(<Failed error={reading.error}>{back}</Failed>);
  if (!p || !reading.data || written.isPending) return wait('Đang mở hồ sơ…');
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null) n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const primary = Math.max(0, (p.names ?? []).findIndex(n => n.primary));
  const newest = (scope: string) => (written.data ?? []).filter(w => w.scope === scope).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const sum = newest('synthesis'), nd = newest('summary');
  const read = reading.data.name ?? primary;
  return (
    <>
      <ReadingView r={reading.data} sp={sp} setSp={setSp} profile={p} written={sum} summary={nd} primary={primary} defTab={nd ? 'summary' : sum ? 'synthesis' : 'traits'}
        title={p.names?.[read]?.text ?? p.subject.displayName} full={p.subject.displayName} gender={p.gender} lunar={lunarOf(p.birth)}
        onName={i => set('name', i === primary ? null : String(i))} onYear={y => set('year', y ? String(y) : null)}
        actions={<>
          <button type="button" className="btn" onClick={() => setSheet('names')}>Sửa tên</button>
          <button type="button" className="btn" onClick={() => setSheet('edit')}>Sửa hồ sơ</button>
        </>} />
      {sheet === 'names' && <NamesSheet names={p.names ?? []} profileId={p.id} onClose={() => setSheet(null)} onSave={() => { set('name', null); setSheet(null); }} />}
      {sheet === 'edit' && <ProfileSheet profile={p} onClose={() => setSheet(null)} />}
    </>
  );
}

function ReadingView({ r, sp, setSp, profile, written, summary, primary = 0, defTab, title, full, gender, lunar, onName, onYear, actions }: {
  r: NumerologyReadingDto; sp: URLSearchParams; setSp: ReturnType<typeof useSearchParams>[1];
  profile: ProfileDto | null; written: AiReadingDto | null; summary: AiReadingDto | null; primary?: number; defTab: Tab;
  title: string; full: string; gender: ProfileDto['gender']; lunar: string | null;
  onName: (i: number) => void; onYear: (y: number | null) => void; actions: React.ReactNode;
}) {
  const toc = useNumerologyBook().data?.toc;
  const c = r.chart;
  useRememberChart('num', title);
  const tabs = TABS.filter(([k]) => k !== 'summary' || summary);
  const tab = (tabs.some(([k]) => k === sp.get('view')) ? sp.get('view') : defTab) as Tab;
  const set = (patch: Record<string, string | null>) => { const n = new URLSearchParams(sp); for (const [k, v] of Object.entries(patch)) { if (v === null) n.delete(k); else n.set(k, v); } setSp(n, { replace: true }); };
  const [hl, setHl] = useState<string | null>(null);
  /* a passage cited by the reading is shown where its tab has it, once that tab has been drawn */
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollTo.current ? document.getElementById(scrollTo.current) : null;
    if (el) { scrollTo.current = null; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  const nameIdx = r.name;
  const nm = nameIdx !== null ? c.names[nameIdx] : null;
  const g = gender === 'female' ? 'Nữ' : gender === 'male' ? 'Nam' : '';
  const sample = !profile && c.input.day === 1 && c.input.month === 5 && c.input.year === 1974 && nm?.text === 'Quỳnh';
  const who = written?.author === 'ai' ? 'AI' : 'Claude';
  const hlText = useMemo(() => numHighlighter(), []);
  const goTo = (code: string) => {
    const rule = r.rules[code];
    if (!rule) return;
    const time = ['year', 'peaks', 'stages'].includes(rule.topic);
    const patch: Record<string, string | null> = { view: time ? 'time' : 'traits' };
    if (patch.view === defTab) patch.view = null;
    if (!time) patch.part = rule.topic === 'ruling' ? null : rule.topic;
    if (rule.topic === 'peaks') {
      const s = r.sections.find(x => x.topic === 'peaks' && x.groups.some(gr => gr.matches.some(m => m.rule === code)));
      if (s && peakOf(s)) patch.peak = String(peakOf(s));
    }
    set(patch);
    setHl(code);
    scrollTo.current = `r-${code}`;
  };
  /* the reading's sources call the newest goTo (it builds on the address as it is now) */
  const go = useRef(goTo);
  go.current = goTo;
  const room = useMemo(() => numRoom(r, hlText, who, primary, code => go.current(code), toc), [r, hlText, who, primary, toc]);
  /* from the Luận giải into its Căn cứ, at one of its sections or at its top */
  const readFrom = (i: number | null) => {
    set({ view: defTab === 'synthesis' ? null : 'synthesis' });
    setTimeout(() => { if (i === null) document.querySelector('.ns-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); else jump(`s${i}`); }, 60);
  };
  const birth = `${g ? `${g}, ` : ''}sinh ngày ${c.input.day}/${c.input.month}/${c.input.year} (dương lịch${r.solar.fromLunar && lunar ? `, đổi từ ${lunar} âm lịch` : ''}).`;
  const names = c.names.map(n => `${n.text}${n.label && n.label !== n.text ? ` (${n.label.toLowerCase()})` : ''}`).join(', ');
  const mode: 'birth' | 'name' = sp.get('board') === 'name' ? 'name' : 'birth';
  const selYear = r.viewYear ?? c.now.year.year;
  return (
    <div className="wrap page ns">
      <header className="phead">
        <h1>{title}<ProfilePick profile={profile} fallback="Hồ sơ" extra={[...(nm?.label ? [`đọc theo ${nm.label.toLowerCase()}`] : []), ...(sample ? ['ví dụ trong sách'] : [])]} /></h1>
        <p className="birth">{birth}{names ? ` Các tên đã lưu: ${names}.` : ' Chưa có tên.'}{!profile && full && nm && full !== nm.text ? ` Họ tên: ${full}.` : ''}
          {profile && <> <Link to={`/people/${profile.subject.id}`}>Trang của {profile.subject.displayName}</Link></>}{profile?.note && <> · {profile.note}</>}</p>
        <div className="acts">
          {c.names.length > 1 && <div className="switch" role="group" aria-label="Đọc theo tên">{c.names.map((n, i) => (
            <button key={i} type="button" className={i === nameIdx ? 'on' : ''} onClick={() => onName(i)}>{n.text}</button>))}</div>}
          {actions}
        </div>
      </header>
      {r.solar.fromLunar && /UTC\+8/.test(r.solar.note ?? '') && <div className="tv-calwarn">{UTC8}</div>}

      <div className="ns-plate">
        <div className="nfig"><Ruling c={c} nameIdx={nameIdx} /></div>
        <div className="nfig"><GridFig c={c} nameIdx={nameIdx} mode={mode} onMode={m => set({ board: m === 'name' ? 'name' : null })} /></div>
        <div className="nfig pyr"><PyramidFig c={c} /></div>
        <div className="ns-row2">
          <div className="nfig"><NameFig c={c} nameIdx={nameIdx} /></div>
          <div className="nfig"><YearsFig c={c} sel={selYear} onYear={y => { onYear(y); }} /></div>
        </div>
      </div>

      <nav className="tabs ns-tabs" role="tablist" aria-label="Phần đọc">{tabs.map(([k, t]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => set({ view: k === defTab ? null : k })}>{t}</button>))}</nav>
      {tab === 'summary' && summary && <SummaryLayout ai={summary} main={written} room={room} sub="Bài giải nhân số học" onRead={readFrom} />}
      {tab === 'synthesis' && (written
        ? <ReadingLayout ai={written} room={room} fresh="còn khớp với hồ sơ" old="hồ sơ đã đổi từ khi viết, nên viết lại"
            voices={<><span><i className="vc" style={{ background: '#151515' }} />Tóm lược lời sách</span><span><i className="vc" style={{ background: 'var(--blue)' }} />{who} luận thêm</span></>}
            top={profile && nameIdx !== null && nameIdx !== primary ? <p className="ns-note">Bài luận viết theo tên {profile.names?.[primary]?.text}; bảng số phía trên đang đọc theo tên {nm?.text}.</p> : null}
            companion={k => <NsCompanion r={r} s={written.sections[k]} primary={nameIdx ?? primary} />} />
        : <NoReading r={r} profile={profile} />)}
      {tab === 'traits' && <TraitsTab r={r} part={sp.get('part')} toc={toc} hl={hlText} focus={hl} />}
      {tab === 'time' && <TimeTab r={r} peak={Number(sp.get('peak')) || null} setPeak={i => set({ peak: String(i) })} onYear={onYear} toc={toc} hl={hlText} focus={hl} />}
    </div>
  );
}

function NoReading({ r, profile }: { r: NumerologyReadingDto; profile: ProfileDto | null }) {
  const n = (t: Topic) => r.sections.filter(s => s.topic === t).reduce((k, s) => k + s.groups.reduce((a, gr) => a + gr.matches.filter(m => r.rules[m.rule]?.kind !== 'general').length, 0), 0);
  return (
    <div className="ns-pane no-rd">
      <div className="writer"><p>{profile
        ? 'Chưa có phần căn cứ cho người này. Phần này do Claude viết từ những đoạn sách khớp ở hai phần Theo sách và Thời vận, rồi lưu vào hồ sơ; bài Luận giải giao cho người được xem dựa trên phần này.'
        : 'Phần căn cứ được viết cho hồ sơ đã lưu: lưu hồ sơ này, rồi Claude viết từ những đoạn sách khớp ở hai phần Theo sách và Thời vận; khi có, nó hiện ở đây.'}</p></div>
      <dl className="counts">{TOPICS.map(t => <div key={t.code}><dt>{t.title}</dt><dd>{n(t.code)} đoạn</dd></div>)}</dl>
    </div>
  );
}

// ── Theo sách: what the book says of the person, part by part ──

function TraitsTab({ r, part, toc, hl, focus }: { r: NumerologyReadingDto; part: string | null; toc?: NumerologyTocEntryDto[]; hl: (t: string) => React.ReactNode; focus: string | null }) {
  const c = r.chart, nm = r.name !== null ? c.names[r.name] : null;
  const isMaster = (n: number) => n === 11 || n === 22;
  const parts: { k: Topic; title: string; sub: string; em: React.ReactNode }[] = [
    { k: 'ruling', title: `Con số chủ đạo ${L(c.ruling)}`, sub: `tổng các chữ số ngày sinh ${c.sum}`, em: <span className={`ns-em circle${isMaster(c.ruling) ? ' master' : ''}`}><b>{c.ruling}</b></span> },
    { k: 'birthday', title: `Con số ngày sinh ${L(c.birthday)}`, sub: c.birthday === c.ruling ? 'trùng Con số chủ đạo' : `sinh ngày ${c.input.day}`, em: <span className="ns-em square"><b>{c.birthday}</b></span> },
    { k: 'grid', title: 'Biểu đồ ngày sinh', sub: [3, 6, 9, 2, 5, 8, 1, 4, 7].filter(n => c.grid.counts[n]).map(n => String(n).repeat(c.grid.counts[n])).join(' · '), em: <span className="ns-em"><svg viewBox="0 0 50 50" aria-hidden="true"><rect className="s" x="6" y="6" width="38" height="38" /><path className="s" d="M18.7 6v38M31.3 6v38M6 18.7h38M6 31.3h38" /></svg></span> },
    { k: 'arrows', title: 'Các mũi tên', sub: `${c.grid.arrows.length} mũi tên đầy, ${c.grid.empty.length} mũi tên trống`, em: <span className="ns-em"><svg viewBox="0 0 50 50" aria-hidden="true"><rect className="s" x="6" y="6" width="38" height="38" /><path d="M10 10 40 40" stroke="var(--red)" strokeWidth="2.4" strokeDasharray="5 4" fill="none" /></svg></span> },
    ...(nm ? [{ k: 'name' as Topic, title: `Tên ${nm.text}`, sub: `linh hồn ${L(nm.soul)} · biểu đạt ${L(nm.expression)} · tên riêng ${L(nm.nameNumber)}`, em: <span className="ns-em square"><b>{nm.nameNumber}</b></span> }] : []),
  ];
  useEffect(() => {
    if (part && parts.some(x => x.k === part)) { const t = setTimeout(() => jump(`part-${part}`), 60); return () => clearTimeout(t); }
  }, [part]); // eslint-disable-line react-hooks/exhaustive-deps
  const groupsOf = (k: Topic) => r.sections.filter(s => s.topic === k).flatMap(s => s.groups);
  return (
    <div className="ns-pane">
      <div className="ns-jump">{parts.map(x => <a key={x.k} href={`#part-${x.k}`} onClick={e => { e.preventDefault(); jump(`part-${x.k}`); }}>{x.title}</a>)}</div>
      {parts.map(x => <BookBlock key={x.k} id={`part-${x.k}`} emblem={x.em} title={x.title} sub={x.sub} groups={groupsOf(x.k)} rules={r.rules} toc={toc} hl={hl} focus={focus} topic={x.k} />)}
    </div>
  );
}

// ── Thời vận: the pyramid, the peaks, the years ──

function TimeTab({ r, peak, setPeak, onYear, toc, hl, focus }: {
  r: NumerologyReadingDto; peak: number | null; setPeak: (i: number) => void; onYear: (y: number | null) => void; toc?: NumerologyTocEntryDto[]; hl: (t: string) => React.ReactNode; focus: string | null;
}) {
  const c = r.chart, now = c.now, P = c.pyramid.peaks;
  const selYear = r.viewYear ?? now.year.year;
  const sel = c.years.find(y => y.year === selYear);
  const pk = peak && peak >= 1 && peak <= 4 ? peak : (now.nextPeak ?? now.lastPeak ?? P[0]).index;
  const peakSec = r.sections.find(x => x.topic === 'peaks' && peakOf(x) === pk);
  const peakGeneral = r.sections.filter(s => s.topic === 'peaks' && !peakOf(s)).flatMap(s => s.groups);
  const groupsOf = (t: Topic) => r.sections.filter(s => s.topic === t).flatMap(s => s.groups);
  const tr = now.transition, next = c.years.find(y => y.year === now.year.year + 1);
  const p = P.find(x => x.index === pk);
  return (
    <div className="ns-pane time-wrap">
      <div className="nfig pyr"><PyramidFig c={c} onPeak={setPeak} sel={pk} /><p className="fig-note">Bấm một đỉnh để đọc lời sách về đỉnh ấy.</p></div>
      <div className="nfig"><h3>Bốn đỉnh cao</h3>
        <table className="peaks-t"><thead><tr><th /><th>Số</th><th>Tuổi</th><th>Năm</th><th /></tr></thead>
          <tbody>{P.map(x => (
            <tr key={x.index} className={[now.lastPeak?.index === x.index ? 'now' : '', x.index === pk ? 'sel' : ''].filter(Boolean).join(' ') || undefined} onClick={() => setPeak(x.index)}>
              <td><button type="button" className="row-pick" onClick={e => { e.stopPropagation(); setPeak(x.index); }} aria-pressed={x.index === pk}>Đỉnh {x.index}</button></td>
              <td className="n">{L(x.n)}</td><td>{x.age} tuổi</td><td>{x.year}</td>
              <td>{now.lastPeak?.index === x.index ? 'đang ở đỉnh này' : now.nextPeak?.index === x.index ? 'đỉnh tới' : x.age <= now.age ? 'đã qua' : ''}</td></tr>))}</tbody></table></div>
      <BookBlock emblem={<span className="ns-em tri"><Tri /><b>{p ? L(p.n) : ''}</b></span>} title={`Đỉnh ${pk}${p ? `: số ${L(p.n)}` : ''}`} sub={p ? `${p.age} tuổi, năm ${p.year}` : undefined}
        groups={[...peakGeneral, ...(peakSec?.groups ?? [])]} rules={r.rules} toc={toc} hl={hl} focus={focus} topic="peaks" />
      <BookBlock emblem={<span className="ns-em tri"><Tri /><b>{now.stage}</b></span>} title={`Giai đoạn ${STAGE[now.stage]}`} sub={`${now.age} tuổi`} groups={groupsOf('stages')} rules={r.rules} toc={toc} hl={hl} focus={focus} topic="stages" />
      <div className="nfig"><h3>Các năm cá nhân <small>một năm cá nhân bắt đầu ở đầu tháng sau sinh nhật âm của năm trước, như sách tính; bấm một năm để đọc</small></h3>
        <table className="peaks-t"><thead><tr><th>Năm</th><th>Số</th><th>Từ – đến</th><th>Dài</th><th /></tr></thead>
          <tbody>{c.years.map(y => (
            <tr key={y.year} className={[y.year === now.year.year ? 'now' : '', y.year === selYear ? 'sel' : ''].filter(Boolean).join(' ') || undefined} onClick={() => onYear(y.year === now.year.year ? null : y.year)}>
              <td><button type="button" className="row-pick" aria-pressed={y.year === selYear} onClick={e => { e.stopPropagation(); onYear(y.year === now.year.year ? null : y.year); }}>{y.year}</button></td>
              <td className="n">{y.n}</td><td>{dmy(y.start)} – {dmy(y.end)}</td><td>{y.months} tháng</td><td>năm thế giới {y.world === 22 ? '22/4' : y.world}{y.year === now.year.year ? ' · đang sống' : ''}</td></tr>))}</tbody></table></div>
      <BookBlock emblem={<span className="ns-em tri"><Tri /><b>{r.pyear}</b></span>} title={`Năm cá nhân ${r.pyear} · ${selYear}`} sub={sel ? `${dmy(sel.start)} – ${dmy(sel.end)}, ${sel.months} tháng` : undefined}
        groups={groupsOf('year')} rules={r.rules} toc={toc} hl={hl} focus={focus} topic="year">
        {selYear === now.year.year && <p className="ns-note">{tr ? `Đang ở khúc giao thời từ năm ${tr.from} sang năm ${tr.to}, đến khoảng ${dmy(tr.until)}.` : `Năm đang sống.${next ? ` Năm ${next.n} bắt đầu ${dmy(next.start)}; khúc giao thời kéo dài hai đến năm tháng từ ngày ấy.` : ''}`}</p>}
      </BookBlock>
    </div>
  );
}
