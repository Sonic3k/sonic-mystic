/* One person's lá số: the chart at a glance, the board, and beside it the panel it is read with — a palace with
   grandma's sentences star by star, the written reading (Luận giải), or the year with its hạn. The API sets up and
   reads the chart; this page only shows it. Opened from a link (/tu-vi/chart?…) or a saved profile (/tu-vi/profile/:id).
   Where one is: ?view=overview (Luận giải) | han (the year), ?cung=<palace>, ?year=, ?variant=grandma|books. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BRANCHES, STEMS, VIEWS, khongWeight, type Principle, type View } from '@mystic/engine/tuvi';
import type { AiReadingDto, GroupDto, ProfileDto, TuViReadingDto, TuViSettings } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed, errorText } from '../../components/Owner';
import { ProfilePick } from '../../components/ProfilePick';
import { useRememberChart } from '../../components/Shell';
import { Byline, Section, jump, parseTitle, useSpy, type RoomReading } from '../../components/Reading';
import { Sheet } from '../../components/Sheet';
import { birthDtoOf, fromProfile, fromSearch, HOURS, settingsOf, thisYear, toSearch, tuviSettings, type ChartParams } from '../../lib/params';
import { SONIC_HUB } from '../../lib/people';
import { useTitle } from '../../lib/text';
import Board, { Lv, MONTH, type TvTab } from './Grid';
import {
  AiWriter, Groups, HlContext, HOA_IDS, HOA_SHORT, ROLE_SEAL, RulesContext, Seal, Supplement, TuviVoices,
  readingOf, sectionPalaces, starTones, tuviRoom, tvSealOf, useAiReadings, useHighlighter, type ToneFilter,
} from './Reading';
import { SettingsFields } from './Settings';

const pad = (n: number) => String(n).padStart(2, '0');
const count = (gs: GroupDto[]) => gs.reduce((n, g) => n + g.matches.length, 0);
/** the palaces the overview is written from (the API's AI reading uses the same) */
const KEY_VIEWS: View[] = ['Mệnh', 'Thân', 'Phúc Đức', 'Quan Lộc', 'Tài Bạch', 'Phu Thê'];

export default function ChartPage() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const profile = useQuery({ queryKey: ['profile', id], queryFn: () => api.profile(id!), enabled: !!id, retry: false });
  const p = profile.data ?? null;
  const params = useMemo<ChartParams | null>(() => {
    if (!id) return fromSearch(sp);
    if (!p) return null;
    try { return fromProfile(p); } catch { return null; }
  }, [id, p, sp]);

  const v = sp.get('variant');
  const variant = v === 'books' || v === 'grandma' ? v : undefined;
  const year = Number(sp.get('year')) || (id ? p?.viewYear ?? thisYear() : params?.options.viewYear ?? thisYear());
  const settings: TuViSettings | null = !params ? null : p ? { ...tuviSettings(p), ...(variant ? { variant } : {}) } : settingsOf(params.options);
  /* a saved profile is read by the API from what it stored; a link, or a profile shown with another variant, is sent as it is */
  const custom = !p || (variant !== undefined && variant !== tuviSettings(p).variant);
  const chartKey = !params || !settings ? '' : custom ? toSearch({ ...params, name: '', options: { ...params.options, ...settings, viewYear: thisYear() } }) : `profile:${id}`;
  const reading = useQuery({
    queryKey: ['reading', chartKey, year],
    queryFn: () => (custom ? api.reading({ birth: params!.input, settings: settings!, viewYear: year }) : api.profileReading(id!, year)),
    enabled: !!chartKey,
    retry: false,
    /* the same chart in another year keeps showing while the new year loads */
    placeholderData: (prev, q) => (q?.queryKey[1] === chartKey ? prev : undefined),
  });
  useTitle(params?.name || 'Lá số');

  const back = <Link className="tv-link" to="/tu-vi">Lập lá số</Link>;
  const box = (body: React.ReactNode) => <div className="wrap page tv"><div className="card empty tv-wait">{body}</div></div>;
  if (id && profile.isLoading) return box('Đang mở lá số…');
  if (id && profile.isError) return <div className="wrap page tv"><Failed error={profile.error}>{back}</Failed></div>;
  if (!params) return box(<>Thiếu ngày giờ sinh. {back}</>);
  if (reading.isError) return box(<>{errorText(reading.error)} <Link className="tv-link" to={`/tu-vi?${toSearch(params)}`}>Sửa ngày sinh</Link></>);
  if (!reading.data) return box('Đang lập lá số…');
  return (
    <RulesContext.Provider value={reading.data.rules}>
      <ChartView r={reading.data} params={params} profile={p} year={year} loading={reading.isFetching && reading.data.viewYear !== year} sp={sp} setSp={setSp} />
    </RulesContext.Provider>
  );
}

