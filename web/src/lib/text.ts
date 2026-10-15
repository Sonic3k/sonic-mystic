import { useEffect } from 'react';

/** Accent-insensitive matching: "thien phu" finds "Thiên Phủ". */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** sets the tab title while a page is open */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Huyền học` : 'Huyền học';
    return () => { document.title = 'Huyền học'; };
  }, [title]);
}

export const dateVi = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'numeric', year: 'numeric' });
