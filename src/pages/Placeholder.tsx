import { Tag } from '@carbon/react';
import { Navigate, useParams } from 'react-router-dom';
import { PLACEHOLDERS } from '../nav';

export function Placeholder() {
  const { slug = '' } = useParams();
  const p = PLACEHOLDERS[slug];
  if (!p) return <Navigate to="/my-day" replace />;
  return (
    <div className="page placeholder-page">
      <div className="row-gap">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>{p.title}</h1>
        {p.tag && <Tag type="warm-gray">{p.tag}</Tag>}
      </div>
      <p>{p.line}</p>
    </div>
  );
}
