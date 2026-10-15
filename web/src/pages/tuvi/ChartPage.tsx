/* One person's lá số: the chart, then grandma's sentences palace by palace, the luck periods, and an overview.
   The API sets up and reads the chart; this page only shows it. Opened from a link (/tu-vi/la-so?…) or from a saved
   profile (/tu-vi/profile/:id). */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BRANCHES, LEVEL_NAME, STEMS, VIEWS, canChiName, type View } from '@mystic/engine/tuvi';
import type { GroupDto, ProfileDto, TuViReadingDto, TuViSettings } from '@mystic/engine/api';
import { api } from '../../api';
import { Failed, errorText } from '../../components/Owner';
import { Sheet } from '../../components/Sheet';
import { birthDtoOf, fromProfile, fromSearch, settingsOf, thisYear, toSearch, type ChartParams } from '../../lib/params';
import { SONIC_HUB, genderOf } from '../../lib/people';
import { useTitle } from '../../lib/text';
import Grid from './Grid';
import { AiBox, BoSung, Groups, RulesContext, type ToneFilter } from './Reading';
import { SettingsFields } from './Settings';

type Tab = 'cung' | 'han' | 'tong';
const TABS: Tab[] = ['cung', 'han', 'tong'];
/** the palaces the overview is written from (the API's AI reading uses the same) */
const KEY_VIEWS: View[] = ['Mệnh', 'Thân', 'Phúc Đức', 'Quan Lộc', 'Tài Bạch', 'Phu Thê'];
const HOA_IDS = new Set(['hoa_loc', 'hoa_quyen', 'hoa_khoa', 'hoa_ky']);
const pad = (n: number) => String(n).padStart(2, '0');
const count = (gs: GroupDto[]) => gs.reduce((n, g) => n + g.matches.length, 0);

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

  const an = sp.get('an');
  const variant = an === 'sach' ? 'sach' : an === 'ba' ? 'ba' : undefined;
  const year = Number(sp.get('nam')) || (id ? p?.viewYear ?? thisYear() : params?.options.viewYear ?? thisYear());
  const settings: TuViSettings | null = !params ? null : p ? { ...p.settings, ...(variant ? { variant } : {}) } : settingsOf(params.options);
  /* a saved profile is read by the API from what it stored; a link, or a profile shown with another variant, is sent as it is */
  const custom = !p || (variant !== undefined && variant !== p.settings.variant);
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
  if (id && profile.isLoading) return <div className="wrap page tv"><div className="card empty">Đang mở lá số…</div></div>;
  if (id && profile.isError) return <div className="wrap page tv"><Failed error={profile.error}>{back}</Failed></div>;
  if (!params) return <div className="wrap page tv"><div className="card empty">Thiếu ngày giờ sinh. {back}</div></div>;
  if (reading.isError) return <div className="wrap page tv"><div className="card empty">{errorText(reading.error)} <Link className="tv-link" to={`/tu-vi?${toSearch(params)}`}>Sửa ngày sinh</Link></div></div>;
  if (!reading.data) return <div className="wrap page tv"><div className="card empty">Đang lập lá số…</div></div>;
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
  const chart = r.chart;
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null || v === '') n.delete(k); else n.set(k, v); setSp(n, { replace: true }); };
  const tab = (TABS.includes(sp.get('xem') as Tab) ? sp.get('xem') : 'cung') as Tab;
  const view = (VIEWS.includes(sp.get('cung') as View) ? sp.get('cung') : 'Mệnh') as View;
  const [hl, setHl] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'save' | 'edit' | null>(null);
  const profileId = profile?.id ?? null;
  const savedVariant = profile?.settings.variant;

  const hanMarks = useMemo(() => {
    const m: Record<number, string[]> = {};
    if (r.han.dai) (m[r.han.dai.branch] ??= []).push('Đại hạn');
    (m[r.han.tieu.branch] ??= []).push(r.han.tieu.dong ? `Đồng hạn ${r.han.year}` : `Tiểu hạn ${r.han.year}`);
    return m;
  }, [r.han]);
  /* the lines of grandma on screen, so an AI citation can scroll to its line */
  const present = useMemo(() => {
    const gs = tab === 'cung' ? r.views[view].ba : tab === 'han' ? [...(r.han.dai?.ba ?? []), ...r.han.tieu.ba] : r.views['Mệnh'].ba.filter(g => g.inPalace).slice(0, 3);
    return new Set(gs.flatMap(g => g.matches.map(m => m.rule)));
  }, [r, tab, view]);

  const pick = (b: number) => {
    const role = chart.palaces[b].role, n = new URLSearchParams(sp);
    if (role === 'Mệnh') n.delete('cung'); else n.set('cung', role);
    n.delete('xem');
    setSp(n, { replace: true });
    requestAnimationFrame(() => document.getElementById('doc')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const onRef = (code: string) => {
    if (!present.has(code)) return false;
    setHl(code);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`r-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
    return true;
  };
  const setVariant = (v: 'ba' | 'sach') => set('an', profile ? (v === savedVariant ? null : v) : v === 'ba' ? null : 'sach');
  const i = params.input, b = profile?.birth;
  const birth = i.calendar === 'solar'
    ? `${i.day}/${i.month}/${i.year} dương lịch, ${pad(i.hour)}:${pad(i.minute ?? 0)}${b?.timeApprox ? ' (ước chừng)' : ''}`
    : `${i.day}/${i.month}${i.leap ? ' nhuận' : ''} năm ${canChiName(chart.stem, chart.branch)} âm lịch, giờ ${BRANCHES[i.hour]}`;

  return (
    <div className="wrap page tv">
      <div className="tv-chart-head">
        <div>
          <h1>{params.name || 'Lá số tử vi'}{profile?.label && <span className="hh-tag">{profile.label}</span>}</h1>
          <p>{i.gender === 'nam' ? 'Nam' : 'Nữ'} · sinh {birth}{b?.place ? ` · ${b.place}` : ''} · {chart.amDuong} · {chart.napAm.name}</p>
          {profile && <p className="tv-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            <Link className="tv-link" to={`/nguoi/${profile.subject.id}`}>Trang của {profile.subject.displayName}</Link>
            {profile.subject.links.some(l => l.system === SONIC_HUB) && <> · <span className="tv-linked">liên kết Sonic Hub</span></>}
            {profile.note && <> · {profile.note}</>}
          </p>}
        </div>
        <div className="acts">
          <div className="seg" title="Cách an mấy sao mà bà an khác sách phổ thông">
            <a className={chart.options.variant === 'ba' ? 'on' : ''} onClick={() => setVariant('ba')}>An theo bà</a>
            <a className={chart.options.variant === 'sach' ? 'on' : ''} onClick={() => setVariant('sach')}>Theo sách</a>
          </div>
          {profile
            ? <>
                <button type="button" className="tv-btn ghost" onClick={() => setSheet('edit')}>Sửa</button>
                <Link className="tv-btn ghost" to={`/tu-vi?${toSearch(params)}&nguoi=${profile.subject.id}`} title="Lập một lá số khác (giờ, ngày khác) cho người này">Lập lại</Link>
              </>
            : <>
                <Link className="tv-btn ghost" to={`/tu-vi?${toSearch(params)}${sp.get('nguoi') ? `&nguoi=${sp.get('nguoi')}` : ''}`}>Sửa</Link>
                <button type="button" className="tv-btn son" onClick={() => setSheet('save')}>Lưu lá số</button>
              </>}
        </div>
      </div>
      {chart.calendarWarning && <div className="tv-calwarn">{chart.calendarWarning}</div>}

      <Grid chart={chart} name={params.name} selected={tab === 'cung' ? r.views[view].branch : null} onSelect={pick} marks={tab === 'han' ? hanMarks : undefined} />

      <div className="tv-tabs" id="doc">
        <div className="seg">
          <a className={tab === 'cung' ? 'on' : ''} onClick={() => set('xem', null)}>Luận từng cung</a>
          <a className={tab === 'han' ? 'on' : ''} onClick={() => set('xem', 'han')}>Vận hạn</a>
          <a className={tab === 'tong' ? 'on' : ''} onClick={() => set('xem', 'tong')}>Tổng quan</a>
        </div>
        <span className="tv-voice ba">Lời bà</span><span className="tv-voice bs">Bổ sung — không phải của bà</span>
        <span className="tv-caution">Tử vi để tham khảo, chiêm nghiệm; câu nào nói về tai ách nên đọc như lời nhắc giữ gìn.</span>
      </div>

      {tab === 'cung' && <PalaceTab r={r} view={view} hl={hl} onRef={onRef} onView={v => set('cung', v === 'Mệnh' ? null : v)} profileId={profileId} year={year} />}
      {tab === 'han' && <HanTab r={r} year={year} loading={loading} setYear={y => set('nam', y === (profile?.viewYear ?? thisYear()) ? null : String(y))}
        hl={hl} onRef={onRef} onPalace={pick} profileId={profileId} homeYear={profile?.viewYear ?? thisYear()} />}
      {tab === 'tong' && <TongTab r={r} onPalace={pick} profileId={profileId} year={year} onRef={onRef} hl={hl} />}

      {sheet === 'save' && <SaveSheet params={params} year={year} subjectId={sp.get('nguoi')} onClose={() => setSheet(null)} />}
      {sheet === 'edit' && profile && <EditSheet profile={profile} onClose={() => setSheet(null)} />}
    </div>
  );
}

function PalaceTab({ r, view, hl, onRef, onView, profileId, year }: {
  r: TuViReadingDto; view: View; hl: string | null; onRef: (code: string) => boolean; onView: (v: View) => void; profileId: string | null; year: number;
}) {
  const [filter, setFilter] = useState<ToneFilter>('all');
  useEffect(() => { setFilter('all'); }, [view]);
  const chart = r.chart, v = r.views[view], c = chart.palaces[v.branch];
  const main = c.stars.filter(s => s.kind === 'chinh'), rest = c.stars.filter(s => s.kind !== 'chinh' && !HOA_IDS.has(s.id));
  return (
    <>
      <div className="tv-strip">{VIEWS.map(x => (
        <button key={x} type="button" className={x === view ? 'on' : ''} onClick={() => onView(x)}>{x === 'Thân' ? `Thân (${chart.palaces[chart.than].role})` : x}<small>{r.views[x].counts.ba}</small></button>
      ))}</div>
      <div className="tv-read">
        <div className="tv-read-main">
          <div className="tv-phead"><h3>{view === 'Thân' ? 'Thân' : `Cung ${view}`}</h3>
            <span>{STEMS[c.stem]} {BRANCHES[c.branch]} · đại hạn {c.daiHan[0]}–{c.daiHan[1]}{view !== 'Thân' && c.isThan ? ' · Thân cư ở đây' : ''}{view === 'Thân' ? ` · cư cung ${c.role}` : ''}</span></div>
          <div className="tv-pstars">
            {main.length ? main.map(s => <span key={s.id} className="main">{s.name}{s.level ? ` · ${LEVEL_NAME[s.level]}` : ''}{s.hoa ? ` · ${s.hoa}` : ''}</span>) : <span className="main">Vô chính diệu</span>}
            {rest.map(s => <span key={s.id}>{s.name}{s.hoa ? ` · ${s.hoa}` : ''}</span>)}
            {chart.tuan.includes(c.branch) && <span>Tuần</span>}{chart.triet.includes(c.branch) && <span>Triệt</span>}
          </div>
          <div className="tv-filter">
            <span className="tv-voice ba">Lời bà · {v.counts.ba} câu</span>
            <div className="seg">
              <a className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Tất cả</a>
              <a className={filter === 'cat' ? 'on' : ''} onClick={() => setFilter('cat')}>Tốt · {v.counts.cat}</a>
              <a className={filter === 'hung' ? 'on' : ''} onClick={() => setFilter('hung')}>Xấu · {v.counts.hung}</a>
            </div>
          </div>
          <Groups groups={v.ba} filter={filter} hlRef={hl} />
        </div>
        <div className="tv-read-side">
          <BoSung about={v.about} groups={v.boSung} principles={view === 'Mệnh' ? r.principles : undefined} />
          <AiBox profileId={profileId} scope={view} year={year} baLines={v.counts.ba} onRef={onRef} />
        </div>
      </div>
    </>
  );
}

function HanTab({ r, year, loading, setYear, hl, onRef, onPalace, profileId, homeYear }: {
  r: TuViReadingDto; year: number; loading: boolean; setYear: (y: number) => void; hl: string | null; onRef: (code: string) => boolean;
  onPalace: (b: number) => void; profileId: string | null; homeYear: number;
}) {
  const chart = r.chart, h = r.han;
  const order = [...chart.palaces].sort((a, b) => a.daiHan[0] - b.daiHan[0]);
  const tieu = chart.palaces[h.tieu.branch], dai = h.dai ? chart.palaces[h.dai.branch] : null;
  const starsOf = (b: number) => chart.palaces[b].stars.filter(s => s.kind === 'chinh').map(s => s.name).join(', ') || 'vô chính diệu';
  const g = (k: string) => (r.general[k] ? [r.general[k]] : []);
  return (
    <>
      <div className="tv-filter">
        <div className="tv-years">
          <button type="button" onClick={() => setYear(year - 1)} aria-label="Năm trước">‹</button>
          <b>{year} · {h.year === year ? h.canChi : '…'}</b>
          <button type="button" onClick={() => setYear(year + 1)} aria-label="Năm sau">›</button>
        </div>
        <span>{loading ? <><span className="tv-spin" />đang đọc năm {year}</> : `tuổi ${h.age} (tuổi mụ)`}</span>
        {year !== homeYear && <a className="tv-link" onClick={() => setYear(homeYear)} style={{ cursor: 'pointer' }}>Về năm {homeYear}</a>}
      </div>
      <div className="tv-dh">{order.map(c => (
        <button key={c.branch} type="button" className={h.dai?.branch === c.branch ? 'now' : ''} onClick={() => setYear(chart.lunar.year + c.daiHan[0] - 1)} title={`Đại hạn ${c.daiHan[0]}–${c.daiHan[1]} tuổi tại cung ${c.role}`}>
          <b>{c.daiHan[0]}–{c.daiHan[1]}</b><span>{c.role}</span>
        </button>))}</div>
      <div className="tv-han" style={loading ? { opacity: 0.55 } : undefined}>
        <div className="tv-han-col">
          <h3>{dai ? `Đại hạn ${h.dai!.from}–${h.dai!.to} · cung ${dai.role}` : 'Chưa vào đại hạn đầu'}</h3>
          {dai && <span>{STEMS[dai.stem]} {BRANCHES[dai.branch]} · {starsOf(dai.branch)} · <a className="tv-link" onClick={() => onPalace(dai.branch)} style={{ cursor: 'pointer' }}>luận cung này ›</a></span>}
          {h.dai && <><Groups groups={h.dai.ba} hlRef={hl} /><BoSung groups={h.dai.boSung} principles={g('dai_han')} /></>}
        </div>
        <div className="tv-han-col">
          <h3>{h.tieu.dong ? `Đồng hạn ${h.year}` : `Tiểu hạn ${h.year}`} · cung {tieu.role}</h3>
          <span>{STEMS[tieu.stem]} {BRANCHES[tieu.branch]} · {starsOf(tieu.branch)} · <a className="tv-link" onClick={() => onPalace(tieu.branch)} style={{ cursor: 'pointer' }}>luận cung này ›</a></span>
          <Groups groups={h.tieu.ba} hlRef={hl} />
          <BoSung groups={h.tieu.boSung} principles={g('tieu_han')} />
          <div className="tv-k" style={{ marginTop: 18 }}>Hạn từng tháng (theo cách bà ghi: nguyệt nghịch, thời thuận)</div>
          <div className="tv-months">{h.months.map((b, m) => <div key={m}><b>Tháng {m + 1}</b>{chart.palaces[b].role}</div>)}</div>
        </div>
      </div>
      {!loading && <div style={{ marginTop: 24 }}><AiBox wide profileId={profileId} scope={`han-${h.year}`} year={h.year} baLines={(h.dai ? count(h.dai.ba) : 0) + count(h.tieu.ba)} onRef={onRef} /></div>}
    </>
  );
}

function TongTab({ r, onPalace, profileId, year, onRef, hl }: {
  r: TuViReadingDto; onPalace: (b: number) => void; profileId: string | null; year: number; onRef: (code: string) => boolean; hl: string | null;
}) {
  const chart = r.chart;
  const order = [...chart.palaces].sort((a, b) => ((a.branch - chart.menh + 12) % 12) - ((b.branch - chart.menh + 12) % 12));
  const general = ['menh_chu', 'than_chu', 'tam_phuong', 'mieu_ham'].map(k => r.general[k]).filter(Boolean);
  return (
    <div className="tv-read">
      <div className="tv-read-main">
        <div className="tv-k" style={{ marginBottom: 8 }}>Mười hai cung — số câu của bà khớp với lá số</div>
        <div className="tv-table-wrap"><table className="tv-table">
          <thead><tr><th>Cung</th><th>Tại</th><th>Chính tinh</th><th>Câu của bà</th><th>Tốt</th><th>Xấu</th></tr></thead>
          <tbody>{order.map(c => { const v = r.views[c.role as View]; return (
            <tr key={c.branch} style={{ cursor: 'pointer' }} onClick={() => onPalace(c.branch)}>
              <td><b>{c.role}</b>{c.isThan ? ' · Thân' : ''}</td><td>{STEMS[c.stem]} {BRANCHES[c.branch]}</td>
              <td>{c.stars.filter(s => s.kind === 'chinh').map(s => s.name).join(', ') || <span className="tv-muted">vô chính diệu</span>}</td>
              <td>{v.counts.ba}</td><td style={{ color: 'var(--cat)' }}>{v.counts.cat}</td><td style={{ color: 'var(--hung)' }}>{v.counts.hung}</td>
            </tr>); })}</tbody>
        </table></div>
        <div className="tv-k" style={{ margin: '24px 0 8px' }}>Mệnh — những câu về chính tinh thủ Mệnh</div>
        <Groups groups={r.views['Mệnh'].ba.filter(g => g.inPalace).slice(0, 3)} limit={4} hlRef={hl} />
      </div>
      <div className="tv-read-side">
        <BoSung title="Bổ sung · cách đọc lá số này" groups={[]} principles={r.principles} />
        <BoSung title="Bổ sung · khái niệm" groups={[]} principles={general} />
        <AiBox profileId={profileId} scope="tong-quan" year={year} baLines={KEY_VIEWS.reduce((n, v) => n + r.views[v].counts.ba, 0)} onRef={onRef} />
      </div>
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
      const gender = genderOf(params.input.gender), birth = birthDtoOf(params.input);
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
        <button type="button" className="tv-btn son" disabled={save.isPending || invalid || subjects.isError} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </Sheet>
  );
}

function EditSheet({ profile, onClose }: { profile: ProfileDto; onClose: () => void }) {
  const [label, setLabel] = useState(profile.label ?? '');
  const [note, setNote] = useState(profile.note ?? '');
  const [viewYear, setViewYear] = useState(profile.viewYear ?? thisYear());
  const [settings, setSettings] = useState<TuViSettings>(profile.settings);
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
      nav(`/nguoi/${profile.subject.id}`, { replace: true });
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
              <button type="button" className="tv-btn son" disabled={del.isPending} onClick={() => del.mutate()}>Xoá</button>
              <button type="button" className="tv-btn ghost" onClick={() => setAsk(false)}>Không</button></span>
          : <span><button type="button" className="tv-link" onClick={() => setAsk(true)}>Xoá lá số này</button></span>}
        <button type="button" className="tv-btn ghost" onClick={onClose}>Huỷ</button>
        <button type="button" className="tv-btn son" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Đang lưu…' : 'Lưu'}</button>
      </div>
    </Sheet>
  );
}
