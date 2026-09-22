import type { Dispatch, ReactNode, SetStateAction } from "react";
import { badgeTone, pretty } from "../utils/presentation.js";
import { StatusIcon } from "./status-icon.js";

export function Pagination({ page, setPage, pageSize, total, totalPages, label }: {
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  total: number;
  totalPages: number;
  label: string;
}) {
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <nav className="pagination" aria-label={`${pretty(label)} pagination`}>
      <span>{first}–{last} of {total} {label}</span>
      <div>
        <button aria-label={`Previous ${label} page`} disabled={page === 1} onClick={() => setPage((current) => current - 1)}>←</button>
        <strong>Page {page} of {totalPages}</strong>
        <button aria-label={`Next ${label} page`} disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>→</button>
      </div>
    </nav>
  );
}

export function Metric({ label, value, note, tone, onClick }: { label: string; value: number; note: string; tone: string; onClick?: () => void }) {
  const content = <><span>{label}</span><strong>{value}</strong><small>{note}</small><i aria-hidden="true">→</i></>;
  return onClick
    ? <button className={`metric ${tone} interactive`} onClick={onClick}>{content}</button>
    : <article className={`metric ${tone}`}>{content}</article>;
}

export function Panel({ title, children, action, onAction }: { title: string; children: ReactNode; action?: string; onAction?: () => void }) {
  return <article className="panel"><div className="panel-head"><h2>{title}</h2>{action && <button onClick={onAction}>{action} →</button>}</div>{children}</article>;
}

export function Badge({ text }: { text: string }) {
  return <span className={`badge ${badgeTone(text)}`}>{text}</span>;
}

export function Empty({ title, copy }: { title: string; copy: string }) {
  return <div className="empty"><StatusIcon state="empty" /><strong>{title}</strong><p>{copy}</p></div>;
}

export function Guard({ title, copy }: { title: string; copy: string }) {
  return <div><span>✓</span><strong>{title}</strong><p>{copy}</p></div>;
}
