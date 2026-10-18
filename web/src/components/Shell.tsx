/* The frame of every page: one bar in the same place, the same behaviour everywhere, in the skin of the room it is
   in (the hall, Tử vi, Chiêm tinh, Nhân số học). The room is set on <html data-room>, which carries the room's ground,
   typefaces and inks to everything below. On a phone the rooms move to a bar at the bottom. */
import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

export type Room = 'hub' | 'tuvi' | 'astro' | 'num';

export const roomOf = (p: string): Room =>
  p.startsWith('/tu-vi') ? 'tuvi' : p.startsWith('/astrology') ? 'astro' : p.startsWith('/numerology') ? 'num' : 'hub';

const THEME: Record<Room, string> = { hub: '#FBFBF9', tuvi: '#FBFAF6', astro: '#1D366D', num: '#FFFFFF' };
const ROOM: Record<Exclude<Room, 'hub'>, { name: string; note: string; base: string; chart: string; isChart: RegExp; sub: [string, string][] }> = {
  tuvi: {
    name: 'Tử vi', note: 'theo ghi chép của bà', base: '/tu-vi', chart: 'Lá số', isChart: /^\/tu-vi\/(chart|profile\/)/,
    sub: [['/tu-vi', 'Lập lá số'], ['/tu-vi/books', 'Sách của bà'], ['/tu-vi/lookup', 'Tra cứu'], ['/tu-vi/setup', 'Phần I · An sao']],
  },
  astro: {
    name: 'Chiêm tinh', note: 'theo cô Hương Kiều, Woolfolk và Tierney', base: '/astrology', chart: 'Lá số', isChart: /^\/astrology\/(view|profile\/)/,
    sub: [['/astrology', 'Lập lá số'], ['/astrology/books', 'Tài liệu'], ['/astrology/lookup', 'Tra cứu']],
  },
  num: {
    name: 'Nhân số học', note: 'theo sách của Lê Đỗ Quỳnh Hương', base: '/numerology', chart: 'Hồ sơ', isChart: /^\/numerology\/(view|profile\/)/,
    sub: [['/numerology', 'Xem các con số'], ['/numerology/books', 'Sách'], ['/numerology/lookup', 'Tra cứu']],
  },
};

/* the last chart opened in each room, so the book or the lookup (or the hall) is one tap away from it (this browser
   only) */
const LAST = 'mystic.lastChart.';
export interface LastChart { path: string; name: string }
export const lastChart = {
  get(r: Room): LastChart | null {
    try { const v = JSON.parse(localStorage.getItem(LAST + r) ?? 'null'); return v && typeof v.path === 'string' ? v : null; } catch { return null; }
  },
  set(r: Room, v: LastChart) { try { localStorage.setItem(LAST + r, JSON.stringify(v)); } catch { /* private mode */ } },
};
/** a chart page keeps itself as its room's last chart, with whose it is */
export function useRememberChart(room: Room, name: string) {
  const { pathname, search } = useLocation();
  useEffect(() => { if (name) lastChart.set(room, { path: pathname + search, name }); }, [room, name, pathname, search]);
}

export const MARK = (
  <svg viewBox="0 0 26 26" aria-hidden="true"><rect x="4" y="4" width="18" height="18" /><circle cx="13" cy="13" r="9" /><path d="M13 5.2 20.2 18 5.8 18Z" /></svg>
);
export const EMBLEM: Record<'tuvi' | 'astro' | 'num' | 'people', React.ReactNode> = {
  tuvi: <i className="em em-tuvi" aria-hidden="true">紫</i>,
  astro: <i className="em em-astro" aria-hidden="true">☉︎</i>,
  num: <i className="em em-num" aria-hidden="true"><svg viewBox="0 0 20 20"><circle className="o" cx="10" cy="10" r="7.5" /><circle className="c" cx="10" cy="10" r="2.3" /></svg></i>,
  people: <i className="em em-people" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.2" /><path d="M4 17c.8-3.3 3.2-5 6-5s5.2 1.7 6 5" /></svg></i>,
};

export default function Shell() {
  const { pathname: p, search } = useLocation();
  const room = roomOf(p);
  useEffect(() => {
    document.documentElement.dataset.room = room;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME[room]);
  }, [room]);
  /* a new page starts at its top (a tab or a year changing the search keeps its place) */
  useEffect(() => { if (!window.location.hash) window.scrollTo(0, 0); }, [p]);
  const R = room === 'hub' ? null : ROOM[room];
  const onChart = !!R && R.isChart.test(p);
  const chart = R ? (onChart ? p + search : lastChart.get(room)?.path ?? null) : null;
  const on = (b: boolean) => (b ? 'on' : '');
  return (
    <>
      <header className="bar">
        <div className="wrap bar-in">
          <Link to="/" className="mark" aria-label="Huyền học, trang đầu">{MARK}<span>Huyền học</span></Link>
          {R && <div className="here"><b>{R.name}</b><small>{R.note}</small></div>}
          <nav className="rooms" aria-label="Các bộ môn">
            {([['/tu-vi', 'tuvi', 'Tử vi'], ['/astrology', 'astro', 'Chiêm tinh'], ['/numerology', 'num', 'Nhân số học']] as const).map(([to, k, name]) => (
              <Link key={k} to={to} className={on(room === k)} aria-current={room === k ? 'page' : undefined}>{EMBLEM[k]}<span>{name}</span></Link>))}
            <Link to="/people" className={on(p.startsWith('/people'))} aria-current={p.startsWith('/people') ? 'page' : undefined}>{EMBLEM.people}<span>Người</span></Link>
          </nav>
        </div>
        {R && (
          <nav className="sub" aria-label={R.name}>
            <div className="wrap sub-in">
              {chart && <Link to={chart} className={on(onChart)}>{R.chart}</Link>}
              {R.sub.map(([to, label]) => <Link key={to} to={to} className={on(to === R.base ? p === to : p.startsWith(to))}>{label}</Link>)}
            </div>
          </nav>
        )}
      </header>
      <main><Outlet /></main>
    </>
  );
}