function ChartView({ r, params, profile, year, loading, sp, setSp }: {
  r: TuViReadingDto; params: ChartParams; profile: ProfileDto | null; year: number; loading: boolean;
  sp: URLSearchParams; setSp: ReturnType<typeof useSearchParams>[1];
}) {
  const chart = r.chart, H = r.han;
  useRememberChart('tuvi', params.name || 'tử vi');
  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === '') n.delete(k); else n.set(k, v); }
    setSp(n, { replace: true });
  };
  const tab: TvTab = sp.get('view') === 'overview' ? 'luan' : sp.get('view') === 'han' ? 'han' : 'cung';
  const view = (VIEWS.includes(sp.get('cung') as View) ? sp.get('cung') : 'Mệnh') as View;
  const sel = view === 'Thân' ? chart.than : r.views[view].branch;
  const [sheet, setSheet] = useState<'save' | 'edit' | null>(null);
  const [spot, setSpot] = useState(-1);
  const [readAt, setReadAt] = useState<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const hl = useHighlighter(chart);
  const tones = useMemo(() => starTones(chart), [chart]);
  const room = useMemo(() => tuviRoom(r, hl, tones), [r, hl, tones]);
  const profileId = profile?.id ?? null;
  const ai = useAiReadings(profileId);
  const overview = readingOf(ai.list, 'overview', year);
  const savedVariant = profile ? tuviSettings(profile).variant : undefined;
  const spotPalaces = tab === 'luan' && overview && spot >= 0 && overview.sections[spot] ? sectionPalaces(overview.sections[spot], r) : [];

  const toPanel = () => requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const pick = (b: number) => {
    const role = chart.palaces[b].role;
    set({ view: null, cung: role === 'Mệnh' ? null : role });
    if (window.innerWidth < 1180) toPanel();
  };
  const goTab = (t: TvTab, scroll = false) => { set({ view: t === 'luan' ? 'overview' : t === 'han' ? 'han' : null }); if (scroll) toPanel(); };
  const read = (i: number) => { setReadAt(i); goTab('luan'); };
  const setVariant = (v: 'grandma' | 'books') => set({ variant: profile ? (v === savedVariant ? null : v) : v === 'grandma' ? null : 'books' });
  const homeYear = profile?.viewYear ?? thisYear();
  const setYear = (y: number) => set({ year: y === homeYear ? null : String(y) });

  const i = params.input, b = profile?.birth;
  const g = i.gender === 'male' ? 'Nam' : 'Nữ';
  const lunarLine = `ngày ${chart.lunar.day} tháng ${MONTH[chart.lunar.month]}${chart.lunar.leap ? ' nhuận' : ''} năm ${STEMS[chart.stem]} ${BRANCHES[chart.branch]}, giờ ${HOURS[chart.hour].n} (${HOURS[chart.hour].span})`;
  const birth = i.calendar === 'solar'
    ? `${g}, sinh ngày ${i.day}/${i.month}/${i.year} lúc ${pad(i.hour)}:${pad(i.minute ?? 0)}${b?.timeApprox ? ' (giờ ước chừng)' : ''}${b?.place ? ` tại ${b.place}` : ''}. Âm lịch ${lunarLine}.`
    : `${g}, sinh ${lunarLine} âm lịch${b?.timeApprox ? ' (giờ ước chừng)' : ''}${b?.place ? `, tại ${b.place}` : ''}. Dương lịch ${chart.solar[0]}/${chart.solar[1]}/${chart.solar[2]}.`;
  const tabs: [TvTab, string][] = [['cung', `Cung ${chart.palaces[sel].role}`], ['luan', 'Luận giải'], ['han', `Năm ${H.year}`]];

  return (
    <HlContext.Provider value={hl}>
      <div className="wrap page tv">
        <header className="phead">
          <h1>{params.name || 'Lá số tử vi'}<ProfilePick profile={profile} fallback="Lá số" /></h1>
          <p className="birth">{birth}{profile && <> <Link to={`/people/${profile.subject.id}`}>Trang của {profile.subject.displayName}</Link></>}
            {profile?.note && <> · {profile.note}</>}</p>
          <div className="acts">
            <div className="switch" title="Cách an mấy sao mà bà an khác sách phổ thông">
              <button type="button" className={chart.options.variant === 'grandma' ? 'on' : ''} onClick={() => setVariant('grandma')}>An theo bà</button>
              <button type="button" className={chart.options.variant === 'books' ? 'on' : ''} onClick={() => setVariant('books')}>Theo sách</button>
            </div>
            {profile
              ? <>
                  <button type="button" className="btn" onClick={() => setSheet('edit')}>Sửa</button>
                  <Link className="btn" to={`/tu-vi?${toSearch(params)}&person=${profile.subject.id}`} title="Lập một lá số khác (giờ, ngày khác) cho người này">Lập lại</Link>
                </>
              : <>
                  <Link className="btn" to={`/tu-vi?${toSearch(params)}${sp.get('person') ? `&person=${sp.get('person')}` : ''}`}>Sửa</Link>
                  <button type="button" className="btn solid" onClick={() => setSheet('save')}>Lưu lá số</button>
                </>}
          </div>
        </header>
        {chart.calendarWarning && <div className="tv-calwarn">{chart.calendarWarning}</div>}

        <Glance r={r} onPalace={b => { pick(b); toPanel(); }} onYear={() => goTab('han', true)} />

        <div className="tv-body">
          <Board r={r} name={params.name} sel={sel} tab={tab} spot={spotPalaces} onSelect={pick} />
          <section className="tv-panel" ref={panel} id="doc">
            <nav className="tabs" role="tablist" aria-label="Đọc lá số">{tabs.map(([k, n]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => goTab(k)}>{n}</button>))}</nav>
            <div className="pane">
              {tab === 'cung' && <PalacePane r={r} sel={sel} tones={tones} year={year} profileId={profileId} list={ai.list} overview={overview} onRead={read} />}
              {tab === 'luan' && <LuanPane r={r} room={room} overview={overview} year={year} profileId={profileId} onSpot={setSpot} readAt={readAt} onRead={() => setReadAt(null)} />}
              {tab === 'han' && <HanPane r={r} room={room} tones={tones} year={year} homeYear={homeYear} loading={loading} setYear={setYear} onPalace={pick}
                profileId={profileId} list={ai.list} overview={overview} />}
            </div>
          </section>
        </div>

        {sheet === 'save' && <SaveSheet params={params} year={year} subjectId={sp.get('person')} onClose={() => setSheet(null)} />}
        {sheet === 'edit' && profile && <EditSheet profile={profile} onClose={() => setSheet(null)} />}
      </div>
    </HlContext.Provider>
  );
}

