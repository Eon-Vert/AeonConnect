import {
  Checkbox,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tooltip,
} from '@carbon/react';
import { Enterprise, Money, Purchase, User, UserMultiple } from '@carbon/icons-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Case, Role } from '../domain/types';
import { BANKS, ageLabel, productLabel, canSeeSalary, durationLabel, holdLabel, holdTagColor, lateBy, withLabel } from '../domain/rules';
import { MAIN_COLS, columnLayout, extraLabel, type ColId, type ExtraCol } from '../domain/columns';
import { NOW, fmtDateTime, fmtShortDate } from '../domain/time';
import { maskPhone } from '../data/mock';
import { StageTag } from './common';
import { useUi } from '../state/ui';

/** simple column switches for tables that don't pass a full layout (the My Day queues) */
export interface Columns {
  bank?: boolean;
  qualify?: boolean;
  checkpoint?: boolean;
}

interface Props {
  rows: Case[];
  role: Role;
  columns?: Columns;
  /** rows that may be ticked for bulk actions */
  selectable?: (c: Case) => boolean;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  readOnly?: (c: Case) => boolean;
  highlightId?: string | null;
  page?: number;
  pageSize?: number;
  onPage?: (page: number, pageSize: number) => void;
  ariaLabel: string;
  /** an extra column placed after Name, e.g. "Why not ready" */
  customColumn?: { header: string; render: (c: Case) => ReactNode };
  /** full column order (Pipeline); otherwise built from `columns` with no extra columns */
  layout?: ColId[];
}

