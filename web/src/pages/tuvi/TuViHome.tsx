/* Tử vi's front page: the birth form, grandma's book, and the charts kept for the family. */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { leapOfYear, lunarMonthLength, type BirthInput } from '@mystic/engine/tuvi';
import { PLACES } from '@mystic/engine/birth';
import { SOURCES, api } from '../../api';
import { needsToken } from '../../components/Owner';
import { GIO, blankParams, chartHref, clockOffsetFor, fromSearch, fromSubject, settingsOf, type ChartParams } from '../../lib/params';
import { birthComplete } from '../../lib/people';
import { dateVi, useTitle } from '../../lib/text';
import { SettingsFields } from './Settings';

export default function TuViHome() {
  const [sp] = useSearchParams();
  const subjectId = sp.get('nguoi');
  const subject = useQuery({ queryKey: ['subject', subjectId], queryFn: () => api.subject(subjectId!), enabled: !!subjectId, retry: false });
  /* a link back from a chart carries its birth; "?nguoi=" alone fills the form with what is known of that person */
  const initial = useMemo<ChartParams | null>(() => {
    const own = fromSearch(sp);
    if (own) return own;
    if (subjectId) return subject.data ? fromSubject(subject.data) : subject.isError ? blankParams() : null;
    return blankParams();
  }, [sp, subjectId, subject.data, subject.isError]);
  useTitle('Tử vi');
  return (
    <div className="wrap page tv">
      <div className="ptitle"><h1>Tử vi<small>theo ghi chép của bà</small></h1></div>
      <div className="tv-home">
        <div className="tv-card">
          <h2>Lập lá số</h2>
          <p>An sao theo đúng phần «Lập lá số» bà viết. Ngày âm lịch đổi theo lịch Việt Nam (từ 1968 múi giờ +7, trước đó lịch cũ +8).</p>
          {initial ? <BirthForm key={sp.toString() + (subject.data?.id ?? '')} initial={initial} subjectId={subjectId} /> : <div className="tv-muted">Đang mở…</div>}
        </div>
        <BookCard />
      </div>
      <Saved />
    </div>
  );
}

const nums = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const pad = (n: number) => String(n).padStart(2, '0');

