/* The front page: what this is, the disciplines (tử vi now, the others to come), and the people looked at lately. */
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { DISCIPLINES } from '@mystic/engine';
import { api } from '../api';
import { SONIC_HUB, birthLine, genderName } from '../lib/people';
import { useTitle } from '../lib/text';

const PATH: Record<string, string> = { tuvi: '/tu-vi' };
const ABOUT: Record<string, string> = {
  tuvi: 'Lập lá số và luận từng cung theo sổ tay «Luận Tử Vi» bà viết năm 2011.',
  astrology: 'Lá số chiêm tinh theo ngày giờ và nơi sinh.',
  numerology: 'Các con số từ tên và ngày sinh.',
  iching: 'Gieo quẻ và đọc 64 quẻ Kinh Dịch.',
  tarot: 'Trải bài và đọc các lá Tarot.',
};

export default function Home() {
  const disciplines = useQuery({ queryKey: ['disciplines'], queryFn: api.disciplines, staleTime: 600_000 });
  const people = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const list = disciplines.data ?? DISCIPLINES.map(d => ({ ...d, description: null }));
  useTitle(null);
  return (
    <div className="wrap page tv">
      <div className="hh-hero">
        <div className="card hh-intro">
          <h1>Huyền học</h1>
          <p>Những gì bà ghi chép về tử vi — giữ nguyên lời bà, số hoá để so được với từng lá số. Phần nào không phải của bà (sách phổ thông, AI) luôn được ghi rõ và để riêng.</p>
          <p>Mỗi người có thể có nhiều lá số ở những thời điểm khác nhau; bản tóm tắt của lá số mới nhất hiện cả ở trang người trong Sonic Hub.</p>
          <div className="tv-acts" style={{ marginTop: 6 }}>
            <Link className="tv-btn son" to="/tu-vi">Lập lá số tử vi</Link>
            <Link className="tv-btn ghost" to="/tu-vi/sach">Đọc sách của bà</Link>
          </div>
        </div>
        <div className="hh-disc">
          {list.map(d => d.ready && PATH[d.code]
            ? <Link key={d.code} className="hh-d" to={PATH[d.code]}><b>{d.name}</b><p>{d.description ?? ABOUT[d.code]}</p><small>Mở ›</small></Link>
            : <div key={d.code} className="hh-d soon"><b>{d.name}</b><p>{d.description ?? ABOUT[d.code]}</p><small>Sắp có</small></div>)}
        </div>
      </div>

      {!!people.data?.length && (
        <section style={{ marginTop: 32 }}>
          <div className="hd"><h2>Người đã xem</h2><span>{people.data.length}</span><Link to="/nguoi">Tất cả ›</Link></div>
          <div className="hh-people">{people.data.slice(0, 9).map(s => (
            <Link key={s.id} className="hh-person" to={`/nguoi/${s.id}`}>
              <b>{s.displayName}{s.links.some(l => l.system === SONIC_HUB) && <span className="hh-tag">Sonic Hub</span>}</b>
              <small>{[genderName(s.gender), birthLine(s.birth)].filter(Boolean).join(' · ') || 'chưa có ngày sinh'}</small>
              <small>{s.profiles.length ? `${s.profiles.length} lá số` : 'chưa có lá số'}</small>
            </Link>))}</div>
        </section>
      )}
    </div>
  );
}
