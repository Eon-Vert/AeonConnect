import { create } from 'zustand';
import type { Batch, Case, DeskKind, DeskTask, Role, StageId, BankId, Product } from '../domain/types';
import { generate, CO_CODE, COORD_CODE, SM_CODE } from '../data/mock';
import { NOW } from '../domain/time';
import { ageLabel, bucketOf, canQualify, stageLabel } from '../domain/rules';

export type ListMode = 'normal' | 'loading' | 'empty' | 'error';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  title: string;
  subtitle?: string;
}

export interface NewLead {
  name: string;
  phone: string;
  email: string;
  employer: string;
  salary: number;
  product: Product;
  jobTitle?: string;
  officerId: string;
  note?: string;
}

interface State {
  role: Role;
  cases: Case[];
  batches: Batch[];
  deskTasks: DeskTask[];
  listMode: ListMode;
  toast: Toast | null;
  /** coordinator tasks marked done manually / skipped (by task key) */
  coordDone: string[];
  coordSkipped: string[];
  /** bumps to tell lists to show their loading state again (Refresh) */
  refreshNonce: number;

  setRole: (r: Role) => void;
  setListMode: (m: ListMode) => void;
  showToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: () => void;
  refresh: () => void;
  resetData: () => void;

  // desk
  skipDeskTask: (id: string) => void;
  completeDeskTask: (id: string) => void;
  nudge: (taskId: string) => void;

  // case actions
  qualify: (id: string, info: { quality: string; origination: string; risk: string[] }) => void;
  moveStage: (id: string, to: StageId, reason?: string) => void;
  fileCase: (id: string, appNumber: string) => void;
  replyQuery: (id: string, text: string) => void;
  closeQuery: (id: string) => void;
  addNote: (id: string, text: string) => void;
  passCheck: (id: string) => void;
  holdCheck: (id: string, reason: string) => void;
  raiseQuery: (id: string, text: string) => void;
  backOut: (id: string, reason: string) => void;
  approvePickup: (id: string) => void;
  assignPickup: (id: string, assignee: string) => void;
  completePickup: (id: string) => void;
  reassign: (ids: string[], officerId: string) => void;
  saveApproval: (id: string, d: { amount: number; cardType?: string; tenure?: number }) => void;
  recordOutcome: (id: string, outcome: 'approved' | 'declined' | 'on_hold', note: string) => void;

  // coordinator focus flow
  markCoordDone: (key: string) => void;
  skipCoord: (key: string) => void;

  // leads
  addLeads: (bank: BankId, leads: NewLead[], source: { campaign: string; channel: string; platform: string; skipped: number }) => number;
  addSingleLead: (bank: BankId, lead: NewLead) => string;
}

const actorFor = (r: Role) => (r === 'SM' ? SM_CODE : r === 'COORD' ? COORD_CODE : CO_CODE);
let toastId = 0;
let clock = NOW;
/** demo actions happen "now", a minute apart so the activity order is stable */
const tick = () => (clock += 60_000);

const initial = generate();

