/** Fixed demo clock so counts and ages are identical on every load. Friday 13 Nov 2026, 10:30 Dubai (UTC+4). */
export const NOW = Date.UTC(2026, 10, 13, 6, 30);
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
const TZ = 'Asia/Dubai';
const DUBAI_OFFSET = 4 * HOUR;

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const shortDateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });

export const fmtDate = (t: number) => dateFmt.format(t);
export const fmtShortDate = (t: number) => shortDateFmt.format(t);
export const fmtDateTime = (t: number) => dateTimeFmt.format(t);

/** start of the Dubai calendar day containing t */
export function dubaiDayStart(t: number): number {
  const local = t + DUBAI_OFFSET;
  return local - (local % DAY) - DUBAI_OFFSET;
}

export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'wtd'
  | 'last_week'
  | 'mtd'
  | 'last_month'
  | 'all'
  | 'custom';

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'wtd', label: 'Week to date' },
  { id: 'last_week', label: 'Last week' },
  { id: 'mtd', label: 'Month to date' },
  { id: 'last_month', label: 'Last month' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];
export const presetLabel = (p: DatePreset) => DATE_PRESETS.find((d) => d.id === p)!.label;

function dubaiParts(t: number) {
  const d = new Date(t + DUBAI_OFFSET);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), dow: d.getUTCDay() };
}
const dubaiMidnight = (y: number, m: number, d: number) => Date.UTC(y, m, d) - DUBAI_OFFSET;

/** [from, to) range in ms. Working week starts Monday. */
export function presetRange(p: DatePreset, custom?: [number, number]): [number, number] {
  const today = dubaiDayStart(NOW);
  const { y, m, dow } = dubaiParts(NOW);
  const sinceMonday = (dow + 6) % 7;
  switch (p) {
    case 'today':
      return [today, today + DAY];
    case 'yesterday':
      return [today - DAY, today];
    case 'wtd':
      return [today - sinceMonday * DAY, today + DAY];
    case 'last_week':
      return [today - (sinceMonday + 7) * DAY, today - sinceMonday * DAY];
    case 'mtd':
      return [dubaiMidnight(y, m, 1), today + DAY];
    case 'last_month':
      return [dubaiMidnight(y, m - 1, 1), dubaiMidnight(y, m, 1)];
    case 'custom':
      return custom ? [custom[0], custom[1] + DAY] : [0, Infinity];
    default:
      return [0, Infinity];
  }
}
