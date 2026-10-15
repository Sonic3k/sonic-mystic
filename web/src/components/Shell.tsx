/* The frame of every page: a top bar with the disciplines (those not ready marked as coming), and the section's own
   sidebar. A chart or a reading uses the full width. */
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { DISCIPLINES } from '@mystic/engine';
import { api } from '../api';

const PATH: Record<string, string> = { tuvi: '/tu-vi', numerology: '/nhan-so-hoc' };
/* each discipline's ink: grandma's cinnabar for tử vi, the book's purple for nhân số học */
const INK: Record<string, string> = { numerology: '#5B3F8F' };
const TUVI_LINKS: [string, string][] = [['/tu-vi', 'Lập lá số'], ['/tu-vi/sach', 'Sách của bà'], ['/tu-vi/tra-cuu', 'Tra cứu'], ['/tu-vi/phan-1', 'Phần I · An sao']];
const NS_LINKS: [string, string][] = [['/nhan-so-hoc', 'Xem các con số'], ['/nhan-so-hoc/sach', 'Sách'], ['/nhan-so-hoc/tra-cuu', 'Tra cứu']];

export default function Shell() {
  const { pathname: p } = useLocation();
  const ns = p.startsWith('/nhan-so-hoc');
  const wide = p.startsWith('/tu-vi/la-so') || p.startsWith('/tu-vi/profile') || p.startsWith('/nhan-so-hoc/xem') || p.startsWith('/nhan-so-hoc/profile');
  const people = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, staleTime: 60_000, retry: false });
  const on = (b: boolean) => (b ? 'on' : '');
  const exact = (to: string) => p === to;
  const links = ns ? NS_LINKS : TUVI_LINKS;
  const home = ns ? '/nhan-so-hoc' : '/tu-vi';
  /* nhân số học: the profiles kept, by the name each reads */
  const saved = ns ? (people.data ?? []).flatMap(s => s.profiles.filter(x => x.discipline === 'numerology').map(x => ({ s, x }))) : [];
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
            <NavLink to="/nguoi" className={({ isActive }) => on(isActive)}><i style={{ ['--c' as string]: '#34617E' }} />Người</NavLink>
          </nav>
        </div>
      </header>
      {(p.startsWith('/tu-vi') || ns) && !wide && (
        <nav className="mnav" aria-label={ns ? 'Nhân số học' : 'Tử vi'}>{links.map(([to, label]) => <Link key={to} to={to} className={on(to === home ? exact(to) : p.startsWith(to))}>{label}</Link>)}</nav>
      )}
      <div className={`frame ${wide ? 'wide' : ''}`}>
        <aside className="side">
          <h4>{ns ? 'Nhân số học' : 'Tử vi'}</h4>
          {links.map(([to, label]) => <Link key={to} to={to} className={on(to === home ? exact(to) : p.startsWith(to))}><span className="dot" style={{ ['--c' as string]: ns ? '#5B3F8F' : 'var(--mystic)' }} />{label}</Link>)}
          {ns ? <>
            {saved.length > 0 && <h4>Đã lưu</h4>}
            {saved.slice(0, 14).map(({ s, x }) => (
              <Link key={x.id} to={`/nhan-so-hoc/profile/${x.id}`} className={on(p === `/nhan-so-hoc/profile/${x.id}`)}>{x.name ?? s.displayName}<small>{x.label === 'ví dụ trong sách' ? 'ví dụ' : x.label ?? ''}</small></Link>
            ))}
            {saved.length > 14 && <Link to="/nhan-so-hoc#da-luu">Tất cả…</Link>}
          </> : <>
            {!!people.data?.length && <h4>Người đã xem</h4>}
            {people.data?.slice(0, 14).map(s => (
              <Link key={s.id} to={`/nguoi/${s.id}`} className={on(p === `/nguoi/${s.id}`)}>{s.displayName}<small>{s.profiles.length || ''}</small></Link>
            ))}
            {(people.data?.length ?? 0) > 14 && <Link to="/nguoi">Tất cả…</Link>}
          </>}
        </aside>
        <main><Outlet /></main>
      </div>
    </>
  );
}
