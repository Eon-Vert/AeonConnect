import { Button, DismissibleTag, Pagination, Tab, TabList, Tabs, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DeskCategory, DeskTask } from '../domain/types';
import { ageLabel } from '../domain/rules';
import { NOW, fmtDateTime } from '../domain/time';
import { pipelineLink } from '../domain/pipelineQuery';
import { useStore } from '../state/store';
import { useUi } from '../state/ui';
import { ListStates, PageHeader, useListStatus } from '../components/common';

const CATS: { id: DeskCategory; title: string; emphasised?: boolean }[] = [
  { id: 'decision', title: 'Needs your decision', emphasised: true },
  { id: 'queries', title: 'Queries' },
  { id: 'followups', title: 'Follow-ups' },
];
const catTitle = (c: DeskCategory) => CATS.find((x) => x.id === c)!.title;
const MAX = 5;

/** a line on a card: one case task, or one officer's grouped desk work */
type CardItem =
  | { type: 'task'; task: DeskTask }
  | { type: 'officer'; officerId: string; tasks: DeskTask[]; followups: number; untouched: number; oldest: number };

function buildCard(cat: DeskCategory, open: DeskTask[]): { items: CardItem[]; total: number } {
  const tasks = open.filter((t) => t.category === cat);
  if (cat !== 'followups') {
    return { total: tasks.length, items: tasks.filter((t) => !t.skipped).slice(0, MAX).map((task) => ({ type: 'task', task })) };
  }
  // officer-desk work grouped one line per officer
  const groups = new Map<string, DeskTask[]>();
  for (const t of tasks) if (t.kind === 'followup' || t.kind === 'untouched') groups.set(t.officerId, [...(groups.get(t.officerId) ?? []), t]);
  const lines: CardItem[] = [...groups.entries()]
    .filter(([, ts]) => ts.some((t) => !t.skipped))
    .map(([officerId, ts]) => ({
      type: 'officer' as const,
      officerId,
      tasks: ts,
      followups: ts.filter((t) => t.kind === 'followup').length,
      untouched: ts.filter((t) => t.kind === 'untouched').length,
      oldest: Math.min(...ts.map((t) => t.since)),
    }))
    .sort((a, b) => b.untouched - a.untouched || a.oldest - b.oldest);
  const caseItems: CardItem[] = tasks.filter((t) => t.kind !== 'followup' && t.kind !== 'untouched' && !t.skipped).map((task) => ({ type: 'task', task }));
  const items = [...lines.slice(0, 3), ...caseItems.slice(0, 2)];
  // top up if one side is short
  const extra = [...lines.slice(3), ...caseItems.slice(2)];
  while (items.length < MAX && extra.length) items.push(extra.shift()!);
  return { total: tasks.length, items };
}

