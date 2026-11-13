import type { BankId, BucketId, Case, HoldKind, StageId } from './types';
import { bucketOf, lateBy, stageLabel } from './rules';
import { NOW, HOUR, DAY, presetRange, type DatePreset } from './time';

export type SortId = 'urgent' | 'updated' | 'captured';
export const SORTS: { id: SortId; label: string }[] = [
  { id: 'urgent', label: 'Most urgent first' },
  { id: 'updated', label: 'Recently updated' },
  { id: 'captured', label: 'Recently captured' },
];

export interface PipelineQuery {
  bank: BankId | 'ALL';
  q: string;
  officer: string;
  date: DatePreset;
  from?: number;
  to?: number;
  sort: SortId;
  bucket: BucketId | 'all';
  view: 'all' | 'archived';
  /** drill-downs from Company leads */
  company: boolean;
  reached?: StageId;
  stage?: StageId;
  journeyStarted: boolean;
  untouched72: boolean;
  /** filter row */
  hold: HoldKind | '';
  queryStatus: 'open' | 'replied' | 'none' | '';
  /** journey start range, inclusive Dubai days (ms of each day's start) */
  jFrom?: number;
  jTo?: number;
}

export const QUERY_STATUSES: { id: PipelineQuery['queryStatus']; label: string }[] = [
  { id: '', label: 'Any query state' },
  { id: 'open', label: 'Open' },
  { id: 'replied', label: 'Replied' },
  { id: 'none', label: 'No query' },
];

export const DEFAULTS: PipelineQuery = {
  bank: 'MAWARID',
  q: '',
  officer: '',
  date: 'mtd',
  sort: 'urgent',
  bucket: 'all',
  view: 'all',
  company: false,
  journeyStarted: false,
  untouched72: false,
  hold: '',
  queryStatus: '',
};

export function parseQuery(sp: URLSearchParams): PipelineQuery {
  const num = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  return {
    bank: (sp.get('bank') as PipelineQuery['bank']) || DEFAULTS.bank,
    q: sp.get('q') ?? '',
    officer: sp.get('officer') ?? '',
    date: (sp.get('date') as DatePreset) || DEFAULTS.date,
    from: num('from'),
    to: num('to'),
    sort: (sp.get('sort') as SortId) || DEFAULTS.sort,
    bucket: (sp.get('bucket') as PipelineQuery['bucket']) || 'all',
    view: sp.get('view') === 'archived' ? 'archived' : 'all',
    company: sp.get('company') === '1',
    reached: (sp.get('reached') as StageId) || undefined,
    stage: (sp.get('stage') as StageId) || undefined,
    journeyStarted: sp.get('journey') === '1',
    untouched72: sp.get('untouched72') === '1',
    hold: (sp.get('hold') as HoldKind) || '',
    queryStatus: (sp.get('qs') as PipelineQuery['queryStatus']) || '',
    jFrom: num('jfrom'),
    jTo: num('jto'),
  };
}

