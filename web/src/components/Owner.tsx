/* The owner's parts (people, saved charts, AI) are open unless the API was given an ADMIN_TOKEN; then this asks for
   it once and keeps it in this browser. */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, adminToken } from '../api';

export const needsToken = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 403);
export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi');

export function TokenBox() {
  const [v, setV] = useState('');
  const qc = useQueryClient();
  return (
    <form className="card tv-token" onSubmit={e => { e.preventDefault(); adminToken.set(v.trim() || null); void qc.invalidateQueries(); }}>
      <b>Phần này của chủ nhà</b>
      <p>Nhập mã chủ nhà để mở. Mã chỉ lưu trên trình duyệt này.</p>
      <div className="tv-row">
        <input type="password" value={v} onChange={e => setV(e.target.value)} autoComplete="current-password" aria-label="Mã chủ nhà" />
        <button className="tv-btn son" type="submit" disabled={!v.trim()}>Mở</button>
      </div>
    </form>
  );
}

/** a failed query: the token box when the API wants the owner, otherwise the message */
export function Failed({ error, children }: { error: unknown; children?: React.ReactNode }) {
  if (needsToken(error)) return <TokenBox />;
  return <div className="card empty">{errorText(error)}{children && <> {children}</>}</div>;
}
