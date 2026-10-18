/* The lá số the classic way: twelve palaces around a centre, Tỵ at the top left, Dần at the bottom left, printed like
   a woodblock sheet. Each palace: its name, the year's hạn and Tuần, Triệt on it, the chính tinh with their degree of
   brightness and Hóa, the other stars good beside bad, the rings and the đại hạn, and along its foot how many of
   grandma's sentences on it are good or bad. Beside the panel it is read with, it shrinks to stay in view. */
import { useLayoutEffect, useRef } from 'react';
import { BRANCHES, LEVEL_MARK, LEVEL_NAME, STEMS, khongWeight, type PlacedStar } from '@mystic/engine/tuvi';
import type { TuViReadingDto } from '@mystic/engine/api';
import { ChuSeal, HOA_IDS, HOA_SHORT, ROLE_HZ } from './Reading';

/** branch → [row, column] of the 4×4 board */
export const POS: Record<number, [number, number]> = { 5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4], 4: [2, 1], 9: [2, 4], 3: [3, 1], 10: [3, 4], 2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4] };
export const MONTH = ['', 'Giêng', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'Tám', 'Chín', 'Mười', 'Mười một', 'Chạp'];
const pad = (n: number) => String(n).padStart(2, '0');
export const triOf = (b: number) => [b, (b + 4) % 12, (b + 8) % 12, (b + 6) % 12];
export const Lv = ({ l }: { l?: PlacedStar['level'] }) => (l ? <i className={`lv ${l}`} title={LEVEL_NAME[l]}>{LEVEL_MARK[l]}</i> : null);
export type TvTab = 'cung' | 'luan' | 'han';

