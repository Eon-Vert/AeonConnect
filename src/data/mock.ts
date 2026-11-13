/**
 * Seeded mock data. Every name, number and application id is invented.
 * Same seed → same data on every load.
 */
import type { ActivityEvent, Batch, BankId, Case, CaseQuery, DeskTask, Journey, Officer, Product, StageId } from '../domain/types';
import { DAY, HOUR, NOW } from '../domain/time';
import { BANKS, bucketOf, stageLabel } from '../domain/rules';

/* ----------------------------------------------------------------- random */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rnd = mulberry32(20261113);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const chance = (p: number) => rnd() < p;
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------------------------------------- vocabulary */
const FIRST = [
  'Amal', 'Bilal', 'Dana', 'Faris', 'Ghada', 'Hamza', 'Iman', 'Jamal', 'Kareem', 'Lina', 'Majed', 'Nadia', 'Omar',
  'Priya', 'Qasim', 'Rana', 'Samir', 'Tala', 'Usman', 'Vikram', 'Wafa', 'Yara', 'Zaid', 'Aisha', 'Bashir', 'Celine',
  'Deepak', 'Elena', 'Fahad', 'Grace', 'Hassan', 'Joanna', 'Khalid', 'Leila', 'Marco', 'Noura', 'Rashid', 'Sara',
  'Tariq', 'Ali', 'Mariam', 'Anil', 'Reem', 'Joseph', 'Hind', 'Kevin', 'Salma', 'Rohan', 'Huda', 'Ibrahim',
];
const LAST = [
  'Azmi', 'Barakat', 'Chaudhry', 'Darwish', 'Estrada', 'Fakhoury', 'Ghanem', 'Haddad', 'Iyer', 'Jaber', 'Kassem',
  'Lahoud', 'Mansour', 'Nair', 'Obeid', 'Pillai', 'Qureshi', 'Rahal', 'Saleh', 'Tamimi', 'Varghese', 'Wakim',
  'Yousef', 'Zaher', 'Abboud', 'Bitar', 'Castillo', 'Dsouza', 'Farouk', 'Gomez', 'Hijazi', 'Khoury', 'Menon',
  'Najjar', 'Reyes', 'Sabbagh', 'Thomas', 'Uddin',
];
const EMPLOYERS = [
  'Desert Pearl Logistics', 'Al Noor Trading', 'Gulf Crest Engineering', 'Palm Arc Hospitality', 'Blue Dune Retail',
  'Creekside Clinics', 'Falcon Ridge Aviation Services', 'Marina Point Realty', 'Oasis Grid Utilities',
  'Saffron Lane Foods', 'Harbour Line Shipping', 'Silver Sand Schools', 'Coral Bay Telecom', 'Summit Tower FM',
];
const TITLES = ['Accountant', 'Site Engineer', 'Nurse', 'Sales Executive', 'HR Officer', 'IT Analyst', 'Teacher',
  'Operations Supervisor', 'Pharmacist', 'Project Manager', 'Cashier', 'Architect'];
const CARD_TYPES = ['Platinum', 'Titanium', 'Signature', 'Classic'];

export const OFFICERS: Officer[] = [
  ['SO-01', 'Adel Sabbagh', 'Team A'], ['SO-02', 'Bina Menon', 'Team A'], ['SO-03', 'Carlos Reyes', 'Team A'],
  ['SO-04', 'Dalia Hijazi', 'Team A'], ['SO-05', 'Ehsan Qureshi', 'Team A'], ['SO-06', 'Farah Najjar', 'Team B'],
  ['SO-07', 'George Thomas', 'Team B'], ['SO-08', 'Hala Ghanem', 'Team B'], ['SO-09', 'Imran Uddin', 'Team B'],
  ['SO-10', 'Jana Khoury', 'Team B'], ['SO-11', 'Karan Iyer', 'Team C'], ['SO-12', 'Lama Bitar', 'Team C'],
  ['SO-13', 'Mazen Rahal', 'Team C'], ['SO-14', 'Nisha Pillai', 'Team C'], ['SO-15', 'Osama Darwish', 'Team C'],
].map(([id, name, team]) => ({ id, name, team }) as Officer);

