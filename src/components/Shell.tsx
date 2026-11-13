import { Button, IconButton, RadioButton, RadioButtonGroup, ToastNotification } from '@carbon/react';
import { Checkmark, ChevronDown, Close, Menu, UserAvatar } from '@carbon/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, type Role } from '../domain/types';
import { NAV, isGroup, type NavGroup } from '../nav';
import { useStore, type ListMode } from '../state/store';
import { useUi } from '../state/ui';
import { CasePanel } from './CasePanel';
import { buildTasks } from '../pages/CoordinatorMyDay';
import { isToCheck } from '../pages/ComplianceMyDay';

const PIN_KEY = 'aeon-nav-pinned';
function readPin() {
  try {
    return localStorage.getItem(PIN_KEY) === '1';
  } catch {
    return false;
  }
}

/** the number shown on My Day in the nav: the same count each role's My Day leads with */
function useMyDayCount(role: Role): number {
  const deskTasks = useStore((s) => s.deskTasks);
  const cases = useStore((s) => s.cases);
  const coordDone = useStore((s) => s.coordDone);
  const coordSkipped = useStore((s) => s.coordSkipped);
  return useMemo(() => {
    if (role === 'SM') return deskTasks.filter((t) => !t.doneAt).length;
    if (role === 'COORD') return buildTasks(cases).filter((t) => !coordDone.includes(t.key) && !coordSkipped.includes(t.key)).length;
    return cases.filter(isToCheck).length;
  }, [role, deskTasks, cases, coordDone, coordSkipped]);
}
const MY_DAY_COUNT_LABEL: Record<Role, string> = { SM: 'tasks on your desk', COORD: 'recommended tasks', CO: 'cases to check' };

export function Shell() {
  const [pinned, setPinned] = useState(readPin);
  const [hover, setHover] = useState(false);
  const location = useLocation();
  const closePanel = useUi((s) => s.closePanel);
  const expanded = pinned || hover;

  useEffect(() => {
    closePanel();
    // collapse the hover-expanded nav after navigating (the pin keeps it open)
    setHover(false);
    (document.activeElement as HTMLElement | null)?.closest('.side-nav') && (document.activeElement as HTMLElement).blur();
  }, [location.pathname, closePanel]);
  const togglePin = () => {
    setPinned((p) => {
      try {
        localStorage.setItem(PIN_KEY, p ? '0' : '1');
      } catch {
        /* storage unavailable: pin lasts for this visit only */
      }
      return !p;
    });
    setHover(false);
  };

  return (
    <div className={`app-shell${expanded ? ' nav-open' : ''}`}>
      <header className="app-header">
        <IconButton
          className="nav-toggle"
          kind="ghost"
          size="lg"
          label={pinned ? 'Collapse navigation' : 'Keep navigation open'}
          align="right"
          aria-expanded={pinned}
          aria-controls="main-nav"
          onClick={togglePin}
        >
          {pinned ? <Close size={20} /> : <Menu size={20} />}
        </IconButton>
        <span className="brand">AEON Connect</span>
        <span className="brand-sep">|</span>
        <span className="brand-team">Mawarid</span>
        <span className="header-right">Dubai time · Fri 13 Nov 2026, 10:30</span>
      </header>
      <SideNav expanded={expanded} pinned={pinned} hover={hover} setHover={setHover} />
      <main className={`app-main${pinned ? ' nav-pinned' : ''}`}>
        <Outlet />
      </main>
      <CasePanel />
      <RoleSwitcher />
      <ToastHost />
    </div>
  );
}

function SideNav({ expanded, pinned, hover, setHover }: { expanded: boolean; pinned: boolean; hover: boolean; setHover: (h: boolean) => void }) {
  const role = useStore((s) => s.role);
  // only one group is open at a time: the one under the pointer (or holding keyboard focus)
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const timer = useRef<number>();
  const count = useMyDayCount(role);
  return (
    <nav
      id="main-nav"
      className={`side-nav${expanded ? ' is-expanded' : ''}${pinned ? ' is-pinned' : ''}${hover ? ' is-hover' : ''}`}
      aria-label="Main navigation"
      onMouseEnter={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setHover(true), 120);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setHover(false);
        setOpenGroup(null);
      }}
      onFocus={() => setHover(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHover(false)}
    >
      <ul className="nav-list">
        {NAV[role].map((e) =>
          isGroup(e) ? (
            <Group key={e.label} g={e} open={expanded && openGroup === e.label} expanded={expanded} setOpen={(o) => setOpenGroup((cur) => (o ? e.label : cur === e.label ? null : cur))} />
          ) : (
            <li key={e.to}>
              <RouterLink
                to={e.to}
                className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
                title={expanded ? undefined : e.to === '/my-day' ? `My Day · ${count} ${MY_DAY_COUNT_LABEL[role]}` : e.label}
              >
                <span className="nav-icon">
                  <e.icon size={20} aria-hidden />
                  {e.to === '/my-day' && count > 0 && <span className="nav-dot" aria-hidden />}
                </span>
                <span className="nav-label">{e.label}</span>
                {e.to === '/my-day' && count > 0 && (
                  <span className="nav-count" aria-label={`${count} ${MY_DAY_COUNT_LABEL[role]}`}>
                    {count}
                  </span>
                )}
              </RouterLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

function Group({ g, open, expanded, setOpen }: { g: NavGroup; open: boolean; expanded: boolean; setOpen: (open: boolean) => void }) {
  const { pathname } = useLocation();
  const activeChild = g.children.find((c) => pathname === c.to);
  const hoverTimer = useRef<number>();
  /** a click closed it while the pointer is still on it: don't let hover reopen it */
  const closedByClick = useRef(false);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  return (
    <li
      className="nav-group"
      // a short delay so sweeping the pointer down the list doesn't open every group in turn
      onMouseEnter={() => {
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => !closedByClick.current && setOpen(true), 150);
      }}
      // leaving doesn't close it: the next group opening, or leaving the nav, does.
      // Closing sooner pulls the items below up from under the pointer.
      onMouseLeave={() => {
        window.clearTimeout(hoverTimer.current);
        closedByClick.current = false;
      }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}
    >
      <button
        className={`nav-group-btn${open ? ' is-open' : ''}${activeChild ? ' has-active' : ''}`}
        aria-expanded={open}
        onClick={() => {
          closedByClick.current = open;
          setOpen(!open);
        }}
        title={expanded ? undefined : activeChild ? `${g.label} › ${activeChild.label}` : g.label}
      >
        <span className="nav-icon">
          <g.icon size={20} aria-hidden />
        </span>
        <span className="nav-label">
          {g.label}
          {activeChild && !open && expanded && <span className="nav-group-current"> › {activeChild.label}</span>}
        </span>
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