export const useStore = create<State>((set, get) => {
  const patchCase = (id: string, fn: (c: Case) => void, note?: string) => {
    set((s) => ({
      cases: s.cases.map((c) => {
        if (c.id !== id) return c;
        const n: Case = structuredClone(c);
        fn(n);
        n.updatedAt = clock;
        if (note) n.activity = [{ at: clock, text: note, by: actorFor(s.role) }, ...n.activity];
        return n;
      }),
    }));
  };
  const resolveDesk = (caseId: string, kinds: DeskKind[]) =>
    set((s) => ({
      deskTasks: s.deskTasks.map((t) => (t.caseId === caseId && kinds.includes(t.kind) && !t.doneAt ? { ...t, doneAt: clock } : t)),
    }));
  const toast = (title: string, subtitle?: string, kind: Toast['kind'] = 'success') => get().showToast({ kind, title, subtitle });
  const caseById = (id: string) => get().cases.find((c) => c.id === id)!;
  const setStage = (c: Case, to: StageId) => {
    c.stage = to;
    c.stageSince = clock;
    c.path = [...c.path, to];
  };

  return {
    role: 'SM',
    cases: initial.cases,
    batches: initial.batches,
    deskTasks: initial.deskTasks,
    listMode: 'normal',
    toast: null,
    coordDone: [],
    coordSkipped: [],
    refreshNonce: 0,

    setRole: (role) => set({ role }),
    setListMode: (listMode) => set({ listMode }),
    showToast: (t) => set({ toast: { ...t, id: ++toastId } }),
    dismissToast: () => set({ toast: null }),
    refresh: () => set((s) => ({ refreshNonce: s.refreshNonce + 1 })),
    resetData: () => {
      const d = generate();
      clock = NOW;
      set({ cases: d.cases, batches: d.batches, deskTasks: d.deskTasks, coordDone: [], coordSkipped: [] });
      toast('Demo data reset');
    },

    skipDeskTask: (id) => set((s) => ({ deskTasks: s.deskTasks.map((t) => (t.id === id ? { ...t, skipped: true } : t)) })),
    completeDeskTask: (id) => {
      tick();
      set((s) => ({ deskTasks: s.deskTasks.map((t) => (t.id === id ? { ...t, doneAt: clock } : t)) }));
    },
    nudge: (taskId) => {
      tick();
      const t = get().deskTasks.find((x) => x.id === taskId);
      if (!t) return;
      patchCase(t.caseId, () => {}, `Nudge sent to ${t.officerId}`);
      get().completeDeskTask(taskId);
      toast(`Nudge sent to ${t.officerId}`, `Case ${t.caseId}`);
    },

    qualify: (id, info) => {
      tick();
      const risk = info.risk.length ? info.risk.join(', ') : 'No risk flags';
      patchCase(
        id,
        (c) => {
          c.qualifiedBy = SM_CODE;
          c.qualifiedAt = clock;
          // DIB has no Pre-Compliance stage: the case waits for the Coordinator to file it.
          if (c.bank === 'MAWARID') setStage(c, 'pre_compliance');
        },
        `Qualified · ${info.quality} profile, ${info.origination} · ${risk}`,
      );
      resolveDesk(id, ['qualify']);
      const c = caseById(id);
      toast(`Case ${id} qualified`, c.bank === 'MAWARID' ? 'Sent to Pre-Compliance' : 'Ready for the Coordinator to file');
    },

    moveStage: (id, to, reason) => {
      tick();
      const c0 = caseById(id);
      const label = stageLabel(c0.bank, to);
      patchCase(
        id,
        (c) => {
          setStage(c, to);
          if (reason) c.closeReason = reason;
          if (to !== 'on_hold' && c.hold?.kind === 'bank') c.hold = undefined;
          if (to === 'on_hold') c.hold = { kind: 'bank', since: clock, reason: reason ?? 'Bank hold' };
          if (to === 'approved' && c.product === 'card' && !c.pickup) c.pickup = 'needs_approval';
          if (to === 'wip' || to === 'approved' || to === 'declined') c.docRequestOpen = false;
        },
        `Moved to ${label}${reason ? ` · ${reason}` : ''}`,
      );
      resolveDesk(id, ['nudge', 'untouched', 'qualify']);
      toast(`Case ${id} moved to ${label}`);
    },

    fileCase: (id, appNumber) => {
      tick();
      const c0 = caseById(id);
      patchCase(
        id,
        (c) => {
          c.applicationNumber = appNumber;
          setStage(c, 'applied');
        },
        `Filed with bank · ${appNumber}`,
      );
      toast(`Case ${id} filed`, `${stageLabel(c0.bank, 'applied')} · ${appNumber}`);
    },

    replyQuery: (id, text) => {
      tick();
      patchCase(
        id,
        (c) => {
          if (!c.query) return;
          c.query.messages.push({ author: actorFor(get().role), text, at: clock });
          c.query.status = 'replied';
        },
        'Replied to query',
      );
      resolveDesk(id, ['reply']);
      toast('Reply sent', 'Query is now Replied · waiting to close');
    },

    closeQuery: (id) => {
      tick();
      patchCase(
        id,
        (c) => {
          if (!c.query) return;
          c.closedQueries = [...c.closedQueries, c.query];
          c.query = undefined;
        },
        'Query closed',
      );
      resolveDesk(id, ['reply', 'close_query']);
      // a query was the only thing stopping Qualify: put the decision on the desk now
      const c = caseById(id);
      const hasQualifyTask = get().deskTasks.some((t) => t.caseId === id && t.kind === 'qualify' && !t.doneAt);
      if (c.bank === 'MAWARID' && bucketOf(c) === 'to_qualify' && !canQualify(c, 'SM').reason && !hasQualifyTask) {
        set((s) => ({
          deskTasks: [
            {
              id: `T-q-${id}-${clock}`,
              category: 'decision',
              kind: 'qualify',
              verb: 'Qualify',
              caseId: id,
              officerId: c.officerId,
              since: c.journeyStartAt!,
              reason: `Journey started ${ageLabel(NOW - c.journeyStartAt!)} ago · query now closed`,
              priority: 999,
            },
            ...s.deskTasks,
          ],
        }));
      }
      toast('Query closed', `Case ${id}`);
    },

    addNote: (id, text) => {
      tick();
      patchCase(id, () => {}, `Note: ${text}`);
      toast('Note added');
    },

    passCheck: (id) => {
      tick();
      const c0 = caseById(id);
      const point = c0.stage === 'pre_compliance' ? 'pre' : 'post';
      patchCase(
        id,
        (c) => {
          c.checks[point] = clock;
        },
        `${point === 'pre' ? 'Pre' : 'Post'}-compliance check passed`,
      );
      toast(`Check passed · Case ${id}`, 'Sent to the Coordinator queue');
    },

    holdCheck: (id, reason) => {
      tick();
      patchCase(
        id,
        (c) => {
          c.hold = { kind: 'compliance', since: clock, reason };
        },
        `Put on hold · compliance: ${reason}`,
      );
      toast(`Case ${id} on hold · compliance`);
    },

    raiseQuery: (id, text) => {
      tick();
      patchCase(
        id,
        (c) => {
          c.query = {
            id: `Q-${Math.floor(clock / 1000) % 100000}`,
            kind: 'mawarid',
            status: 'open',
            raisedBy: `Compliance (${CO_CODE})`,
            raisedAt: clock,
            messages: [{ author: `Compliance (${CO_CODE})`, text, at: clock }],
          };
        },
        'Query raised by Compliance',
      );
      toast('Query raised', `Case ${id}`);
    },

    backOut: (id, reason) => {
      tick();
      const c0 = caseById(id);
      patchCase(
        id,
        (c) => {
          setStage(c, 'back_out');
          c.closeReason = reason;
        },
        `Moved to ${stageLabel(c0.bank, 'back_out')} · ${reason}`,
      );
      toast(`Case ${id} moved to ${stageLabel(c0.bank, 'back_out')}`);
    },

    approvePickup: (id) => {
      tick();
      patchCase(id, (c) => (c.pickup = 'needs_assignment'), 'Document pickup approved');
      resolveDesk(id, ['approve_pickup']);
      toast('Pickup approved', `Case ${id} · assign it next`);
    },
    assignPickup: (id, assignee) => {
      tick();
      patchCase(
        id,
        (c) => {
          c.pickup = 'assigned';
          c.pickupAssignee = assignee;
        },
        `Document pickup assigned to ${assignee}`,
      );
      resolveDesk(id, ['assign_pickup', 'approve_pickup']);
      toast('Pickup assigned', `${assignee} · Case ${id}`);
    },
    completePickup: (id) => {
      tick();
      patchCase(id, (c) => (c.pickup = 'completed'), 'Document pickup completed');
      toast('Pickup marked completed', `Case ${id}`);
    },

    reassign: (ids, officerId) => {
      tick();
      for (const id of ids) {
        const from = caseById(id).officerId;
        patchCase(
          id,
          (c) => {
            c.officerId = officerId;
            setStage(c, 'to_contact');
            c.closeReason = undefined;
          },
          `Reassigned from ${from} to ${officerId} · back to To contact`,
        );
        resolveDesk(id, ['reassign']);
      }
      toast(ids.length === 1 ? `Case ${ids[0]} reassigned to ${officerId}` : `${ids.length} cases reassigned to ${officerId}`);
    },

    saveApproval: (id, d) => {
      tick();
      patchCase(
        id,
        (c) => {
          c.approvedAmount = d.amount;
          if (d.cardType) c.cardType = d.cardType;
          if (d.tenure) c.tenure = d.tenure;
        },
        `Approval details saved · AED ${d.amount.toLocaleString('en-US')}`,
      );
      toast('Approval details saved', `Case ${id}`);
    },

    recordOutcome: (id, outcome, note) => {
      tick();
      get().moveStage(id, outcome, outcome === 'approved' ? undefined : note || 'Bank outcome');
      patchCase(id, (c) => (c.docRequestOpen = false), note ? `Outcome note: ${note}` : undefined);
    },

    markCoordDone: (key) => set((s) => ({ coordDone: [...s.coordDone, key] })),
    skipCoord: (key) => set((s) => ({ coordSkipped: [...s.coordSkipped, key] })),

    addLeads: (bank, leads, source) => {
      tick();
      const batchId = `B-${300 + get().batches.length + 1}`;
      const batch: Batch = {
        id: batchId,
        bank,
        campaign: source.campaign,
        channel: source.channel,
        platform: source.platform,
        uploadedAt: clock,
        uploadedBy: SM_CODE,
        rowsUploaded: leads.length + source.skipped,
        skipped: source.skipped,
      };
      const created = leads.map((l, i) => newCase(bank, l, nextId(get().cases, bank, i), batchId, source.campaign));
      set((s) => ({ batches: [...s.batches, batch], cases: [...created, ...s.cases] }));
      return created.length;
    },
    addSingleLead: (bank, lead) => {
      tick();
      const c = newCase(bank, lead, nextId(get().cases, bank, 0));
      set((s) => ({ cases: [c, ...s.cases] }));
      return c.id;
    },
  };
});