export default function Board({ r, name, sel, tab, spot, onSelect }: {
  r: TuViReadingDto; name: string; sel: number; tab: TvTab; spot: number[]; onSelect: (b: number) => void;
}) {
  const chart = r.chart, H = r.han;
  const tri = tab === 'cung' ? triOf(sel) : [];
  const variant = new Set(chart.variantStars);
  const wrap = useRef<HTMLDivElement>(null);
  /* beside the panel (≥ 1180px) the board stays in view while one reads: it shrinks to the window's height, down to
     seven tenths; a window too short for that lets it scroll with the page */
  useLayoutEffect(() => {
    const fit = () => {
      const el = wrap.current;
      if (!el) return;
      el.style.zoom = '';
      el.classList.remove('static');
      if (window.innerWidth < 1180) return;
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) + 42 + 30;
      const z = Math.min(1, (window.innerHeight - top) / el.offsetHeight);
      if (z < 0.7) el.classList.add('static');
      else if (z < 1) el.style.zoom = z.toFixed(3);
    };
    fit();
    window.addEventListener('resize', fit);
    void document.fonts?.ready.then(fit);
    return () => window.removeEventListener('resize', fit);
  }, [r, tab, sel]);

  const cells = chart.palaces.map(p => {
    const [row, col] = POS[p.branch];
    const main = p.stars.filter(s => s.kind === 'chinh');
    const minor = p.stars.filter(s => s.kind === 'phu' && !s.ring && !HOA_IDS.has(s.id));
    const rings = p.stars.filter(s => s.ring).map(s => s.name);
    const good = [...minor.filter(s => s.tone === 'cat'), ...minor.filter(s => s.tone === 'trung' || !s.tone)];
    const bad = minor.filter(s => s.tone === 'hung');
    const cnt = r.views[p.role]?.counts;
    const neutral = cnt ? Math.max(0, cnt.grandma - cnt.cat - cnt.hung) : 0;
    const tot = cnt ? cnt.cat + cnt.hung + neutral : 0;
    const isDai = H.dai?.branch === p.branch, isTieu = H.tieu.branch === p.branch;
    const rel = tab !== 'cung' || sel === p.branch ? '' : p.branch === (sel + 6) % 12 ? 'xung chiếu' : tri.includes(p.branch) ? 'tam hợp' : '';
    const w = khongWeight(chart, p.branch);
    const cls = ['pc', `c${col}`, `r${row}`, p.branch === chart.menh ? 'menh' : '', p.isThan ? 'than' : '',
      tab === 'cung' && sel === p.branch ? 'sel' : tri.includes(p.branch) ? 'tri' : '', isDai ? 'dai' : '', isTieu ? 'tieu' : '', spot.includes(p.branch) ? 'spot' : ''].filter(Boolean).join(' ');
    const star = (s: PlacedStar) => (
      <span key={s.id} className={[s.tone === 'trung' || !s.tone ? 't' : '', variant.has(s.id) ? 'var' : ''].filter(Boolean).join(' ') || undefined}
        title={variant.has(s.id) ? 'An theo cách của bà; sách phổ thông an khác' : undefined}>
        {s.name}{s.level && <>&nbsp;<small>{LEVEL_MARK[s.level]}</small></>}{s.hoa && ` (${HOA_SHORT[s.hoa]})`}
      </span>
    );
    const flags = <>
      {isDai && <i className="flag dai">Đại hạn {H.dai!.from}–{H.dai!.to}</i>}
      {isTieu && <i className="flag tieu">{H.tieu.dong ? 'Đồng hạn' : 'Tiểu hạn'} {H.year}</i>}
      {p.isThan && <i className="flag than">Thân</i>}
      {rel && <i className="flag tri">{rel}</i>}
      {w.tuan && <i className="flag kv" title={`Tuần, ${w.tuan}/10 phần (theo bà: dương tam thất, âm nhị bát)`}><b>旬</b>Tuần</i>}
      {w.triet && <i className="flag kv" title={`Triệt, ${w.triet}/10 phần (theo bà: dương tam thất, âm nhị bát)`}><b>截</b>Triệt</i>}
    </>;
    const hasFlags = isDai || isTieu || p.isThan || !!rel || !!w.tuan || !!w.triet;
    return (
      <button key={p.branch} type="button" className={cls} style={{ gridRow: row, gridColumn: col }} onClick={() => onSelect(p.branch)}
        aria-label={`Cung ${p.role} tại ${BRANCHES[p.branch]}`} aria-pressed={tab === 'cung' && sel === p.branch}>
        <span className="pc-h"><b className="pc-role">{p.role}</b><i className="pc-hz">{ROLE_HZ[p.role]}</i><span className="pc-cc">{STEMS[p.stem]} {BRANCHES[p.branch]}</span></span>
        {hasFlags && <span className="pc-flags">{flags}</span>}
        <span className="pc-main">{main.length ? main.map(s => (
          <span key={s.id} className="stm">{s.name}<Lv l={s.level} />{s.hoa && <em className={`hoa${s.hoa === 'Hóa Kỵ' ? ' ky' : ''}`}>{HOA_SHORT[s.hoa]}</em>}</span>
        )) : <span className="vcd">vô chính diệu</span>}</span>
        <span className="pc-minor"><span className="g">{good.map(star)}</span><span className="b">{bad.map(star)}</span></span>
        <span className="pc-more">{minor.length ? `+${minor.length} sao` : ''}</span>
        <span className="pc-f"><span className="rings">{rings.join(' · ')}</span><span className="dh">{p.daiHan[0]}–{p.daiHan[1]}</span></span>
        {tot > 0 && cnt && <span className="pc-bal" aria-hidden="true"><i style={{ width: `${(cnt.cat / tot) * 100}%` }} /><u /><b style={{ width: `${(cnt.hung / tot) * 100}%` }} /></span>}
      </button>
    );
  });

  const i = chart.input, lunar = chart.lunar;
  const solar = `${pad(chart.solar[0])}/${pad(chart.solar[1])}/${chart.solar[2]}`;
  const clock = i.calendar === 'solar' ? ` · ${pad(i.hour)}:${pad(i.minute ?? 0)}` : '';
  const sun = chart.solarClock ? ` (giờ mặt trời ${pad(chart.solarClock.hour)}:${pad(chart.solarClock.minute)})` : '';
  const notOurs = [...(chart.options.variant === 'books' ? ['An Hỏa Linh, Tứ Hóa tuổi Canh, Thiên Phúc tuổi Quý theo sách phổ thông.'] : []), ...chart.notes];
  return (
    <div className="tv-boardwrap" ref={wrap}>
      <div className="tv-board" role="grid" aria-label="Lá số tử vi">
        {cells}
        <div className="tv-center">
          <span className="hz">紫微斗數</span>
          <h2>{name || 'Lá số tử vi'}</h2>
          <span className="lunar">{lunar.day} tháng {MONTH[lunar.month]}{lunar.leap ? ' nhuận' : ''} năm {STEMS[chart.stem]} {BRANCHES[chart.branch]}, giờ {BRANCHES[chart.hour]}</span>
          <dl>
            <dt>Dương lịch</dt><dd>{solar}{clock}{sun}</dd>
            <dt>Âm dương</dt><dd>{chart.amDuong}</dd>
            <dt>Bản mệnh</dt><dd>{chart.napAm.name}</dd>
            <dt>Cục</dt><dd>{chart.cuc.name}</dd>
            <dt>Mệnh chủ</dt><dd>{chart.menhChu}</dd>
            <dt>Thân chủ</dt><dd>{chart.thanChu}</dd>
          </dl>
          <span className="yr">Xem năm {H.year} {H.canChi} · {H.age} tuổi</span>
        </div>
      </div>
      <div className="legend">
        <span><i className="d" style={{ background: 'var(--cat)' }} />cát tinh, câu tốt</span>
        <span><i className="d" style={{ background: 'var(--hung)' }} />hung tinh, câu xấu</span>
        <span><i className="d" style={{ background: 'var(--trung)' }} />trung tinh</span>
        <span>{(['M', 'V', 'D', 'B', 'H'] as const).map(l => <Lv key={l} l={l} />)} miếu, vượng, đắc, bình, hãm</span>
        <span><i className="d" style={{ background: 'var(--kim)', borderRadius: 1 }} />hạn năm {H.year}</span>
        <span><i className="flag kv"><b>旬</b>Tuần</i><i className="flag kv"><b>截</b>Triệt</i></span>
        <span className="lg-var">sao an theo cách của bà</span>
        <span>vạch đáy cung: tỉ lệ câu tốt, xấu của bà</span>
      </div>
      {notOurs.length > 0 && <p className="tv-notours"><ChuSeal />Không phải ghi chép của bà: {notOurs.join(' ')}</p>}
    </div>
  );
}
