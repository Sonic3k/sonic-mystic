/* One person's numbers and what Lê Đỗ Quỳnh Hương's book says of them: the board, then three tabs — the synthesis
   Claude wrote (Tổng hợp), the book's passages on the person (Tính cách), and the years and peaks (Thời vận).
   Opened from a link (/numerology/view?…) or from a saved profile (/numerology/profile/:id). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ARROW_BY_CODE, TOPICS, type Topic } from '@mystic/engine/numerology';
import type { AiReadingDto, NumerologyReadingDto, NumerologyRuleDto, NumerologySectionDto, NumerologyTocEntryDto, ProfileDto } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed } from '../../components/Owner';
import { SONIC_HUB } from '../../lib/people';
import { dmShort, dmy, fromNumerologySearch, numerologyRequest, toNumerologySearch, withPrimary, type NumerologyParams } from '../../lib/numerology';
import { dateVi, useTitle } from '../../lib/text';
import { Board, Explain, Groups, L, LifeLine, STAGE, splitGroups } from './Parts';
import { NamesSheet, ProfileSheet, SaveSheet } from './Sheets';

type Tab = 'synthesis' | 'traits' | 'time';
export const useNumerologyBook = () => useQuery({ queryKey: ['numerology-book'], queryFn: api.numerologyBook, staleTime: 600_000, retry: false });
const UTC8 = 'Đổi ngày âm ra dương lịch theo lịch tính cho UTC+8, lịch dùng trước năm 1968 (ở miền Nam đến 1975).';
const lunarOf = (b: { calendar: string; day: number | null; month: number | null; year: number | null; leapMonth?: boolean }) =>
  b.calendar === 'lunar' && b.day && b.month && b.year ? `${b.day}/${b.month}${b.leapMonth ? ' nhuận' : ''}/${b.year}` : null;
/** the peak a section of the reading is about («Đỉnh thứ 2 · …»): a peak the book says nothing of has no section */
const peakOf = (s: NumerologySectionDto) => Number(/^Đỉnh thứ (\d)/.exec(s.focus ?? '')?.[1] ?? 0);
const arrowName = (code: string, kind: 'full' | 'empty') => (kind === 'full' ? ARROW_BY_CODE[code]?.full : ARROW_BY_CODE[code]?.empty) ?? code;
const page = (body: React.ReactNode) => <div className="wrap page tv ns">{body}</div>;