export const SM_CODE = 'SM-02';
export const COORD_CODE = 'CD-01';
export const CO_CODE = 'CO-03';

const CUSTOMER_QUERIES = [
  'Customer asks whether the annual fee is waived in the first year.',
  'Customer wants to change the delivery address for the card.',
  'Customer asks why the approved limit is lower than requested.',
  'Customer says the salary transfer letter was already sent last week.',
  'Customer wants to know the early settlement charge on the loan.',
  'Customer asks if a second supplementary card is possible.',
];
const MAWARID_QUERIES = [
  'Salary certificate is older than 30 days. Please share a new one.',
  'Employer name on the application does not match the labour contract.',
  'Please confirm the customer is not an existing Mawarid card holder.',
  'Missing page 2 of the bank statement.',
];
const FOLLOWUP_TOPICS = [
  'Call back customer', 'Collect salary certificate', 'Collect Emirates ID copy', 'Confirm journey started',
  'Send documents link again', 'Confirm employer letter', 'Update customer on status',
];

export const CAMPAIGNS = ['Ramadan Cards', 'Salary Transfer Q4', 'Card Upgrade Nov', 'Expat Loans'];
export const CHANNELS = ['Ads', 'Marketing', 'Partnerships'];
export const AD_PLATFORMS = ['Meta', 'Google', 'TikTok', 'LinkedIn'];

/* ------------------------------------------------------------------ paths */
const MAIN: Record<BankId, StageId[]> = {
  MAWARID: ['to_contact', 'contacted', 'eligible', 'pre_compliance', 'applied', 'wip', 'approved', 'post_compliance', 'docs_submitted', 'booked'],
  DIB: ['to_contact', 'contacted', 'eligible', 'applied', 'wip', 'approved', 'post_compliance', 'booked'],
};

function pathFor(bank: BankId, stage: StageId): StageId[] {
  const main = MAIN[bank];
  const upTo = (s: StageId) => main.slice(0, main.indexOf(s) + 1);
  switch (stage) {
    case 'ineligible':
      return ['to_contact', 'contacted', 'ineligible'];
    case 'dropped':
      return chance(0.4) ? ['to_contact', 'contacted', 'eligible', 'dropped'] : ['to_contact', 'contacted', 'dropped'];
    case 'qualified':
      return ['to_contact', 'contacted', 'eligible', 'qualified'];
    case 'on_hold':
      return [...upTo('wip'), 'on_hold'];
    case 'declined':
      return [...upTo(chance(0.7) ? 'wip' : 'approved'), 'declined'];
    case 'back_out': {
      const from = pick(bank === 'MAWARID' ? (['pre_compliance', 'applied', 'wip', 'approved'] as StageId[]) : (['applied', 'wip'] as StageId[]));
      return [...upTo(from), 'back_out'];
    }
    default:
      return upTo(stage);
  }
}

/** typical hours sitting at the current stage */
function stageAgeHours(stage: StageId): number {
  switch (stage) {
    case 'to_contact':
      return chance(0.3) ? between(74, 200) : between(1, 110);
    case 'contacted':
      return chance(0.25) ? between(140, 260) : between(3, 120);
    case 'eligible':
      return between(4, 110);
    case 'pre_compliance':
    case 'post_compliance':
      return between(2, 70);
    case 'booked':
    case 'declined':
    case 'back_out':
    case 'ineligible':
    case 'dropped':
      return chance(0.45) ? between(12, 200) : between(200, 1100);
    default:
      return between(6, 160);
  }
}

