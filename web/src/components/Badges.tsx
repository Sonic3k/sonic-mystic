/* A person's key figure in each room, drawn the way that room draws it (see lib/badges). */
import { Link } from 'react-router';
import { BRANCHES, LEVEL_MARK, LEVEL_NAME } from '@mystic/engine/tuvi';
import { SIGN } from '@mystic/engine/astrology';
import type { AstroBadge, NumBadge, TuviBadge } from '../lib/badges';

const isMaster = (n: number) => n === 11 || n === 22;

export function TuviBadgeView({ b, to }: { b: TuviBadge; to: string }) {
  return (
    <Link className="bdg bdg-tv" to={to} onClick={e => e.stopPropagation()} title={`Cung Mệnh ở ${BRANCHES[b.branch]}`}>
      <span className="seal-s">命</span>
      <span>{b.stars.length ? b.stars.map((s, i) => (
        <span key={s.name}>{i ? ', ' : ''}{s.name}{s.level && <i className={`lvb ${s.level}`} title={LEVEL_NAME[s.level]}>{LEVEL_MARK[s.level]}</i>}</span>
      )) : <em>vô chính diệu</em>} · {BRANCHES[b.branch]}</span>
    </Link>
  );
}

export function AstroBadgeView({ b, to }: { b: AstroBadge; to: string }) {
  const sg = (c: keyof typeof SIGN) => <span className={`sym sg ${SIGN[c].element}`} title={SIGN[c].name}>{SIGN[c].glyph}︎</span>;
  return (
    <Link className="bdg bdg-as" to={to} onClick={e => e.stopPropagation()}
      title={[`Mặt Trời ở ${SIGN[b.sun].name}`, b.moon ? `Mặt Trăng ở ${SIGN[b.moon].name}` : '', b.asc ? `cung Mọc ${SIGN[b.asc].name}` : ''].filter(Boolean).join(', ')}>
      <i><span className="sym">☉︎</span>{sg(b.sun)}</i>
      {b.moon && <i><span className="sym">☽︎</span>{sg(b.moon)}</i>}
      {b.asc && <i><span className="ac">AC</span>{sg(b.asc)}</i>}
    </Link>
  );
}

export function NumBadgeView({ b, to }: { b: NumBadge; to: string }) {
  return (
    <Link className="bdg bdg-ns" to={to} onClick={e => e.stopPropagation()} title={`Con số chủ đạo ${b.ruling === 22 ? '22/4' : b.ruling}, con số ngày sinh ${b.birthday === 22 ? '22/4' : b.birthday}`}>
      <span className={`shape circle${isMaster(b.ruling) ? ' master' : ''}`}>{b.ruling}</span><span className="shape square">{b.birthday}</span>
    </Link>
  );
}
