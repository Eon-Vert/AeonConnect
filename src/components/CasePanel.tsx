import {
  Button,
  IconButton,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  TextArea,
  TextInput,
} from '@carbon/react';
import { ChevronDown, Close, Enterprise } from '@carbon/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { Case } from '../domain/types';
import { ROLE_LABEL } from '../domain/types';
import {
  BANKS,
  bucketOf,
  bucketOpenFor,
  canApprovePickup,
  canAssignPickup,
  canCompletePickup,
  canFile,
  canLiftHold,
  canQualify,
  canReassign,
  canRecordOutcome,
  canRunCheck,
  canSeeSalary,
  MSG,
  moveOptions,
  roleSeesMoveTo,
  stageLabel,
  type Transition,
} from '../domain/rules';
import { fmtDate, fmtDateTime } from '../domain/time';
import { maskPhone } from '../data/mock';
import { useStore } from '../state/store';
import { useUi } from '../state/ui';
import { Gate, StageTag } from './common';
import { JourneyIcon } from './CaseTable';
import {
  AssignPickupDialog,
  ConfirmDialog,
  MoveDialog,
  OutcomeDialog,
  QualifyDialog,
  ReassignDialog,
  RunCheckDialog,
} from './dialogs';

type Dialog =
  | { t: 'qualify' }
  | { t: 'move'; tr: Pick<Transition, 'to' | 'reasonRequired' | 'needsAppNumber'> }
  | { t: 'check' }
  | { t: 'reassign' }
  | { t: 'assign' }
  | { t: 'outcome' }
  | { t: 'closeQuery' }
  | null;