/* ------------------------------------------------------------- plan table */
type Plan = [StageId, number, Partial<{ journey: boolean; prePassed: boolean; postPassed: boolean; qualified: boolean }>];
const PLAN: Record<BankId, Plan[]> = {
  MAWARID: [
    ['to_contact', 50, {}], ['contacted', 45, {}], ['eligible', 20, {}], ['eligible', 18, { journey: true }],
    ['ineligible', 15, {}], ['dropped', 20, {}], ['qualified', 2, {}], ['pre_compliance', 14, {}],
    ['pre_compliance', 12, { prePassed: true }], ['applied', 12, {}], ['wip', 16, {}], ['on_hold', 6, {}],
    ['approved', 12, {}], ['post_compliance', 5, {}], ['post_compliance', 5, { postPassed: true }],
    ['docs_submitted', 8, {}], ['booked', 26, {}], ['declined', 8, {}], ['back_out', 6, {}],
  ],
  DIB: [
    ['to_contact', 14, {}], ['contacted', 12, {}], ['eligible', 6, {}], ['eligible', 4, { journey: true }],
    ['eligible', 2, { journey: true, qualified: true }], ['ineligible', 4, {}], ['dropped', 6, {}], ['applied', 6, {}],
    ['wip', 6, {}], ['on_hold', 2, {}], ['approved', 4, {}], ['post_compliance', 3, {}],
    ['post_compliance', 1, { postPassed: true }], ['booked', 6, {}], ['declined', 2, {}], ['back_out', 2, {}],
  ],
};

/* -------------------------------------------------------------- builders */
export const maskPhone = (digits: string) => `+971 ${digits.slice(0, 2)} *** **${digits.slice(-2)}`;

function makePhone() {
  return `${pick(['50', '52', '54', '55', '56', '58'])}${String(int(1000000, 9999999))}`;
}

function makeBatches(): Batch[] {
  const defs: [string, string, string, number, BankId][] = [
    ['Ramadan Cards', 'Ads', 'Meta', 58, 'MAWARID'],
    ['Ramadan Cards', 'Ads', 'TikTok', 44, 'MAWARID'],
    ['Salary Transfer Q4', 'Marketing', 'Google', 37, 'MAWARID'],
    ['Expat Loans', 'Ads', 'Meta', 30, 'MAWARID'],
    ['Salary Transfer Q4', 'Ads', 'LinkedIn', 21, 'MAWARID'],
    ['Card Upgrade Nov', 'Marketing', 'Google', 16, 'MAWARID'],
    ['Expat Loans', 'Partnerships', 'Meta', 11, 'MAWARID'],
    ['Card Upgrade Nov', 'Ads', 'TikTok', 9, 'MAWARID'],
    ['Salary Transfer Q4', 'Ads', 'Meta', 5, 'MAWARID'],
    ['Card Upgrade Nov', 'Ads', 'Google', 3, 'MAWARID'],
    ['Ramadan Cards', 'Ads', 'Meta', 26, 'DIB'],
    ['Expat Loans', 'Marketing', 'Google', 6, 'DIB'],
  ];
  return defs.map(([campaign, channel, platform, daysAgo, bank], i) => ({
    id: `B-${String(301 + i)}`,
    campaign,
    channel,
    platform,
    bank,
    uploadedAt: NOW - daysAgo * DAY - int(1, 8) * HOUR,
    uploadedBy: SM_CODE,
    rowsUploaded: 0,
    skipped: int(1, 6),
  }));
}

function byFor(stage: StageId, c: Case): string {
  if (['to_contact', 'contacted', 'eligible', 'ineligible', 'dropped'].includes(stage)) return c.officerId;
  if (stage === 'pre_compliance' || stage === 'qualified') return SM_CODE;
  return COORD_CODE;
}

