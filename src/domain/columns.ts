/**
 * Pipeline column model.
 *
 * - Six main columns are fixed: always shown, never moved.
 * - Extra columns can be shown, hidden and reordered by each viewer (saved per role, on this
 *   device only). Shared links and the URL never carry a layout: they always open the default.
 * - Buckets promote columns next to the ones they relate to:
 *     To qualify                       → Salary, Consent after Name
 *     With bank, Approved, Booked, Closed → Journey start, Qualified by after Stage
 *   A promoted column leaves the trailing extras, so nothing appears twice.
 * - What a role may not see stays restricted (Salary reads "Restricted") wherever it sits.
 */
import type { BucketId, Role } from './types';

export type MainCol = 'name' | 'product' | 'with' | 'stage' | 'query' | 'updated';
export type ExtraCol = 'officer' | 'qualifiedBy' | 'journeyStart' | 'salary' | 'consent';
/** columns that appear only in some views, not user-orderable */
export type ContextCol = 'select' | 'custom' | 'bank' | 'checkpoint';
export type ColId = MainCol | ExtraCol | ContextCol;

export const MAIN_COLS: { id: MainCol; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'product', label: 'Product' },
  { id: 'with', label: 'With' },
  { id: 'stage', label: 'Stage' },
  { id: 'query', label: 'Query' },
  { id: 'updated', label: 'Updated' },
];

export const EXTRA_COLS: { id: ExtraCol; label: string }[] = [
  { id: 'officer', label: 'Sales Officer' },
  { id: 'qualifiedBy', label: 'Qualified by' },
  { id: 'journeyStart', label: 'Journey start' },
  { id: 'salary', label: 'Salary' },
  { id: 'consent', label: 'Consent' },
];
export const extraLabel = (id: ExtraCol) => EXTRA_COLS.find((c) => c.id === id)!.label;

export interface ColumnPrefs {
  order: ExtraCol[];
  hidden: ExtraCol[];
}
export const DEFAULT_PREFS: ColumnPrefs = {
  order: ['officer', 'qualifiedBy', 'journeyStart', 'salary', 'consent'],
  hidden: ['salary', 'consent'],
};

export const APPLICANT_BUCKETS: BucketId[] = ['with_bank', 'approved', 'booked', 'closed'];
export const QUALIFY_PROMOTED: ExtraCol[] = ['salary', 'consent'];
export const APPLICANT_PROMOTED: ExtraCol[] = ['journeyStart', 'qualifiedBy'];

export function bucketColumns(bucket: BucketId | 'all'): 'qualify' | 'applicant' | null {
  if (bucket === 'to_qualify') return 'qualify';
  if (bucket !== 'all' && APPLICANT_BUCKETS.includes(bucket)) return 'applicant';
  return null;
}

/* ------------------------------------------------------------- storage */
const key = (role: Role) => `aeon-columns-${role}`;
const isExtra = (x: unknown): x is ExtraCol => EXTRA_COLS.some((c) => c.id === x);

/** read this role's saved layout; anything unknown or missing falls back to the default */
export function loadPrefs(role: Role): ColumnPrefs {
  try {
    const raw = localStorage.getItem(key(role));
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<ColumnPrefs>;
    const order = (Array.isArray(p.order) ? p.order : []).filter(isExtra);
    // keep every known column exactly once, appending any the saved copy lacks
    const full = [...new Set([...order, ...DEFAULT_PREFS.order])];
    const hidden = (Array.isArray(p.hidden) ? p.hidden : []).filter(isExtra);
    return { order: full, hidden };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(role: Role, prefs: ColumnPrefs) {
  try {
    localStorage.setItem(key(role), JSON.stringify(prefs));
  } catch {
    /* storage unavailable: the layout lasts for this visit only */
  }
}

export function clearPrefs(role: Role) {
  try {
    localStorage.removeItem(key(role));
  } catch {
    /* nothing saved to clear */
  }
}

export const isDefaultPrefs = (p: ColumnPrefs) =>
  p.order.join() === DEFAULT_PREFS.order.join() && [...p.hidden].sort().join() === [...DEFAULT_PREFS.hidden].sort().join();

/* -------------------------------------------------------------- layout */
export interface LayoutOptions {
  prefs?: ColumnPrefs;
  /** which bucket promotion applies, and whether the viewer left it switched on */
  promote?: 'qualify' | 'applicant' | null;
  select?: boolean;
  custom?: boolean;
  bank?: boolean;
  checkpoint?: boolean;
  /** show the trailing extra columns at all (Pipeline yes; My Day queues no) */
  extras?: boolean;
}

export function columnLayout(o: LayoutOptions): ColId[] {
  const prefs = o.prefs ?? DEFAULT_PREFS;
  const promoted: ExtraCol[] = o.promote === 'qualify' ? QUALIFY_PROMOTED : o.promote === 'applicant' ? APPLICANT_PROMOTED : [];
  const cols: ColId[] = [];
  if (o.select) cols.push('select');
  cols.push('name');
  if (o.custom) cols.push('custom');
  if (o.bank) cols.push('bank');
  if (o.promote === 'qualify') cols.push(...QUALIFY_PROMOTED);
  cols.push('product', 'with');
  if (o.checkpoint) cols.push('checkpoint');
  cols.push('stage');
  if (o.promote === 'applicant') cols.push(...APPLICANT_PROMOTED);
  cols.push('query', 'updated');
  if (o.extras) cols.push(...prefs.order.filter((c) => !prefs.hidden.includes(c) && !promoted.includes(c)));
  return cols;
}
