/**
 * The single rules file: stage lists per bank team, bucket mapping, the stage
 * transition map (pack doc 04), and every permission check. UI code asks these
 * functions; it never hard-codes stages or roles.
 */
import type { BankId, BucketId, Case, Role, StageId } from './types';
import { NOW, HOUR, DAY } from './time';

export type TagColor =
  | 'cool-gray'
  | 'blue'
  | 'teal'
  | 'red'
  | 'warm-gray'
  | 'magenta'
  | 'purple'
  | 'cyan'
  | 'green'
  | 'gray';

interface StageDef {
  id: StageId;
  label: string;
  color: TagColor;
}

interface BankDef {
  id: BankId;
  label: string;
  /** stage list in lifecycle order — read this, never assume a count */
  stages: StageDef[];
  appPrefix: string;
}

export const BANKS: Record<BankId, BankDef> = {
  MAWARID: {
    id: 'MAWARID',
    label: 'Mawarid',
    appPrefix: 'MW',
    stages: [
      { id: 'to_contact', label: 'To contact', color: 'cool-gray' },
      { id: 'contacted', label: 'Contacted', color: 'blue' },
      { id: 'eligible', label: 'Eligible', color: 'teal' },
      { id: 'ineligible', label: 'Ineligible', color: 'red' },
      { id: 'dropped', label: 'Dropped', color: 'warm-gray' },
      { id: 'qualified', label: 'Qualified', color: 'magenta' },
      { id: 'pre_compliance', label: 'Pre-Compliance', color: 'purple' },
      { id: 'applied', label: 'Applied', color: 'cyan' },
      { id: 'wip', label: 'WIP', color: 'purple' },
      { id: 'on_hold', label: 'On Hold', color: 'cool-gray' },
      { id: 'approved', label: 'Approved', color: 'green' },
      { id: 'post_compliance', label: 'Post-Compliance', color: 'purple' },
      { id: 'docs_submitted', label: 'Documents Submitted', color: 'teal' },
      { id: 'booked', label: 'Booked', color: 'green' },
      { id: 'declined', label: 'Declined', color: 'red' },
      { id: 'back_out', label: 'Back out', color: 'warm-gray' },
    ],
  },
  DIB: {
    id: 'DIB',
    label: 'DIB',
    appPrefix: 'DIB',
    stages: [
      { id: 'to_contact', label: 'To contact', color: 'cool-gray' },
      { id: 'contacted', label: 'Contacted', color: 'blue' },
      { id: 'eligible', label: 'Eligible', color: 'teal' },
      { id: 'ineligible', label: 'Ineligible', color: 'red' },
      { id: 'dropped', label: 'Dropped', color: 'warm-gray' },
      { id: 'applied', label: 'Pre-screening', color: 'cyan' },
      { id: 'wip', label: 'Work in Progress', color: 'purple' },
      { id: 'on_hold', label: 'Hold', color: 'cool-gray' },
      { id: 'approved', label: 'Approved', color: 'green' },
      { id: 'post_compliance', label: 'Post-Compliance', color: 'purple' },
      { id: 'booked', label: 'Booked', color: 'green' },
      { id: 'declined', label: 'Declined', color: 'red' },
      { id: 'back_out', label: 'Cancelled', color: 'warm-gray' },
    ],
  },
};

export function stageDef(bank: BankId, stage: StageId): StageDef {
  const d = BANKS[bank].stages.find((s) => s.id === stage);
  // Fallback keeps the UI from ever printing a raw id.
  return d ?? { id: stage, label: 'Unknown stage', color: 'gray' };
}
export const stageLabel = (bank: BankId, stage: StageId) => stageDef(bank, stage).label;
export const bankHasStage = (bank: BankId, stage: StageId) =>
  BANKS[bank].stages.some((s) => s.id === stage);

/* ------------------------------------------------------------------ buckets */

export const BUCKETS: { id: BucketId; label: string }[] = [
  { id: 'with_officer', label: 'With officer' },
  { id: 'to_qualify', label: 'To qualify' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'to_file', label: 'To file' },
  { id: 'with_bank', label: 'With bank' },
  { id: 'approved', label: 'Approved' },
  { id: 'booked', label: 'Booked' },
  { id: 'closed', label: 'Closed' },
];
/** a vertical divider sits before this bucket in the chip row */
export const BUCKET_DIVIDER_BEFORE: BucketId = 'with_bank';
export const bucketLabel = (b: BucketId) => BUCKETS.find((x) => x.id === b)!.label;