function buildActivity(c: Case, times: number[]): ActivityEvent[] {
  const ev: ActivityEvent[] = [];
  const b = c.batchId ? batchesCache.find((x) => x.id === c.batchId) : undefined;
  ev.push({
    at: c.capturedAt,
    text: b ? `Company lead uploaded · ${b.campaign} (${b.id})` : 'Lead captured by officer',
    by: b ? SM_CODE : c.officerId,
  });
  c.path.forEach((s, i) => {
    if (i === 0) return;
    const at = times[i];
    if (s === 'pre_compliance') ev.push({ at, text: 'Qualified · sent to Pre-Compliance', by: SM_CODE });
    else if (s === 'applied') ev.push({ at, text: `Filed with bank · ${c.applicationNumber ?? 'application number recorded'}`, by: COORD_CODE });
    else ev.push({ at, text: `Moved to ${stageLabel(c.bank, s)}`, by: byFor(s, c) });
    if (s === 'eligible' && c.journeyStartAt) ev.push({ at: c.journeyStartAt, text: `${c.journey === 'self' ? 'Self' : 'Assisted'} journey started`, by: c.officerId });
  });
  if (c.checks.pre) ev.push({ at: c.checks.pre, text: 'Pre-compliance check passed', by: CO_CODE });
  if (c.checks.post) ev.push({ at: c.checks.post, text: 'Post-compliance check passed', by: CO_CODE });
  if (c.hold) ev.push({ at: c.hold.since, text: `Put on hold · ${c.hold.kind}: ${c.hold.reason}`, by: c.hold.kind === 'compliance' ? CO_CODE : COORD_CODE });
  if (c.query) ev.push({ at: c.query.raisedAt, text: `Query raised by ${c.query.raisedBy}`, by: c.query.raisedBy });
  return ev.sort((a, b2) => b2.at - a.at);
}

let batchesCache: Batch[] = [];

function makeCase(bank: BankId, stage: StageId, opts: Plan[2], idx: number): Case {
  const first = pick(FIRST);
  const last = pick(LAST);
  const product: Product = chance(0.6) ? 'card' : 'loan';
  const officer = pick(OFFICERS);
  const path = pathFor(bank, stage);
  const stageSince = NOW - stageAgeHours(stage) * HOUR;
  // walk backwards to place earlier stages
  const times: number[] = new Array(path.length);
  times[path.length - 1] = stageSince;
  for (let i = path.length - 2; i >= 0; i--) times[i] = times[i + 1] - between(8, 52) * HOUR;
  // some leads sat in the system for weeks before anyone worked them
  const capturedAt = times[0] - (stage !== 'to_contact' && chance(0.5) ? between(6, 30) * DAY : between(0.2, 30) * HOUR);

  const journeyChosen = opts.journey || !['to_contact', 'contacted', 'eligible', 'ineligible', 'dropped'].includes(stage);
  const journey: Journey = journeyChosen ? (chance(0.18) ? 'self' : 'assisted') : 'none';
  const eligibleAt = path.includes('eligible') ? times[path.indexOf('eligible')] : undefined;
  const journeyStartAt = journeyChosen && eligibleAt ? eligibleAt + between(1, 20) * HOUR : undefined;

  const reached = (s: StageId) => path.includes(s);
  const c: Case = {
    id: `${bank}-${idx}`,
    bank,
    name: `${first} ${last}`,
    phone: makePhone(),
    email: `${first.toLowerCase()}.${last.toLowerCase()}${int(1, 99)}@mail.example`,
    employer: pick(EMPLOYERS),
    jobTitle: pick(TITLES),
    salary: int(8, 60) * 1000 + pick([0, 250, 500, 750]),
    consent: chance(0.9),
    product,
    journey,
    journeyStartAt: journeyStartAt && journeyStartAt < NOW ? journeyStartAt : undefined,
    companyProvided: false,
    officerId: officer.id,
    stage,
    stageSince,
    path,
    checks: {},
    closedQueries: [],
    capturedAt,
    updatedAt: Math.min(NOW, stageSince + between(0, 20) * HOUR),
    activity: [],
  };
  if (bank === 'MAWARID' && (reached('pre_compliance') || stage === 'qualified')) {
    c.qualifiedBy = SM_CODE;
    c.qualifiedAt = times[path.indexOf(reached('pre_compliance') ? 'pre_compliance' : 'qualified')];
  }
  if (opts.qualified) c.qualifiedAt = stageSince + between(1, 10) * HOUR;
  if (reached('pre_compliance') && (stage !== 'pre_compliance' || opts.prePassed)) {
    const at = stage === 'pre_compliance' ? Math.min(NOW - HOUR, stageSince + between(2, 20) * HOUR) : times[path.indexOf('pre_compliance')] + 4 * HOUR;
    c.checks.pre = at;
  }
  if (reached('post_compliance') && (stage !== 'post_compliance' || opts.postPassed)) {
    c.checks.post = stage === 'post_compliance' ? Math.min(NOW - HOUR, stageSince + between(2, 30) * HOUR) : times[path.indexOf('post_compliance')] + 3 * HOUR;
  }
  if (reached('applied')) c.applicationNumber = `${BANKS[bank].appPrefix}-2026-${String(int(10000, 99999))}`;
  if (reached('approved') && stage !== 'declined') {
    c.approvedAmount = product === 'card' ? int(10, 60) * 1000 : int(50, 350) * 1000;
    if (product === 'card') c.cardType = pick(CARD_TYPES);
    else c.tenure = pick([12, 24, 36, 48]);
  }
  if (product === 'card' && reached('approved')) c.pickup = 'completed';
  if (stage === 'on_hold') c.hold = { kind: 'bank', since: stageSince, reason: pick(['Bank awaiting employer verification', 'Bank requested updated salary certificate', 'Credit bureau check pending']) };
  if (['ineligible', 'dropped', 'declined', 'back_out'].includes(stage))
    c.closeReason = pick(['Salary below minimum', 'Customer not interested', 'No response after 3 attempts', 'Existing liabilities too high', 'Customer chose another bank']);
  // archive old closed and booked cases
  if (['booked', 'declined', 'back_out', 'ineligible', 'dropped'].includes(stage) && NOW - capturedAt > 45 * DAY) c.archived = true;
  (c as Case & { _times: number[] })._times = times;
  return c;
}