function BirthForm({ initial, subjectId }: { initial: ChartParams; subjectId: string | null }) {
  const [p, setP] = useState<ChartParams>(initial);
  const nav = useNavigate();
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const i = p.input;
  const setI = (patch: Partial<BirthInput>) => setP(x => ({ ...x, input: { ...x.input, ...patch } }));
  const setO = (patch: Partial<ChartParams['options']>) => setP(x => ({ ...x, options: { ...x.options, ...patch } }));
  const solar = i.calendar === 'solar';
  const zone = i.year < 1968 ? 8 : 7;
  const leap = !solar ? leapOfYear(i.year, zone) : 0;
  const maxDay = solar ? new Date(Date.UTC(i.year, i.month, 0)).getUTCDate() : (lunarMonthLength(i.month, i.year, !!i.leap, zone) || 30);
  const place = PLACES.findIndex(x => x.latitude === i.latitude && x.longitude === i.longitude);
  const hasPlace = i.longitude != null;
  const error = !Number.isInteger(i.year) || i.year < 1900 || i.year > 2100 ? 'Năm sinh từ 1900 đến 2100.'
    : i.day > maxDay ? `Tháng này chỉ có ${maxDay} ngày.`
      : !solar && i.leap && leap !== i.month ? (leap ? `Năm ${i.year} chỉ nhuận tháng ${leap}.` : `Năm ${i.year} không có tháng nhuận.`)
        : solar && p.options.hourBasis === 'true_solar' && !hasPlace ? 'Giờ mặt trời cần nơi sinh.' : '';
  const ready = (subjects.data ?? []).filter(s => birthComplete(s.gender, s.birth));
  const pickPlace = (v: string) => {
    if (v === 'none') setI({ latitude: null, longitude: null });
    else if (v !== 'own') { const x = PLACES[+v]; setI({ latitude: x.latitude, longitude: x.longitude }); }
  };
  /* the clock's offset follows the date and place unless it was set by hand */
  const [offsetSet, setOffsetSet] = useState(i.utcOffsetMinutes != null && i.utcOffsetMinutes !== 420);
  const offset = offsetSet ? i.utcOffsetMinutes ?? 420 : clockOffsetFor(i);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    const q = { ...p, input: { ...i, utcOffsetMinutes: offset } };
    nav(chartHref(q) + (subjectId ? `&nguoi=${subjectId}` : ''));
  };
  return (
    <form className="tv-form" onSubmit={submit}>
      <label className="tv-f half"><span>Họ tên</span><input value={p.name} onChange={e => setP(x => ({ ...x, name: e.target.value }))} placeholder="không bắt buộc" /></label>
      <label className="tv-f half"><span>Hoặc lấy từ người đã lưu</span>
        <select value={subjectId ?? ''} onChange={e => nav(e.target.value ? `/tu-vi?nguoi=${e.target.value}` : '/tu-vi')} disabled={!ready.length}>
          <option value="">{ready.length ? '— chọn người —' : subjects.isError && needsToken(subjects.error) ? '(cần mã chủ nhà)' : '(chưa có ai đủ ngày giờ sinh)'}</option>
          {ready.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}</select></label>
      <div className="tv-f half"><span>Giới tính</span>
        <div className="seg"><a className={i.gender === 'nam' ? 'on' : ''} onClick={() => setI({ gender: 'nam' })}>Nam</a><a className={i.gender === 'nu' ? 'on' : ''} onClick={() => setI({ gender: 'nu' })}>Nữ</a></div></div>
      <div className="tv-f half"><span>Ngày sinh theo</span>
        <div className="seg">
          <a className={solar ? 'on' : ''} onClick={() => setI({ calendar: 'solar', leap: false, hour: 12, minute: 0 })}>Dương lịch</a>
          <a className={!solar ? 'on' : ''} onClick={() => setI({ calendar: 'lunar', hour: 6 })}>Âm lịch</a>
        </div></div>
      <label className="tv-f third"><span>Ngày</span><select value={i.day} onChange={e => setI({ day: +e.target.value })}>{nums(1, solar ? 31 : 30).map(n => <option key={n}>{n}</option>)}</select></label>
      <label className="tv-f third"><span>Tháng</span><select value={i.month} onChange={e => setI({ month: +e.target.value })}>{nums(1, 12).map(n => <option key={n}>{n}</option>)}</select></label>
      <label className="tv-f third"><span>Năm</span><input type="number" inputMode="numeric" value={i.year} onChange={e => setI({ year: +e.target.value })} min={1900} max={2100} /></label>
      {!solar && (
        <label className="tv-f tv-check" style={{ flexDirection: 'row' }}>
          <input type="checkbox" checked={!!i.leap} onChange={e => setI({ leap: e.target.checked })} disabled={!leap && !i.leap} />
          Tháng nhuận {leap ? <span className="tv-muted">(năm {i.year} nhuận tháng {leap})</span> : <span className="tv-muted">(năm {i.year} không nhuận)</span>}
        </label>
      )}
      {solar
        ? <label className="tv-f half"><span>Giờ sinh <small className="tv-muted">= giờ {GIO[Math.floor((i.hour + 1) / 2) % 12].n}</small></span><input type="time" value={`${pad(i.hour)}:${pad(i.minute ?? 0)}`}
            onChange={e => { const [h, m] = e.target.value.split(':').map(Number); if (Number.isInteger(h)) setI({ hour: h, minute: m || 0 }); }} required /></label>
        : <label className="tv-f half"><span>Giờ sinh</span><select value={i.hour} onChange={e => setI({ hour: +e.target.value })}>{GIO.map(g => <option key={g.i} value={g.i}>Giờ {g.n} ({g.span})</option>)}</select></label>}
      <label className="tv-f half"><span>Nơi sinh</span>
        <select value={place >= 0 ? String(place) : hasPlace ? 'own' : 'none'} onChange={e => pickPlace(e.target.value)}>
          <option value="none">Không rõ / không cần</option>
          {hasPlace && place < 0 && <option value="own">Theo hồ sơ ({i.latitude?.toFixed(2)}, {i.longitude?.toFixed(2)})</option>}
          {PLACES.map((x, k) => <option key={x.name} value={k}>{x.name}</option>)}</select></label>

      <SettingsFields value={settingsOf(p.options)} onChange={setO} solar={solar} hasPlace={hasPlace} />
      {solar && p.options.hourBasis === 'true_solar' && (
        <label className="tv-f half"><span>Đồng hồ lúc sinh</span>
          <select value={offset} onChange={e => { setOffsetSet(true); setI({ utcOffsetMinutes: +e.target.value }); }}>
            <option value={420}>UTC+7</option><option value={480}>UTC+8 (miền Nam 1960–1975)</option></select></label>
      )}
      <div className="tv-form-foot">
        <button type="submit" className="tv-btn son" disabled={!!error}>Lập lá số</button>
        {error && <span className="tv-err">{error}</span>}
      </div>
    </form>
  );
}

