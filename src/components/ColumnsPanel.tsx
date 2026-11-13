import { Checkbox, IconButton, Modal } from '@carbon/react';
import { ArrowDown, ArrowUp, Draggable, Locked } from '@carbon/icons-react';
import { useEffect, useRef, useState } from 'react';
import type { Role } from '../domain/types';
import { ROLE_LABEL } from '../domain/types';
import { canSeeSalary } from '../domain/rules';
import { MAIN_COLS, extraLabel, type ColumnPrefs, type ExtraCol } from '../domain/columns';

/**
 * Show, hide and reorder the extra Pipeline columns. Drag to reorder, or use Move up / Move down
 * from the keyboard. Changes preview in the table at once; Done keeps them, Cancel (or the X) puts
 * back the layout from when the dialog opened. Saved for this role on this device only.
 */
export function ColumnsPanel({
  open,
  role,
  prefs,
  onChange,
  onReset,
  onClose,
}: {
  open: boolean;
  role: Role;
  prefs: ColumnPrefs;
  onChange: (p: ColumnPrefs) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [dragging, setDragging] = useState<ExtraCol | null>(null);
  const [over, setOver] = useState<ExtraCol | null>(null);
  const [announce, setAnnounce] = useState('');
  const order = prefs.order;
  // the layout as it was when the dialog opened, for Cancel
  const snapshot = useRef(prefs);
  useEffect(() => {
    if (open) snapshot.current = prefs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const cancel = () => {
    onChange(snapshot.current);
    onClose();
  };

  const move = (id: ExtraCol, to: number, how: 'keyboard' | 'drag') => {
    const from = order.indexOf(id);
    if (to < 0 || to >= order.length || to === from) return;
    const next = order.filter((x) => x !== id);
    next.splice(to, 0, id);
    onChange({ ...prefs, order: next });
    if (how === 'keyboard') {
      setAnnounce(`${extraLabel(id)} moved to position ${to + 1} of ${order.length}`);
      // keep focus on the same control after the row moves
      requestAnimationFrame(() => document.getElementById(`col-${id}-${to < from ? 'up' : 'down'}`)?.focus());
    }
  };
  const toggle = (id: ExtraCol, show: boolean) =>
    onChange({ ...prefs, hidden: show ? prefs.hidden.filter((x) => x !== id) : [...prefs.hidden, id] });

  return (
    <Modal
      open={open}
      modalHeading="Columns"
      modalLabel="Pipeline"
      primaryButtonText="Done"
      // standard Carbon three-button footer: Cancel and Reset on the left, Done on the right
      secondaryButtons={[
        { buttonText: 'Cancel', onClick: cancel },
        { buttonText: 'Reset to default', onClick: onReset },
      ]}
      onRequestSubmit={onClose}
      onRequestClose={cancel}
      size="md"
      className="columns-panel"
    >
      <p className="helper-line">
        Saved on this device for {ROLE_LABEL[role]}. Shared links always open with the default layout.
      </p>

      <h3 className="cols-heading">Always shown · can't be moved or hidden</h3>
      <ul className="cols-fixed-list" aria-label="Fixed columns">
        {MAIN_COLS.map((c) => (
          <li key={c.id} className="cols-row is-fixed">
            <Locked size={14} aria-hidden />
            <span className="cols-label">{c.label}</span>
            <span className="sr-only">, fixed</span>
          </li>
        ))}
      </ul>

      <h3 className="cols-heading">Extra columns</h3>
      <p className="helper-line">Drag to reorder, or use the arrows. Some buckets move a column next to Name or Stage while that bucket is selected.</p>
      <ul className="cols-list" aria-label="Extra columns, in order">
        {order.map((id, i) => {
          const shown = !prefs.hidden.includes(id);
          return (
            <li
              key={id}
              data-col={id}
              className={`cols-row${dragging === id ? ' is-dragging' : ''}${over === id && dragging !== id ? ' is-over' : ''}`}
              draggable
              onDragStart={(e) => {
                setDragging(id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(id);
              }}
              onDragLeave={() => setOver((o) => (o === id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const src = (e.dataTransfer.getData('text/plain') || dragging) as ExtraCol;
                if (src) move(src, order.indexOf(id), 'drag');
                setDragging(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <span className="cols-handle" aria-hidden title="Drag to reorder">
                <Draggable size={16} />
              </span>
              <Checkbox id={`col-show-${id}`} labelText={extraLabel(id)} checked={shown} onChange={(_, { checked }) => toggle(id, checked)} />
              {id === 'salary' && !canSeeSalary(role) && <span className="cols-note">Restricted for your role</span>}
              <span className="cols-moves">
                <IconButton id={`col-${id}-up`} kind="ghost" size="sm" label={`Move ${extraLabel(id)} up`} align="left" disabled={i === 0} onClick={() => move(id, i - 1, 'keyboard')}>
                  <ArrowUp />
                </IconButton>
                <IconButton id={`col-${id}-down`} kind="ghost" size="sm" label={`Move ${extraLabel(id)} down`} align="left" disabled={i === order.length - 1} onClick={() => move(id, i + 1, 'keyboard')}>
                  <ArrowDown />
                </IconButton>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </Modal>
  );
}