function makeQuery(c: Case, i: number, forced?: { kind?: CaseQuery['kind']; status?: CaseQuery['status'] }): CaseQuery {
  const kind = forced?.kind ?? (chance(0.6) ? 'customer' : 'mawarid');
  const status = forced?.status ?? (chance(0.6) ? 'open' : 'replied');
  const raisedAt = NOW - between(2, 120) * HOUR;
  const q: CaseQuery = {
    id: `Q-${5000 + i}`,
    kind,
    status,
    raisedBy: kind === 'customer' ? `Customer (via ${c.officerId})` : 'Mawarid',
    raisedAt,
    messages: [{ author: kind === 'customer' ? `Customer (via ${c.officerId})` : 'Mawarid', text: pick(kind === 'customer' ? CUSTOMER_QUERIES : MAWARID_QUERIES), at: raisedAt }],
  };
  if (status === 'replied') {
    q.messages.push({ author: SM_CODE, text: 'Shared the answer with the customer and attached the updated document.', at: Math.min(NOW - HOUR, raisedAt + between(2, 30) * HOUR) });
  }
  return q;
}

/* ---------------------------------------------------------------- dataset */
export interface Dataset {
  cases: Case[];
  batches: Batch[];
  deskTasks: DeskTask[];
}

export function generate(): Dataset {
  rnd = mulberry32(20261113);
  const batches = makeBatches();
  batchesCache = batches;
  const cases: Case[] = [];
  for (const bank of ['MAWARID', 'DIB'] as BankId[]) {
    let n = 0;
    for (const [stage, count, opts] of PLAN[bank]) {
      for (let i = 0; i < count; i++) cases.push(makeCase(bank, stage, opts, n++));
    }
  }

  // ids
  const mw = cases.filter((c) => c.bank === 'MAWARID');
  const pool = shuffle(Array.from({ length: 450 }, (_, i) => 801 + i)).slice(0, mw.length);
  const SHOWCASE = [1042, 981, 877, 1120, 1009, 991, 802, 1201, 1150, 1088];
  for (const s of SHOWCASE) if (!pool.includes(s)) pool[pool.findIndex((p) => !SHOWCASE.includes(p))] = s;
  mw.forEach((c, i) => (c.id = `A-${String(pool[i]).padStart(4, '0')}`));
  cases.filter((c) => c.bank === 'DIB').forEach((c, i) => (c.id = `D-${2001 + i * 3 + int(0, 2)}`));

  // company-provided (~30%), linked to batches uploaded before capture
  for (const c of cases) {
    if (!chance(0.3)) continue;
    const options = batches.filter((b) => b.bank === c.bank && b.uploadedAt <= c.capturedAt);
    if (!options.length) continue;
    const b = options[options.length - 1 - Math.floor(rnd() * Math.min(options.length, 4))];
    c.companyProvided = true;
    c.batchId = b.id;
  }

  // queries on ~15% of open cases
  let qi = 0;
  for (const c of cases) {
    if (['booked', 'declined', 'back_out', 'ineligible', 'dropped'].includes(c.stage)) continue;
    if (chance(0.16)) c.query = makeQuery(c, qi++);
  }

  const open = (stage: StageId, f: (c: Case) => boolean = () => true) => mw.filter((c) => c.stage === stage && f(c));

  // compliance holds and refusals
  open('pre_compliance', (c) => !c.checks.pre).slice(0, 3).forEach((c, i) => {
    c.hold = { kind: 'compliance', since: NOW - [26, 80, 100][i] * HOUR, reason: pick(['Salary certificate does not match employer letter', 'Address proof unclear', 'Name mismatch on Emirates ID']) };
  });
  open('post_compliance', (c) => !c.checks.post).slice(0, 1).forEach((c) => {
    c.hold = { kind: 'compliance', since: NOW - 30 * HOUR, reason: 'Signed documents missing customer initials' };
  });
  const toQualify = mw.filter((c) => bucketOf(c) === 'to_qualify');
  toQualify[1].complianceRefused = true;
  toQualify.slice(2, 5).forEach((c) => (c.journeyStartAt = undefined));

  // pickups on approved card cases
  const approvedCards = open('approved', (c) => c.product === 'card');
  approvedCards.forEach((c, i) => (c.pickup = (['needs_approval', 'needs_approval', 'needs_assignment', 'needs_assignment', 'assigned', 'assigned'] as const)[i] ?? 'completed'));
  open('post_compliance', (c) => c.product === 'card' && !c.checks.post).forEach((c, i) => {
    c.pickup = i % 2 === 0 ? 'assigned' : 'completed';
    if (c.pickup === 'assigned') c.pickupAssignee = 'Courier · Swift Docs';
  });
  for (const c of mw) if (c.pickup === 'assigned' && !c.pickupAssignee) c.pickupAssignee = 'Courier · Swift Docs';
  open('wip').slice(0, 5).forEach((c) => (c.docRequestOpen = true));

  /* showcase cases from the brief */
  const swapId = (target: string, c: Case | undefined) => {
    if (!c) return;
    const holder = cases.find((x) => x.id === target);
    if (holder && holder !== c) holder.id = c.id;
    c.id = target;
  };
  const used = new Set<Case>();
  const choose = (f: (c: Case) => boolean) => {
    const c = mw.find((x) => f(x) && !used.has(x));
    if (c) used.add(c);
    return c;
  };
  const a1042 = choose((c) => bucketOf(c) === 'to_qualify' && !!c.journeyStartAt && !c.complianceRefused);
  if (a1042) a1042.query = undefined;
  swapId('A-1042', a1042);
  swapId('A-0981', choose((c) => c.pickup === 'needs_approval'));
  const a0877 = choose((c) => c.stage === 'dropped' && !c.archived);
  swapId('A-0877', a0877);
  const a1120 = choose((c) => c.stage === 'contacted');
  if (a1120) a1120.query = makeQuery(a1120, qi++, { kind: 'customer', status: 'open' });
  if (a1120?.query) { a1120.query.raisedAt = NOW - 52 * HOUR; a1120.query.messages[0].at = NOW - 52 * HOUR; }
  swapId('A-1120', a1120);
  const a1009 = choose((c) => c.stage === 'wip');
  if (a1009) a1009.query = makeQuery(a1009, qi++, { kind: 'customer', status: 'replied' });
  swapId('A-1009', a1009);
  swapId('A-0991', choose((c) => c.pickup === 'needs_assignment'));
  const a0802 = choose((c) => c.stage === 'contacted' && !c.query);
  if (a0802) a0802.stageSince = NOW - 6.4 * DAY;
  swapId('A-0802', a0802);
  const a1201 = choose((c) => c.stage === 'pre_compliance' && !!c.checks.pre);
  if (a1201) {
    a1201.journey = 'self';
    a1201.query = undefined;
    a1201.checks.pre = NOW - 2.5 * HOUR;
  }
  swapId('A-1201', a1201);
  const a1150 = choose((c) => c.stage === 'post_compliance' && !!c.checks.post);
  if (a1150) a1150.checks.post = NOW - 2 * DAY - 3 * HOUR;
  swapId('A-1150', a1150);
  const a1088 = choose((c) => !!c.docRequestOpen);
  if (a1088) a1088.query = undefined;
  swapId('A-1088', a1088);
  if (a1150) a1150.query = undefined;
  const a0981 = cases.find((c) => c.id === 'A-0981');
  if (a0981) a0981.query = undefined;

  // SO-07: 9 company leads untouched over 72h
  const untouched = shuffle(mw.filter((c) => c.stage === 'to_contact' && !used.has(c))).slice(0, 9);
  const b7 = batches.filter((b) => b.bank === 'MAWARID' && NOW - b.uploadedAt > 8 * DAY).slice(-1)[0];
  untouched.forEach((c) => {
    c.officerId = 'SO-07';
    c.companyProvided = true;
    c.batchId = b7.id;
    c.stageSince = NOW - between(78, 190) * HOUR;
    c.capturedAt = c.stageSince - 2 * HOUR;
    c.updatedAt = c.stageSince;
    c.path = ['to_contact'];
    (c as Case & { _times: number[] })._times = [c.stageSince];
  });
  // other company to_contact leads stay fresh so SO-07 stands out
  for (const c of mw) {
    if (c.stage === 'to_contact' && c.companyProvided && !untouched.includes(c) && NOW - c.stageSince > 72 * HOUR) {
      c.stageSince = NOW - between(3, 50) * HOUR;
      c.capturedAt = c.stageSince - HOUR;
      c.updatedAt = c.stageSince;
      (c as Case & { _times: number[] })._times = [c.stageSince];
    }
  }

  // batch row counts and activity
  for (const b of batches) b.rowsUploaded = cases.filter((c) => c.batchId === b.id).length + b.skipped;
  for (const c of cases) {
    const times = (c as Case & { _times?: number[] })._times ?? [c.stageSince];
    if (c.capturedAt > times[0]) c.capturedAt = times[0] - HOUR;
    c.updatedAt = Math.max(c.updatedAt, c.stageSince, c.query?.messages.at(-1)?.at ?? 0);
    c.activity = buildActivity(c, times);
    delete (c as Case & { _times?: number[] })._times;
  }

  const deskTasks = buildDeskTasks(cases);
  return { cases, batches, deskTasks };
}

