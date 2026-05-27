'use client';

import { useParams } from 'next/navigation';
import { ProjectDashboard } from '@/components/ProjectSpaces/ProjectDashboard';

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  if (!Number.isFinite(projectId)) return <div className="p-6">Invalid project id.</div>;
  return <ProjectDashboard projectId={projectId} />;
}
