/* Chiêm tinh's front page: the birth (date, clock time, place, zone), the example the book reads, the sources, and the
   charts kept. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { PLACES } from '@mystic/engine/birth';
import type { Gender, SubjectDto } from '@mystic/engine/api';
import { api } from '../../api';
import { SAMPLE, SAMPLE_LABEL, ZONES, fromAstroSearch, placeNamed, toAstroSearch, zoneFields, zoneOf, type AstroParams } from '../../lib/astro';
import { birthLine } from '../../lib/people';
import { fold, useTitle } from '../../lib/text';

export const useAstroBook = () => useQuery({ queryKey: ['astro-book'], queryFn: api.astroBook, staleTime: 600_000, retry: false });

interface Form { name: string; d: string; m: string; y: string; time: string; approx: boolean; place: string; lat: string; lon: string; zone: string; gender: Gender | null }
const blank: Form = { name: '', d: '', m: '', y: '', time: '', approx: false, place: '', lat: '', lon: '', zone: 'tz:Asia/Ho_Chi_Minh', gender: null };
const num = (s: string) => (/^\s*-?\d+(\.\d+)?\s*$/.test(s) ? Number(s) : NaN);

function formOf(p: AstroParams): Form {
  const b = p.birth;
  return {
    name: p.name, d: String(b.day), m: String(b.month), y: String(b.year), time: b.time ?? '', approx: !!b.timeApprox, place: b.place ?? '',
    lat: b.latitude !== null ? String(b.latitude) : '', lon: b.longitude !== null ? String(b.longitude) : '', zone: zoneOf(b), gender: p.gender,
  };
}
function formOfSubject(s: SubjectDto): Form {
  const b = s.birth;
  return {
    ...blank, name: s.displayName, d: b.day ? String(b.day) : '', m: b.month ? String(b.month) : '', y: b.year ? String(b.year) : '',
    time: b.calendar === 'solar' && b.time ? b.time : '', approx: b.timeApprox, place: b.place ?? '',
    lat: b.latitude !== null ? String(b.latitude) : '', lon: b.longitude !== null ? String(b.longitude) : '',
    zone: b.timeZone || b.utcOffsetMinutes !== null ? zoneOf(b) : blank.zone, gender: s.gender,
  };
}

/** the form as the chart it asks for, or what is wrong with it */
function readForm(f: Form): { params: AstroParams | null; error: string | null } {
  const day = num(f.d), month = num(f.m), year = num(f.y);
  if (!f.d.trim() && !f.m.trim() && !f.y.trim()) return { params: null, error: null };
  if (![day, month, year].every(Number.isInteger)) return { params: null, error: 'Nhập đủ ngày, tháng và năm sinh.' };
  if (year < 1800 || year > 2200) return { params: null, error: 'Năm sinh từ 1800 đến 2200.' };
  const t = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || day < 1 || t.getUTCMonth() !== month - 1) return { params: null, error: `Không có ngày ${day}/${month}/${year}.` };
  let time: string | null = null;
  if (f.time.trim()) {
    const m = /^(\d{1,2})[:h.](\d{2})$/.exec(f.time.trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return { params: null, error: 'Giờ sinh viết như 09:05.' };
    time = `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  const lat = num(f.lat), lon = num(f.lon), hasPlace = f.lat.trim() !== '' || f.lon.trim() !== '';
  if (hasPlace && (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 66 || Math.abs(lon) > 180)) return { params: null, error: 'Vĩ độ từ −66 đến 66, kinh độ từ −180 đến 180 (số thập phân, ví dụ 21.0285).' };
  return {
    params: {
      name: f.name.trim(), gender: f.gender,
      birth: { year, month, day, time, timeApprox: !!time && f.approx, ...zoneFields(f.zone), place: f.place.trim() || null, latitude: hasPlace ? lat : null, longitude: hasPlace ? lon : null },
    },
    error: null,
  };
}

export default function AstroHome() {
  const [sp] = useSearchParams();
  const subjectId = sp.get('person');
  const subject = useQuery({ queryKey: ['subject', subjectId], queryFn: () => api.subject(subjectId!), enabled: !!subjectId, retry: false });
  /* a link back from a chart carries its birth; "?person=" alone fills the form with what is known of that person */
  const initial = useMemo<Form | null>(() => {
    const own = fromAstroSearch(sp);
    if (own) return formOf(own);
    if (subjectId) return subject.data ? formOfSubject(subject.data) : subject.isError ? blank : null;
    return blank;
  }, [sp, subjectId, subject.data, subject.isError]);
  useTitle('Chiêm tinh');
  return (
    <div className="wrap page tv as">
      <div className="ptitle"><h1>Chiêm tinh</h1><span>Lá số theo giáo trình của cô Hương Kiều · vị trí sao tính bằng Swiss Ephemeris</span></div>
      <div className="as-home">
        {initial ? <BirthForm key={sp.toString() + (subject.data?.id ?? '')} initial={initial} subjectId={subjectId} /> : <div className="tv-card"><div className="tv-muted">Đang mở…</div></div>}
        <SampleCard />
      </div>
      <Saved />
    </div>
  );
}

function BirthForm({ initial, subjectId }: { initial: Form; subjectId: string | null }) {
  const [f, setF] = useState<Form>(initial);
  const nav = useNavigate();
  const set = (patch: Partial<Form>) => setF(x => ({ ...x, ...patch }));
  /* a known place fills its coordinates */
  const setPlace = (place: string) => { const p = placeNamed(place); set(p ? { place: p.name, lat: String(p.latitude), lon: String(p.longitude) } : { place }); };
  const { params, error } = readForm(f);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (params) nav(`/astrology/view?${toAstroSearch(params)}${subjectId ? `&person=${subjectId}` : ''}`); };
  return (
    <form className="tv-card" onSubmit={submit} autoComplete="off">
      <h2>Ngày giờ và nơi sinh</h2>
      <p>Giờ sinh càng đúng, cung Mọc và các cung địa bàn càng chắc. Chưa có giờ vẫn xem được các sao trong cung hoàng đạo.</p>
      <div className="as-form">
        <label className="tv-f as-c4"><span>Ngày</span><input inputMode="numeric" value={f.d} onChange={e => set({ d: e.target.value })} /></label>
        <label className="tv-f as-c4"><span>Tháng</span><input inputMode="numeric" value={f.m} onChange={e => set({ m: e.target.value })} /></label>
        <label className="tv-f as-c4"><span>Năm</span><input inputMode="numeric" value={f.y} onChange={e => set({ y: e.target.value })} /></label>
        <label className="tv-f as-c4"><span>Giờ sinh (giờ đồng hồ)</span><input inputMode="numeric" value={f.time} onChange={e => set({ time: e.target.value })} placeholder="chưa biết" /></label>
        <label className="tv-f as-c8"><span>&nbsp;</span><span className="as-check"><input type="checkbox" checked={f.approx} onChange={e => set({ approx: e.target.checked })} /> Giờ chỉ ước chừng (bài đọc cho biết khoảng giờ cho cùng lá số)</span></label>
        <label className="tv-f as-c7"><span>Nơi sinh</span><input list="as-places" value={f.place} onChange={e => setPlace(e.target.value)} placeholder="Hà Nội, Huế… hay tên nơi khác" />
          <datalist id="as-places">{PLACES.map(p => <option key={p.name} value={p.name} />)}</datalist></label>
        <label className="tv-f as-c5"><span>Múi giờ</span><select value={f.zone} onChange={e => set({ zone: e.target.value })}>{ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}</select></label>
        <label className="tv-f as-c4"><span>Vĩ độ</span><input inputMode="decimal" value={f.lat} onChange={e => set({ lat: e.target.value })} placeholder="21.0285" /></label>
        <label className="tv-f as-c4"><span>Kinh độ</span><input inputMode="decimal" value={f.lon} onChange={e => set({ lon: e.target.value })} placeholder="105.8542" /></label>
        <label className="tv-f as-c4"><span>Giới tính</span><select value={f.gender ?? ''} onChange={e => set({ gender: (e.target.value || null) as Gender | null })}>
          <option value="female">Nữ</option><option value="male">Nam</option><option value="">Không ghi</option></select></label>
      </div>
      <div className="as-form-foot">
        <button className="tv-btn accent" type="submit" disabled={!params}>Xem lá số</button>
        {error ? <span className="tv-err">{error}</span> : <span className="tv-muted">Hà Nội, Huế, Đà Nẵng, TP Hồ Chí Minh… có sẵn tọa độ.</span>}
      </div>
    </form>
  );
}

/** the book's own example: the saved profile with its synthesis when there is one, else the chart of the link */
function SampleCard() {
  const q = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const book = useAstroBook();
  const saved = (q.data ?? []).flatMap(s => s.profiles).find(p => p.discipline === 'astrology' && p.label === SAMPLE_LABEL);
  const sources = book.data?.sources.map(s => s.source) ?? [];
  return (
    <div className="tv-card">
      <h2>Ví dụ trong sách</h2>
      <p>Woolfolk dùng lá số của Oprah Winfrey (sinh 29/1/1954, 4:30 sáng, Kosciusko, Mississippi) để dạy cách luận ở chương 9. Lá số tính ở đây khớp với những gì sách in: cung Mọc 29° Nhân Mã, Mặt Trời 9° Bảo Bình ở cung 2…</p>
      <Link className="tv-link" to={saved ? `/astrology/profile/${saved.id}` : `/astrology/view?${toAstroSearch(SAMPLE)}`}>Mở lá số này ›</Link>
      {sources.length > 0 && <>
        <div className="tv-k" style={{ margin: '18px 0 6px' }}>Đọc từ {sources.length === 6 ? 'sáu' : sources.length} tài liệu</div>
        {sources.map(s => <p key={s.code} className="as-src"><b>{s.title}</b> · {s.author}{s.translator ? ` · ${s.translator} dịch` : ''}</p>)}
      </>}
      {book.isError && <p className="tv-muted" style={{ fontSize: 13 }}>Tài liệu chưa được nạp.</p>}
    </div>
  );
}

function Saved() {
  const q = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const [find, setFind] = useState('');
  const all = (q.data ?? []).flatMap(s => s.profiles.filter(p => p.discipline === 'astrology').map(p => ({ s, p })));
  if (!all.length) return null;
  const f = fold(find.trim());
  const list = f ? all.filter(({ s }) => fold(s.displayName).includes(f)) : all;
  return (
    <section style={{ marginTop: 32 }} id="saved">
      <div className="hd"><h2>Đã lưu</h2><span>{all.length}</span>
        {all.length > 12 && <input className="tv-input" style={{ marginLeft: 'auto', maxWidth: 220, height: 34 }} value={find} onChange={e => setFind(e.target.value)} placeholder="Tìm người…" aria-label="Tìm trong hồ sơ đã lưu" />}</div>
      <div className="tv-saved-list">{list.map(({ s, p }) => {
        const g = p.gender === 'female' ? 'Nữ' : p.gender === 'male' ? 'Nam' : '';
        return (
          <Link key={p.id} className="tv-saved-item" to={`/astrology/profile/${p.id}`}>
            <b>{s.displayName}{p.label && <span className="hh-tag">{p.label === SAMPLE_LABEL ? 'ví dụ' : p.label}</span>}</b>
            <small>{[g, birthLine(p.birth)].filter(Boolean).join(' · ')}</small>
            <small>{p.birth.time ? '' : 'chưa có giờ sinh · '}{p.aiReadings ? 'có bài tổng hợp' : 'chưa có bài tổng hợp'}</small>
          </Link>);
      })}</div>
      {!list.length && <div className="tv-empty">Không thấy ai tên như vậy.</div>}
    </section>
  );
}