export function bucketOf(c: Case): BucketId {
  switch (c.stage) {
    case 'to_contact':
    case 'contacted':
      return 'with_officer';
    case 'eligible':
      if (c.journey === 'none') return 'with_officer';
      // DIB has no Pre-Compliance stage: a qualified DIB case waits to be filed.
      if (c.bank === 'DIB' && c.qualifiedAt) return 'to_file';
      return 'to_qualify';
    case 'qualified':
      return 'to_file';
    case 'pre_compliance':
      return c.checks.pre ? 'to_file' : 'compliance';
    case 'applied':
    case 'wip':
    case 'on_hold':
      return 'with_bank';
    case 'approved':
    case 'post_compliance':
    case 'docs_submitted':
      return 'approved';
    case 'booked':
      return 'booked';
    default:
      return 'closed';
  }
}

/** buckets each role works in; the rest collapse into "Other stages" */
export const OPEN_BUCKETS: Record<Role, BucketId[] | 'all'> = {
  SM: 'all',
  COORD: ['to_file', 'with_bank', 'approved'],
  CO: ['compliance', 'approved'],
};
export function bucketOpenFor(role: Role, b: BucketId) {
  const o = OPEN_BUCKETS[role];
  return o === 'all' || o.includes(b);
}

/* -------------------------------------------------------- whose desk ("With") */

export function withLabel(c: Case): string {
  const b = bucketOf(c);
  if (c.hold?.kind === 'compliance') return 'Compliance';
  switch (b) {
    case 'with_officer':
      return `Sales Officer · ${c.officerId}`;
    case 'to_qualify':
      return 'Sales Manager';
    case 'compliance':
      return 'Compliance';
    case 'to_file':
      return 'Coordinator';
    case 'with_bank':
      return 'Bank';
    case 'approved':
      if (c.stage === 'docs_submitted') return 'Bank';
      if (c.stage === 'post_compliance' && !c.checks.post) return 'Compliance';
      if (c.product === 'card' && (c.pickup === 'needs_approval' || c.pickup === 'needs_assignment'))
        return 'Sales Manager';
      return 'Coordinator';
    default:
      return '—';
  }
}

/* ------------------------------------------------------------ lateness (SLA) */

const SLA_HOURS: Partial<Record<StageId, number>> = {
  to_contact: 24,
  contacted: 72,
  eligible: 72,
  qualified: 24,
  pre_compliance: 24,
  applied: 48,
  wip: 120,
  on_hold: 72,
  approved: 72,
  post_compliance: 48,
  docs_submitted: 96,
};

export function lateBy(c: Case): number {
  const sla = SLA_HOURS[c.stage];
  if (!sla) return 0;
  if (c.stage === 'pre_compliance' && c.checks.pre) return 0;
  const over = NOW - c.stageSince - sla * HOUR;
  return over > 0 ? over : 0;
}

/* ----------------------------------------------------------- transition map */

export const MSG = {
  openQuery: 'Close the open query before moving this case',
  reasonRequired: 'Reason required',
  finalStage: 'Booked, Declined and Back out are final stages',
  bankStagesCoordinator: 'Only the Coordinator moves cases through bank stages',
  roleCannotMove: 'Your role cannot move cases at this stage',
  readOnly: 'Read-only for your role at this stage',
  liftHold: 'Only a Business Head, Head of Sales or Admin can lift this hold.',
  reassign: 'Only Sales Manager, Business Head or Admin can reassign',
  addLeads: 'Only a Sales Manager can add leads',
  pickupNotCompleted: 'Pickup not completed',
  preNotPassed: 'Pre-compliance check not passed',
  postNotPassed: 'Post-compliance check not passed',
  noAppNumber: 'Enter an application number to file this case',
};

export interface Transition {
  to: StageId;
  roles: Role[];
  reasonRequired?: boolean;
  /** needs an application number (opens the File dialog) */
  needsAppNumber?: boolean;
  guard?: (c: Case) => string | null;
}

const T = (to: StageId, roles: Role[], extra: Partial<Transition> = {}): Transition => ({ to, roles, ...extra });

const OFFICER_DESK: Role[] = ['SM']; // Sales Officers too, but they are history-only in the demo
const COORD: Role[] = ['COORD'];

const prePassed = (c: Case) => (c.checks.pre ? null : MSG.preNotPassed);
const postPassed = (c: Case) => (c.checks.post ? null : MSG.postNotPassed);