export function toSearch(q: Partial<PipelineQuery>): string {
  const sp = new URLSearchParams();
  const full = { ...DEFAULTS, ...q };
  if (full.bank !== DEFAULTS.bank) sp.set('bank', full.bank);
  if (full.q) sp.set('q', full.q);
  if (full.officer) sp.set('officer', full.officer);
  if (full.date !== DEFAULTS.date) sp.set('date', full.date);
  if (full.date === 'custom' && full.from && full.to) {
    sp.set('from', String(full.from));
    sp.set('to', String(full.to));
  }
  if (full.sort !== DEFAULTS.sort) sp.set('sort', full.sort);
  if (full.bucket !== 'all') sp.set('bucket', full.bucket);
  if (full.view === 'archived') sp.set('view', 'archived');
  if (full.company) sp.set('company', '1');
  if (full.reached) sp.set('reached', full.reached);
  if (full.stage) sp.set('stage', full.stage);
  if (full.journeyStarted) sp.set('journey', '1');
  if (full.untouched72) sp.set('untouched72', '1');
  if (full.hold) sp.set('hold', full.hold);
  if (full.queryStatus) sp.set('qs', full.queryStatus);
  if (full.jFrom && full.jTo) {
    sp.set('jfrom', String(full.jFrom));
    sp.set('jto', String(full.jTo));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** link into Pipeline */
export const pipelineLink = (q: Partial<PipelineQuery>) => `/pipeline${toSearch(q)}`;

export function activeFilterCount(q: PipelineQuery): number {
  let n = 0;
  if (q.bank !== DEFAULTS.bank) n++;
  if (q.q) n++;
  if (q.officer) n++;
  if (q.date !== DEFAULTS.date) n++;
  if (q.sort !== DEFAULTS.sort) n++;
  if (q.bucket !== 'all') n++;
  if (q.company) n++;
  if (q.hold) n++;
  if (q.queryStatus) n++;
  if (q.jFrom && q.jTo) n++;
  if (q.reached || q.stage || q.journeyStarted || q.untouched72) n++;
  return n;
}

export function drillLabel(q: PipelineQuery): string | null {
  const parts: string[] = [];
  if (q.reached) parts.push(`reached ${stageLabel(q.bank === 'DIB' ? 'DIB' : 'MAWARID', q.reached)}`);
  if (q.stage) parts.push(`at ${stageLabel(q.bank === 'DIB' ? 'DIB' : 'MAWARID', q.stage)}`);
  if (q.journeyStarted) parts.push('journey started');
  if (q.untouched72) parts.push('untouched over 72h');
  return parts.length ? parts.join(' · ') : null;
}

/** every filter except the bucket chip */
export function baseFilter(cases: Case[], q: PipelineQuery): Case[] {
  const [from, to] = presetRange(q.date, q.from && q.to ? [q.from, q.to] : undefined);
  const term = q.q.trim().toLowerCase();
  return cases.filter((c) => {
    if (q.bank !== 'ALL' && c.bank !== q.bank) return false;
    if ((q.view === 'archived') !== !!c.archived) return false;
    if (q.officer && c.officerId !== q.officer) return false;
    if (c.capturedAt < from || c.capturedAt >= to) return false;
    if (q.company && !c.companyProvided) return false;
    if (q.reached && !c.path.includes(q.reached)) return false;
    if (q.stage && c.stage !== q.stage) return false;
    if (q.journeyStarted && !c.journeyStartAt) return false;
    if (q.untouched72 && !(c.stage === 'to_contact' && NOW - c.stageSince > 72 * HOUR)) return false;
    if (q.hold && c.hold?.kind !== q.hold) return false;
    if (q.queryStatus === 'none' && c.query) return false;
    if ((q.queryStatus === 'open' || q.queryStatus === 'replied') && c.query?.status !== q.queryStatus) return false;
    if (q.jFrom && q.jTo && !(c.journeyStartAt && c.journeyStartAt >= q.jFrom && c.journeyStartAt < q.jTo + DAY)) return false;
    if (term) {
      const hay = `${c.name} ${c.employer} ${c.applicationNumber ?? ''} ${c.id}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });
}

export function bucketFilter(cases: Case[], bucket: PipelineQuery['bucket']) {
  return bucket === 'all' ? cases : cases.filter((c) => bucketOf(c) === bucket);
}

function urgency(c: Case): number {
  let s = lateBy(c) / HOUR;
  if (c.query) s += (NOW - c.query.raisedAt) / HOUR + (c.query.status === 'open' ? 48 : 12);
  if (c.hold) s += 24;
  if (['booked', 'declined', 'back_out', 'ineligible', 'dropped'].includes(c.stage)) s -= 10000;
  return s;
}

export function sortCases(cases: Case[], sort: SortId): Case[] {
  const a = [...cases];
  if (sort === 'updated') return a.sort((x, y) => y.updatedAt - x.updatedAt);
  if (sort === 'captured') return a.sort((x, y) => y.capturedAt - x.capturedAt);
  return a.sort((x, y) => urgency(y) - urgency(x) || x.stageSince - y.stageSince);
}
