'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProjects } from '@/projects/ProjectsProvider';
import type { Project } from '@/projects/types';

type ProjectMeeting = {
  id: string;
  title: string;
  created_at: string;
  has_summary: number;
  action_items_count: number;
};

type ProjectActionItem = {
  id: number;
  meeting_id: string;
  title: string;
  details: string | null;
  status: string;
  due_at: string | null;
};

type DashboardData = {
  project: Project;
  meetings: ProjectMeeting[];
  open_action_items: ProjectActionItem[];
  member_count: number;
};

export function ProjectDashboard({ projectId }: { projectId: number }) {
  const { projects } = useProjects();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find(p => p.id === projectId) ?? null;

  useEffect(() => {
    let alive = true;
    setError(null);
    invoke<DashboardData>('project_dashboard', { projectId })
      .then(d => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!project) {
    return <div className="p-6 text-sm text-zinc-500">Project not found.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <div className="text-xs uppercase tracking-wide text-zinc-500">Project</div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        {project.description && (
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{project.description}</p>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Failed to load dashboard: {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card label="Meetings" value={data?.meetings.length ?? '—'} />
        <Card label="Open action items" value={data?.open_action_items.length ?? '—'} />
        <Card label="People" value={data?.member_count ?? '—'} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Recent meetings
        </h2>
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {(data?.meetings ?? []).slice(0, 10).map(m => (
            <li key={m.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-xs text-zinc-500">{new Date(m.created_at).toLocaleString()}</div>
              </div>
              <div className="text-xs text-zinc-500">
                {m.action_items_count > 0 && <span>{m.action_items_count} actions</span>}
              </div>
            </li>
          ))}
          {(data?.meetings ?? []).length === 0 && (
            <li className="px-4 py-3 text-sm text-zinc-500">No meetings tagged to this project yet.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Open action items
        </h2>
        <ul className="space-y-1">
          {(data?.open_action_items ?? []).map(a => (
            <li key={a.id} className="flex items-start gap-3 rounded-md p-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
              <input type="checkbox" className="mt-1" readOnly />
              <div className="flex-1">
                <div>{a.title}</div>
                {a.due_at && (
                  <div className="text-xs text-zinc-500">due {new Date(a.due_at).toLocaleDateString()}</div>
                )}
              </div>
            </li>
          ))}
          {(data?.open_action_items ?? []).length === 0 && (
            <li className="px-2 py-1 text-sm text-zinc-500">Nothing open.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
