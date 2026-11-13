import { Checkbox, Modal, RadioButton, RadioButtonGroup, Select, SelectItem, TextArea, TextInput } from '@carbon/react';
import { useState } from 'react';
import type { Case, StageId } from '../domain/types';
import { OFFICERS } from '../data/mock';
import { checkpointOf, passBlockedReason, stageLabel, type Transition } from '../domain/rules';

interface Base {
  open: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ Qualify */
const RISKS = ['Salary below product band', 'New employer (under 6 months)', 'Existing liabilities over 50% of salary', 'Address not verified'];

export function QualifyDialog({ open, onClose, c, onSubmit }: Base & { c: Case; onSubmit: (v: { quality: string; origination: string; risk: string[] }) => void }) {
  const [quality, setQuality] = useState('');
  const [origination, setOrigination] = useState('');
  const [risk, setRisk] = useState<string[]>([]);
  const [noRisk, setNoRisk] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const valid = quality && origination && (noRisk || risk.length > 0) && confirm;
  return (
    <Modal
      open={open}
      modalHeading={`Qualify ${c.name}`}
      modalLabel={`Case ${c.id}`}
      primaryButtonText="Qualify and send to Pre-Compliance"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!valid}
      onRequestClose={onClose}
      onRequestSubmit={() => valid && onSubmit({ quality, origination, risk: noRisk ? [] : risk })}
      size="sm"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <RadioButtonGroup legendText="Profile quality" name="quality" valueSelected={quality} onChange={(v) => setQuality(String(v))} orientation="horizontal">
          <RadioButton labelText="Strong" value="Strong" id="q-strong" />
          <RadioButton labelText="Average" value="Average" id="q-average" />
          <RadioButton labelText="Weak" value="Weak" id="q-weak" />
        </RadioButtonGroup>
        <Select id="origination" labelText="Origination" value={origination} onChange={(e) => setOrigination(e.target.value)}>
          <SelectItem value="" text="Choose origination" />
          <SelectItem value="Officer sourced" text="Officer sourced" />
          <SelectItem value="Company lead" text="Company lead" />
          <SelectItem value="Referral" text="Referral" />
          <SelectItem value="Walk-in" text="Walk-in" />
        </Select>
        <fieldset className="cds--fieldset">
          <legend className="cds--label">Risk flags</legend>
          {RISKS.map((r) => (
            <Checkbox
              key={r}
              id={`risk-${r}`}
              labelText={r}
              disabled={noRisk}
              checked={risk.includes(r)}
              onChange={(_, { checked }) => setRisk((x) => (checked ? [...x, r] : x.filter((y) => y !== r)))}
            />
          ))}
          <Checkbox
            id="risk-none"
            labelText="No risk flags"
            checked={noRisk}
            onChange={(_, { checked }) => {
              setNoRisk(checked);
              if (checked) setRisk([]);
            }}
          />
        </fieldset>
        <Checkbox id="q-confirm" labelText="I confirm this customer is ready for Pre-Compliance" checked={confirm} onChange={(_, { checked }) => setConfirm(checked)} />
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------- Move / File */
export function MoveDialog({
  open,
  onClose,
  c,
  transition,
  onSubmit,
}: Base & { c: Case; transition: Pick<Transition, 'to' | 'reasonRequired' | 'needsAppNumber'>; onSubmit: (v: { reason?: string; appNumber?: string }) => void }) {
  const [reason, setReason] = useState('');
  const [app, setApp] = useState(c.applicationNumber ?? '');
  const appValid = !transition.needsAppNumber || /^[A-Z]{2,3}-\d{4}-\d{4,6}$/.test(app.trim());
  const valid = (!transition.reasonRequired || reason.trim().length >= 3) && appValid;
  const target = stageLabel(c.bank, transition.to);
  return (
    <Modal
      open={open}
      modalHeading={transition.needsAppNumber ? `File Case ${c.id} with the bank` : `Move Case ${c.id} to ${target}`}
      modalLabel={c.name}
      primaryButtonText={transition.needsAppNumber ? 'File' : `Move to ${target}`}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!valid}
      danger={['back_out', 'declined', 'dropped', 'ineligible'].includes(transition.to)}
      onRequestClose={onClose}
      onRequestSubmit={() => valid && onSubmit({ reason: reason.trim() || undefined, appNumber: transition.needsAppNumber ? app.trim() : undefined })}
      size="sm"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {transition.needsAppNumber && (
          <TextInput
            id="app-number"
            labelText="Application number"
            placeholder={c.bank === 'MAWARID' ? 'MW-2026-04812' : 'DIB-2026-30117'}
            helperText="As shown on the bank portal"
            value={app}
            invalid={!!app && !appValid}
            invalidText="Use the format MW-2026-04812"
            onChange={(e) => setApp(e.target.value.toUpperCase())}
          />
        )}
        {transition.reasonRequired && (
          <TextArea id="move-reason" labelText="Reason (required)" rows={3} maxCount={240} enableCounter value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
        {!transition.needsAppNumber && !transition.reasonRequired && <p>The case moves to {target}. This is recorded in the activity log.</p>}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ Run check */
export type CheckOutcome = 'pass' | 'hold' | 'query' | 'back_out';

export function RunCheckDialog({ open, onClose, c, onSubmit }: Base & { c: Case; onSubmit: (o: CheckOutcome, text: string) => void }) {
  const [outcome, setOutcome] = useState<CheckOutcome | ''>('');
  const [text, setText] = useState('');
  const passReason = passBlockedReason(c);
  const held = c.hold?.kind === 'compliance';
  const needsText = outcome && outcome !== 'pass';
  const valid = !!outcome && (!needsText || text.trim().length >= 3);
  const point = checkpointOf(c) === 'pre' ? 'Pre-compliance' : 'Post-compliance';
  const label: Record<CheckOutcome, string> = { pass: 'Pass check', hold: 'Put on hold', query: 'Raise query', back_out: 'Back out' };
  return (
    <Modal
      open={open}
      modalHeading={`${point} check`}
      modalLabel={`Case ${c.id} · ${c.name}`}
      primaryButtonText={outcome ? label[outcome] : 'Choose an outcome'}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!valid}
      danger={outcome === 'back_out'}
      onRequestClose={onClose}
      onRequestSubmit={() => valid && onSubmit(outcome as CheckOutcome, text.trim())}
      size="sm"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <RadioButtonGroup legendText="Outcome" name="outcome" orientation="vertical" valueSelected={outcome} onChange={(v) => setOutcome(v as CheckOutcome)}>
          <RadioButton id="o-pass" value="pass" labelText={passReason ? `Pass check — ${passReason}` : 'Pass check'} disabled={!!passReason} />
          <RadioButton id="o-hold" value="hold" labelText={held ? 'Put on hold — already on hold' : 'Put on hold'} disabled={held} />
          <RadioButton id="o-query" value="query" labelText="Raise query" disabled={!!c.query} />
          <RadioButton id="o-back" value="back_out" labelText={`Back out (${stageLabel(c.bank, 'back_out')})`} />
        </RadioButtonGroup>
        {c.query && <p className="muted">A query is already open on this case, so another cannot be raised.</p>}
        {outcome === 'pass' && <p>The check is stamped as passed. The case stays at {stageLabel(c.bank, c.stage)} and moves to the Coordinator's queue.</p>}
        {needsText && (
          <TextArea
            id="check-text"
            labelText={outcome === 'query' ? 'Query for the Sales Manager (required)' : 'Reason (required)'}
            rows={3}
            maxCount={300}
            enableCounter
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- Reassign */
export function ReassignDialog({ open, onClose, cases, onSubmit }: Base & { cases: Case[]; onSubmit: (officerId: string) => void }) {
  const [officer, setOfficer] = useState('');
  const current = new Set(cases.map((c) => c.officerId));
  return (
    <Modal
      open={open}
      modalHeading={cases.length === 1 ? `Reassign Case ${cases[0].id}` : `Reassign ${cases.length} dropped leads`}
      modalLabel={cases.length === 1 ? cases[0].name : undefined}
      primaryButtonText="Reassign"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!officer}
      onRequestClose={onClose}
      onRequestSubmit={() => officer && onSubmit(officer)}
      size="sm"
    >
      <p style={{ marginBottom: '1rem' }}>
        The {cases.length === 1 ? 'case goes' : 'leads go'} back to To contact on the new officer's desk. The current officer cannot be chosen.
      </p>
      <Select id="reassign-officer" labelText="New officer" value={officer} onChange={(e) => setOfficer(e.target.value)}>
        <SelectItem value="" text="Choose an officer" />
        {OFFICERS.map((o) => (
          <SelectItem key={o.id} value={o.id} disabled={current.has(o.id)} text={`${o.id} · ${o.name} · ${o.team}${current.has(o.id) ? ' (current)' : ''}`} />
        ))}
      </Select>
    </Modal>
  );
}

/* --------------------------------------------------------- Assign pickup */
export function AssignPickupDialog({ open, onClose, c, onSubmit }: Base & { c: Case; onSubmit: (assignee: string) => void }) {
  const [who, setWho] = useState('');
  return (
    <Modal
      open={open}
      modalHeading={`Assign document pickup`}
      modalLabel={`Case ${c.id} · ${c.name}`}
      primaryButtonText="Assign pickup"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!who}
      onRequestClose={onClose}
      onRequestSubmit={() => who && onSubmit(who)}
      size="sm"
    >
      <Select id="pickup-who" labelText="Pickup by" value={who} onChange={(e) => setWho(e.target.value)}>
        <SelectItem value="" text="Choose who collects the documents" />
        <SelectItem value="Courier · Swift Docs" text="Courier · Swift Docs" />
        <SelectItem value="Courier · Falcon Express" text="Courier · Falcon Express" />
        <SelectItem value={`${c.officerId} (case officer)`} text={`${c.officerId} (case officer)`} />
      </Select>
    </Modal>
  );
}

/* ------------------------------------------------------- Record outcome */
export function OutcomeDialog({ open, onClose, c, onSubmit }: Base & { c: Case; onSubmit: (o: 'approved' | 'declined' | 'on_hold', note: string) => void }) {
  const [o, setO] = useState<'' | 'approved' | 'declined' | 'on_hold'>('');
  const [note, setNote] = useState('');
  const needsNote = o === 'declined' || o === 'on_hold';
  const valid = !!o && (!needsNote || note.trim().length >= 3);
  const opts: StageId[] = c.stage === 'wip' ? ['approved', 'declined', 'on_hold'] : ['approved', 'declined'];
  return (
    <Modal
      open={open}
      modalHeading="Record bank outcome"
      modalLabel={`Case ${c.id} · ${c.name}`}
      primaryButtonText="Record outcome"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!valid}
      onRequestClose={onClose}
      onRequestSubmit={() => valid && onSubmit(o as 'approved', note.trim())}
      size="sm"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {c.docRequestOpen && <p>The bank's document request will be marked as answered.</p>}
        <RadioButtonGroup legendText="Bank decision" name="outcome" orientation="vertical" valueSelected={o} onChange={(v) => setO(v as typeof o)}>
          {opts.map((s) => (
            <RadioButton key={s} id={`oc-${s}`} value={s} labelText={stageLabel(c.bank, s)} />
          ))}
        </RadioButtonGroup>
        <TextArea id="oc-note" labelText={needsNote ? 'Reason (required)' : 'Note (optional)'} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- Confirm */
export function ConfirmDialog({
  open,
  onClose,
  heading,
  body,
  confirmText,
  onConfirm,
  danger,
}: Base & { heading: string; body: string; confirmText: string; onConfirm: () => void; danger?: boolean }) {
  return (
    <Modal
      open={open}
      modalHeading={heading}
      primaryButtonText={confirmText}
      secondaryButtonText="Cancel"
      danger={danger}
      onRequestClose={onClose}
      onRequestSubmit={onConfirm}
      size="xs"
    >
      <p>{body}</p>
    </Modal>
  );
}
