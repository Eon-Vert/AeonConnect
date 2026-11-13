import type { CarbonIconType } from '@carbon/icons-react';
import {
  Activity,
  Badge,
  Building,
  Catalog,
  ChartLine,
  Enterprise,
  Events,
  Flow,
  Folder,
  Home,
  Location,
  Map,
  Notification,
  Report,
  Time,
  Upload,
  User,
  UserMultiple,
  Workspace,
} from '@carbon/icons-react';
import type { Role } from './domain/types';

export interface NavLink {
  label: string;
  to: string;
  icon: CarbonIconType;
}
export interface NavGroup {
  label: string;
  icon: CarbonIconType;
  children: NavLink[];
}
export type NavEntry = NavLink | NavGroup;
export const isGroup = (e: NavEntry): e is NavGroup => 'children' in e;

/** Placeholder pages: path → [title, line] */
export const PLACEHOLDERS: Record<string, { title: string; line: string; tag?: string }> = {
  analytics: { title: 'Analytics', line: 'Coming soon' },
  dsr: { title: 'Daily Sales Report', line: 'Out of scope for this prototype.' },
  'live-operations': { title: 'Live Operations', line: 'Out of scope for this prototype.' },
  events: { title: 'Events', line: 'Out of scope for this prototype.' },
  venues: { title: 'Venues', line: 'Out of scope for this prototype.' },
  'field-visits': { title: 'Field Visits', line: 'Out of scope for this prototype.' },
  'sales-officers': { title: 'Sales Officers', line: 'Out of scope for this prototype.' },
  attendance: { title: 'Attendance', line: 'Out of scope for this prototype.' },
  workspace: { title: 'Workspace', line: 'Out of scope for this prototype.' },
  alerts: { title: 'Alerts', line: 'Out of scope for this prototype.' },
  'report-upload': { title: 'Report Upload', line: 'Out of scope for this prototype.' },
  'application-quality': { title: 'Application Quality', line: 'Out of scope for this prototype.', tag: 'Pending decision' },
  'audit-log': { title: 'Audit Log', line: 'Out of scope for this prototype.' },
  'my-attendance': { title: 'My attendance', line: 'Out of scope for this prototype.' },
};

const p = (slug: string, icon: CarbonIconType, label = PLACEHOLDERS[slug].title): NavLink => ({ label, to: `/p/${slug}`, icon });

export const NAV: Record<Role, NavEntry[]> = {
  SM: [
    { label: 'My Day', to: '/my-day', icon: Home },
    p('analytics', ChartLine),
    p('dsr', Report, 'DSR'),
    {
      label: 'Cases',
      icon: Folder,
      children: [
        { label: 'Pipeline', to: '/pipeline', icon: Flow },
        { label: 'Company leads', to: '/company-leads', icon: Enterprise },
      ],
    },
    {
      label: 'Field',
      icon: Location,
      children: [p('live-operations', Activity), p('events', Events), p('venues', Building), p('field-visits', Map)],
    },
    {
      label: 'Team',
      icon: UserMultiple,
      children: [p('sales-officers', User), p('attendance', Time), p('workspace', Workspace)],
    },
    p('alerts', Notification),
  ],
  COORD: [
    { label: 'My Day', to: '/my-day', icon: Home },
    { label: 'Pipeline', to: '/pipeline', icon: Flow },
    p('report-upload', Upload),
    p('application-quality', Badge),
  ],
  CO: [
    { label: 'My Day', to: '/my-day', icon: Home },
    p('audit-log', Catalog),
    p('my-attendance', Time),
    { label: 'Pipeline', to: '/pipeline', icon: Flow },
  ],
};