export function CaseTable({
  rows,
  role,
  columns = {},
  selectable,
  selected = [],
  onSelect,
  readOnly,
  highlightId,
  page: pageProp,
  pageSize: pageSizeProp,
  onPage,
  ariaLabel,
  customColumn,
  layout: layoutProp,
}: Props) {
  const openCase = useUi((s) => s.openCase);
  const panelId = useUi((s) => s.panelCaseId);
  const [pageLocal, setPageLocal] = useState(1);
  const [sizeLocal, setSizeLocal] = useState(25);
  const page = pageProp ?? pageLocal;
  const pageSize = pageSizeProp ?? sizeLocal;
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);
  const anySelectable = !!selectable && rows.some(selectable);
  const cols = (
    layoutProp ??
    columnLayout({ custom: !!customColumn, bank: columns.bank, checkpoint: columns.checkpoint, promote: columns.qualify ? 'qualify' : null })
  ).filter((c) => c !== 'select' && (c !== 'custom' || customColumn));

  const head = (id: ColId): [string, string] => {
    switch (id) {
      case 'custom':
        return [customColumn!.header, 'col-custom'];
      case 'name':
      case 'product':
      case 'with':
      case 'stage':
      case 'query':
      case 'updated':
        return [MAIN_COLS.find((m) => m.id === id)!.label, `col-${id}`];
      case 'bank':
        return ['Bank', 'col-x'];
      case 'checkpoint':
        return ['Checkpoint', 'col-x'];
      default:
        return [extraLabel(id as ExtraCol), 'col-x'];
    }
  };
  const cell = (id: ColId, c: Case): ReactNode => {
    switch (id) {
      case 'name':
        return <NameCell c={c} />;
      case 'custom':
        return customColumn!.render(c);
      case 'bank':
        return BANKS[c.bank].label;
      // restricted for roles that can't qualify, wherever the column sits
      case 'salary':
        return canSeeSalary(role) ? `AED ${c.salary.toLocaleString('en-US')}` : <span className="restricted">Restricted</span>;
      case 'consent':
        return c.consent ? 'Given' : <span className="late">Missing</span>;
      case 'product':
        return <ProductCell c={c} />;
      case 'with':
        return withLabel(c);
      case 'checkpoint':
        return c.stage === 'pre_compliance' ? 'Pre-compliance' : c.stage === 'post_compliance' ? 'Post-compliance' : '—';
      case 'stage':
        return <StageCell c={c} />;
      case 'query':
        return <QueryCell c={c} />;
      case 'updated':
        return fmtDateTime(c.updatedAt);
      case 'officer':
        return c.officerId;
      case 'qualifiedBy':
        return c.qualifiedBy ?? '—';
      case 'journeyStart':
        return c.journeyStartAt ? fmtShortDate(c.journeyStartAt) : '—';
      default:
        return null;
    }
  };

  useEffect(() => {
    // keep the page in range when the list shrinks
    const maxPage = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > maxPage) setPage(maxPage, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  function setPage(p: number, s: number) {
    if (onPage) onPage(p, s);
    else {
      setPageLocal(p);
      setSizeLocal(s);
    }
    setActive(-1);
  }

  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, button, [role="checkbox"]') && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(pageRows.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      openCase(pageRows[active].id);
    }
  }

  useEffect(() => {
    if (active < 0) return;
    wrapRef.current?.querySelector(`tr[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const toggle = (id: string) => onSelect?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const selectableOnPage = selectable ? pageRows.filter(selectable).map((c) => c.id) : [];
  const allOnPage = selectableOnPage.length > 0 && selectableOnPage.every((id) => selected.includes(id));

  return (
    <>
      <div className="case-table-wrap" ref={wrapRef} tabIndex={0} onKeyDown={onKey} aria-label={`${ariaLabel}. Use up and down arrows to move, Enter to open.`}>
        <Table size="lg" className="case-table" aria-label={ariaLabel} useZebraStyles={false}>
          <TableHead>
            <TableRow>
              {anySelectable && (
                <TableHeader className="col-select">
                  <Checkbox
                    id={`${ariaLabel}-all`}
                    labelText="Select all dropped leads on this page"
                    hideLabel
                    checked={allOnPage}
                    onChange={() =>
                      onSelect?.(allOnPage ? selected.filter((id) => !selectableOnPage.includes(id)) : [...new Set([...selected, ...selectableOnPage])])
                    }
                  />
                </TableHeader>
              )}
              {cols.map((id) => {
                const [label, cls] = head(id);
                return (
                  <TableHeader key={id} className={cls} data-col={id}>
                    {label}
                  </TableHeader>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((c, i) => {
              const ro = readOnly?.(c);
              const cls = [
                c.id === panelId || i === active ? 'is-active' : '',
                c.id === highlightId ? 'is-highlight' : '',
                ro ? 'is-readonly' : '',
              ].join(' ');
              return (
                <TableRow
                  key={c.id}
                  data-index={i}
                  data-case-id={c.id}
                  className={cls}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.cds--checkbox-wrapper, .no-row-click')) return;
                    setActive(i);
                    openCase(c.id);
                  }}
                >
                  {anySelectable && (
                    <TableCell className="no-row-click">
                      {selectable!(c) ? (
                        <Checkbox id={`sel-${c.id}`} labelText={`Select ${c.name}`} hideLabel checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                      ) : null}
                    </TableCell>
                  )}
                  {cols.map((id) => (
                    <TableCell key={id} data-col={id}>
                      {cell(id, c)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        pageSizes={[25, 50, 100]}
        totalItems={rows.length}
        onChange={({ page: p, pageSize: s }: { page: number; pageSize: number }) => setPage(s !== pageSize ? 1 : p, s)}
        itemsPerPageText="Rows per page:"
      />
    </>
  );
}

export function JourneyIcon({ c }: { c: Case }) {
  if (c.journey === 'none') return null;
  const self = c.journey === 'self';
  return (
    <Tooltip label={self ? 'Self journey' : 'Assisted journey'} align="top">
      <span className="icon-text" tabIndex={-1}>
        {self ? <User size={14} aria-label="Self journey" /> : <UserMultiple size={14} aria-label="Assisted journey" />}
        {self ? 'Self' : 'Assisted'}
      </span>
    </Tooltip>
  );
}

function NameCell({ c }: { c: Case }) {
  return (
    <>
      <div className="cell-name">
        {c.name}
        {c.companyProvided && (
          <Tag size="sm" type="outline" renderIcon={Enterprise}>
            Company
          </Tag>
        )}
        <JourneyIcon c={c} />
      </div>
      <div className="cell-sub">
        Case {c.id} · {maskPhone(c.phone)}
      </div>
    </>
  );
}

function ProductCell({ c }: { c: Case }) {
  return (
    <span className="icon-text" style={{ color: 'inherit', fontSize: '0.875rem' }}>
      {c.product === 'card' ? <Purchase size={16} aria-hidden /> : <Money size={16} aria-hidden />}
      {productLabel(c.product)}
    </span>
  );
}

export function StageCell({ c }: { c: Case }) {
  const late = lateBy(c);
  return (
    <>
      <StageTag c={c} />
      <div className="cell-sub">since {fmtShortDate(c.stageSince)}</div>
      {late > 0 && <div className="cell-sub late">Late by {durationLabel(late)}</div>}
      {c.stage === 'pre_compliance' && c.checks.pre && <div className="cell-sub">Check passed</div>}
      {c.stage === 'post_compliance' && c.checks.post && <div className="cell-sub">Check passed</div>}
      {c.hold && (
        <Tag size="sm" type={holdTagColor(c.hold.kind)} style={{ marginTop: 4 }}>
          On hold · {holdLabel(c.hold.kind).toLowerCase()}
        </Tag>
      )}
    </>
  );
}

function QueryCell({ c }: { c: Case }) {
  const q = c.query;
  if (!q) return null;
  return (
    <>
      <div className="query-preview">{q.messages[0].text}</div>
      <div className="cell-sub">
        {ageLabel(NOW - q.raisedAt)} · {q.raisedBy}
      </div>
      <Tag size="sm" type={q.status === 'open' ? 'red' : 'blue'} style={{ marginTop: 4 }}>
        {q.status === 'open' ? 'Open' : 'Replied · waiting to close'}
      </Tag>
    </>
  );
}