export function CasePanel() {
  const id = useUi((s) => s.panelCaseId);
  const close = useUi((s) => s.closePanel);
  const c = useStore((s) => s.cases.find((x) => x.id === id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.cds--modal.is-visible')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  if (!id || !c) return null;
  return (
    <>
      <div className="panel-scrim" onClick={close} />
      <PanelBody key={c.id} c={c} onClose={close} />
    </>
  );
}

function PanelBody({ c, onClose }: { c: Case; onClose: () => void }) {
  const role = useStore((s) => s.role);
  const st = useStore();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [appNo, setAppNo] = useState(c.applicationNumber ?? '');
  const [tab, setTab] = useState(c.query ? 0 : 1);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const readOnly = !bucketOpenFor(role, bucketOf(c));
  const gate = (check: { visible: boolean; reason: string | null }) => (readOnly && check.visible ? { ...check, reason: check.reason ?? MSG.readOnly } : check);

  const qualify = gate(canQualify(c, role));
  const file = gate(canFile(c, role));
  const runCheck = gate(canRunCheck(c, role));
  const lift = canLiftHold(c, role);
  const reassign = gate(canReassign(c, role));
  const approvePickup = gate(canApprovePickup(c, role));
  const assignPickup = gate(canAssignPickup(c, role));
  const completePickup = gate(canCompletePickup(c, role));
  const outcome = gate(canRecordOutcome(c, role));
  const moves = moveOptions(c, role);
  const appValid = /^[A-Z]{2,3}-\d{4}-\d{4,6}$/.test(appNo.trim());
  const showRecordBankOutcome = role === 'COORD' && (c.stage === 'wip' || c.stage === 'on_hold') && !readOnly && !c.query;
  const showSubmitDocs = role === 'COORD' && c.stage === 'post_compliance' && c.bank === 'MAWARID';

  const nudgeTask = st.deskTasks.find((t) => t.caseId === c.id && t.kind === 'nudge' && !t.doneAt);
  const done = () => setDialog(null);

  return (
    <aside className="side-panel" role="dialog" aria-modal="true" aria-label={`Case ${c.id}, ${c.name}`}>
      <div className="panel-head" style={{ position: 'relative' }}>
        <div className="panel-id">
          Case {c.id} · {BANKS[c.bank].label}
        </div>
        <h2>{c.name}</h2>
        <div className="tags">
          <StageTag c={c} size="md" />
          {c.companyProvided && (
            <Tag type="outline" renderIcon={Enterprise}>
              Company
            </Tag>
          )}
          <JourneyIcon c={c} />
          {c.journey === 'none' && <span className="icon-text muted">No journey yet</span>}
          {c.hold && <Tag type={c.hold.kind === 'compliance' ? 'magenta' : 'cool-gray'}>On hold · {c.hold.kind}</Tag>}
          {c.stage === 'pre_compliance' && c.checks.pre && <Tag type="green">Pre-check passed</Tag>}
          {c.stage === 'post_compliance' && c.checks.post && <Tag type="green">Post-check passed</Tag>}
        </div>
        <IconButton ref={closeRef} className="close-btn" kind="ghost" label="Close" align="left" onClick={onClose}>
          <Close />
        </IconButton>
      </div>

      {readOnly && (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title="Read-only"
          subtitle={`${ROLE_LABEL[role]} does not work cases at this stage.`}
          style={{ margin: '0.75rem 1.5rem 0', maxWidth: 'none' }}
        />
      )}

      <div className="panel-actions">
        {qualify.visible && (
          <Gate reason={qualify.reason}>
            <Button size="sm" disabled={!!qualify.reason} onClick={() => setDialog({ t: 'qualify' })}>
              Qualify
            </Button>
          </Gate>
        )}
        {approvePickup.visible && (
          <Gate reason={approvePickup.reason}>
            <Button size="sm" disabled={!!approvePickup.reason} onClick={() => st.approvePickup(c.id)}>
              Approve pickup
            </Button>
          </Gate>
        )}
        {assignPickup.visible && (
          <Gate reason={assignPickup.reason}>
            <Button size="sm" disabled={!!assignPickup.reason} onClick={() => setDialog({ t: 'assign' })}>
              Assign pickup
            </Button>
          </Gate>
        )}
        {completePickup.visible && (
          <Gate reason={completePickup.reason}>
            <Button size="sm" kind="secondary" disabled={!!completePickup.reason} onClick={() => st.completePickup(c.id)}>
              Mark pickup completed
            </Button>
          </Gate>
        )}
        {runCheck.visible && (
          <Gate reason={runCheck.reason}>
            <Button size="sm" disabled={!!runCheck.reason} onClick={() => setDialog({ t: 'check' })}>
              Run check
            </Button>
          </Gate>
        )}
        {lift.visible && (
          <Gate reason={lift.reason}>
            <Button size="sm" kind="tertiary" disabled>
              Lift hold
            </Button>
          </Gate>
        )}
        {reassign.visible && (
          <Gate reason={reassign.reason}>
            <Button size="sm" disabled={!!reassign.reason} onClick={() => setDialog({ t: 'reassign' })}>
              Reassign
            </Button>
          </Gate>
        )}
        {nudgeTask && role === 'SM' && (
          <Button size="sm" kind="secondary" onClick={() => st.nudge(nudgeTask.id)}>
            Nudge {c.officerId}
          </Button>
        )}
        {showRecordBankOutcome && (
          <Button size="sm" onClick={() => setDialog({ t: 'outcome' })}>
            Record outcome
          </Button>
        )}
        {showSubmitDocs && (
          <Gate reason={!c.checks.post ? MSG.postNotPassed : c.query?.kind === 'customer' ? MSG.openQuery : null}>
            <Button size="sm" disabled={!c.checks.post || c.query?.kind === 'customer'} onClick={() => st.moveStage(c.id, 'docs_submitted')}>
              Submit documents
            </Button>
          </Gate>
        )}
        {roleSeesMoveTo(role) && <MoveMenu c={c} moves={moves} onPick={(tr) => (tr.reasonRequired || tr.needsAppNumber ? setDialog({ t: 'move', tr }) : st.moveStage(c.id, tr.to))} />}

        {file.visible &&
          (role === 'COORD' ? (
            <div className="file-row">
              <TextInput
                id="panel-app-number"
                size="sm"
                labelText="Application number"
                placeholder={c.bank === 'MAWARID' ? 'MW-2026-04812' : 'DIB-2026-30117'}
                value={appNo}
                disabled={!!file.reason}
                invalid={!!appNo && !appValid}
                invalidText="Use the format MW-2026-04812"
                onChange={(e) => setAppNo(e.target.value.toUpperCase())}
              />
              <Gate reason={file.reason ?? (appValid ? null : MSG.noAppNumber)}>
                <Button size="sm" disabled={!!file.reason || !appValid} onClick={() => st.fileCase(c.id, appNo.trim())}>
                  File
                </Button>
              </Gate>
            </div>
          ) : (
            <Gate reason={file.reason}>
              <Button size="sm" kind="tertiary" disabled>
                File
              </Button>
            </Gate>
          ))}
      </div>

      {outcome.visible && role === 'COORD' && !readOnly && <ApprovalFields c={c} />}
      {c.stage === 'approved' && c.product === 'card' && c.pickup && (
        <p className="muted" style={{ padding: '0.75rem 1.5rem 0', fontSize: '0.8125rem' }}>
          Document pickup: {pickupText(c)}
        </p>
      )}

      <div className="summary-strip">
        <div>
          <div className="k">Product</div>
          <div className="v">{c.product === 'card' ? 'Credit Card' : 'Personal loan'}</div>
        </div>
        <div>
          <div className="k">Officer</div>
          <div className="v">{c.officerId}</div>
        </div>
        <div>
          <div className="k">Captured</div>
          <div className="v">{fmtDate(c.capturedAt)}</div>
        </div>
        <div>
          <div className="k">Application no.</div>
          <div className="v">{c.applicationNumber ?? '—'}</div>
        </div>
      </div>

      <div className="panel-body">
        <Tabs selectedIndex={tab} onChange={({ selectedIndex }: { selectedIndex: number }) => setTab(selectedIndex)}>
          <TabList aria-label="Case sections" contained={false}>
            <Tab>Queries{c.query ? ' (1)' : ''}</Tab>
            <Tab>Details</Tab>
            <Tab>Activity</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <QueriesTab c={c} onClose={() => setDialog({ t: 'closeQuery' })} />
            </TabPanel>
            <TabPanel>
              <DetailsTab c={c} />
            </TabPanel>
            <TabPanel>
              <ActivityTab c={c} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>

      {dialog?.t === 'qualify' && (
        <QualifyDialog
          open
          c={c}
          onClose={done}
          onSubmit={(v) => {
            st.qualify(c.id, v);
            done();
          }}
        />
      )}
      {dialog?.t === 'move' && (
        <MoveDialog
          open
          c={c}
          transition={dialog.tr}
          onClose={done}
          onSubmit={({ reason, appNumber }) => {
            if (appNumber) st.fileCase(c.id, appNumber);
            else st.moveStage(c.id, dialog.tr.to, reason);
            done();
          }}
        />
      )}
      {dialog?.t === 'check' && (
        <RunCheckDialog
          open
          c={c}
          onClose={done}
          onSubmit={(o, text) => {
            if (o === 'pass') st.passCheck(c.id);
            if (o === 'hold') st.holdCheck(c.id, text);
            if (o === 'query') st.raiseQuery(c.id, text);
            if (o === 'back_out') st.backOut(c.id, text);
            done();
          }}
        />
      )}
      {dialog?.t === 'reassign' && (
        <ReassignDialog
          open
          cases={[c]}
          onClose={done}
          onSubmit={(o) => {
            st.reassign([c.id], o);
            done();
          }}
        />
      )}
      {dialog?.t === 'assign' && (
        <AssignPickupDialog
          open
          c={c}
          onClose={done}
          onSubmit={(who) => {
            st.assignPickup(c.id, who);
            done();
          }}
        />
      )}
      {dialog?.t === 'outcome' && (
        <OutcomeDialog
          open
          c={c}
          onClose={done}
          onSubmit={(o, note) => {
            st.recordOutcome(c.id, o, note);
            done();
          }}
        />
      )}
      {dialog?.t === 'closeQuery' && (
        <ConfirmDialog
          open
          heading="Close this query?"
          body="The thread stays in the case history. Closing it unblocks stage moves."
          confirmText="Close query"
          onClose={done}
          onConfirm={() => {
            st.closeQuery(c.id);
            done();
          }}
        />
      )}
    </aside>
  );
}

function pickupText(c: Case) {
  switch (c.pickup) {
    case 'needs_approval':
      return 'waiting for Sales Manager approval';
    case 'needs_assignment':
      return 'approved, not assigned yet';
    case 'assigned':
      return `assigned to ${c.pickupAssignee}`;
    default:
      return 'Completed';
  }
}

/* ------------------------------------------------------------- Move to ▾ */
function MoveMenu({ c, moves, onPick }: { c: Case; moves: ReturnType<typeof moveOptions>; onPick: (t: Transition) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Gate reason={moves.menuDisabledReason}>
        <Button size="sm" kind="tertiary" renderIcon={ChevronDown} disabled={!!moves.menuDisabledReason} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
          Move to
        </Button>
      </Gate>
      {open && (
        <ul
          role="menu"
          aria-label={`Move Case ${c.id} to`}
          style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, minWidth: '16rem', background: 'var(--cds-layer-02)', boxShadow: '0 2px 8px rgba(0,0,0,.25)' }}
        >
          {moves.options.map((o) => (
            <li key={o.transition.to}>
              <button
                role="menuitem"
                className="cds--menu-item"
                disabled={!!o.disabledReason}
                onClick={() => {
                  setOpen(false);
                  onPick(o.transition);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.625rem 1rem',
                  background: 'none',
                  border: 0,
                  cursor: o.disabledReason ? 'not-allowed' : 'pointer',
                  color: o.disabledReason ? 'var(--cds-text-disabled)' : 'var(--cds-text-primary)',
                }}
              >
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{o.label}</span>
                {o.transition.reasonRequired && !o.disabledReason && <span className="muted" style={{ fontSize: '0.75rem' }}> · reason required</span>}
                {o.disabledReason && <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>{o.disabledReason}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------- Approval fields */
function ApprovalFields({ c }: { c: Case }) {
  const save = useStore((s) => s.saveApproval);
  const [amount, setAmount] = useState<number>(c.approvedAmount ?? 0);
  const [cardType, setCardType] = useState(c.cardType ?? '');
  const [tenure, setTenure] = useState<number>(c.tenure ?? 24);
  const valid = amount > 0 && (c.product === 'loan' || cardType);
  return (
    <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--cds-border-subtle-01)', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
      <NumberInput id="approved-amount" size="sm" label="Approved amount (AED)" min={0} step={1000} value={amount} onChange={(_e: unknown, { value }: { value: number | string }) => setAmount(Number(value))} hideSteppers />
      {c.product === 'card' ? (
        <Select id="card-type" size="sm" labelText="Card type" value={cardType} onChange={(e) => setCardType(e.target.value)}>
          <SelectItem value="" text="Choose" />
          {['Classic', 'Titanium', 'Platinum', 'Signature'].map((t) => (
            <SelectItem key={t} value={t} text={t} />
          ))}
        </Select>
      ) : (
        <Select id="tenure" size="sm" labelText="Tenure (months)" value={String(tenure)} onChange={(e) => setTenure(Number(e.target.value))}>
          {[12, 24, 36, 48].map((t) => (
            <SelectItem key={t} value={String(t)} text={String(t)} />
          ))}
        </Select>
      )}
      <Button size="sm" kind="secondary" disabled={!valid} onClick={() => save(c.id, { amount, cardType: c.product === 'card' ? cardType : undefined, tenure: c.product === 'loan' ? tenure : undefined })}>
        Save
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- Queries */
function QueriesTab({ c, onClose }: { c: Case; onClose: () => void }) {
  const reply = useStore((s) => s.replyQuery);
  const [text, setText] = useState('');
  const q = c.query;
  if (!q)
    return (
      <div className="empty-tab">
        No open query on this case.
        {c.closedQueries.length > 0 && ` ${c.closedQueries.length} closed ${c.closedQueries.length === 1 ? 'query is' : 'queries are'} in the Activity tab.`}
      </div>
    );
  return (
    <>
      <div className="query-head">
        <Tag type={q.status === 'open' ? 'red' : 'blue'}>{q.status === 'open' ? 'Open' : 'Replied · waiting to close'}</Tag>
        <span className="muted" style={{ fontSize: '0.75rem' }}>
          {q.kind === 'customer' ? 'Customer query' : 'Mawarid query'} · raised by {q.raisedBy} · {fmtDateTime(q.raisedAt)}
        </span>
        <span className="spacer" />
        <button className="link-btn" onClick={onClose}>
          Close query
        </button>
      </div>
      {q.kind === 'customer' && <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>An open customer query blocks every stage move.</p>}
      <div className="thread">
        {q.messages.map((m, i) => (
          <div key={i} className={`msg${m.author.startsWith('SM') || m.author.startsWith('CD') ? ' mine' : ''}`}>
            <div className="meta">
              {m.author} · {fmtDateTime(m.at)}
            </div>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      <TextArea id="reply" labelText="Reply" rows={3} maxCount={500} enableCounter value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply" />
      <div style={{ marginTop: '0.75rem' }}>
        <Button
          size="sm"
          disabled={!text.trim()}
          onClick={() => {
            reply(c.id, text.trim());
            setText('');
          }}
        >
          Reply
        </Button>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- Details */
function DetailsTab({ c }: { c: Case }) {
  const role = useStore((s) => s.role);
  const batch = useStore((s) => s.batches.find((b) => b.id === c.batchId));
  const rows: [string, string][] = [
    ['Mobile', maskPhone(c.phone)],
    ['Email', c.email],
    ['Employer', c.employer],
    ['Job title', c.jobTitle],
    ['Salary', canSeeSalary(role) ? `AED ${c.salary.toLocaleString('en-US')}` : 'Restricted'],
    ['Consent', c.consent ? 'Given' : 'Missing'],
    ['Product', c.product === 'card' ? 'Credit Card' : 'Personal loan'],
    ['Journey', c.journey === 'none' ? 'Not started' : c.journey === 'self' ? 'Self' : 'Assisted'],
    ['Journey start', c.journeyStartAt ? fmtDateTime(c.journeyStartAt) : '—'],
    ['Bank team', BANKS[c.bank].label],
    ['Stage', `${stageLabel(c.bank, c.stage)} since ${fmtDateTime(c.stageSince)}`],
    ['Sales Officer', c.officerId],
    ['Qualified by', c.qualifiedBy ?? '—'],
    ['Source', batch ? `${batch.campaign} · ${batch.channel} · ${batch.platform} (${batch.id})` : 'Officer sourced'],
    ['Application number', c.applicationNumber ?? '—'],
    ['Approved amount', c.approvedAmount ? `AED ${c.approvedAmount.toLocaleString('en-US')}` : '—'],
  ];
  if (c.cardType) rows.push(['Card type', c.cardType]);
  if (c.tenure) rows.push(['Tenure', `${c.tenure} months`]);
  if (c.hold) rows.push(['Hold', `${c.hold.kind === 'compliance' ? 'Compliance' : 'Bank'} · ${c.hold.reason}`]);
  if (c.closeReason) rows.push(['Close reason', c.closeReason]);
  return (
    <div className="details-grid">
      {rows.map(([k, v]) => (
        <div key={k}>
          <div className="k">{k}</div>
          <div className="v">{v}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Activity */
function ActivityTab({ c }: { c: Case }) {
  const addNote = useStore((s) => s.addNote);
  const [note, setNote] = useState('');
  return (
    <>
      <div style={{ marginTop: '1rem' }}>
        <TextArea id="note" labelText="Add note" rows={2} maxCount={300} enableCounter value={note} onChange={(e) => setNote(e.target.value)} />
        <Button
          size="sm"
          kind="tertiary"
          style={{ marginTop: '0.5rem' }}
          disabled={!note.trim()}
          onClick={() => {
            addNote(c.id, note.trim());
            setNote('');
          }}
        >
          Add note
        </Button>
      </div>
      <ol className="timeline">
        {c.activity.map((a, i) => (
          <li key={i}>
            <div className="t">{a.text}</div>
            <div className="m">
              {a.by} · {fmtDateTime(a.at)}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
