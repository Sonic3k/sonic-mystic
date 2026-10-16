/* The frame of every page: a top bar with the disciplines (those not ready marked as coming), and the section's own
   sidebar. A chart or a reading uses the full width. */
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { DISCIPLINES } from '@mystic/engine';
import { api } from '../api';

const PATH: Record<string, string> = { tuvi: '/tu-vi', numerology: '/nhan-so-hoc', astrology: '/chiem-tinh' };
/* each discipline's ink: grandma's cinnabar for tử vi, the book's purple for nhân số học, cô Hương Kiều's teal for chiêm tinh */
const INK: Record<string, string> = { numerology: '#5B3F8F', astrology: '#1E6B66' };
const TUVI_LINKS: [string, string][] = [['/tu-vi', 'Lập lá số'], ['/tu-vi/sach', 'Sách của bà'], ['/tu-vi/tra-cuu', 'Tra cứu'], ['/tu-vi/phan-1', 'Phần I · An sao']];
const NS_LINKS: [string, string][] = [['/nhan-so-hoc', 'Xem các con số'], ['/nhan-so-hoc/sach', 'Sách'], ['/nhan-so-hoc/tra-cuu', 'Tra cứu']];
const ASTRO_LINKS: [string, string][] = [['/chiem-tinh', 'Lập lá số'], ['/chiem-tinh/sach', 'Tài liệu'], ['/chiem-tinh/tra-cuu', 'Tra cứu']];

export default function Shell() {
  const { pathname: p } = useLocation();
  const ns = p.startsWith('/nhan-so-hoc'), astro = p.startsWith('/chiem-tinh');
  const wide = p.startsWith('/tu-vi/la-so') || p.startsWith('/tu-vi/profile') || p.startsWith('/nhan-so-hoc/xem') || p.startsWith('/nhan-so-hoc/profile');
  const people = useQuery({ queryKey: ['subjects'], queryFn: api.subjects, staleTime: 60_000, retry: false });
  const on = (b: boolean) => (b ? 'on' : '');
  const exact = (to: string) => p === to;
  const links = astro ? ASTRO_LINKS : ns ? NS_LINKS : TUVI_LINKS;
  const home = astro ? '/chiem-tinh' : ns ? '/nhan-so-hoc' : '/tu-vi';
  const section = astro ? 'Chiêm tinh' : ns ? 'Nhân số học' : 'Tử vi';
  const dot = astro ? INK.astrology : ns ? INK.numerology : 'var(--mystic)';
  /* a chart read from a link counts as the chart being set up */
  const isOn = (to: string) => (to === home ? exact(to) || (astro && p === '/chiem-tinh/xem') : p.startsWith(to));
  /* nhân số học and chiêm tinh: the profiles kept */
  const saved = ns || astro
    ? (people.data ?? []).flatMap(s => s.profiles.filter(x => x.discipline === (astro ? 'astrology' : 'numerology')).map(x => ({ s, x })))
    : [];
  const base = astro ? '/chiem-tinh' : '/nhan-so-hoc';
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
      {(p.startsWith('/tu-vi') || ns || astro) && !wide && (
        <nav className="mnav" aria-label={section}>{links.map(([to, label]) => <Link key={to} to={to} className={on(isOn(to))}>{label}</Link>)}</nav>
      )}
      <div className={`frame ${wide ? 'wide' : ''}`}>
        <aside className="side">
          <h4>{section}</h4>
          {links.map(([to, label]) => <Link key={to} to={to} className={on(isOn(to))}><span className="dot" style={{ ['--c' as string]: dot }} />{label}</Link>)}
          {ns || astro ? <>
            {saved.length > 0 && <h4>Đã lưu</h4>}
            {saved.slice(0, 14).map(({ s, x }) => (
              <Link key={x.id} to={`${base}/profile/${x.id}`} className={on(p === `${base}/profile/${x.id}`)}>{(ns ? x.name : null) ?? s.displayName}<small>{x.label === 'ví dụ trong sách' ? 'ví dụ' : x.label ?? ''}</small></Link>
            ))}
            {saved.length > 14 && <Link to={`${base}#da-luu`}>Tất cả…</Link>}
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