/** a reading opened from a link: the birth and the names are in the URL */
export function NumerologyViewPage() {
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => fromNumerologySearch(sp), [sp]);
  const key = params ? toNumerologySearch(params) : '';
  const reading = useQuery({ queryKey: ['numerology-reading', key], queryFn: () => api.numerologyReading(numerologyRequest(params!)), enabled: !!params, retry: false, placeholderData: keepPreviousData });
  const [sheet, setSheet] = useState<'save' | 'names' | null>(null);
  useTitle(params?.names.find(n => n.primary)?.text || params?.full || 'Nhân số học');
  if (!params) return page(<div className="tv-empty">Thiếu ngày sinh. <Link className="tv-link" to="/numerology">Xem các con số</Link></div>);
  const edit = <Link className="tv-link" to={`/numerology?${key}`}>Sửa ngày sinh</Link>;
  if (reading.isError) return page(<Failed error={reading.error}>{edit}</Failed>);
  if (!reading.data) return page(<div className="tv-empty">Đang tính các con số…</div>);
  /* the birth and the names change the link; what is being looked at (tab, part, peak, chart) stays */
  const set = (p: Partial<NumerologyParams>) => {
    const n = new URLSearchParams(toNumerologySearch({ ...params, ...p }));
    for (const k of ['view', 'part', 'peak', 'board', 'person']) { const v = sp.get(k); if (v) n.set(k, v); }
    setSp(n, { replace: true });
  };
  return (
    <>
      <ReadingView r={reading.data} sp={sp} setSp={setSp} profile={null} written={null} defTab="traits"
        title={params.names.find(n => n.primary)?.text || params.full || 'Các con số'} full={params.full} gender={params.gender} lunar={lunarOf(params.birth)}
        onName={i => set({ names: withPrimary(params.names, i) })} onYear={y => set({ viewYear: y })}
        actions={<>
          <button type="button" className="tv-btn ghost" onClick={() => setSheet('names')}>Sửa tên</button>
          <Link className="tv-btn ghost" to={`/numerology?${key}`}>Sửa ngày sinh</Link>
          <button type="button" className="tv-btn accent" onClick={() => setSheet('save')}>Lưu hồ sơ</button>
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
  if (p && !ok) return page(<div className="tv-empty">Đây là lá số tử vi. <Link className="tv-link" to={`/tu-vi/profile/${p.id}`}>Mở lá số</Link></div>);
  if (reading.isError) return page(<Failed error={reading.error}>{back}</Failed>);
  if (!p || !reading.data || written.isPending) return page(<div className="tv-empty">Đang mở hồ sơ…</div>);
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null) n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const primary = Math.max(0, (p.names ?? []).findIndex(n => n.primary));
  const sum = (written.data ?? []).filter(w => w.scope === 'synthesis').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const read = reading.data.name ?? primary;
  return (
    <>
      <ReadingView r={reading.data} sp={sp} setSp={setSp} profile={p} written={sum} primary={primary} defTab={sum ? 'synthesis' : 'traits'}
        title={p.names?.[read]?.text ?? p.subject.displayName} full={p.subject.displayName} gender={p.gender} lunar={lunarOf(p.birth)}
        onName={i => set('name', i === primary ? null : String(i))} onYear={y => set('year', y ? String(y) : null)}
        actions={<>
          <button type="button" className="tv-btn ghost" onClick={() => setSheet('names')}>Sửa tên</button>
          <button type="button" className="tv-btn ghost" onClick={() => setSheet('edit')}>Sửa hồ sơ</button>
        </>} />
      {sheet === 'names' && <NamesSheet names={p.names ?? []} profileId={p.id} onClose={() => setSheet(null)} onSave={() => { set('name', null); setSheet(null); }} />}
      {sheet === 'edit' && <ProfileSheet profile={p} onClose={() => setSheet(null)} />}
    </>
  );
}

