/* The hall: a door to each room, each in its room's own material (the lá số on silk, the lapis plate, the squared
   paper), and the people with each room's key figure, so a glance finds a person's Mệnh, Sun and ruling number. */
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { SIGNS } from '@mystic/engine/astrology';
import type { SubjectDto } from '@mystic/engine/api';
import { api } from '../api';
import { newest } from '../lib/badges';
import { lastChart, type Room } from '../components/Shell';
import { useTitle } from '../lib/text';
import { PeopleTable } from './People';

const VS = '︎';

function DoorTuvi() {
  const W = [[30, 22, 26], [24, 34, 18, 28], [36, 20, 30], [22, 30, 26, 18], [28, 24, 32], [34, 18, 26, 22], [20, 32, 24], [26, 22, 34, 20], [32, 26, 18], [24, 30, 22, 28], [30, 20, 26], [22, 28, 30]];
  const cells = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 3], [2, 0], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3]];
  return (
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <rect x="7" y="7" width="226" height="226" fill="none" stroke="#2E2823" />
      <rect x="12" y="12" width="216" height="216" fill="none" stroke="#2E2823" strokeWidth="1.6" />
      {[66, 120, 174].map(v => <g key={v}><line x1={v} y1="12" x2={v} y2="228" stroke="#2E2823" /><line x1="12" y1={v} x2="228" y2={v} stroke="#2E2823" /></g>)}
      <rect x="67" y="67" width="106" height="106" fill="#FBFAF6" />
      {cells.map(([r, c], k) => W[k].map((w, j) => (
        <rect key={`${k}-${j}`} x={12 + c * 54 + 7} y={12 + r * 54 + 9 + j * 9} width={w} height={j === 0 ? 4 : 2.6}
          fill={j === 0 ? '#2B2622' : j % 2 ? '#2B694E' : '#A1372A'} opacity={j === 0 ? 0.9 : 0.75} />
      )))}
      <rect x="98" y="94" width="44" height="52" fill="#5B2B5F" rx="2" />
      <rect x="100.5" y="96.5" width="39" height="47" fill="none" stroke="#fff" strokeOpacity=".55" />
      <text x="120" y="117" textAnchor="middle" fontFamily="Noto Serif TC, serif" fontWeight="700" fontSize="17" fill="#fff">紫</text>
      <text x="120" y="138" textAnchor="middle" fontFamily="Noto Serif TC, serif" fontWeight="700" fontSize="17" fill="#fff">微</text>
    </svg>
  );
}