function nextId(cases: Case[], bank: BankId, offset: number) {
  const prefix = bank === 'MAWARID' ? 'A-' : 'D-';
  const max = Math.max(...cases.filter((c) => c.id.startsWith(prefix)).map((c) => Number(c.id.slice(2))));
  return `${prefix}${String(max + 1 + offset).padStart(4, '0')}`;
}

function newCase(bank: BankId, l: NewLead, id: string, batchId?: string, campaign?: string): Case {
  return {
    id,
    bank,
    name: l.name,
    phone: l.phone,
    email: l.email,
    employer: l.employer,
    jobTitle: l.jobTitle ?? '—',
    salary: l.salary,
    consent: true,
    product: l.product,
    journey: 'none',
    companyProvided: !!batchId,
    batchId,
    officerId: l.officerId,
    stage: 'to_contact',
    stageSince: clock,
    path: ['to_contact'],
    checks: {},
    closedQueries: [],
    capturedAt: clock,
    updatedAt: clock,
    activity: [
      {
        at: clock,
        text: batchId ? `Company lead uploaded · ${campaign} (${batchId}) · assigned to ${l.officerId}` : `Lead added by Sales Manager · assigned to ${l.officerId}${l.note ? ` · ${l.note}` : ''}`,
        by: SM_CODE,
      },
    ],
  };
}

export const useRole = () => useStore((s) => s.role);
