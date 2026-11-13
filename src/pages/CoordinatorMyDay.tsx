import { Button, Tag } from '@carbon/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Case } from '../domain/types';
import { bucketOf, hasOpenCustomerQuery } from '../domain/rules';
import { DAY, NOW, dubaiDayStart } from '../domain/time';
import { useStore } from '../state/store';
import { useUi } from '../state/ui';
import { CaseTable } from '../components/CaseTable';
import { ListStates, PageHeader, useListStatus, PlainTabs } from '../components/common';

type TabIdx = 0 | 1 | 2 | 3;
const MAX_SHOWN = 5;
const TAB_NAMES = ['To Apply', 'To Submit', 'Application Status', 'Awaiting'];

interface CoordTask {
  key: string;
  caseId: string;
  verb: 'File' | 'Submit documents' | 'Record outcome';
  reason: string;
  tab: TabIdx;
  blocked: string | null;
  group: number;
  since: number;
}

function rel(t: number) {
  const days = Math.round((dubaiDayStart(NOW) - dubaiDayStart(t)) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

const isMawaridOpen = (c: Case) => c.bank === 'MAWARID' && !c.archived;
const toApply = (c: Case) => isMawaridOpen(c) && bucketOf(c) === 'to_file';
const toSubmit = (c: Case) => isMawaridOpen(c) && c.stage === 'post_compliance' && !!c.checks.post;
const appStatus = (c: Case) => isMawaridOpen(c) && ['applied', 'wip', 'on_hold', 'approved', 'docs_submitted'].includes(c.stage);
const awaiting = (c: Case) => isMawaridOpen(c) && (['to_qualify', 'compliance'].includes(bucketOf(c)) || (c.stage === 'post_compliance' && !c.checks.post));
const FILTERS = [toApply, toSubmit, appStatus, awaiting];

function whyNotReady(c: Case): string {
  if (c.hold?.kind === 'compliance') return 'On hold · compliance';
  if (bucketOf(c) === 'to_qualify') return c.journeyStartAt ? 'Waiting for Sales Manager to qualify' : 'Journey not started';
  if (c.stage === 'pre_compliance') return 'Waiting for pre-compliance check';
  if (c.stage === 'post_compliance') return c.product === 'card' && c.pickup !== 'completed' ? 'Waiting for document pickup, then post-compliance check' : 'Waiting for post-compliance check';
  return '—';
}

function buildTasks(cases: Case[]): CoordTask[] {
  const out: CoordTask[] = [];
  for (const c of cases) {
    const blocked = hasOpenCustomerQuery(c) ? 'Blocked: open customer query. Close it before acting.' : null;
    if (toApply(c)) {
      const legacy = c.stage === 'qualified';
      out.push({
        key: `file:${c.id}:${c.stage}`,
        caseId: c.id,
        verb: 'File',
        tab: 0,
        blocked,
        since: c.checks.pre ?? c.stageSince,
        group: c.journey === 'self' ? 0 : 2,
        reason: legacy ? 'Legacy Qualified case, file or send to Pre-Compliance' : `${c.journey === 'self' ? 'Self' : 'Assisted'} case, compliance passed ${rel(c.checks.pre ?? c.stageSince)}`,
      });
    } else if (toSubmit(c)) {
      out.push({ key: `submit:${c.id}`, caseId: c.id, verb: 'Submit documents', tab: 1, blocked, since: c.checks.post!, group: 2, reason: `Post-compliance passed ${rel(c.checks.post!)}` });
    } else if (c.bank === 'MAWARID' && c.docRequestOpen && (c.stage === 'wip' || c.stage === 'on_hold')) {
      out.push({ key: `outcome:${c.id}:${c.stage}`, caseId: c.id, verb: 'Record outcome', tab: 2, blocked, since: c.stageSince, group: 1, reason: 'Document request open' });
    }
  }
  // Self cases first for filing, then open document requests, then oldest first
  return out.sort((a, b) => a.group - b.group || a.since - b.since);
}

export function CoordinatorMyDay() {
  const cases = useStore((s) => s.cases);
  const role = useStore((s) => s.role);
  const coordDone = useStore((s) => s.coordDone);
  const coordSkipped = useStore((s) => s.coordSkipped);
  const markDone = useStore((s) => s.markCoordDone);
  const skipCoord = useStore((s) => s.skipCoord);
  const openCase = useUi((s) => s.openCase);
  const [tab, setTab] = useState<TabIdx>(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const lastIndex = useRef(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const tasks = useMemo(() => buildTasks(cases).filter((t) => !coordDone.includes(t.key)), [cases, coordDone]);
  const tabRows = useMemo(() => FILTERS.map((f) => cases.filter(f).sort((a, b) => a.stageSince - b.stageSince)), [cases]);
  const { status, forceEmpty, retry } = useListStatus(`coord|${tab}|${page}|${pageSize}`);
  const { status: recStatus, retry: recRetry } = useListStatus('coord-rec');
  const rows = forceEmpty ? [] : tabRows[tab];
  const pinned = tasks.find((t) => t.key === pinnedKey) ?? null;

  function focus(t: CoordTask) {
    setPinnedKey(t.key);
    lastIndex.current = tasks.findIndex((x) => x.key === t.key);
    setTab(t.tab);
    const idx = tabRows[t.tab].findIndex((c) => c.id === t.caseId);
    const p = Math.floor(Math.max(0, idx) / pageSize) + 1;
    setPage(p);
    setHighlight(t.caseId);
    openCase(t.caseId);
    setTimeout(() => {
      document.querySelector(`tr[data-case-id="${t.caseId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 350);
  }

  /** next task after position i that is not skipped */
  function nextFrom(i: number, list = tasks, exclude?: string) {
    const after = list.slice(i).filter((t) => t.key !== exclude && !coordSkipped.includes(t.key));
    return after[0] ?? list.find((t) => t.key !== exclude && !coordSkipped.includes(t.key)) ?? null;
  }

  // When the pinned task's action is completed in the panel, it drops out: load the next one.
  useEffect(() => {
    if (pinnedKey && !tasks.some((t) => t.key === pinnedKey)) {
      const n = nextFrom(lastIndex.current);
      if (n) focus(n);
      else {
        setPinnedKey(null);
        setHighlight(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const doneNext = () => {
    if (!pinned) return;
    const i = tasks.findIndex((t) => t.key === pinned.key);
    const n = nextFrom(i + 1, tasks, pinned.key);
    markDone(pinned.key);
    if (n) focus(n);
    else setPinnedKey(null);
  };
  const skipNext = () => {
    if (!pinned) return;
    const i = tasks.findIndex((t) => t.key === pinned.key);
    skipCoord(pinned.key);
    const n = tasks.slice(i + 1).find((t) => !coordSkipped.includes(t.key)) ?? null;
    if (n) focus(n);
    else setPinnedKey(null);
  };

  /** at most 5 at a time; skipped tasks leave the list (they stay in the queues below) */
  const queue = tasks.filter((t) => !coordSkipped.includes(t.key) || t.key === pinnedKey);
  const shown = queue.slice(0, collapsed ? 3 : MAX_SHOWN);

  return (
    <div className="page">
      <PageHeader title="My Day" subtitle="Coordinator · Mawarid" right={<span className="desk-count">{forceEmpty ? 0 : queue.length} recommended tasks</span>} />

      {pinned && (
        <div className="pinned-bar" role="region" aria-label="Current task">
          <div>
            <div className="pin-title">
              {pinned.verb} · Case {pinned.caseId}
            </div>
            <div className="pin-reason">{pinned.reason}</div>
            {pinned.blocked && <div className="pin-blocked">{pinned.blocked}</div>}
          </div>
          <div className="pin-actions">
            <Button size="sm" kind="ghost" style={{ color: '#f4f4f4' }} onClick={() => openCase(pinned.caseId)}>
              Open case
            </Button>
            <Button size="sm" kind="secondary" onClick={skipNext}>
              Skip
            </Button>
            <Button size="sm" kind="primary" disabled={!!pinned.blocked} onClick={doneNext}>
              Done, next
            </Button>
          </div>
        </div>
      )}

      <section className="rec-tasks" aria-labelledby="rec-title">
        <div className="rec-head">
          <div>
            <h2 id="rec-title">Recommended tasks</h2>
            <span className="helper">
              {shown.length} shown of {queue.length} · Self cases first for filing, then open document requests, then oldest first
            </span>
          </div>
          <span style={{ marginLeft: 'auto' }}>
            <Button kind="ghost" size="sm" onClick={() => setCollapsed((c) => !c)} disabled={queue.length <= 3}>
              {collapsed ? `Show top ${Math.min(MAX_SHOWN, queue.length)}` : 'Show top 3'}
            </Button>
          </span>
        </div>
        <ListStates status={recStatus} isEmpty={forceEmpty || tasks.length === 0} emptyText="No recommended tasks. You're up to date." onRetry={recRetry} columns={3} what="tasks">
          <ol>
            {shown.map((t, i) => (
              <li key={t.key} className={t.key === pinnedKey ? 'is-pinned' : ''}>
                <span className="rank">{i + 1}</span>
                <button className="item-main link-btn" style={{ flex: 1, textAlign: 'left', color: 'var(--cds-text-primary)' }} onClick={() => focus(t)}>
                  <strong>
                    {t.verb} · Case {t.caseId}
                  </strong>
                  <span className="muted"> · {t.reason}</span>
                </button>
                {t.blocked && <Tag type="red" size="sm">Blocked</Tag>}
                <Tag type="outline" size="sm">
                  {TAB_NAMES[t.tab]}
                </Tag>
              </li>
            ))}
          </ol>
        </ListStates>
      </section>

      <div ref={tableRef}>
        <PlainTabs
          label="Coordinator queues"
          tabs={TAB_NAMES.map((n, i) => `${n} (${forceEmpty ? 0 : tabRows[i].length})`)}
          selected={tab}
          onChange={(i) => {
            setTab(i as TabIdx);
            setPage(1);
          }}
        />
        <p className="helper-line" style={{ marginTop: '0.75rem' }}>
          {['Ready to file with the bank.', 'Post-compliance passed: submit the documents.', 'With the bank, Applied onward.', "Read-only: cases waiting on someone else, and why they aren't ready to file."][tab]}
        </p>
        <ListStates status={status} isEmpty={rows.length === 0} emptyText="Nothing in this queue." onRetry={retry} columns={7}>
          <CaseTable
            rows={rows}
            role={role}
            highlightId={highlight}
            readOnly={tab === 3 ? () => true : undefined}
            customColumn={tab === 3 ? { header: 'Why not ready', render: (c) => whyNotReady(c) } : undefined}
            page={page}
            pageSize={pageSize}
            onPage={(p, s) => {
              setPage(p);
              setPageSize(s);
            }}
            ariaLabel={`${TAB_NAMES[tab]} cases`}
          />
        </ListStates>
      </div>
    </div>
  );
}
