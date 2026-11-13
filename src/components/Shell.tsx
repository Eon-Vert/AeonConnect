import { Button, IconButton, RadioButton, RadioButtonGroup, ToastNotification } from '@carbon/react';
import { Checkmark, ChevronDown, Pin, PinFilled, UserAvatar } from '@carbon/icons-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, type Role } from '../domain/types';
import { NAV, isGroup, type NavGroup } from '../nav';
import { useStore, type ListMode } from '../state/store';
import { useUi } from '../state/ui';
import { CasePanel } from './CasePanel';

const PIN_KEY = 'aeon-nav-pinned';
function readPin() {
  try {
    return localStorage.getItem(PIN_KEY) === '1';
  } catch {
    return false;
  }
}

export function Shell() {
  const [pinned, setPinned] = useState(readPin);
  const [hover, setHover] = useState(false);
  const location = useLocation();
  const closePanel = useUi((s) => s.closePanel);

  useEffect(() => closePanel(), [location.pathname, closePanel]);
  const togglePin = () => {
    setPinned((p) => {
      try {
        localStorage.setItem(PIN_KEY, p ? '0' : '1');
      } catch {
        /* storage unavailable: pin lasts for this visit only */
      }
      return !p;
    });
  };

  return (
    <>
      <header className="app-header">
        <span className="brand">AEON Connect</span>
        <span className="brand-sep">|</span>
        <span className="brand-team">Mawarid</span>
        <span className="header-right">Dubai time · Fri 13 Nov 2026, 10:30</span>
      </header>
      <SideNav expanded={pinned || hover} pinned={pinned} hover={hover} setHover={setHover} onPin={togglePin} />
      <main className={`app-main${pinned ? ' nav-pinned' : ''}`}>
        <Outlet />
      </main>
      <CasePanel />
      <RoleSwitcher />
      <ToastHost />
    </>
  );
}

function SideNav({ expanded, pinned, hover, setHover, onPin }: { expanded: boolean; pinned: boolean; hover: boolean; setHover: (h: boolean) => void; onPin: () => void }) {
  const role = useStore((s) => s.role);
  const [closed, setClosed] = useState<string[]>([]);
  const timer = useRef<number>();
  return (
    <nav
      className={`side-nav${expanded ? ' is-expanded' : ''}${pinned ? ' is-pinned' : ''}${hover ? ' is-hover' : ''}`}
      aria-label="Main navigation"
      onMouseEnter={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setHover(true), 80);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setHover(false);
      }}
      onFocus={() => setHover(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHover(false)}
    >
      <div className="nav-pin-row">
        {expanded && (
          <IconButton kind="ghost" size="sm" label={pinned ? 'Unpin navigation' : 'Pin navigation open'} align="right" onClick={onPin}>
            {pinned ? <PinFilled /> : <Pin />}
          </IconButton>
        )}
      </div>
      <ul>
        {NAV[role].map((e) =>
          isGroup(e) ? (
            <Group key={e.label} g={e} open={!closed.includes(e.label)} toggle={() => setClosed((c) => (c.includes(e.label) ? c.filter((x) => x !== e.label) : [...c, e.label]))} />
          ) : (
            <li key={e.to}>
              <RouterLink to={e.to} className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`} title={expanded ? undefined : e.label}>
                <e.icon size={20} aria-hidden />
                <span className="nav-label">{e.label}</span>
              </RouterLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

function Group({ g, open, toggle }: { g: NavGroup; open: boolean; toggle: () => void }) {
  return (
    <li>
      <button className={`nav-group-btn${open ? ' is-open' : ''}`} aria-expanded={open} onClick={toggle} title={g.label}>
        <g.icon size={20} aria-hidden />
        <span className="nav-label">{g.label}</span>
        <ChevronDown size={16} className="chev" aria-hidden />
      </button>
      {open && (
        <ul className="nav-sub">
          {g.children.map((l) => (
            <li key={l.to}>
              <RouterLink to={l.to} className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}>
                <span className="nav-label">{l.label}</span>
              </RouterLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const MODES: { id: ListMode; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
  { id: 'error', label: 'Error' },
];

function RoleSwitcher() {
  const role = useStore((s) => s.role);
  const setRole = useStore((s) => s.setRole);
  const listMode = useStore((s) => s.listMode);
  const setListMode = useStore((s) => s.setListMode);
  const resetData = useStore((s) => s.resetData);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open]);

  const choose = (r: Role) => {
    setRole(r);
    setOpen(false);
    navigate('/my-day');
  };

  return (
    <div className="role-switcher" ref={ref}>
      {open && (
        <div className="role-menu" role="menu" aria-label="Switch role">
          <div className="menu-title">View the prototype as</div>
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <button key={r} role="menuitemradio" aria-checked={r === role} className={`menu-item${r === role ? ' is-current' : ''}`} onClick={() => choose(r)}>
              <span style={{ width: 16 }}>{r === role && <Checkmark size={16} />}</span>
              {ROLE_LABEL[r]}
            </button>
          ))}
          <div className="menu-divider" />
          <div className="menu-title">Demo controls: list state</div>
          <div className="dev-row">
            <RadioButtonGroup name="list-mode" legendText="" orientation="vertical" valueSelected={listMode} onChange={(v) => setListMode(v as ListMode)}>
              {MODES.map((m) => (
                <RadioButton key={m.id} id={`mode-${m.id}`} value={m.id} labelText={m.label} />
              ))}
            </RadioButtonGroup>
          </div>
          <div className="dev-row">
            <Button
              kind="ghost"
              size="sm"
              onClick={() => {
                resetData();
                setOpen(false);
              }}
            >
              Reset demo data
            </Button>
          </div>
        </div>
      )}
      <Button className="role-btn" kind="primary" size="md" renderIcon={UserAvatar} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        Viewing as: {ROLE_LABEL[role]}
        {listMode !== 'normal' ? ` · ${listMode}` : ''}
      </Button>
    </div>
  );
}

function ToastHost() {
  const toast = useStore((s) => s.toast);
  const dismiss = useStore((s) => s.dismissToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);
  if (!toast) return null;
  return (
    <div className="toast-host" aria-live="polite">
      <ToastNotification key={toast.id} kind={toast.kind} title={toast.title} subtitle={toast.subtitle} onClose={() => (dismiss(), false)} timeout={0} lowContrast />
    </div>
  );
}
