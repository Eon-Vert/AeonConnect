import {
  Button,
  Checkbox,
  DatePicker,
  DatePickerInput,
  DismissibleTag,
  Dropdown,
  IconButton,
  Search,
  Tab,
  TabList,
  Tabs,
} from '@carbon/react';
import { Add, ChevronDown, Renew, Settings } from '@carbon/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { BucketId, Case } from '../domain/types';
import {
  BUCKETS,
  BUCKET_DIVIDER_BEFORE,
  bucketLabel,
  bucketOf,
  bucketOpenFor,
  canAddLeads,
  canSeeArchived,
  MSG,
} from '../domain/rules';
import { DATE_PRESETS, presetLabel, type DatePreset } from '../domain/time';
import {
  activeFilterCount,
  baseFilter,
  bucketFilter,
  DEFAULTS,
  drillLabel,
  parseQuery,
  SORTS,
  sortCases,
  toSearch,
  type PipelineQuery,
  type SortId,
} from '../domain/pipelineQuery';
import { OFFICERS } from '../data/mock';
import { useStore } from '../state/store';
import { CaseTable } from '../components/CaseTable';
import { Gate, ListStates, PageHeader, useListStatus } from '../components/common';
import { ReassignDialog } from '../components/dialogs';

const BANK_ITEMS = [
  { id: 'MAWARID', label: 'Mawarid' },
  { id: 'DIB', label: 'DIB' },
  { id: 'ALL', label: 'All banks' },
];
const OFFICER_ITEMS = [{ id: '', label: 'All officers' }, ...OFFICERS.map((o) => ({ id: o.id, label: `${o.id} · ${o.name}` }))];

