/* A bottom sheet (a centred dialog on a wide screen). Escape or a tap outside closes it; the page behind stays where
   it was — it does not scroll while the sheet is open, and focusing the first field does not move it.
   It is drawn into <body>: a page enters with a transform animation, and a fixed box inside a transformed one would
   be placed against the page instead of the window. */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function Sheet({ title, sub, onClose, children, className = 'tv', closable = false }: {
  title: string; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode;
  /** the section's own classes (its colours): 'tv' for tử vi, 'tv ns' for nhân số học */
  className?: string;
  /** a «Đóng» button in the head, for sheets whose foot has only the one action */
  closable?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', esc);
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = before; };
  }, []);
  return createPortal(
    <div className="sheet-wrap" onClick={e => { if (e.target === e.currentTarget) close.current(); }}>
      <div ref={box} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head"><div><b>{title}</b>{sub && <small>{sub}</small>}</div>
          {closable && <button type="button" className="tv-btn ghost" onClick={() => close.current()} aria-label="Đóng">Đóng</button>}</div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
