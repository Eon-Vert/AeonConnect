import { ContentSwitcher, Dropdown, Search, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { ChevronDown, ChevronRight } from '@carbon/icons-react';
import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { BankId, Batch, Case } from '../domain/types';
import { DATE_PRESETS, DAY, HOUR, NOW, fmtDate, presetRange, type DatePreset } from '../domain/time';
import { pipelineLink, type PipelineQuery } from '../domain/pipelineQuery';
import { OFFICERS } from '../data/mock';
import { useStore } from '../state/store';
import { ListStates, PageHeader, useListStatus, PlainTabs } from '../components/common';
import { AddLeadsFlow } from '../components/AddLeadsFlow';

const TABS = ['officers', 'analytics', 'upload'] as const;
type TabId = (typeof TABS)[number];
const BANK_ITEMS = [
  { id: 'MAWARID', label: 'Mawarid' },
  { id: 'DIB', label: 'DIB' },
];
const TEAM_ITEMS = [{ id: '', label: 'All teams' }, { id: 'Team A', label: 'Team A' }, { id: 'Team B', label: 'Team B' }, { id: 'Team C', label: 'Team C' }];

type Metric = 'assigned' | 'untouched' | 'over72' | 'contacted' | 'eligible' | 'ineligible' | 'dropped' | 'journey' | 'applied' | 'booked';
const METRICS: { id: Metric; label: string; test: (c: Case) => boolean; drill: Partial<PipelineQuery> }[] = [
  { id: 'assigned', label: 'Assigned', test: () => true, drill: {} },
  { id: 'untouched', label: 'Untouched', test: (c) => c.stage === 'to_contact', drill: { stage: 'to_contact' } },
  { id: 'contacted', label: 'Contacted', test: (c) => c.path.includes('contacted'), drill: { reached: 'contacted' } },
  { id: 'eligible', label: 'Eligible', test: (c) => c.path.includes('eligible'), drill: { reached: 'eligible' } },
  { id: 'ineligible', label: 'Ineligible', test: (c) => c.stage === 'ineligible', drill: { stage: 'ineligible' } },
  { id: 'dropped', label: 'Dropped', test: (c) => c.stage === 'dropped', drill: { stage: 'dropped' } },
  { id: 'journey', label: 'Started journey', test: (c) => !!c.journeyStartAt, drill: { journeyStarted: true } },
  { id: 'applied', label: 'Applied', test: (c) => c.path.includes('applied'), drill: { reached: 'applied' } },
  { id: 'booked', label: 'Booked', test: (c) => c.stage === 'booked', drill: { stage: 'booked' } },
];
const over72 = (c: Case) => c.stage === 'to_contact' && NOW - c.stageSince > 72 * HOUR;
const count = (cs: Case[], id: Metric) => (id === 'over72' ? cs.filter(over72).length : cs.filter(METRICS.find((m) => m.id === id)!.test).length);

export function CompanyLeads() {
  const [sp, setSp] = useSearchParams();
  const tab: TabId = (TABS as readonly string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as TabId) : 'officers';
  const setTab = (t: TabId) => setSp(t === 'officers' ? {} : { tab: t }, { replace: true });
  const cases = useStore((s) => s.cases);
  const batches = useStore((s) => s.batches);
  const [bank, setBank] = useState<BankId>('MAWARID');
  const [date, setDate] = useState<DatePreset>('mtd');
  const [team, setTeam] = useState('');
  const [search, setSearch] = useState('');

  const [from, to] = presetRange(date);
  // every lead that came in a batch, archived ones included: Analytics counts whole batches
  const batchCases = useMemo(() => cases.filter((c) => c.batchId && c.bank === bank), [cases, bank]);
  const leads = useMemo(
    () => cases.filter((c) => c.companyProvided && !c.archived && c.bank === bank && c.capturedAt >= from && c.capturedAt < to),
    [cases, bank, from, to],
  );

  if (tab === 'upload') return <div className="page"><AddLeadsFlow onBack={() => setTab('officers')} defaultBank={bank} /></div>;

  const drillBase: Partial<PipelineQuery> = { bank, company: true, date: date === 'custom' ? 'all' : date };

  return (
    <div className="page">
      <PageHeader title="Company leads" subtitle="Leads the company provided, and whether officers are working them." />
      <PlainTabs label="Company leads views" tabs={['Officers', 'Analytics', 'Upload']} selected={TABS.indexOf(tab)} onChange={(i) => setTab(TABS[i])} />
      <div className="filter-row">
        <Dropdown id="cl-bank" titleText="Bank team" label="Bank team" size="md" items={BANK_ITEMS} itemToString={(i) => i?.label ?? ''} selectedItem={BANK_ITEMS.find((b) => b.id === bank)} onChange={({ selectedItem }) => selectedItem && setBank(selectedItem.id as BankId)} />
        <Dropdown
          id="cl-date"
          titleText="Captured"
          label="Date"
          size="md"
          items={DATE_PRESETS.filter((d) => d.id !== 'custom')}
          itemToString={(i) => i?.label ?? ''}
          selectedItem={DATE_PRESETS.find((d) => d.id === date)}
          onChange={({ selectedItem }) => selectedItem && setDate(selectedItem.id as DatePreset)}
        />
        {tab === 'officers' && (
          <>
            <Dropdown id="cl-team" titleText="Team" label="Team" size="md" items={TEAM_ITEMS} itemToString={(i) => i?.label ?? ''} selectedItem={TEAM_ITEMS.find((t) => t.id === team)} onChange={({ selectedItem }) => setTeam(selectedItem?.id ?? '')} />
            <Search id="cl-search" labelText="Search officers" placeholder="Search officers" size="md" value={search} onChange={(e) => setSearch((e.target as HTMLInputElement).value)} />
          </>
        )}
      </div>
      {tab === 'officers' ? (
        <OfficersTab leads={leads} team={team} search={search} drillBase={drillBase} keyStr={`${bank}|${date}|${team}|${search}`} />
      ) : (
        <AnalyticsTab batchCases={batchCases} batches={batches.filter((b) => b.bank === bank && b.uploadedAt >= from && b.uploadedAt < to)} keyStr={`${bank}|${date}`} />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- officers */
function OfficersTab({ leads, team, search, drillBase, keyStr }: { leads: Case[]; team: string; search: string; drillBase: Partial<PipelineQuery>; keyStr: string }) {
  const navigate = useNavigate();
  const { status, forceEmpty, retry } = useListStatus(`cl-off|${keyStr}`);
  const term = search.trim().toLowerCase();
  const officers = OFFICERS.filter((o) => (!team || o.team === team) && (!term || `${o.id} ${o.name}`.toLowerCase().includes(term)));
  const scoped = forceEmpty ? [] : leads.filter((c) => officers.some((o) => o.id === c.officerId));
  const rows = officers
    .map((o) => ({ o, cs: scoped.filter((c) => c.officerId === o.id) }))
    .filter((r) => r.cs.length > 0)
    .sort((a, b) => count(b.cs, 'untouched') - count(a.cs, 'untouched') || count(b.cs, 'over72') - count(a.cs, 'over72'));

  const link = (officer: string | undefined, m: Metric) =>
    pipelineLink({ ...drillBase, officer, ...(m === 'over72' ? { untouched72: true } : METRICS.find((x) => x.id === m)!.drill) });
  const cell = (cs: Case[], m: Metric, officer?: string) => {
    const n = count(cs, m);
    return n === 0 ? <span className="muted">0</span> : <Link className="link-btn" to={link(officer, m)}>{n}</Link>;
  };
  const tiles: Metric[] = ['assigned', 'untouched', 'contacted', 'eligible', 'applied', 'booked'];

  return (
    <>
      <p className="helper-line">
        Call metrics will appear once call tracking is added.
        <br />
        <Tag type="warm-gray" size="sm">Placeholder threshold</Tag> "Over 72h" uses a placeholder 72-hour threshold until the founder confirms the number.
      </p>
      <ListStates status={status} isEmpty={rows.length === 0} emptyText="No company leads in this period." onRetry={retry} columns={10} what="company leads">
        <div className="tiles">
          {tiles.map((m) => (
            <button key={m} className="tile link-btn" style={{ textAlign: 'left', color: 'inherit' }} onClick={() => navigate(link(undefined, m))}>
              <div className="k">{METRICS.find((x) => x.id === m)!.label}</div>
              <div className="v">{count(scoped, m)}</div>
              {m === 'untouched' && count(scoped, 'over72') > 0 && <div className="amber">{count(scoped, 'over72')} waiting over 72h</div>}
            </button>
          ))}
        </div>
        <div className="case-table-wrap">
          <Table size="lg" className="plain-table" aria-label="Company leads by officer">
            <TableHead>
              <TableRow>
                <TableHeader>Officer</TableHeader>
                {METRICS.map((m) => (
                  <TableHeader key={m.id} className="num">
                    {m.label}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ o, cs }) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <strong>{o.id}</strong> <span className="muted">· {o.team}</span>
                  </TableCell>
                  {METRICS.map((m) => (
                    <TableCell key={m.id} className="num">
                      {cell(cs, m.id, o.id)}
                      {m.id === 'untouched' && count(cs, 'over72') > 0 && (
                        <Link to={link(o.id, 'over72')} className="amber-badge">
                          {count(cs, 'over72')} over 72h
                        </Link>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="totals">
                <TableCell>Total</TableCell>
                {METRICS.map((m) => (
                  <TableCell key={m.id} className="num">
                    {cell(scoped, m.id)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </ListStates>
    </>
  );
}

/* -------------------------------------------------------------- analytics */
type GroupBy = 'campaign' | 'channel' | 'platform';
const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'campaign', label: 'Campaign' },
  { id: 'channel', label: 'Channel' },
  { id: 'platform', label: 'Ad platform' },
];

function AnalyticsTab({ batchCases, batches, keyStr }: { batchCases: Case[]; batches: Batch[]; keyStr: string }) {
  const [by, setBy] = useState<GroupBy>('campaign');
  const [open, setOpen] = useState<string[]>([]);
  const { status, forceEmpty, retry } = useListStatus(`cl-an|${keyStr}|${by}`);

  /*
   * One scope for every column: the batches uploaded in the period and every lead in them.
   * So Rows uploaded = Assigned + Skipped at upload, for each group and each batch.
   */
  const groups = useMemo(() => {
    const keys = [...new Set(batches.map((b) => b[by]))];
    return keys
      .map((k) => {
        const bs = batches.filter((b) => b[by] === k).sort((a, b) => b.uploadedAt - a.uploadedAt);
        const ids = new Set(bs.map((b) => b.id));
        const cs = batchCases.filter((c) => ids.has(c.batchId!));
        const contacted = count(cs, 'contacted');
        const newest = Math.max(...bs.map((b) => b.uploadedAt));
        return {
          key: k,
          batches: bs,
          uploaded: bs.reduce((s, b) => s + b.rowsUploaded, 0),
          skipped: bs.reduce((s, b) => s + b.skipped, 0),
          assigned: cs.length,
          untouched: count(cs, 'untouched'),
          contacted,
          rate: contacted ? Math.round((count(cs, 'eligible') / contacted) * 100) : null,
          applied: count(cs, 'applied'),
          booked: count(cs, 'booked'),
          tooEarly: NOW - newest < 7 * DAY ? Math.max(1, Math.floor((NOW - newest) / DAY)) : 0,
          cs,
        };
      })
      .sort((a, b) => b.assigned - a.assigned);
  }, [batchCases, batches, by]);
  const rows = forceEmpty ? [] : groups;

  return (
    <>
      <div className="row-gap mb-05">
        <span className="cds--label" style={{ marginBottom: 0 }}>
          Group by
        </span>
        <ContentSwitcher size="sm" selectedIndex={GROUPS.findIndex((g) => g.id === by)} onChange={({ index }: { index?: number }) => setBy(GROUPS[index ?? 0].id)} style={{ width: '24rem' }}>
          {GROUPS.map((g) => (
            <Switch key={g.id} name={g.id} text={g.label} />
          ))}
        </ContentSwitcher>
      </div>
      <p className="helper-line">Covers batches uploaded in the period and every lead in them, so Rows uploaded = Assigned + Skipped at upload. Eligible rate % = eligible ÷ contacted. Groups with a batch under 7 days old are marked too early to judge.</p>
      <ListStates status={status} isEmpty={rows.length === 0} emptyText="No company leads in this period." onRetry={retry} columns={9} what="analytics">
        <div className="case-table-wrap">
          <Table size="lg" className="plain-table" aria-label={`Company leads by ${by}`}>
            <TableHead>
              <TableRow>
                <TableHeader>{GROUPS.find((g) => g.id === by)!.label}</TableHeader>
                <TableHeader className="num">Rows uploaded</TableHeader>
                <TableHeader className="num">Skipped at upload</TableHeader>
                <TableHeader className="num">Assigned</TableHeader>
                <TableHeader className="num">Untouched</TableHeader>
                <TableHeader className="num">Contacted</TableHeader>
                <TableHeader className="num">Eligible rate %</TableHeader>
                <TableHeader className="num">Applied</TableHeader>
                <TableHeader className="num">Booked</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((g) => {
                const isOpen = open.includes(g.key);
                return (
                  <Fragment key={g.key}>
                    <TableRow onClick={() => setOpen((o) => (isOpen ? o.filter((x) => x !== g.key) : [...o, g.key]))} style={{ cursor: 'pointer' }} aria-expanded={isOpen}>
                      <TableCell>
                        <span className="row-gap">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          <strong>{g.key}</strong>
                          <span className="muted">
                            {g.batches.length} {g.batches.length === 1 ? 'batch' : 'batches'}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="num">{g.uploaded}</TableCell>
                      <TableCell className="num">{g.skipped}</TableCell>
                      <TableCell className="num">{g.assigned}</TableCell>
                      <TableCell className="num">{g.untouched}</TableCell>
                      <TableCell className="num">{g.contacted}</TableCell>
                      <TableCell className="num">
                        {g.rate === null ? '—' : `${g.rate}%`}
                        {g.tooEarly > 0 && (
                          <Tag type="gray" size="sm" style={{ marginLeft: 8 }}>
                            Too early · {g.tooEarly} {g.tooEarly === 1 ? 'day' : 'days'}
                          </Tag>
                        )}
                      </TableCell>
                      <TableCell className="num">{g.applied}</TableCell>
                      <TableCell className="num">{g.booked}</TableCell>
                    </TableRow>
                    {isOpen &&
                      g.batches.map((b) => {
                        const cs = g.cs.filter((c) => c.batchId === b.id);
                        return (
                          <TableRow key={b.id} className="batch-row">
                            <TableCell style={{ paddingLeft: '2.75rem' }}>
                              Batch {b.id} · uploaded {fmtDate(b.uploadedAt)} by {b.uploadedBy}
                              <div className="cell-sub">
                                {b.campaign} · {b.channel} · {b.platform}
                              </div>
                            </TableCell>
                            <TableCell className="num">{b.rowsUploaded}</TableCell>
                            <TableCell className="num">{b.skipped}</TableCell>
                            <TableCell className="num">{cs.length}</TableCell>
                            <TableCell className="num">{count(cs, 'untouched')}</TableCell>
                            <TableCell className="num">{count(cs, 'contacted')}</TableCell>
                            <TableCell className="num">{count(cs, 'contacted') ? `${Math.round((count(cs, 'eligible') / count(cs, 'contacted')) * 100)}%` : '—'}</TableCell>
                            <TableCell className="num">{count(cs, 'applied')}</TableCell>
                            <TableCell className="num">{count(cs, 'booked')}</TableCell>
                          </TableRow>
                        );
                      })}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </ListStates>
    </>
  );
}