export function SalesManagerMyDay() {
  const deskTasks = useStore((s) => s.deskTasks);
  const skip = useStore((s) => s.skipDeskTask);
  const openCase = useUi((s) => s.openCase);
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [catFilter, setCatFilter] = useState<DeskCategory | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const listRef = useRef<HTMLDivElement>(null);

  const open = useMemo(() => deskTasks.filter((t) => !t.doneAt), [deskTasks]);
  const done = useMemo(() => deskTasks.filter((t) => t.doneAt).sort((a, b) => b.doneAt! - a.doneAt!), [deskTasks]);
  const cards = useMemo(() => CATS.map((c) => ({ ...c, ...buildCard(c.id, open) })), [open]);
  const { status: cardStatus, forceEmpty, retry: retryCards } = useListStatus('myday-cards');
  const { status, retry } = useListStatus(`myday-list|${tab}|${catFilter}|${page}|${pageSize}`);

  const listRows = forceEmpty ? [] : (tab === 0 ? open : done).filter((t) => !catFilter || t.category === catFilter);
  const pageRows = listRows.slice((page - 1) * pageSize, page * pageSize);

  const seeAll = (cat: DeskCategory) => {
    setCatFilter(cat);
    setTab(0);
    setPage(1);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="page">
      <PageHeader title="My Day" subtitle="Sales Manager · Mawarid" right={<span className="desk-count">{forceEmpty ? 0 : open.length} on your desk</span>} />

      <section className="dtf" aria-labelledby="dtf-title">
        <div className="dtf-head">
          <h2 id="dtf-title">Do these first</h2>
          <span className="helper">Ordered by the system · up to 5 per category · each item says why it is here</span>
        </div>
        <ListStates status={cardStatus} isEmpty={forceEmpty} emptyText="Nothing needs you right now." onRetry={retryCards} columns={3} what="your desk">
          <div className="dtf-cards">
            {cards.map((card) => (
              <div key={card.id} className={`desk-card${card.emphasised ? ' is-emphasised' : ''}`}>
                <div className="card-head">
                  <h3>{card.title}</h3>
                  <div className="count">
                    {card.items.length} shown of {card.total}
                  </div>
                </div>
                {card.items.length === 0 ? (
                  <div className="card-empty">Nothing here right now.</div>
                ) : (
                  <ul>
                    {card.items.map((it) =>
                      it.type === 'task' ? (
                        <li key={it.task.id}>
                          <button className="item-main" onClick={() => openCase(it.task.caseId)}>
                            <div className="item-title">
                              {it.task.verb} · Case {it.task.caseId}
                            </div>
                            <div className="item-reason">{it.task.reason}</div>
                          </button>
                          <Button kind="ghost" size="sm" onClick={() => skip(it.task.id)}>
                            Skip
                          </Button>
                        </li>
                      ) : (
                        <li key={`o-${it.officerId}`}>
                          <button className="item-main" onClick={() => navigate(pipelineLink({ officer: it.officerId, date: 'all', ...(it.untouched ? { company: true, untouched72: true } : {}) }))}>
                            <div className="item-title">
                              Chase {it.officerId} · {it.untouched ? `${it.untouched} company leads untouched over 72h` : `${it.followups} overdue follow-ups`}
                            </div>
                            <div className="item-reason">
                              {it.untouched ? `Also ${it.followups} overdue follow-ups` : `Oldest overdue ${ageLabel(NOW - it.oldest)}`}
                            </div>
                          </button>
                          <Button kind="ghost" size="sm" onClick={() => it.tasks.forEach((t) => skip(t.id))}>
                            Skip
                          </Button>
                        </li>
                      ),
                    )}
                  </ul>
                )}
                <div className="card-foot">
                  <button className="link-btn" onClick={() => seeAll(card.id)} disabled={card.total === 0}>
                    See all {card.total} <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ListStates>
      </section>

      <section ref={listRef} style={{ scrollMarginTop: '4rem' }}>
        <h2 className="section-title">Everything else on your desk</h2>
        <Tabs
          selectedIndex={tab}
          onChange={({ selectedIndex }: { selectedIndex: number }) => {
            setTab(selectedIndex);
            setPage(1);
          }}
        >
          <TabList aria-label="Desk list">
            <Tab>All ({forceEmpty ? 0 : open.length})</Tab>
            <Tab>Done ({done.length})</Tab>
          </TabList>
        </Tabs>
        {catFilter && (
          <div className="drill-tags" style={{ marginTop: '1rem' }}>
            <DismissibleTag type="blue" text={`Showing: ${catTitle(catFilter)}`} onClose={() => setCatFilter(null)} />
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          <ListStates status={status} isEmpty={listRows.length === 0} emptyText={tab === 0 ? 'Nothing needs you right now.' : 'Nothing done yet today.'} onRetry={retry} columns={4} what="your desk">
            <div className="case-table-wrap">
              <Table size="lg" className="case-table" aria-label="Desk items">
                <TableHead>
                  <TableRow>
                    <TableHeader>Case</TableHeader>
                    <TableHeader>Waiting reason</TableHeader>
                    <TableHeader>Officer</TableHeader>
                    <TableHeader>{tab === 0 ? 'Age' : 'Done'}</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageRows.map((t) => (
                    <TableRow key={t.id} onClick={() => openCase(t.caseId)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openCase(t.caseId)}>
                      <TableCell>
                        <div className="cell-name">Case {t.caseId}</div>
                        <div className="cell-sub">{catTitle(t.category)}</div>
                      </TableCell>
                      <TableCell>
                        <strong>{t.verb}</strong> · {t.reason}
                      </TableCell>
                      <TableCell>{t.officerId}</TableCell>
                      <TableCell>{tab === 0 ? ageLabel(NOW - t.since) : fmtDateTime(t.doneAt!)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              pageSizes={[25, 50, 100]}
              totalItems={listRows.length}
              onChange={({ page: p, pageSize: s }: { page: number; pageSize: number }) => {
                setPage(s !== pageSize ? 1 : p);
                setPageSize(s);
              }}
            />
          </ListStates>
        </div>
      </section>
    </div>
  );
}