const BACK_OUT_FROM: StageId[] = [
  'pre_compliance',
  'applied',
  'wip',
  'on_hold',
  'approved',
  'post_compliance',
  'docs_submitted',
];

function baseMap(bank: BankId): Partial<Record<StageId, Transition[]>> {
  const m: Partial<Record<StageId, Transition[]>> = {
    to_contact: [T('contacted', OFFICER_DESK)],
    contacted: [
      T('eligible', OFFICER_DESK),
      T('ineligible', OFFICER_DESK, { reasonRequired: true }),
      T('dropped', OFFICER_DESK, { reasonRequired: true }),
    ],
    // Eligible with a journey chosen is handled by the Qualify action, not Move to.
    eligible: [
      T('ineligible', OFFICER_DESK, { reasonRequired: true }),
      T('dropped', OFFICER_DESK, { reasonRequired: true }),
    ],
    ineligible: [T('eligible', OFFICER_DESK), T('dropped', OFFICER_DESK, { reasonRequired: true })],
    dropped: [T('eligible', OFFICER_DESK), T('ineligible', OFFICER_DESK, { reasonRequired: true })],
    qualified: [T('pre_compliance', COORD), T('applied', COORD, { needsAppNumber: true })],
    pre_compliance: [T('applied', COORD, { needsAppNumber: true, guard: prePassed })],
    applied: [T('wip', COORD)],
    wip: [T('approved', COORD), T('declined', COORD, { reasonRequired: true }), T('on_hold', COORD, { reasonRequired: true })],
    on_hold: [T('approved', COORD), T('declined', COORD, { reasonRequired: true })],
    approved: [T('post_compliance', COORD), T('wip', COORD)],
    post_compliance: [T('docs_submitted', COORD, { guard: postPassed })],
    docs_submitted: [T('booked', COORD), T('declined', COORD, { reasonRequired: true })],
    booked: [],
    declined: [],
    back_out: [],
  };
  for (const s of BACK_OUT_FROM) {
    m[s] = [...(m[s] ?? []), T('back_out', ['COORD', 'SM'], { reasonRequired: true })];
  }
  if (bank === 'DIB') {
    // DIB has no Qualified, Pre-Compliance or Documents Submitted.
    // A qualified DIB case is filed straight from Eligible.
    m.eligible = [
      ...(m.eligible ?? []),
      T('applied', COORD, { needsAppNumber: true, guard: (c) => (c.qualifiedAt ? null : 'Qualify this case first') }),
    ];
    m.post_compliance = [T('booked', COORD, { guard: postPassed }), T('back_out', ['COORD', 'SM'], { reasonRequired: true })];
  }
  // drop anything that targets a stage the bank does not have
  for (const k of Object.keys(m) as StageId[]) {
    m[k] = (m[k] ?? []).filter((t) => bankHasStage(bank, t.to));
  }
  return m;
}

export const TRANSITIONS: Record<BankId, Partial<Record<StageId, Transition[]>>> = {
  MAWARID: baseMap('MAWARID'),
  DIB: baseMap('DIB'),
};

export const TERMINAL: StageId[] = ['booked', 'declined', 'back_out'];
const BANK_STAGES: StageId[] = ['qualified', 'pre_compliance', 'applied', 'wip', 'on_hold', 'approved', 'post_compliance', 'docs_submitted'];

export const hasOpenCustomerQuery = (c: Case) => c.query?.kind === 'customer';

export interface MoveOption {
  transition: Transition;
  label: string;
  disabledReason: string | null;
}

/** Move to ▾ for this role: only allowed targets, each disabled with its first blocking reason. */
export function moveOptions(c: Case, role: Role): { options: MoveOption[]; menuDisabledReason: string | null } {
  const all = TRANSITIONS[c.bank][c.stage] ?? [];
  const mine = all.filter((t) => t.roles.includes(role));
  if (TERMINAL.includes(c.stage)) return { options: [], menuDisabledReason: MSG.finalStage };
  if (!mine.length) {
    return {
      options: [],
      menuDisabledReason: BANK_STAGES.includes(c.stage) && role !== 'COORD' ? MSG.bankStagesCoordinator : MSG.roleCannotMove,
    };
  }
  if (!bucketOpenFor(role, bucketOf(c))) return { options: [], menuDisabledReason: MSG.readOnly };
  if (hasOpenCustomerQuery(c)) return { options: [], menuDisabledReason: MSG.openQuery };
  return {
    menuDisabledReason: null,
    options: mine.map((t) => ({
      transition: t,
      label: stageLabel(c.bank, t.to),
      disabledReason: t.guard?.(c) ?? null,
    })),
  };
}