export function Pipeline() {
  const [sp, setSp] = useSearchParams();
  const q = parseQuery(sp);
  const role = useStore((s) => s.role);
  const cases = useStore((s) => s.cases);
  const refresh = useStore((s) => s.refresh);
  const reassign = useStore((s) => s.reassign);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [showQualifyCols, setShowQualifyCols] = useState(true);
  const [reassignOpen, setReassignOpen] = useState(false);

  const update = (patch: Partial<PipelineQuery>) => setSp(new URLSearchParams(toSearch({ ...q, ...patch }).slice(1)), { replace: true });
  const filterKey = sp.toString();
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [filterKey]);
  // archived is Sales Manager only
  useEffect(() => {
    if (q.view === 'archived' && !canSeeArchived(role)) update({ view: 'all' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const { status, forceEmpty, retry } = useListStatus(`${filterKey}|${page}|${pageSize}`);

  const base = useMemo(() => baseFilter(cases, q), [cases, filterKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => {
    const m = new Map<BucketId, number>();
    for (const c of base) m.set(bucketOf(c), (m.get(bucketOf(c)) ?? 0) + 1);
    return m;
  }, [base]);
  const rows = useMemo(() => (forceEmpty ? [] : sortCases(bucketFilter(base, q.bucket), q.sort)), [base, q.bucket, q.sort, forceEmpty]);

  const nFilters = activeFilterCount(q);
  const drill = drillLabel(q);
  const addLeads = canAddLeads(role);
  const qualifyCols = q.bucket === 'to_qualify';
  const closed = q.bucket === 'closed';
  const readOnly = (c: Case) => !bucketOpenFor(role, bucketOf(c));
  const selectable = closed && role === 'SM' ? (c: Case) => c.stage === 'dropped' : undefined;

  return (
    <div className="page">
      <PageHeader
        title="Pipeline"
        subtitle="Every case for Mawarid. Open any row to reply, move or decide."
        right={
          <>
            {nFilters > 0 && (
              <Button kind="ghost" size="md" onClick={() => setSp(new URLSearchParams(q.view === 'archived' ? 'view=archived' : ''), { replace: true })}>
                Clear filters ({nFilters})
              </Button>
            )}
            <IconButton kind="ghost" label="Refresh" align="bottom" onClick={refresh}>
              <Renew />
            </IconButton>
            <Gate reason={addLeads.reason}>
              <Button kind="secondary" renderIcon={Add} disabled={!!addLeads.reason} onClick={() => navigate('/add-leads')}>
                Add Leads
              </Button>
            </Gate>
          </>
        }
      />

      {canSeeArchived(role) && (
        <Tabs selectedIndex={q.view === 'archived' ? 1 : 0} onChange={({ selectedIndex }: { selectedIndex: number }) => update({ view: selectedIndex === 1 ? 'archived' : 'all', bucket: 'all' })}>
          <TabList aria-label="Pipeline views" style={{ marginBottom: '1.5rem' }}>
            <Tab>All cases</Tab>
            <Tab>Archived</Tab>
          </TabList>
        </Tabs>
      )}

      <div className="filter-row">
        <Dropdown
          id="bank-team"
          titleText="Bank team"
          label="Bank team"
          size="md"
          items={BANK_ITEMS}
          itemToString={(i) => i?.label ?? ''}
          selectedItem={BANK_ITEMS.find((b) => b.id === q.bank)}
          onChange={({ selectedItem }) => selectedItem && update({ bank: selectedItem.id as PipelineQuery['bank'] })}
        />
        <Search
          id="pipeline-search"
          labelText="Search"
          placeholder="Search name, company or application number"
          size="md"
          value={q.q}
          onChange={(e) => update({ q: (e.target as HTMLInputElement).value })}
        />
        <Dropdown
          id="officer"
          titleText="Officer"
          label="All officers"
          size="md"
          items={OFFICER_ITEMS}
          itemToString={(i) => i?.label ?? ''}
          selectedItem={OFFICER_ITEMS.find((o) => o.id === q.officer)}
          onChange={({ selectedItem }) => update({ officer: selectedItem?.id ?? '' })}
        />
        <DateFilter q={q} update={update} />
        <Dropdown
          id="sort"
          titleText="Sort"
          label="Sort"
          size="md"
          items={SORTS}
          itemToString={(i) => i?.label ?? ''}
          selectedItem={SORTS.find((s) => s.id === q.sort)}
          onChange={({ selectedItem }) => selectedItem && update({ sort: selectedItem.id as SortId })}
        />
      </div>

      {drill && (
        <div className="drill-tags">
          <DismissibleTag type="blue" text={`Showing: ${drill}`} onClose={() => update({ company: false, reached: undefined, stage: undefined, journeyStarted: false, untouched72: false })} />
        </div>
      )}

      <BucketChips role={role} counts={counts} total={base.length} bucket={q.bucket} onPick={(b) => update({ bucket: b })} />

      <div className="count-line">
        Showing {rows.length} {rows.length === 1 ? 'case' : 'cases'} · captured {presetLabel(q.date)} · {SORTS.find((s) => s.id === q.sort)!.label}
        {q.bank === 'ALL' ? ' · all banks' : ''}
      </div>

      {qualifyCols && (
        <div className="table-note">
          {showQualifyCols ? 'Showing qualify columns' : 'Qualify columns hidden'}
          <ColumnSettings checked={showQualifyCols} onChange={setShowQualifyCols} />
        </div>
      )}
      {closed && (
        <div className="table-note" style={{ justifyContent: 'space-between' }}>
          <span>{role === 'SM' ? 'Tick dropped leads to reassign them in bulk. Declined cases are reassigned one at a time from their panel.' : ''}</span>
          <Gate reason={role !== 'SM' ? MSG.reassign : selected.length === 0 ? 'Select dropped leads first' : null}>
            <Button size="sm" kind="primary" disabled={role !== 'SM' || selected.length === 0} onClick={() => setReassignOpen(true)}>
              Reassign{selected.length ? ` (${selected.length})` : ''}
            </Button>
          </Gate>
        </div>
      )}

      <ListStates status={status} isEmpty={rows.length === 0} emptyText={q.view === 'archived' ? 'No archived cases match these filters.' : 'No cases match these filters.'} onRetry={retry} columns={7}>
        <CaseTable
          rows={rows}
          role={role}
          columns={{ bank: q.bank === 'ALL', qualify: qualifyCols && showQualifyCols, extra: true }}
          readOnly={readOnly}
          selectable={selectable}
          selected={selected}
          onSelect={setSelected}
          page={page}
          pageSize={pageSize}
          onPage={(p, s) => {
            setPage(p);
            setPageSize(s);
          }}
          ariaLabel="Pipeline cases"
        />
      </ListStates>

      {reassignOpen && (
        <ReassignDialog
          open
          cases={cases.filter((c) => selected.includes(c.id))}
          onClose={() => setReassignOpen(false)}
          onSubmit={(o) => {
            reassign(selected, o);
            setSelected([]);
            setReassignOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DateFilter({ q, update }: { q: PipelineQuery; update: (p: Partial<PipelineQuery>) => void }) {
  return (
    <>
      <Dropdown
        id="date"
        titleText="Captured"
        label="Date"
        size="md"
        items={DATE_PRESETS}
        itemToString={(i) => i?.label ?? ''}
        selectedItem={DATE_PRESETS.find((d) => d.id === q.date)}
        onChange={({ selectedItem }) => selectedItem && update({ date: selectedItem.id as DatePreset })}
      />
      {q.date === 'custom' && (
        <DatePicker
          datePickerType="range"
          dateFormat="d/m/Y"
          value={q.from && q.to ? [new Date(q.from), new Date(q.to)] : undefined}
          onChange={(dates: Date[]) => {
            if (dates.length === 2) update({ from: dates[0].getTime(), to: dates[1].getTime() });
          }}
        >
          <DatePickerInput id="date-from" labelText="From" placeholder="dd/mm/yyyy" size="md" />
          <DatePickerInput id="date-to" labelText="To" placeholder="dd/mm/yyyy" size="md" />
        </DatePicker>
      )}
    </>
  );
}

export function BucketChips({
  role,
  counts,
  total,
  bucket,
  onPick,
}: {
  role: ReturnType<typeof useStore.getState>['role'];
  counts: Map<BucketId, number>;
  total: number;
  bucket: BucketId | 'all';
  onPick: (b: BucketId | 'all') => void;
}) {
  const open = BUCKETS.filter((b) => bucketOpenFor(role, b.id));
  const hidden = BUCKETS.filter((b) => !bucketOpenFor(role, b.id));
  const hiddenCount = hidden.reduce((s, b) => s + (counts.get(b.id) ?? 0), 0);
  const hiddenSelected = hidden.some((b) => b.id === bucket);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menu]);

  const chip = (id: BucketId | 'all', label: string, n: number) => (
    <button key={id} className={`chip${bucket === id ? ' is-selected' : ''}`} aria-pressed={bucket === id} onClick={() => onPick(id)}>
      {label} <span className="chip-count">{n}</span>
    </button>
  );

  return (
    <div className="chip-row" role="group" aria-label="Filter by stage bucket">
      {chip('all', 'All stages', total)}
      {open.map((b) => (
        <span key={b.id} style={{ display: 'contents' }}>
          {b.id === BUCKET_DIVIDER_BEFORE && open.length === BUCKETS.length && <span className="chip-divider" aria-hidden />}
          {chip(b.id, b.label, counts.get(b.id) ?? 0)}
        </span>
      ))}
      {hidden.length > 0 && (
        <div ref={ref} style={{ position: 'relative' }}>
          <button className={`chip${hiddenSelected ? ' is-selected' : ''}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            {hiddenSelected ? `Other stages: ${bucketLabel(bucket as BucketId)}` : 'Other stages'} <span className="chip-count">{hiddenSelected ? counts.get(bucket as BucketId) ?? 0 : hiddenCount}</span>
            <ChevronDown size={14} />
          </button>
          {menu && (
            <ul role="menu" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 30, minWidth: '14rem', background: 'var(--cds-layer-01)', boxShadow: '0 2px 8px rgba(0,0,0,.25)', padding: '0.25rem 0' }}>
              {hidden.map((b) => (
                <li key={b.id}>
                  <button
                    role="menuitem"
                    className="cds--menu-item"
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: '0.625rem 1rem', background: bucket === b.id ? 'var(--cds-layer-selected-01)' : 'none', border: 0, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--cds-text-primary)' }}
                    onClick={() => {
                      onPick(b.id);
                      setMenu(false);
                    }}
                  >
                    {b.label}
                    <span className="muted">{counts.get(b.id) ?? 0}</span>
                  </button>
                </li>
              ))}
              <li className="muted" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                Read-only for your role
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ColumnSettings({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <IconButton kind="ghost" size="sm" label="Column settings" align="right" onClick={() => setOpen((o) => !o)}>
        <Settings />
      </IconButton>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 30, background: 'var(--cds-layer-01)', boxShadow: '0 2px 8px rgba(0,0,0,.25)', padding: '0.75rem 1rem', width: '15rem' }}>
          <Checkbox id="qual-cols" labelText="Show Salary and Consent" checked={checked} onChange={(_, { checked: v }) => onChange(v)} />
        </div>
      )}
    </span>
  );
}

export { DEFAULTS };
