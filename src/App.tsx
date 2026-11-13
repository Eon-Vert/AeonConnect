import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Shell } from './components/Shell';
import { useStore } from './state/store';
import type { Role } from './domain/types';
import { SalesManagerMyDay } from './pages/SalesManagerMyDay';
import { CoordinatorMyDay } from './pages/CoordinatorMyDay';
import { ComplianceMyDay } from './pages/ComplianceMyDay';
import { Pipeline } from './pages/Pipeline';
import { CompanyLeads } from './pages/CompanyLeads';
import { Placeholder } from './pages/Placeholder';
import { AddLeadsFlow } from './components/AddLeadsFlow';

function MyDay() {
  const role = useStore((s) => s.role);
  if (role === 'COORD') return <CoordinatorMyDay />;
  if (role === 'CO') return <ComplianceMyDay />;
  return <SalesManagerMyDay />;
}

/** pages that only some roles have in their nav */
function Only({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useStore((s) => s.role);
  return roles.includes(role) ? <>{children}</> : <Navigate to="/my-day" replace />;
}

function AddLeadsPage() {
  const navigate = useNavigate();
  return (
    <div className="page">
      <AddLeadsFlow onBack={() => navigate(-1)} />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/my-day" replace />} />
        <Route path="my-day" element={<MyDay />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="company-leads" element={<Only roles={['SM']}><CompanyLeads /></Only>} />
        <Route path="add-leads" element={<Only roles={['SM']}><AddLeadsPage /></Only>} />
        <Route path="p/:slug" element={<Placeholder />} />
        <Route path="*" element={<Navigate to="/my-day" replace />} />
      </Route>
    </Routes>
  );
}
