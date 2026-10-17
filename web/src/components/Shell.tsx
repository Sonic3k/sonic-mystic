/* The frame of every page: a top bar with the disciplines (those not ready marked as coming), and the section's own
   sidebar. A chart or a reading uses the full width. */
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { DISCIPLINES } from '@mystic/engine';
import { api } from '../api';

const PATH: Record<string, string> = { tuvi: '/tu-vi', numerology: '/numerology', astrology: '/astrology' };
/* each discipline's ink: grandma's cinnabar for tử vi, the book's purple for nhân số học, cô Hương Kiều's teal for chiêm tinh */
const INK: Record<string, string> = { numerology: '#5B3F8F', astrology: '#1E6B66' };
const TUVI_LINKS: [string, string][] = [['/tu-vi', 'Lập lá số'], ['/tu-vi/books', 'Sách của bà'], ['/tu-vi/lookup', 'Tra cứu'], ['/tu-vi/setup', 'Phần I · An sao']];
const NUMEROLOGY_LINKS: [string, string][] = [['/numerology', 'Xem các con số'], ['/numerology/books', 'Sách'], ['/numerology/lookup', 'Tra cứu']];
const ASTRO_LINKS: [string, string][] = [['/astrology', 'Lập lá số'], ['/astrology/books', 'Tài liệu'], ['/astrology/lookup', 'Tra cứu']];

export default function Shell() {
  const { pathname: p } = useLocation();
  const numerology = p.startsWith('/numerology'), astro = p.startsWith('/astrology');
  const wide = p.startsWith('/tu-vi/chart') || p.startsWith('/tu-vi/profile') || p.startsWith('/numerology/view') || p.startsWith('/numerology/profile');
  const people = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, staleTime: 60_000, retry: false });
  const on = (b: boolean) => (b ? 'on' : '');
  const exact = (to: string) => p === to;
  const links = astro ? ASTRO_LINKS : numerology ? NUMEROLOGY_LINKS : TUVI_LINKS;
  const home = astro ? '/astrology' : numerology ? '/numerology' : '/tu-vi';
  const section = astro ? 'Chiêm tinh' : numerology ? 'Nhân số học' : 'Tử vi';
  const dot = astro ? INK.astrology : numerology ? INK.numerology : 'var(--mystic)';
  /* a chart read from a link counts as the chart being set up */
  const isOn = (to: string) => (to === home ? exact(to) || (astro && p === '/astrology/view') : p.startsWith(to));
  /* nhân số học and chiêm tinh: the profiles kept */
  const saved = numerology || astro
    ? (people.data ?? []).flatMap(s => s.profiles.filter(x => x.discipline === (astro ? 'astrology' : 'numerology')).map(x => ({ s, x })))
    : [];
  const base = astro ? '/astrology' : '/numerology';
  return (
    <>
      <header className="top">
        <div className="top-in">
          <Link to="/" className="logo"><i aria-hidden />Huyền học<small>theo ghi chép của bà</small></Link>
          <nav className="tabs" aria-label="Các môn">
            <NavLink to="/" end className={({ isActive }) => on(isActive)}><i style={{ ['--c' as string]: '#57544D' }} />Trang đầu</NavLink>
            {DISCIPLINES.map(d => d.ready
              ? <NavLink key={d.code} to={PATH[d.code] ?? '/'} className={({ isActive }) => on(isActive)}><i style={INK[d.code] ? { ['--c' as string]: INK[d.code] } : undefined} />{d.name}</NavLink>
              : <span key={d.code} className="soon" title="Sắp có"><i />{d.name}<small>sắp có</small></span>)}
            <NavLink to="/people" className={({ isActive }) => on(isActive)}><i style={{ ['--c' as string]: '#34617E' }} />Người</NavLink>
          </nav>
        </div>
      </header>
      {(p.startsWith('/tu-vi') || numerology || astro) && !wide && (
        <nav className="mnav" aria-label={section}>{links.map(([to, label]) => <Link key={to} to={to} className={on(isOn(to))}>{label}</Link>)}</nav>
      )}
      <div className={`frame ${wide ? 'wide' : ''}`}>
        <aside className="side">
          <h4>{section}</h4>
          {links.map(([to, label]) => <Link key={to} to={to} className={on(isOn(to))}><span className="dot" style={{ ['--c' as string]: dot }} />{label}</Link>)}
          {numerology || astro ? <>
            {saved.length > 0 && <h4>Đã lưu</h4>}
            {saved.slice(0, 14).map(({ s, x }) => (
              <Link key={x.id} to={`${base}/profile/${x.id}`} className={on(p === `${base}/profile/${x.id}`)}>{(numerology ? x.name : null) ?? s.displayName}<small>{x.label === 'ví dụ trong sách' ? 'ví dụ' : x.label ?? ''}</small></Link>
            ))}
            {saved.length > 14 && <Link to={`${base}#saved`}>Tất cả…</Link>}
          </> : <>
            {!!people.data?.length && <h4>Người đã xem</h4>}
            {people.data?.slice(0, 14).map(s => (
              <Link key={s.id} to={`/people/${s.id}`} className={on(p === `/people/${s.id}`)}>{s.displayName}<small>{s.profiles.length || ''}</small></Link>
            ))}
            {(people.data?.length ?? 0) > 14 && <Link to="/people">Tất cả…</Link>}
          </>}
        </aside>
        <main><Outlet /></main>
      </div>
    </>
  );
}