/* ------------------------------------------------------------- desk tasks */
export const DESK_TOTAL = 594;

function buildDeskTasks(cases: Case[]): DeskTask[] {
  const mw = cases.filter((c) => c.bank === 'MAWARID' && !c.archived);
  const tasks: DeskTask[] = [];
  let n = 0;
  const add = (t: Omit<DeskTask, 'id'>) => tasks.push({ id: `T-${++n}`, ...t });
  const hrs = (since: number) => (NOW - since) / HOUR;
  const days = (since: number) => Math.max(1, Math.round((NOW - since) / DAY));

  for (const c of mw) {
    if (bucketOf(c) === 'to_qualify') {
      add({ category: 'decision', kind: 'qualify', verb: 'Qualify', caseId: c.id, officerId: c.officerId, since: c.stageSince,
        reason: c.journeyStartAt ? `Journey started ${days(c.journeyStartAt)} days ago` : 'Journey chosen, not started', priority: 300 + hrs(c.stageSince) });
    }
    if (c.pickup === 'needs_approval') {
      add({ category: 'decision', kind: 'approve_pickup', verb: 'Approve pickup', caseId: c.id, officerId: c.officerId, since: c.stageSince,
        reason: `Approved ${days(c.stageSince)} days, card case`, priority: 320 + hrs(c.stageSince) });
    }
    if (c.stage === 'dropped' && NOW - c.stageSince < 25 * DAY) {
      add({ category: 'decision', kind: 'reassign', verb: 'Reassign', caseId: c.id, officerId: c.officerId, since: c.stageSince,
        reason: `Dropped ${days(c.stageSince)} days ago${c.companyProvided ? ', company lead' : ''}`, priority: 200 + hrs(c.stageSince) / 10 });
    }
    if (c.query) {
      const open = c.query.status === 'open';
      const last = c.query.messages.at(-1)!.at;
      add({ category: 'queries', kind: open ? 'reply' : 'close_query', verb: open ? 'Reply' : 'Close', caseId: c.id, officerId: c.officerId,
        since: open ? c.query.raisedAt : last,
        reason: open ? `Query waiting ${hrs(c.query.raisedAt) < 72 ? Math.round(hrs(c.query.raisedAt)) + 'h' : days(c.query.raisedAt) + 'd'}` : `Replied ${Math.max(1, Math.round(hrs(last)))}h ago, not closed`,
        priority: (open ? 400 : 250) + hrs(c.query.raisedAt) });
    }
    if (c.pickup === 'needs_assignment') {
      add({ category: 'followups', kind: 'assign_pickup', verb: 'Assign pickup', caseId: c.id, officerId: c.officerId, since: c.stageSince,
        reason: `Approved ${days(c.stageSince)} days, card case`, priority: 150 + hrs(c.stageSince) });
    }
    if ((c.stage === 'contacted' || (c.stage === 'eligible' && c.journey === 'none')) && NOW - c.stageSince >= 6 * DAY) {
      add({ category: 'followups', kind: 'nudge', verb: 'Nudge', caseId: c.id, officerId: c.officerId, since: c.stageSince,
        reason: `No move in ${Math.floor((NOW - c.stageSince) / DAY)} days`, priority: 120 + hrs(c.stageSince) });
    }
    if (c.stage === 'to_contact' && c.companyProvided && NOW - c.stageSince > 72 * HOUR) {
      add({ category: 'followups', kind: 'untouched', verb: 'Untouched company lead', caseId: c.id, officerId: c.officerId, since: c.stageSince,
        reason: `Company lead untouched ${days(c.stageSince)}d`, priority: 100 + hrs(c.stageSince) });
    }
  }

  // Overdue follow-ups fill the desk to exactly DESK_TOTAL; SO-14 carries 23.
  const remaining = DESK_TOTAL - tasks.length;
  const openCases = mw.filter((c) => !['booked', 'declined', 'back_out', 'ineligible', 'dropped'].includes(c.stage));
  const byOfficer = new Map<string, Case[]>();
  for (const c of openCases) byOfficer.set(c.officerId, [...(byOfficer.get(c.officerId) ?? []), c]);
  const quotas = new Map<string, number>([['SO-14', 23]]);
  const others = OFFICERS.filter((o) => o.id !== 'SO-14');
  const weight = (id: string) => (byOfficer.get(id)?.length ?? 0) * between(0.6, 1.4) + 1;
  const weights = others.map((o) => weight(o.id));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const rest = remaining - 23;
  others.forEach((o, i) => quotas.set(o.id, Math.floor((weights[i] / wSum) * rest)));
  let left = rest - others.reduce((s, o) => s + quotas.get(o.id)!, 0);
  for (let i = 0; left > 0; i++, left--) quotas.set(others[i % others.length].id, quotas.get(others[i % others.length].id)! + 1);
  for (const [officerId, q] of quotas) {
    const pool = byOfficer.get(officerId) ?? openCases;
    for (let i = 0; i < q; i++) {
      const c = pool[i % pool.length];
      const due = NOW - (officerId === 'SO-14' ? between(60, 150) : between(4, 120)) * HOUR;
      add({ category: 'followups', kind: 'followup', verb: 'Follow-up', caseId: c.id, officerId, since: due,
        reason: `Follow-up overdue ${hrs(due) < 72 ? Math.round(hrs(due)) + 'h' : days(due) + 'd'} · ${pick(FOLLOWUP_TOPICS)}`, priority: 50 + hrs(due) / 10 });
    }
  }
  return tasks.sort((a, b) => b.priority - a.priority);
}