/** Move to is shown to SM and Coordinator; the Compliance Officer never moves stages from it. */
export const roleSeesMoveTo = (role: Role) => role !== 'CO';

/* ---------------------------------------------------------- action checks */

export interface Check {
  /** show the control at all */
  visible: boolean;
  /** null = allowed */
  reason: string | null;
}
const hidden: Check = { visible: false, reason: null };
const ok: Check = { visible: true, reason: null };
const no = (reason: string): Check => ({ visible: true, reason });

export function canQualify(c: Case, role: Role): Check {
  if (bucketOf(c) !== 'to_qualify') return hidden;
  if (role !== 'SM') return no('Only a Sales Manager can qualify');
  if (!c.journeyStartAt) return no('Journey not started');
  if (c.query) return no(c.query.kind === 'customer' ? 'Open customer query' : 'Open Mawarid query');
  if (c.complianceRefused) return no('Compliance previously refused this customer');
  return ok;
}

export function canFile(c: Case, role: Role): Check {
  if (bucketOf(c) !== 'to_file') return hidden;
  if (role !== 'COORD') return no('Only the Coordinator files applications');
  if (hasOpenCustomerQuery(c)) return no(MSG.openQuery);
  if (c.stage === 'pre_compliance' && !c.checks.pre) return no(MSG.preNotPassed);
  return ok;
}

export function canRunCheck(c: Case, role: Role): Check {
  const pending =
    (c.stage === 'pre_compliance' && !c.checks.pre) || (c.stage === 'post_compliance' && !c.checks.post);
  if (!pending) return hidden;
  if (role !== 'CO') return no('Only a Compliance Officer runs checks');
  return ok;
}

export function checkpointOf(c: Case): 'pre' | 'post' | null {
  if (c.stage === 'pre_compliance') return 'pre';
  if (c.stage === 'post_compliance') return 'post';
  return null;
}

/** first reason the Compliance Officer cannot press Pass */
export function passBlockedReason(c: Case): string | null {
  if (c.hold?.kind === 'compliance') return `On hold · compliance. ${MSG.liftHold}`;
  if (checkpointOf(c) === 'post' && c.product === 'card' && c.pickup !== 'completed') return MSG.pickupNotCompleted;
  return null;
}

export function canLiftHold(c: Case, _role: Role): Check {
  if (c.hold?.kind !== 'compliance') return hidden;
  // None of the demo roles can lift a compliance hold: shown, disabled.
  return no(MSG.liftHold);
}

export function canReassign(c: Case, role: Role): Check {
  if (bucketOf(c) !== 'closed') return hidden;
  if (role !== 'SM') return no(MSG.reassign);
  return ok;
}

export function canAssignPickup(c: Case, role: Role): Check {
  if (c.product !== 'card' || c.stage !== 'approved') return hidden;
  if (c.pickup !== 'needs_assignment') return hidden;
  if (role !== 'SM') return no('Only a Sales Manager assigns pickups');
  return ok;
}

export function canApprovePickup(c: Case, role: Role): Check {
  if (c.product !== 'card' || c.pickup !== 'needs_approval') return hidden;
  if (role !== 'SM') return no('Only a Sales Manager approves pickups');
  return ok;
}

export function canCompletePickup(c: Case, role: Role): Check {
  if (c.product !== 'card' || c.pickup !== 'assigned') return hidden;
  if (role !== 'SM') return no('Only a Sales Manager confirms pickups');
  return ok;
}

export function canRecordOutcome(c: Case, role: Role): Check {
  if (c.stage !== 'approved') return hidden;
  if (role !== 'COORD') return no('Only the Coordinator records bank outcomes');
  return ok;
}

export function canAddLeads(role: Role): Check {
  return role === 'SM' ? ok : no(MSG.addLeads);
}

export const canSeeSalary = (role: Role) => role === 'SM';
export const canSeeArchived = (role: Role) => role === 'SM';

/* ------------------------------------------------------------- misc helpers */

export function ageLabel(ms: number): string {
  const h = Math.max(0, Math.floor(ms / HOUR));
  if (h < 72) return `${Math.max(h, 1)}h`;
  return `${Math.floor(ms / DAY)}d`;
}

export function durationLabel(ms: number): string {
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`;
  return `${Math.max(h, 1)}h`;
}