function ReadingView({ r, sp, setSp, profile, written, primary = 0, defTab, title, full, gender, lunar, onName, onYear, actions }: {
  r: NumerologyReadingDto; sp: URLSearchParams; setSp: ReturnType<typeof useSearchParams>[1];
  profile: ProfileDto | null; written: AiReadingDto | null; primary?: number; defTab: Tab;
  title: string; full: string; gender: ProfileDto['gender']; lunar: string | null;
  onName: (i: number) => void; onYear: (y: number | null) => void; actions: React.ReactNode;
}) {
  const toc = useNumerologyBook().data?.toc;
  const c = r.chart;
  const tab = (['synthesis', 'traits', 'time'].includes(sp.get('view') ?? '') ? sp.get('view') : defTab) as Tab;
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null) n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const [hl, setHl] = useState<string | null>(null);
  /* a passage cited by the synthesis is shown where the reading has it, once that tab has been drawn */
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollTo.current ? document.getElementById(scrollTo.current) : null;
    if (el) { scrollTo.current = null; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  const nm = r.name !== null ? c.names[r.name] : null;
  const g = gender === 'female' ? 'Nữ' : gender === 'male' ? 'Nam' : '';
  const sample = !profile && c.input.day === 1 && c.input.month === 5 && c.input.year === 1974 && nm?.text === 'Quỳnh';
  const goTo = (code: string) => {
    const rule = r.rules[code];
    if (!rule) return;
    const time = ['year', 'peaks', 'stages'].includes(rule.topic);
    const n = new URLSearchParams(sp);
    n.set('view', time ? 'time' : 'traits');
    if (!time) { if (rule.topic === 'ruling') n.delete('part'); else n.set('part', rule.topic); }
    if (rule.topic === 'peaks') {
      const s = r.sections.find(x => x.topic === 'peaks' && x.groups.some(gr => gr.matches.some(m => m.rule === code)));
      if (s && peakOf(s)) n.set('peak', String(peakOf(s)));
    }
    setSp(n, { replace: true });
    setHl(code);
    scrollTo.current = `r-${code}`;
  };
  return (
    <div className="wrap page tv ns">
      <div className="tv-chart-head">
        <div>
          <h1>{title}{profile?.label && <span className="hh-tag">{profile.label}</span>}{sample && <span className="hh-tag">ví dụ trong sách</span>}</h1>
          <p>{[g, `sinh ${c.input.day}/${c.input.month}/${c.input.year} dương lịch${r.solar.fromLunar && lunar ? ` (đổi từ ${lunar} âm lịch)` : ''}`,
            nm ? `đọc theo tên ${nm.text}${nm.label && nm.label !== nm.text ? ` (${nm.label.toLowerCase()})` : ''}` : 'chưa có tên'].filter(Boolean).join(' · ')}</p>
          {profile && <p className="tv-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            <Link className="tv-link" to={`/people/${profile.subject.id}`}>{profile.subject.displayName}</Link>
            {profile.subject.links.some(l => l.system === SONIC_HUB) && <> · <span className="tv-linked">liên kết Sonic Hub</span></>}
            {profile.note && <> · {profile.note}</>}
          </p>}
          {!profile && full && nm && full !== nm.text && <p className="tv-muted" style={{ fontSize: 12.5, marginTop: 4 }}>{full}</p>}
        </div>
        <div className="acts">{actions}</div>
      </div>
      {r.solar.fromLunar && /UTC\+8/.test(r.solar.note ?? '') && <div className="tv-calwarn">{UTC8}</div>}

      <Board c={c} nameIdx={r.name} mode={sp.get('board') === 'name' ? 'name' : 'birth'} onMode={m => set('board', m === 'name' ? 'name' : null)} onName={onName} />

      <div className="tv-tabs" id="doc">
        <div className="seg" role="tablist" aria-label="Phần đọc">
          {([['synthesis', 'Tổng hợp'], ['traits', 'Tính cách'], ['time', 'Thời vận']] as const).map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => set('view', k === defTab ? null : k)}>{t}</button>))}
        </div>
        <span className="tv-voice primary">Lời sách</span><span className="tv-voice ai">Claude luận thêm — không phải lời sách</span>
        <span className="tv-caution">Nhân số học để tham khảo, chiêm nghiệm. Các con số chỉ khuynh hướng.</span>
      </div>
      {tab === 'synthesis' && <SumTab r={r} written={written} profile={profile} primary={primary} toc={toc} onGoTo={goTo} />}
      {tab === 'traits' && <TraitsTab r={r} part={sp.get('part')} setPart={v => set('part', v === 'ruling' ? null : v)} toc={toc} hl={hl} />}
      {tab === 'time' && <TimeTab r={r} peak={Number(sp.get('peak')) || null} setPeak={i => set('peak', String(i))} onYear={onYear} toc={toc} hl={hl} />}
    </div>
  );
}

// ── Tổng hợp ──