function BookCard() {
  const sources = useQuery({ queryKey: ['sources'], queryFn: () => api.sources() });
  const entries = useQuery({ queryKey: ['entries', SOURCES.luan], queryFn: () => api.entries(SOURCES.luan) });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: api.catalog, staleTime: Infinity });
  const quote = useQuery({ queryKey: ['search', 'ngôi Đế cực', 1], queryFn: () => api.search('ngôi Đế cực', 1), staleTime: Infinity });
  const luan = sources.data?.find(s => s.code === SOURCES.luan);
  const stars = entries.data?.filter(e => e.kind === 'symbol') ?? [];
  const mains = (catalog.data?.stars ?? []).filter(s => s.kind === 'chinh');
  const refOf = (code: string) => stars.find(e => e.symbols.includes(code))?.ref;
  const hit = quote.data?.hits[0];
  return (
    <div className="tv-card tv-book-card">
      <span className="tv-voice ba">Sách của bà</span>
      <h2 style={{ marginTop: 8 }}>{luan?.title ?? 'Luận Tử Vi'}</h2>
      <p>Bà viết dở năm 2011: phần lập lá số, rồi từng sao, luận ở từng cung. Mọi câu đều được số hoá để so với lá số — giữ nguyên lời bà.</p>
      {luan && <div className="tv-stats"><div><b>{stars.length || '…'}</b><span>mục sao</span></div><div><b>{luan.passages.toLocaleString('vi-VN')}</b><span>đoạn</span></div><div><b>{luan.rules.toLocaleString('vi-VN')}</b><span>câu luận</span></div></div>}
      {hit && <blockquote>{hit.text.replace(/^[-*•+]\s*/, '')}<small>— mục {hit.entryTitle}</small></blockquote>}
      <div className="tv-chips">{mains.map(s => { const ref = refOf(s.code); return <Link key={s.code} className="tv-chip" to={ref != null ? `/tu-vi/sach/${ref}` : '/tu-vi/sach'}>{s.name}</Link>; })}</div>
      <div className="tv-row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <Link className="tv-btn ghost" to="/tu-vi/sach">Đọc sách của bà</Link>
        <Link className="tv-btn ghost" to="/tu-vi/tra-cuu">Tra cứu</Link>
        <Link className="tv-btn ghost" to="/tu-vi/phan-1">Phần I · An sao</Link>
      </div>
      <div className="tv-legend">
        <p><span className="tv-voice ba">Lời bà</span> — nguyên văn của bà, kiểu chữ có chân, vạch son bên trái. Không câu nào bị viết lại.</p>
        <p><span className="tv-voice bs">Bổ sung</span> — kiến thức tử vi phổ thông và luận giải của AI, luôn tách riêng, ghi rõ không phải của bà.</p>
      </div>
    </div>
  );
}

function Saved() {
  const q = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const list = (q.data ?? []).flatMap(s => s.profiles.filter(p => p.discipline === 'tuvi').map(p => ({ s, p })));
  if (!list.length) return null;
  return (
    <section className="tv-saved">
      <div className="hd"><h2>Lá số đã lưu</h2><span>{list.length}</span><Link to="/nguoi">Tất cả người ›</Link></div>
      <div className="tv-saved-list">{list.map(({ s, p }) => (
        <Link key={p.id} className="tv-saved-item" to={`/tu-vi/profile/${p.id}`}>
          <b>{s.displayName}{p.label && <span className="hh-tag">{p.label}</span>}</b>
          <small>{[p.viewYear ? `xem năm ${p.viewYear}` : '', `lưu ${dateVi(p.createdAt)}`, p.aiReadings ? `${p.aiReadings} bài AI` : ''].filter(Boolean).join(' · ')}</small>
        </Link>))}</div>
    </section>
  );
}
