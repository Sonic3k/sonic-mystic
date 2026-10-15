/* How a chart is set up where grandma's notes say nothing (or differ from the books) — the app's choices, shown as such. */
import { Link } from 'react-router';
import type { TuViSettings } from '@mystic/engine/api';

export function SettingsFields({ value, onChange, solar, hasPlace, open }: {
  value: TuViSettings; onChange: (patch: Partial<TuViSettings>) => void;
  /** the birth is a solar date with a clock time (the 23:00 rule and sun time apply only then) */
  solar: boolean; hasPlace: boolean; open?: boolean;
}) {
  return (
    <details className="tv-more" open={open}>
      <summary>Tuỳ chọn an sao</summary>
      <div className="tv-more-in">
        <div className="tv-opt"><span className="tv-k">Mấy sao bà an khác sách</span>
          <div className="seg" style={{ margin: 0, justifySelf: 'start' }}>
            <a className={value.variant === 'ba' ? 'on' : ''} onClick={() => onChange({ variant: 'ba' })}>Theo bà</a>
            <a className={value.variant === 'sach' ? 'on' : ''} onClick={() => onChange({ variant: 'sach' })}>Theo sách</a>
          </div>
          <small>Hỏa Tinh – Linh Tinh, Tứ Hóa tuổi Canh, Thiên Phúc tuổi Quý. <Link className="tv-link" to="/tu-vi/phan-1#khac">Xem chỗ khác</Link></small></div>
        <div className="tv-opt"><span className="tv-k">Sinh tháng nhuận</span>
          <select value={value.leapMonth} onChange={e => onChange({ leapMonth: e.target.value as TuViSettings['leapMonth'] })}>
            <option value="same">Tính như tháng đó</option><option value="split15">Từ ngày 16 tính sang tháng sau</option></select>
          <small className="tv-note-bs">Bà không ghi cách tính — đây là tuỳ chọn của ứng dụng.</small></div>
        {solar && <div className="tv-opt"><span className="tv-k">Sinh từ 23 giờ đến 24 giờ</span>
          <select value={value.tyNextDay ? '1' : '0'} onChange={e => onChange({ tyNextDay: e.target.value === '1' })}>
            <option value="1">Giờ Tý của ngày hôm sau</option><option value="0">Giờ Tý của chính ngày đó</option></select>
          <small className="tv-note-bs">Bà không ghi cách tính — đây là tuỳ chọn của ứng dụng.</small></div>}
        <div className="tv-opt"><span className="tv-k">Đổi ngày âm lịch theo</span>
          <select value={value.lunarCalendar} onChange={e => onChange({ lunarCalendar: e.target.value as TuViSettings['lunarCalendar'] })}>
            <option value="auto">Tự động theo năm sinh và nơi sinh</option>
            <option value="utc7">Lịch Việt Nam hiện nay (múi giờ +7)</option>
            <option value="utc8">Lịch cũ (múi giờ +8)</option></select>
          <small className="tv-note-bs">Trước năm 1968 lịch ở Việt Nam tính theo múi giờ +8 (miền Nam đến 1975), sau đó +7; vài ngày mồng một lệch nhau một ngày. Bà không ghi — đây là tuỳ chọn của ứng dụng.</small></div>
        {solar && <div className="tv-opt"><span className="tv-k">Giờ sinh tính theo</span>
          <select value={value.hourBasis} onChange={e => onChange({ hourBasis: e.target.value as TuViSettings['hourBasis'] })}>
            <option value="clock">Giờ đồng hồ (như bà và phần lớn sách)</option>
            <option value="true_solar" disabled={!hasPlace}>Giờ mặt trời tại nơi sinh{hasPlace ? '' : ' — cần nơi sinh'}</option></select>
          <small className="tv-note-bs">Giờ mặt trời lệch giờ đồng hồ vài chục phút tuỳ kinh độ và ngày trong năm; chỉ đổi giờ sinh khi ở sát ranh giới hai giờ. Tuỳ chọn của ứng dụng.</small></div>}
      </div>
    </details>
  );
}
