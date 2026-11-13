export type Role = 'SM' | 'COORD' | 'CO';

export const ROLE_LABEL: Record<Role, string> = {
  SM: 'Sales Manager',
  COORD: 'Coordinator',
  CO: 'Compliance Officer',
};

export type BankId = 'MAWARID' | 'DIB';

/** Internal stage ids. Never printed: always go through stageLabel(). */
export type StageId =
  | 'to_contact'
  | 'contacted'
  | 'eligible'
  | 'ineligible'
  | 'dropped'
  | 'qualified'
  | 'pre_compliance'
  | 'applied'
  | 'wip'
  | 'on_hold'
  | 'approved'
  | 'post_compliance'
  | 'docs_submitted'
  | 'booked'
  | 'declined'
  | 'back_out';

export type BucketId =
  | 'with_officer'
  | 'to_qualify'
  | 'compliance'
  | 'to_file'
  | 'with_bank'
  | 'approved'
  | 'booked'
  | 'closed';

export type Product = 'card' | 'loan';
export type Journey = 'assisted' | 'self' | 'none';
export type PickupState = 'needs_approval' | 'needs_assignment' | 'assigned' | 'completed';

export interface QueryMessage {
  author: string;
  text: string;
  at: number;
}

export interface CaseQuery {
  id: string;
  /** customer queries block every stage move; mawarid queries block Qualify only */
  kind: 'customer' | 'mawarid';
  status: 'open' | 'replied';
  raisedBy: string;
  raisedAt: number;
  messages: QueryMessage[];
}

export interface ActivityEvent {
  at: number;
  text: string;
  by: string;
}

export type HoldKind = 'compliance' | 'manager' | 'amount_check' | 'bank';

export interface Hold {
  kind: HoldKind;
  since: number;
  reason: string;
}

export interface Case {
  id: string;
  bank: BankId;
  name: string;
  phone: string;
  email: string;
  employer: string;
  jobTitle: string;
  salary: number;
  consent: boolean;
  product: Product;
  journey: Journey;
  journeyStartAt?: number;
  companyProvided: boolean;
  batchId?: string;
  officerId: string;
  stage: StageId;
  stageSince: number;
  /** every stage the case has been at, in order (for funnel counts) */
  path: StageId[];
  checks: { pre?: number; post?: number };
  complianceRefused?: boolean;
  hold?: Hold;
  query?: CaseQuery;
  closedQueries: CaseQuery[];
  qualifiedBy?: string;
  qualifiedAt?: number;
  capturedAt: number;
  updatedAt: number;
  applicationNumber?: string;
  pickup?: PickupState;
  pickupAssignee?: string;
  docRequestOpen?: boolean;
  approvedAmount?: number;
  cardType?: string;
  tenure?: number;
  archived?: boolean;
  closeReason?: string;
  activity: ActivityEvent[];
}

export interface Officer {
  id: string;
  name: string;
  team: 'Team A' | 'Team B' | 'Team C';
}

export interface Batch {
  id: string;
  campaign: string;
  channel: string;
  platform: string;
  uploadedAt: number;
  uploadedBy: string;
  rowsUploaded: number;
  skipped: number;
  bank: BankId;
}

export type DeskCategory = 'decision' | 'queries' | 'followups';

export type DeskKind =
  | 'qualify'
  | 'approve_pickup'
  | 'reassign'
  | 'reply'
  | 'close_query'
  | 'assign_pickup'
  | 'nudge'
  | 'followup'
  | 'untouched';

export interface DeskTask {
  id: string;
  category: DeskCategory;
  kind: DeskKind;
  caseId: string;
  officerId: string;
  /** short label such as "Qualify" */
  verb: string;
  /** grey reason line */
  reason: string;
  since: number;
  /** system priority: higher first */
  priority: number;
  doneAt?: number;
  skipped?: boolean;
}
