'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProjectDashboard } from '@/components/ProjectSpaces/ProjectDashboard';

function ProjectsInner() {
  const sp = useSearchParams();
  const raw = sp.get('id');
  const projectId = raw ? Number(raw) : null;
  if (projectId == null || !Number.isFinite(projectId)) {
    return <div className="p-6 text-sm text-zinc-500">Pick a project from the left rail.</div>;
  }
  return <ProjectDashboard projectId={projectId} />;
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading…</div>}>
      <ProjectsInner />
    </Suspense>
  );
}
