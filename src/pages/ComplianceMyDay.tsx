import { Dropdown, Tab, TabList, Tabs } from '@carbon/react';
import { useMemo, useState } from 'react';
import type { Case } from '../domain/types';
import { checkpointOf } from '../domain/rules';
import { useStore } from '../state/store';
import { CaseTable } from '../components/CaseTable';
import { ListStates, PageHeader, useListStatus } from '../components/common';

type Opt = { id: string; label: string };
const CHECKPOINTS: Opt[] = [
  { id: '', label: 'All checkpoints' },
  { id: 'pre', label: 'Pre-compliance' },
  { id: 'post', label: 'Post-compliance' },
];
const STATUSES: Opt[] = [
  { id: '', label: 'All statuses' },
  { id: 'to_check', label: 'To check' },
  { id: 'held', label: 'On hold · compliance' },
];
const QUERIES: Opt[] = [
  { id: '', label: 'Any query state' },
  { id: 'open', label: 'Has a query' },
  { id: 'none', label: 'No query' },
];
const PRODUCTS: Opt[] = [
  { id: '', label: 'All products' },
  { id: 'card', label: 'Credit Card' },
  { id: 'loan', label: 'Personal loan' },
];

const isToCheck = (c: Case) => !c.archived && ((c.stage === 'pre_compliance' && !c.checks.pre) || (c.stage === 'post_compliance' && !c.checks.post));
/** checked by compliance and still sitting at that checkpoint, or passed recently */
const isChecked = (c: Case) => !c.archived && !isToCheck(c) && (!!c.checks.pre || !!c.checks.post) && !['booked', 'declined', 'back_out'].includes(c.stage);

export function ComplianceMyDay() {
  const cases = useStore((s) => s.cases);
  const role = useStore((s) => s.role);
  const [tab, setTab] = useState(0);
  const [cp, setCp] = useState('');
  const [st, setSt] = useState('');
  const [qf, setQf] = useState('');
  const [pf, setPf] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { status, forceEmpty, retry } = useListStatus(`co|${tab}|${cp}|${st}|${qf}|${pf}|${page}|${pageSize}`);

  const toCheck = useMemo(() => cases.filter(isToCheck).sort((a, b) => a.stageSince - b.stageSince), [cases]);
  const checked = useMemo(() => cases.filter(isChecked).sort((a, b) => Math.max(b.checks.pre ?? 0, b.checks.post ?? 0) - Math.max(a.checks.pre ?? 0, a.checks.post ?? 0)), [cases]);

  const rows = useMemo(() => {
    if (forceEmpty) return [];
    return (tab === 0 ? toCheck : checked).filter((c) => {
      if (cp && checkpointOf(c) !== cp && !(tab === 1 && ((cp === 'pre' && c.checks.pre && !c.checks.post) || (cp === 'post' && c.checks.post)))) return false;
      if (st === 'held' && c.hold?.kind !== 'compliance') return false;
      if (st === 'to_check' && c.hold?.kind === 'compliance') return false;
      if (qf === 'open' && !c.query) return false;
      if (qf === 'none' && c.query) return false;
      if (pf && c.product !== pf) return false;
      return true;
    });
  }, [tab, toCheck, checked, cp, st, qf, pf, forceEmpty]);

  const dd = (id: string, title: string, items: Opt[], value: string, set: (v: string) => void) => (
    <Dropdown
      id={id}
      titleText={title}
      label={title}
      size="md"
      items={items}
      itemToString={(i) => i?.label ?? ''}
      selectedItem={items.find((i) => i.id === value)}
      onChange={({ selectedItem }) => {
        set(selectedItem?.id ?? '');
        setPage(1);
      }}
    />
  );

  return (
    <div className="page">
      <PageHeader title="My Day" subtitle="Compliance Officer · Mawarid" right={<span className="desk-count">{forceEmpty ? 0 : toCheck.length} to check</span>} />
      <Tabs
        selectedIndex={tab}
        onChange={({ selectedIndex }: { selectedIndex: number }) => {
          setTab(selectedIndex);
          setPage(1);
        }}
      >
        <TabList aria-label="Compliance queues" style={{ marginBottom: '1.5rem' }}>
          <Tab>To check ({forceEmpty ? 0 : toCheck.length})</Tab>
          <Tab>Checked ({forceEmpty ? 0 : checked.length})</Tab>
        </TabList>
      </Tabs>
      <div className="filter-row">
        {dd('cp', 'Checkpoint', CHECKPOINTS, cp, setCp)}
        {tab === 0 && dd('st', 'Status', STATUSES, st, setSt)}
        {dd('qf', 'Query', QUERIES, qf, setQf)}
        {dd('pf', 'Product', PRODUCTS, pf, setPf)}
      </div>
      <div className="count-line">
        Showing {rows.length} {rows.length === 1 ? 'case' : 'cases'} · oldest first
      </div>
      <ListStates status={status} isEmpty={rows.length === 0} emptyText={tab === 0 ? 'Nothing to check right now.' : 'No checked cases match these filters.'} onRetry={retry} columns={7}>
        <CaseTable
          rows={rows}
          role={role}
          columns={{ checkpoint: true }}
          page={page}
          pageSize={pageSize}
          onPage={(p, s) => {
            setPage(p);
            setPageSize(s);
          }}
          ariaLabel={tab === 0 ? 'Cases to check' : 'Checked cases'}
        />
      </ListStates>
    </div>
  );
}
