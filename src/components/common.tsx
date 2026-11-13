import { Button, DataTableSkeleton, Tag, Tooltip } from '@carbon/react';
import { Renew } from '@carbon/icons-react';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { Case } from '../domain/types';
import { stageDef } from '../domain/rules';
import { useStore } from '../state/store';

/** Disabled control with a tooltip giving the reason. Renders children untouched when allowed. */
export function Gate({ reason, children, align = 'bottom' }: { reason: string | null; children: ReactElement; align?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!reason) return children;
  return (
    <Tooltip label={reason} align={align} autoAlign>
      <span className="gate" tabIndex={0} aria-label={reason}>
        {children}
      </span>
    </Tooltip>
  );
}

export function StageTag({ c, size = 'sm' }: { c: Pick<Case, 'bank' | 'stage'>; size?: 'sm' | 'md' }) {
  const d = stageDef(c.bank, c.stage);
  return (
    <Tag type={d.color} size={size} className="stage-tag">
      {d.label}
    </Tag>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </div>
  );
}

export type ListStatus = 'loading' | 'error' | 'ready';

/**
 * Simulated fetch. Shows a skeleton when `key` changes (filters, page, refresh),
 * then ready, unless the dev toggle in the role switcher forces loading, empty or error.
 */
export function useListStatus(key: string) {
  const mode = useStore((s) => s.listMode);
  const nonce = useStore((s) => s.refreshNonce);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<ListStatus>('loading');
  useEffect(() => {
    setStatus('loading');
    if (mode === 'loading') return;
    const t = setTimeout(() => setStatus(mode === 'error' ? 'error' : 'ready'), 280);
    return () => clearTimeout(t);
  }, [key, mode, nonce, retry]);
  return { status, forceEmpty: mode === 'empty', retry: () => setRetry((r) => r + 1) };
}

export function ListError({ onRetry, what = 'cases' }: { onRetry: () => void; what?: string }) {
  return (
    <div className="list-error" role="alert">
      <div>
        <strong>Couldn't load {what}.</strong>
        <p className="muted">The server did not respond. Nothing has changed on these {what}.</p>
      </div>
      <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function ListEmpty({ text }: { text: string }) {
  return <div className="list-message">{text}</div>;
}

export function ListSkeleton({ columns = 6, rows = 8 }: { columns?: number; rows?: number }) {
  return <DataTableSkeleton columnCount={columns} rowCount={rows} showHeader={false} showToolbar={false} />;
}

/** Wraps a list body with loading / error / empty states. */
export function ListStates({
  status,
  isEmpty,
  emptyText,
  onRetry,
  columns,
  what,
  children,
}: {
  status: ListStatus;
  isEmpty: boolean;
  emptyText: string;
  onRetry: () => void;
  columns?: number;
  what?: string;
  children: ReactNode;
}) {
  if (status === 'loading') return <ListSkeleton columns={columns} />;
  if (status === 'error') return <ListError onRetry={onRetry} what={what} />;
  if (isEmpty) return <ListEmpty text={emptyText} />;
  return <>{children}</>;
}

/**
 * Plain tab row. Carbon's Tabs render a hidden "Remove … tab" button inside every tab,
 * which screen readers announce even when tabs can't be removed; these are plain tabs.
 */
export function PlainTabs({ label, tabs, selected, onChange }: { label: string; tabs: ReactNode[]; selected: number; onChange: (i: number) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const go = (i: number) => {
    onChange(i);
    refs.current[i]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="plain-tabs">
      {tabs.map((t, i) => (
        <button
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={i === selected}
          tabIndex={i === selected ? 0 : -1}
          className={`plain-tab${i === selected ? ' is-selected' : ''}`}
          onClick={() => onChange(i)}
          onKeyDown={(e) => {
            const n = tabs.length;
            if (e.key === 'ArrowRight') go((i + 1) % n);
            else if (e.key === 'ArrowLeft') go((i - 1 + n) % n);
            else if (e.key === 'Home') go(0);
            else if (e.key === 'End') go(n - 1);
            else return;
            e.preventDefault();
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
