/* The frame of every page: a top bar with the disciplines (tử vi now, the others marked as coming), and the
   section's own sidebar. A chart page uses the full width. */
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { DISCIPLINES } from '@mystic/engine';
import { api } from '../api';

const PATH: Record<string, string> = { tuvi: '/tu-vi' };
const TUVI_LINKS: [string, string][] = [['/tu-vi', 'Lập lá số'], ['/tu-vi/sach', 'Sách của bà'], ['/tu-vi/tra-cuu', 'Tra cứu'], ['/tu-vi/phan-1', 'Phần I · An sao']];

export default function Shell() {
  const { pathname: p } = useLocation();
  const wide = p.startsWith('/tu-vi/la-so') || p.startsWith('/tu-vi/profile');
  const people = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, staleTime: 60_000, retry: false });
  const on = (b: boolean) => (b ? 'on' : '');
  const exact = (to: string) => p === to;
  return (
    <>
      <header className="top">
        <div className="top-in">
          <Link to="/" className="logo"><i aria-hidden />Huyền học<small>theo ghi chép của bà</small></Link>
          <nav className="tabs" aria-label="Các môn">
            <NavLink to="/" end className={({ isActive }) => on(isActive)}><i style={{ ['--c' as string]: '#57544D' }} />Trang đầu</NavLink>
            {DISCIPLINES.map(d => d.ready
              ? <NavLink key={d.code} to={PATH[d.code] ?? '/'} className={({ isActive }) => on(isActive)}><i />{d.name}</NavLink>
              : <span key={d.code} className="soon" title="Sắp có"><i />{d.name}<small>sắp có</small></span>)}
            <NavLink to="/nguoi" className={({ isActive }) => on(isActive)}><i style={{ ['--c' as string]: '#34617E' }} />Người</NavLink>
          </nav>
        </div>
      </header>
      {p.startsWith('/tu-vi') && !wide && (
        <nav className="mnav" aria-label="Tử vi">{TUVI_LINKS.map(([to, label]) => <Link key={to} to={to} className={on(to === '/tu-vi' ? exact(to) : p.startsWith(to))}>{label}</Link>)}</nav>
      )}
      <div className={`frame ${wide ? 'wide' : ''}`}>
        <aside className="side">
          <h4>Tử vi</h4>
          {TUVI_LINKS.map(([to, label]) => <Link key={to} to={to} className={on(to === '/tu-vi' ? exact(to) : p.startsWith(to))}><span className="dot" style={{ ['--c' as string]: 'var(--mystic)' }} />{label}</Link>)}
          {!!people.data?.length && <h4>Người đã xem</h4>}
          {people.data?.slice(0, 14).map(s => (
            <Link key={s.id} to={`/nguoi/${s.id}`} className={on(p === `/nguoi/${s.id}`)}>{s.displayName}<small>{s.profiles.length || ''}</small></Link>
          ))}
          {(people.data?.length ?? 0) > 14 && <Link to="/nguoi">Tất cả…</Link>}
        </aside>
        <main><Outlet /></main>
      </div>
    </>
  );
}