function SumTab({ r, written, profile, primary, toc, onGoTo }: {
  r: NumerologyReadingDto; written: AiReadingDto | null; profile: ProfileDto | null; primary: number; toc?: NumerologyTocEntryDto[]; onGoTo: (code: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const by = useMemo(() => new Map((toc ?? []).map(e => [e.code, e])), [toc]);
  const pathOf = (entry: string) => { const out: string[] = []; for (let e = by.get(entry); e; e = e.parent ? by.get(e.parent) : undefined) out.unshift(e.title); return out.slice(1).join(' › '); };
  if (!written) {
    return (
      <div className="tv-read">
        <div className="tv-read-main"><div className="tv-empty">{profile
          ? 'Chưa có bài tổng hợp cho người này. Bài tổng hợp do Claude viết từ những đoạn sách khớp ở hai phần Tính cách và Thời vận, rồi lưu vào hồ sơ; khi có, bài hiện ở đây.'
          : 'Bài tổng hợp được viết cho hồ sơ đã lưu: lưu hồ sơ này, rồi Claude viết bài từ những đoạn sách khớp ở hai phần Tính cách và Thời vận; khi có, bài hiện ở đây.'}</div></div>
        <div className="tv-read-side"><TopicCounts r={r} /></div>
      </div>
    );
  }
  const who = written.author === 'ai' ? 'AI' : 'Claude';
  const matched = r.sections.reduce((n, s) => n + s.groups.reduce((k, gr) => k + gr.matches.length, 0), 0);
  const primaryName = profile?.names?.[primary]?.text ?? null;
  const other = profile && r.name !== null && r.name !== primary;
  return (
    <div className="tv-read">
      <div className="tv-read-main">
        <div className="ns-sum-head">
          <span className="tv-voice primary">Tóm lược sách</span><span className="tv-voice ai">{who} luận thêm</span>
          <span>{who} viết ngày {dateVi(written.createdAt)}, cho năm {written.viewYear} · từ {matched} đoạn sách khớp</span>
          <span className={`ns-ok${written.stale ? ' old' : ''}`}>{written.stale ? 'hồ sơ đã đổi từ khi viết' : 'còn khớp với hồ sơ'}</span>
        </div>
        {other && <p className="ns-note">Bài tổng hợp viết theo tên {primaryName}; bảng số phía trên đang đọc theo tên {r.chart.names[r.name!]?.text}.</p>}
        {written.sections.map((sec, si) => (
          <div key={si} className="ns-sum"><h3 id={`sum-${si}`}>{sec.title}</h3>
            {sec.items.map((it, ii) => {
              const id = `${si}-${ii}`, isOpen = open.has(id);
              const toggle = () => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
              const refs = it.refs.length > 0 && <span className="ns-refs">{it.refs.map((ref, j) => <button key={ref.code} type="button" aria-expanded={isOpen} aria-label="Xem đoạn sách được dẫn" onClick={toggle}>{j + 1}</button>)}</span>;
              const quotes = isOpen && (
                <div className="ns-quotes">{it.refs.map((ref, j) => {
                  const rule: NumerologyRuleDto | undefined = r.rules[ref.code];
                  return <p key={ref.code} className="ns-quote">{j + 1}. {rule?.text ?? ref.quoted}
                    <small>{rule ? <>tr. {rule.page} · {pathOf(rule.entry)} · <button type="button" onClick={() => onGoTo(ref.code)}>xem trong bài đọc ›</button></> : 'đoạn này không có trong bài đọc đang xem'}</small></p>;
                })}</div>);
              return it.layer === 'primary'
                ? <div key={ii} className="ns-item src"><p>{it.text}{refs}</p>{quotes}</div>
                : <div key={ii} className="ns-item add"><span className="tv-voice ai">{who} luận thêm</span><p>{it.text}{refs}</p>{quotes}</div>;
            })}
          </div>))}
        {written.caution && <p className="tv-muted" style={{ fontSize: 12.5, fontStyle: 'italic' }}>{written.caution}</p>}
      </div>
      <div className="tv-read-side">
        <div className="ns-expl"><h4>Trong bài</h4><nav className="ns-toc">{written.sections.map((sec, si) => (
          <button key={si} type="button" onClick={() => document.getElementById(`sum-${si}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{sec.title}</button>))}</nav></div>
        <div className="tv-added-box"><h4>Bài này viết thế nào</h4>
          <p>Phần <b>tóm lược</b> chỉ kể lại những đoạn sách khớp với các con số và tên {primaryName ?? 'của người này'}; mỗi ý dẫn số đoạn, bấm để xem lời sách. Phần <b>luận thêm</b> là ý của {who} nối các đoạn lại, không phải lời sách.</p>
          <p style={{ margin: 0 }}>Khi đổi tên đọc hay khi sách được sửa, bài được đánh dấu cũ để viết lại.</p></div>
      </div>
    </div>
  );
}

function TopicCounts({ r }: { r: NumerologyReadingDto }) {
  const n = (t: Topic) => r.sections.filter(s => s.topic === t).reduce((k, s) => k + s.groups.reduce((a, gr) => a + gr.matches.filter(m => r.rules[m.rule]?.kind !== 'general').length, 0), 0);
  return <div className="ns-expl"><h4>Sách nói về người này</h4>{TOPICS.map(t => <p key={t.code} className="row"><span>{t.title}</span><b>{n(t.code)}</b></p>)}</div>;
}

// ── Tính cách ──

function TraitsTab({ r, part, setPart, toc, hl }: { r: NumerologyReadingDto; part: string | null; setPart: (v: Topic) => void; toc?: NumerologyTocEntryDto[]; hl: string | null }) {
  const c = r.chart, nm = r.name !== null ? c.names[r.name] : null;
  const parts: [Topic, string][] = [['ruling', `Chủ đạo ${L(c.ruling)}`], ['birthday', `Ngày sinh ${L(c.birthday)}`], ['grid', 'Biểu đồ'], ['arrows', 'Mũi tên'], ...(nm ? [['name', `Tên ${nm.text}`] as [Topic, string]] : [])];
  const cur = (parts.some(([k]) => k === part) ? part : 'ruling') as Topic;
  const of = (k: Topic) => { const s = r.sections.find(x => x.topic === k); return s ? splitGroups(s.groups, r.rules) : { said: [], general: [] }; };
  const { said, general } = of(cur);
  const head: Partial<Record<Topic, [string, string]>> = {
    ruling: [`Con số chủ đạo ${L(c.ruling)}`, `tổng các chữ số ngày sinh ${c.sum}`],
    birthday: [`Con số ngày sinh ${L(c.birthday)}`, c.birthday === c.ruling ? 'trùng Con số chủ đạo' : `sinh ngày ${c.input.day}, khác Con số chủ đạo`],
    grid: ['Biểu đồ ngày sinh', [3, 6, 9, 2, 5, 8, 1, 4, 7].filter(n => c.grid.counts[n]).map(n => String(n).repeat(c.grid.counts[n])).join(' · ')],
    arrows: ['Các mũi tên', [...c.grid.arrows.map(a => arrowName(a, 'full')), ...c.grid.empty.map(a => arrowName(a, 'empty'))].join(' · ') || 'không có mũi tên nào'],
    name: nm ? [`Tên ${nm.text}`, `linh hồn ${L(nm.soul)} · biểu đạt ${L(nm.expression)} · tên riêng ${L(nm.nameNumber)}`] : undefined,
  };
  const [h, sub] = head[cur] ?? ['', ''];
  return (
    <>
      <div className="tv-strip">{parts.map(([k, t]) => <button key={k} type="button" className={cur === k ? 'on' : ''} onClick={() => setPart(k)}>{t}<small>{of(k).said.reduce((n, gr) => n + gr.matches.length, 0)}</small></button>)}</div>
      <div className="tv-read">
        <div className="tv-read-main">
          <div className="tv-phead"><h3>{h}</h3><span>{sub}</span></div>
          <Groups groups={said} rules={r.rules} toc={toc} hl={hl} />
        </div>
        <div className="tv-read-side"><Explain general={general} rules={r.rules} topic={cur} /></div>
      </div>
    </>
  );
}

// ── Thời vận ──

function TimeTab({ r, peak, setPeak, onYear, toc, hl }: {
  r: NumerologyReadingDto; peak: number | null; setPeak: (i: number) => void; onYear: (y: number | null) => void; toc?: NumerologyTocEntryDto[]; hl: string | null;
}) {
  const c = r.chart, now = c.now, P = c.pyramid.peaks;
  const selYear = r.viewYear ?? now.year.year;
  const sel = c.years.find(y => y.year === selYear);
  const pk = peak && peak >= 1 && peak <= 4 ? peak : (now.nextPeak ?? now.lastPeak ?? P[0]).index;
  const empty = { said: [], general: [] };
  const part = (t: Topic) => { const s = r.sections.find(x => x.topic === t); return s ? splitGroups(s.groups, r.rules) : empty; };
  const peakSecs = r.sections.filter(s => s.topic === 'peaks');
  const ys = part('year'), gs = part('stages');
  const pkSec = peakSecs.find(x => peakOf(x) === pk);
  const ps = pkSec ? splitGroups(pkSec.groups, r.rules) : empty;
  const peakGeneral = peakSecs.flatMap(s => splitGroups(s.groups, r.rules).general);
  const peakYears = new Map(P.map(p => [p.year, p.index]));
  const tr = now.transition, next = c.years.find(y => y.year === now.year.year + 1);
  return (
    <>
      <LifeLine c={c} />
      <div className="tv-k" style={{ margin: '0 0 8px' }}>Chu kỳ chín năm · bấm một năm để đọc</div>
      <div className="ns-years">{c.years.map(y => (
        <button key={y.year} type="button" className={`${y.year === now.year.year ? 'now ' : ''}${y.year === selYear ? 'sel' : ''}`} aria-pressed={y.year === selYear}
          onClick={() => onYear(y.year === now.year.year ? null : y.year)}>
          <span>{y.year}</span><b>{y.n}</b><small>{dmShort(y.start)}–{dmShort(y.end)}</small>
          {peakYears.has(y.year) ? <i>đỉnh {peakYears.get(y.year)}</i> : y.year === now.year.year ? <i>đang sống</i> : null}
        </button>))}</div>
      <div className="ns-two">
        <div>
          <div className="tv-phead"><h3>Năm cá nhân {r.pyear} · {selYear}</h3>{sel && <span>{dmy(sel.start)} – {dmy(sel.end)} · {sel.months} tháng</span>}</div>
          {selYear === now.year.year && <p className="ns-note">{tr
            ? `Đang ở khúc giao thời từ năm ${tr.from} sang năm ${tr.to}, đến khoảng ${dmy(tr.until)}.`
            : `Năm đang sống.${next ? ` Năm ${next.n} bắt đầu ${dmy(next.start)}; khúc giao thời kéo dài hai đến năm tháng từ ngày ấy.` : ''}`}</p>}
          <Groups groups={ys.said} rules={r.rules} toc={toc} hl={hl} />
          {ys.general.length > 0 && <Explain general={ys.general} rules={r.rules} topic="year" />}
        </div>
        <div>
          <div className="tv-phead"><h3>Bốn đỉnh cao</h3><span>{now.nextPeak ? `đang hướng tới đỉnh ${now.nextPeak.index}` : 'đã qua cả bốn đỉnh'}</span></div>
          <div className="ns-peaks">{P.map(p => (
            <button key={p.index} type="button" className={`${p.index === pk ? 'sel ' : ''}${now.nextPeak?.index === p.index ? 'next' : ''}`} aria-pressed={p.index === pk} onClick={() => setPeak(p.index)}>
              <small>Đỉnh {p.index}{now.nextPeak?.index === p.index ? ' · tới' : p.age <= now.age ? ' · đã qua' : ''}</small><b>{L(p.n)}</b><span>{p.age} tuổi · {p.year}</span>
            </button>))}</div>
          <Groups groups={ps.said} rules={r.rules} toc={toc} hl={hl} />
          <div className="tv-phead" style={{ marginTop: 24 }}><h3>Giai đoạn {STAGE[now.stage]}</h3><span>{now.age} tuổi</span></div>
          <Groups groups={gs.said} rules={r.rules} toc={toc} hl={hl} />
          {peakGeneral.length > 0 && <Explain general={peakGeneral} rules={r.rules} topic="peaks" />}
        </div>
      </div>
    </>
  );
}