// ── the chart at a glance ──

function Glance({ r, onPalace, onYear }: { r: TuViReadingDto; onPalace: (b: number) => void; onYear: () => void }) {
  const chart = r.chart, H = r.han;
  const than = chart.palaces[chart.than];
  const main = (b: number) => chart.palaces[b].stars.filter(s => s.kind === 'chinh');
  const minorOf = (b: number, tone: string) => chart.palaces[b].stars.filter(s => s.kind === 'phu' && !s.ring && !HOA_IDS.has(s.id) && s.tone === tone).map(s => s.name);
  const stars = (b: number) => { const m = main(b); return m.length ? m.map((s, k) => <span key={s.id}>{k ? ' ' : ''}{s.name} <Lv l={s.level} /></span>) : 'vô chính diệu'; };
  const pr = (id: string) => r.principles.find(p => p.id.startsWith(id));
  const chips = (ids: string[]) => {
    const list = ids.map(pr).filter((p): p is Principle => !!p);
    return list.length > 0 && <span className="bs">{list.map(p => (
      <button key={p.id} type="button" title={p.text} onClick={() => { onPalace(chart.menh); setTimeout(() => document.getElementById(`pr-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); }}>補 {p.title}</button>))}</span>;
  };
  const mc = minorOf(chart.menh, 'cat').slice(0, 2), mh = minorOf(chart.menh, 'hung').slice(0, 2), th = minorOf(chart.than, 'hung').slice(0, 1);
  const dai = H.dai ? chart.palaces[H.dai.branch] : null, tieu = chart.palaces[H.tieu.branch];
  return (
    <div className="tv-glance">
      <button type="button" className="gl" onClick={() => onPalace(chart.menh)}><Seal c="命" /><span className="k">Mệnh ở {BRANCHES[chart.menh]}</span><span className="v">{stars(chart.menh)}</span>
        <span className="s">{mc.length > 0 && <span className="c">{mc.join(', ')}</span>}{mc.length > 0 && mh.length > 0 && ' · '}{mh.length > 0 && <span className="h">{mh.join(', ')}</span>}</span></button>
      <button type="button" className="gl" onClick={() => onPalace(chart.than)}><Seal c="身" /><span className="k">Thân cư {than.role}</span><span className="v">{stars(chart.than)}</span>
        <span className="s">{th.length > 0 && <span className="h">{th.join(', ')}</span>}{chart.triet.includes(chart.than) ? `${th.length ? ', ' : ''}gặp Triệt` : chart.tuan.includes(chart.than) ? `${th.length ? ', ' : ''}gặp Tuần` : ''}</span></button>
      <div className="gl"><Seal c="局" k="o" /><span className="k">Cục</span><span className="v">{chart.cuc.name}</span><span className="s">đại hạn khởi từ {chart.cuc.n} tuổi</span></div>
      <div className="gl"><Seal c="音" k="o" /><span className="k">Bản mệnh</span><span className="v">{chart.napAm.name}</span><span className="s">hành {chart.napAm.element}, Cục hành {chart.cuc.element}</span>{chips(['menh_cuc', 'cung_menh'])}</div>
      <div className="gl"><Seal c="主" k="o two" /><span className="k">Mệnh chủ · Thân chủ</span><span className="v">{chart.menhChu} · {chart.thanChu}</span><span className="s">{chart.amDuong}</span>{chips(['am_duong'])}</div>
      <button type="button" className="gl" onClick={onYear}><Seal c="運" k="kim" /><span className="k">Năm {H.year} · {H.canChi}</span><span className="v">{H.age} tuổi</span>
        <span className="s">{dai ? <>Đại hạn {dai.role} <span className="nw">({H.dai!.from}–{H.dai!.to})</span>, </> : 'Chưa vào đại hạn, '}{H.tieu.dong ? 'đồng hạn' : 'tiểu hạn'} {tieu.role}</span></button>
    </div>
  );
}

// ── a palace ──

function PalacePane({ r, sel, tones, year, profileId, list, overview, onRead }: {
  r: TuViReadingDto; sel: number; tones: Record<string, string>; year: number; profileId: string | null; list: AiReadingDto[];
  overview: AiReadingDto | undefined; onRead: (i: number) => void;
}) {
  const chart = r.chart, p = chart.palaces[sel], v = r.views[p.role], cnt = v.counts;
  const [filter, setFilter] = useState<ToneFilter>('all');
  useEffect(() => { setFilter('all'); }, [sel]);
  const main = p.stars.filter(s => s.kind === 'chinh');
  const minor = p.stars.filter(s => s.kind === 'phu' && !s.ring && !HOA_IDS.has(s.id));
  const rings = p.stars.filter(s => s.ring), hoa = p.stars.filter(s => s.hoa);
  const chip = (s: (typeof p.stars)[number], k: string) => <span key={s.id} className={`cs ${k}`}>{s.name}<Lv l={s.level} /></span>;
  const w = khongWeight(chart, p.branch);
  const neutral = Math.max(0, cnt.grandma - cnt.cat - cnt.hung), total = cnt.grandma || 1;
  const sects = overview ? overview.sections.map((s, i) => ({ s, i })).filter(({ s }) => sectionPalaces(s, r).includes(p.branch)) : [];
  const cat = minor.filter(s => s.tone === 'cat'), hung = minor.filter(s => s.tone === 'hung'), trung = minor.filter(s => s.tone !== 'cat' && s.tone !== 'hung');
  const than = p.isThan ? r.views['Thân'] : null;
  const mine = readingOf(list, p.role, year), mineThan = than ? readingOf(list, 'Thân', year) : undefined;
  return (
    <>
      <div className="pp-h"><Seal c={ROLE_SEAL[p.role]} k="lg" /><div><h2>Cung {p.role}</h2>
        <p>{STEMS[p.stem]} {BRANCHES[p.branch]} · đại hạn {p.daiHan[0]}–{p.daiHan[1]} tuổi{p.isThan ? ' · Thân cư tại đây' : ''}{w.tuan ? ` · gặp Tuần (${w.tuan}/10 phần)` : ''}{w.triet ? ` · gặp Triệt (${w.triet}/10 phần)` : ''}</p></div></div>
      {v.about && <Supplement className="pp-about" title="Cung này nói về" about={v.about} />}
      <dl className="roster">
        <dt>Chính tinh</dt><dd>{main.length ? main.map(s => chip(s, 'm')) : <span className="vcd">vô chính diệu</span>}</dd>
        {cat.length > 0 && <><dt>Cát tinh</dt><dd>{cat.map(s => chip(s, 'c'))}</dd></>}
        {hung.length > 0 && <><dt>Hung tinh</dt><dd>{hung.map(s => chip(s, 'h'))}</dd></>}
        {trung.length > 0 && <><dt>Trung tinh</dt><dd>{trung.map(s => chip(s, 't'))}</dd></>}
        {hoa.length > 0 && <><dt>Tứ hóa</dt><dd>{hoa.map(s => <span key={s.id} className={`cs ${s.hoa === 'Hóa Kỵ' ? 'h' : 'c'}`}>{s.name} hóa {HOA_SHORT[s.hoa!]}</span>)}</dd></>}
        {rings.length > 0 && <><dt>Các vòng</dt><dd>{rings.map(s => chip(s, s.tone === 'cat' ? 'c' : s.tone === 'hung' ? 'h' : 't'))}</dd></>}
      </dl>
      <div className="tally">
        <div className="tally-t"><b>{cnt.grandma} câu của bà khớp với cung này</b><span className="c">{cnt.cat} câu tốt</span><span className="h">{cnt.hung} câu xấu</span><span>{neutral} câu trung tính</span></div>
        <div className="tally-bar"><i style={{ width: `${(cnt.cat / total) * 100}%` }} /><u style={{ width: `${(neutral / total) * 100}%` }} /><b style={{ width: `${(cnt.hung / total) * 100}%` }} /></div>
      </div>
      {sects.length > 0 && <div className="pp-links">{sects.map(({ s, i }) => <button key={i} type="button" className="pp-link" onClick={() => onRead(i)}>Đọc luận giải: {parseTitle(s.title).subj}</button>)}</div>}
      {v.grandma.length > 0 && (
        <div className="gm">
          <div className="gm-head"><Seal c="外婆" k="two" style={{ width: 30, height: 36, fontSize: 12.5 }} /><h3>Lời bà về cung {p.role}</h3><span>xếp theo sao</span>
            <div className="switch sm" role="group" aria-label="Lọc câu">
              <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tất cả</button>
              <button type="button" className={filter === 'cat' ? 'on' : ''} onClick={() => setFilter('cat')}>Tốt {cnt.cat}</button>
              <button type="button" className={filter === 'hung' ? 'on' : ''} onClick={() => setFilter('hung')}>Xấu {cnt.hung}</button>
            </div></div>
          <Groups groups={v.grandma} where={`cung ${p.role}`} tones={tones} filter={filter} />
        </div>
      )}
      {!v.grandma.length && <p className="gm-empty">Không có câu nào trong ghi chép của bà khớp với cung này.</p>}
      <Supplement groups={v.supplement} principles={p.role === 'Mệnh' ? r.principles : undefined} />
      {than && <>
        <div className="gm"><div className="gm-head"><Seal c="身" style={{ width: 30, height: 30, fontSize: 16 }} /><h3>Thân cư {p.role}</h3><span>{than.counts.grandma} câu của bà</span></div>
          <Groups groups={than.grandma} where="cung Thân" tones={tones} filter={filter} empty="Không có câu nào của bà về Thân cư ở đây." /></div>
        <Supplement about={than.about} groups={than.supplement} />
      </>}
      {mine && <PaneReading ai={mine} r={r} idp="c" title={`Bài luận cung ${p.role}`} />}
      <AiWriter profileId={profileId} scope={p.role} year={year} grandmaLines={cnt.grandma} mine={mine} what={`cung ${p.role}`} />
      {than && <>
        {mineThan && <PaneReading ai={mineThan} r={r} idp="t" title="Bài luận Thân" />}
        {(mineThan || profileId) && <AiWriter profileId={profileId} scope="Thân" year={year} grandmaLines={than.counts.grandma} mine={mineThan} what="Thân" />}
      </>}
    </>
  );
}

/** a written reading inside a pane (a palace's, a year's) */
function PaneReading({ ai, r, idp, title }: { ai: AiReadingDto; r: TuViReadingDto; idp: string; title: string }) {
  const hl = useHighlighter(r.chart);
  const room = useMemo(() => tuviRoom(r, hl, starTones(r.chart)), [r, hl]);
  return (
    <div className="pane-rd">
      <div className="gm-head"><Seal c="論" k="chu" s={30} /><h3>{title}</h3></div>
      <Byline ai={ai} />
      <article className="rd">{ai.sections.map((s, i) => <Section key={i} s={s} i={i} room={room} idp={idp} />)}{ai.caution && <p className="caution">{ai.caution}</p>}</article>
    </div>
  );
}

// ── the written reading ──

function LuanPane({ r, room, overview, year, profileId, onSpot, readAt, onRead }: {
  r: TuViReadingDto; room: RoomReading; overview: AiReadingDto | undefined; year: number; profileId: string | null;
  onSpot: (i: number) => void; readAt: number | null; onRead: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const spot = useSpy(box, [overview?.id], onSpot);
  useEffect(() => {
    if (readAt === null) return;
    const t = setTimeout(() => { jump(`s${readAt}`); onRead(); }, 40);
    return () => clearTimeout(t);
  }, [readAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = KEY_VIEWS.reduce((n, v) => n + r.views[v].counts.grandma, 0);
  const general = ['menh_chu', 'than_chu', 'tam_phuong', 'mieu_ham'].map(k => r.general[k]).filter((p): p is Principle => !!p);
  if (!overview) {
    return (
      <>
        <div className="pp-h"><Seal c="論" k="lg" /><div><h2>Luận giải</h2><p>Bài luận cả lá số, viết từ những câu của bà khớp với sáu cung chính: Mệnh, Thân, Phúc Đức, Quan Lộc, Tài Bạch, Phu Thê.</p></div></div>
        <AiWriter profileId={profileId} scope="overview" year={year} grandmaLines={lines} mine={undefined} what="cả lá số" />
        <Supplement title="Cách đọc lá số" principles={general} />
      </>
    );
  }
  return (
    <div ref={box}>
      <Byline ai={overview} />
      <TuviVoices />
      <div className="tv-mini-toc">{overview.sections.map((s, i) => {
        const { c, k } = tvSealOf(s, r);
        return <a key={i} href={`#s${i}`} className={i === spot ? 'on' : ''} onClick={e => { e.preventDefault(); jump(`s${i}`); }}><Seal c={c} k={k} />{parseTitle(s.title).subj}</a>;
      })}</div>
      <article className="rd">{overview.sections.map((s, i) => <Section key={i} s={s} i={i} room={room} />)}{overview.caution && <p className="caution">{overview.caution}</p>}</article>
      <Supplement title="Cách đọc lá số" principles={general} />
      <AiWriter profileId={profileId} scope="overview" year={year} grandmaLines={lines} mine={overview} what="cả lá số" />
    </div>
  );
}

// ── the year ──

function HanPane({ r, room, tones, year, homeYear, loading, setYear, onPalace, profileId, list, overview }: {
  r: TuViReadingDto; room: RoomReading; tones: Record<string, string>; year: number; homeYear: number; loading: boolean; setYear: (y: number) => void;
  onPalace: (b: number) => void; profileId: string | null; list: AiReadingDto[]; overview: AiReadingDto | undefined;
}) {
  const chart = r.chart, H = r.han;
  const order = [...chart.palaces].sort((a, b) => a.daiHan[0] - b.daiHan[0]);
  const tieu = chart.palaces[H.tieu.branch], dai = H.dai ? chart.palaces[H.dai.branch] : null;
  const mine = readingOf(list, `han-${H.year}`, H.year);
  const yearSec = overview?.sections.map((s, i) => ({ s, i })).find(({ s }) => s.title.includes(`năm ${H.year}`));
  const gen = [r.general.dai_han, r.general.tieu_han].filter((p): p is Principle => !!p);
  return (
    <div className={loading ? 'loading' : undefined}>
      <div className="pp-h"><Seal c="運" k="kim lg" /><div><h2>Năm {H.canChi} {H.year}</h2>
        <p>{H.age} tuổi{dai ? ` · đại hạn ở cung ${dai.role} (${BRANCHES[dai.branch]}), ${H.dai!.from}–${H.dai!.to} tuổi` : ' · chưa vào đại hạn đầu'} · {H.tieu.dong ? 'đồng hạn' : 'tiểu hạn'} ở cung {tieu.role} ({BRANCHES[tieu.branch]})</p></div></div>
      <div className="yr-nav">
        <button type="button" className="btn" onClick={() => setYear(year - 1)} aria-label="Năm trước">‹</button>
        <b>{year}</b>
        <button type="button" className="btn" onClick={() => setYear(year + 1)} aria-label="Năm sau">›</button>
        <span>{loading ? <><span className="tv-spin" />đang đọc năm {year}</> : 'tuổi mụ'}</span>
        {year !== homeYear && <button type="button" className="tv-link" onClick={() => setYear(homeYear)}>Về năm {homeYear}</button>}
      </div>
      <div className="dh-strip" role="group" aria-label="Các đại hạn">{order.map(c => (
        <button key={c.branch} type="button" className={H.dai?.branch === c.branch ? 'now' : ''} onClick={() => setYear(chart.lunar.year + c.daiHan[0] - 1)} title={`Đại hạn ${c.daiHan[0]}–${c.daiHan[1]} tuổi tại cung ${c.role}`}>
          <b>{c.daiHan[0]}–{c.daiHan[1]}</b><span>{c.role}</span></button>))}</div>
      {H.dai && dai && (
        <div className="gm"><div className="gm-head"><Seal c="大" k="kim" s={30} /><h3>Đại hạn {H.dai.from}–{H.dai.to}: cung {dai.role}</h3><button type="button" className="pp-link" onClick={() => onPalace(dai.branch)}>luận cung này ›</button></div>
          <Groups groups={H.dai.grandma} where="đại hạn" tones={tones} empty="Không có câu nào của bà về đại hạn này." />
          <Supplement groups={H.dai.supplement} /></div>
      )}
      <div className="gm"><div className="gm-head"><Seal c="小" k="kim" s={30} /><h3>{H.tieu.dong ? 'Đồng hạn' : 'Tiểu hạn'} {H.year}: cung {tieu.role}</h3><button type="button" className="pp-link" onClick={() => onPalace(tieu.branch)}>luận cung này ›</button></div>
        <Groups groups={H.tieu.grandma} where="tiểu hạn" tones={tones} empty="Không có câu nào của bà về tiểu hạn năm này." />
        <Supplement groups={H.tieu.supplement} /></div>
      <div className="months"><h4>Hạn từng tháng <span>theo cách bà ghi: nguyệt nghịch, thời thuận</span></h4>
        <div className="months-g">{H.months.map((b, m) => <div key={m}><b>Tháng {m + 1}</b>{chart.palaces[b].role}</div>)}</div></div>
      <Supplement title="Cách đọc hạn" principles={gen} />
      {mine ? <PaneReading ai={mine} r={r} idp="y" title={`Bài luận năm ${H.year}`} />
        : yearSec && <div className="pane-rd"><article className="rd"><Section s={yearSec.s} i={yearSec.i} room={room} idp="y" /></article></div>}
      {!loading && <AiWriter profileId={profileId} scope={`han-${H.year}`} year={H.year} grandmaLines={(H.dai ? count(H.dai.grandma) : 0) + count(H.tieu.grandma)} mine={mine} what={`năm ${H.year}`} />}
    </div>
  );
}

// ── saving a chart as a profile, editing and deleting one ──

/** who the chart is about: someone already here, a person from Sonic Hub (linked on save), or someone new */
function SaveSheet({ params, year, subjectId, onClose }: { params: ChartParams; year: number; subjectId: string | null; onClose: () => void }) {
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const persons = useQuery({ queryKey: ['hub-persons'], queryFn: api.sonicHubPersons, retry: false, staleTime: 300_000 });
  const [who, setWho] = useState(subjectId ? `s:${subjectId}` : 'new');
  const [name, setName] = useState(params.name);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const nav = useNavigate(), qc = useQueryClient();
  const linked = new Set((subjects.data ?? []).flatMap(s => s.links.filter(l => l.system === SONIC_HUB).map(l => l.externalId)));
  const hub = (persons.data ?? []).filter(x => !linked.has(x.id));
  const picked = who.startsWith('s:') ? subjects.data?.find(s => s.id === who.slice(2)) : undefined;
  const save = useMutation({
    mutationFn: async () => {
      const gender = params.input.gender, birth = birthDtoOf(params.input);
      let sid: string;
      if (who.startsWith('s:')) sid = who.slice(2);
      else if (who.startsWith('h:')) sid = (await api.linkSonicHub(who.slice(2))).id;
      else sid = (await api.createSubject({ displayName: name.trim(), gender, birth })).id;
      return api.createProfile({ subjectId: sid, label: label.trim() || null, viewYear: year, note: note.trim() || null, gender, birth, settings: settingsOf(params.options) });
    },
    onSuccess: p => { void qc.invalidateQueries({ queryKey: ['subjects'] }); onClose(); nav(`/tu-vi/profile/${p.id}`, { replace: true }); },
  });
  const invalid = who === 'new' && !name.trim();
  return (
    <Sheet title="Lưu lá số" sub="Lá số được giữ cùng người này; lưu nhiều lá số cho một người cũng được (giờ sinh khác, năm xem khác)." onClose={onClose}>
      {subjects.isError ? <Failed error={subjects.error} /> : (
        <div className="tv-form" style={{ marginTop: 12 }}>
          <label className="tv-f"><span>Của ai</span>
            <select value={who} onChange={e => setWho(e.target.value)}>
              <option value="new">+ Người mới</option>
              {!!subjects.data?.length && <optgroup label="Người đã có">{subjects.data.map(s => <option key={s.id} value={`s:${s.id}`}>{s.displayName}{s.profiles.length ? ` · ${s.profiles.length} lá số` : ''}</option>)}</optgroup>}
              {!!hub.length && <optgroup label="Từ Sonic Hub (liên kết khi lưu)">{hub.map(x => <option key={x.id} value={`h:${x.id}`}>{x.displayName || x.name}{x.isSelf ? ' (chủ nhà)' : ''}</option>)}</optgroup>}
            </select></label>
          {who === 'new' && <label className="tv-f"><span>Tên</span><input value={name} onChange={e => setName(e.target.value)} data-autofocus /></label>}
          <label className="tv-f half"><span>Tên lá số (không bắt buộc)</span><input value={label} onChange={e => setLabel(e.target.value)} placeholder={picked?.profiles.length ? 'ví dụ: giờ Thìn' : 'Lá số gốc'} /></label>
          <label className="tv-f half"><span>Ghi chú</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="ví dụ: giờ sinh theo lời mẹ kể" /></label>
          {who.startsWith('h:') && <p className="tv-muted" style={{ fontSize: 12.5, margin: 0 }}>Tên và ngày sinh của người này lấy từ Sonic Hub; lá số giữ đúng ngày giờ đang xem.</p>}
        </div>
      )}
      {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
      <div className="sheet-foot"><span />
        <button type="button" className="tv-btn ghost" onClick={onClose}>Huỷ</button>
        <button type="button" className="tv-btn accent" disabled={save.isPending || invalid || subjects.isError} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </Sheet>
  );
}

function EditSheet({ profile, onClose }: { profile: ProfileDto; onClose: () => void }) {
  const [label, setLabel] = useState(profile.label ?? '');
  const [note, setNote] = useState(profile.note ?? '');
  const [viewYear, setViewYear] = useState(profile.viewYear ?? thisYear());
  const [settings, setSettings] = useState<TuViSettings>(tuviSettings(profile));
  const [ask, setAsk] = useState(false);
  const nav = useNavigate(), qc = useQueryClient();
  const refresh = () => ['profile', 'reading', 'subjects', 'subject', 'ai-readings', 'brief'].forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
  const save = useMutation({
    mutationFn: () => api.updateProfile(profile.id, { label: label.trim() || null, note: note.trim() || null, viewYear, settings }),
    onSuccess: () => { refresh(); onClose(); },
  });
  const del = useMutation({
    mutationFn: () => api.deleteProfile(profile.id),
    onSuccess: () => {
      onClose();
      nav(`/people/${profile.subject.id}`, { replace: true });
      /* once this page has gone, the deleted profile's queries are dropped (asking for them again would only 404) */
      setTimeout(() => { for (const k of [['profile', profile.id], ['reading', `profile:${profile.id}`], ['ai-readings', profile.id]]) qc.removeQueries({ queryKey: k }); }, 100);
      ['subjects', 'subject', 'brief'].forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
    },
  });
  return (
    <Sheet title="Sửa lá số" sub={`Ngày giờ sinh của lá số giữ nguyên như lúc lưu — muốn đọc giờ khác thì «Lập lại».`} onClose={onClose}>
      <div className="tv-form" style={{ marginTop: 12 }}>
        <label className="tv-f half"><span>Tên lá số</span><input value={label} onChange={e => setLabel(e.target.value)} /></label>
        <label className="tv-f half"><span>Năm xem mặc định</span><input type="number" inputMode="numeric" value={viewYear} min={1800} max={2200} onChange={e => setViewYear(+e.target.value)} /></label>
        <label className="tv-f"><span>Ghi chú</span><input value={note} onChange={e => setNote(e.target.value)} /></label>
        <SettingsFields value={settings} onChange={patch => setSettings(s => ({ ...s, ...patch }))} solar={profile.birth.calendar === 'solar'} hasPlace={profile.birth.longitude !== null} />
      </div>
      {save.isError && <p className="tv-err">{errorText(save.error)}</p>}
      {del.isError && <p className="tv-err">{errorText(del.error)}</p>}
      <div className="sheet-foot">
        {ask
          ? <span className="tv-row" style={{ alignItems: 'center' }}><span className="tv-muted" style={{ fontSize: 13 }}>Xoá lá số và các bài luận?</span>
              <button type="button" className="tv-btn accent" disabled={del.isPending} onClick={() => del.mutate()}>Xoá</button>
              <button type="button" className="tv-btn ghost" onClick={() => setAsk(false)}>Không</button></span>
          : <span><button type="button" className="tv-link" onClick={() => setAsk(true)}>Xoá lá số này</button></span>}
        <button type="button" className="tv-btn ghost" onClick={onClose}>Huỷ</button>
        <button type="button" className="tv-btn accent" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </Sheet>
  );
}