function DoorAstro() {
  const C = 120, rad = (d: number) => (d * Math.PI) / 180;
  const at = (a: number, r: number): [number, number] => [C + r * Math.cos(a), C - r * Math.sin(a)];
  const tri = [Math.PI * 1.1, Math.PI * 0.45, Math.PI * 1.75].map(a => at(a, 40));
  const [rx1, ry1] = at(Math.PI * 1.1, 40), [rx2, ry2] = at(Math.PI * 0.1, 40);
  return (
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <circle cx="120" cy="120" r="108" fill="none" stroke="#AE8832" />
      <circle cx="120" cy="120" r="102" fill="none" stroke="#E3CB8C" strokeOpacity=".5" />
      <circle cx="120" cy="120" r="84" fill="none" stroke="#AE8832" />
      <circle cx="120" cy="120" r="40" fill="none" stroke="#AE8832" strokeOpacity=".7" />
      {Array.from({ length: 12 }, (_, i) => { const a = rad(180 + i * 30), [x1, y1] = at(a, 84), [x2, y2] = at(a, 102); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#AE8832" />; })}
      {SIGNS.map((s, i) => { const [x, y] = at(rad(180 + i * 30 + 15), 93); return <text key={s.code} x={x.toFixed(1)} y={y.toFixed(1)} textAnchor="middle" dominantBaseline="central" fontFamily="Noto Sans Symbols 2, sans-serif" fontSize="12" fill="#E3CB8C">{s.glyph}{VS}</text>; })}
      <line x1="12" y1="120" x2="228" y2="120" stroke="#E3CB8C" strokeWidth="1.4" />
      <line x1="120" y1="12" x2="120" y2="228" stroke="#E3CB8C" strokeOpacity=".6" />
      <path d={`M${tri.map(p => p.join(' ')).join(' L')} Z`} fill="none" stroke="#8DB4F4" strokeOpacity=".8" />
      <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke="#F07E63" strokeOpacity=".85" />
      {[319, 118, 295, 290, 277, 228].map(lon => { const [x, y] = at(rad(180 + lon - 6.5), 70); return <circle key={lon} cx={x} cy={y} r="3" fill="#FFF6DF" />; })}
      <circle cx="120" cy="120" r="5" fill="none" stroke="#E3CB8C" />
    </svg>
  );
}

function DoorNum() {
  const rows = [[3, 6, 9], [2, 5, 8], [1, 4, 7]], col = ['#22508D', '#DCA12A', '#BF3F29'];
  return (
    <svg viewBox="0 0 260 220" aria-hidden="true">
      <rect x="40" y="40" width="156" height="156" fill="#fff" stroke="#151515" strokeWidth="2" />
      <line x1="92" y1="40" x2="92" y2="196" stroke="#151515" /><line x1="144" y1="40" x2="144" y2="196" stroke="#151515" />
      <line x1="40" y1="92" x2="196" y2="92" stroke="#151515" /><line x1="40" y1="144" x2="196" y2="144" stroke="#151515" />
      <line x1="48" y1="48" x2="188" y2="188" stroke="#BF3F29" strokeWidth="1.8" strokeDasharray="6 5" opacity=".85" />
      {rows.map((r, i) => (
        <g key={i}>
          <rect x="28" y={44 + i * 52} width="6" height="40" fill={col[i]} />
          {r.map((n, j) => <g key={n}><rect x={55 + j * 52} y={52 + i * 52} width="22" height="28" fill="#fff" />
            <text x={66 + j * 52} y={66 + i * 52} textAnchor="middle" dominantBaseline="central" fontFamily="Old Standard TT, serif" fontWeight="700" fontSize="24" fill="#151515">{n}</text></g>)}
        </g>
      ))}
      <path d="M229 70 L256 128 L202 128 Z" fill="#F6E2AE" stroke="#151515" strokeWidth="1.6" />
      <circle cx="229" cy="70" r="11" fill="#fff" stroke="#151515" strokeWidth="1.6" />
      <circle cx="229" cy="70" r="3.6" fill="#BF3F29" />
    </svg>
  );
}

const URL_OF: Record<string, string> = { tuvi: '/tu-vi/profile/', astrology: '/astrology/profile/', numerology: '/numerology/profile/' };
/** a door's first way in: the last chart opened in that room here, else the newest chart of the room among everyone's */
function lastIn(people: SubjectDto[], room: Room, discipline: string, word: string) {
  const last = lastChart.get(room);
  if (last) return <Link to={last.path}>{word} {last.name}</Link>;
  let best: { s: SubjectDto; p: NonNullable<ReturnType<typeof newest>> } | null = null;
  for (const s of people) { const p = newest(s, discipline); if (p && (!best || p.updatedAt > best.p.updatedAt)) best = { s, p }; }
  return best && <Link to={URL_OF[discipline] + best.p.id}>{word} {(discipline === 'numerology' && best.p.name) || best.s.displayName}</Link>;
}

export default function Home() {
  const people = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, retry: false });
  const src = (d: string) => ({ queryKey: ['sources', d], queryFn: () => api.sources(d), staleTime: 600_000, retry: false });
  const tvSources = useQuery(src('tuvi')), asSources = useQuery(src('astrology'));
  useTitle(null);
  const list = people.data ?? [];
  const count = (d: string) => list.reduce((n, s) => n + s.profiles.filter(p => p.discipline === d).length, 0);
  const family = tvSources.data?.filter(s => s.kind === 'family').length;
  return (
    <div className="wrap hub page">
      <header className="hub-h"><h1>Huyền học</h1>
        <p>Mỗi bộ môn một gian riêng, đọc theo nguồn riêng của nó: tử vi theo ghi chép của bà, chiêm tinh theo cô Hương Kiều, nhân số học theo sách của Lê Đỗ Quỳnh Hương. Lá số và bài luận của từng người nằm trong gian của môn đó.</p></header>
      <div className="doors">
        <div className="door door-tuvi"><div className="door-in">
          <div className="door-art"><DoorTuvi /></div>
          <div className="door-tx"><b><Link className="door-main" to="/tu-vi">Tử vi</Link></b>
            <p>Theo ghi chép của bà ngoại. Lá số an theo cách của bà, từng câu bà viết được so với lá số.</p>
            <p className="door-count">{people.data ? `${count('tuvi')} lá số` : '…'}{family ? ` · ${family} tập ghi chép của bà` : ''}</p>
            <div className="go">{lastIn(list, 'tuvi', 'tuvi', 'Lá số')}<Link to="/tu-vi/books">Sách của bà</Link><Link to="/tu-vi/lookup">Tra cứu</Link></div>
          </div>
        </div></div>
        <div className="door door-astro">
          <div className="door-art"><DoorAstro /></div>
          <div className="door-tx"><b><Link className="door-main" to="/astrology">Chiêm tinh</Link></b>
            <p>Theo bài giảng của cô Hương Kiều, sách của Woolfolk và bản dịch Tierney của lớp.</p>
            <p className="door-count">{people.data ? `${count('astrology')} lá số` : '…'}{asSources.data ? ` · ${asSources.data.length} tài liệu` : ''}</p>
            <div className="go">{lastIn(list, 'astro', 'astrology', 'Lá số')}<Link to="/astrology/books">Tài liệu</Link><Link to="/astrology/lookup">Tra cứu</Link></div>
          </div>
        </div>
        <div className="door door-num">
          <div className="door-art"><DoorNum /></div>
          <div className="door-tx"><b><Link className="door-main" to="/numerology">Nhân số học</Link></b>
            <p>Theo sách «Thay đổi cuộc sống với Nhân số học» của Lê Đỗ Quỳnh Hương.</p>
            <p className="door-count">{people.data ? `${count('numerology')} hồ sơ` : '…'} · 1 cuốn sách</p>
            <div className="go">{lastIn(list, 'num', 'numerology', 'Hồ sơ')}<Link to="/numerology/books">Sách</Link><Link to="/numerology/lookup">Tra cứu</Link></div>
          </div>
        </div>
      </div>
      <PeopleTable q={people} />
    </div>
  );
}
