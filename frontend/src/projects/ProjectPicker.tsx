'use client';

import { useMemo, useState } from 'react';
import { useProjects } from './ProjectsProvider';
import { projectsApi } from './api';
import type { Company, Project } from './types';

type Props = {
  initialCompanyId: number | null;
  initialProjectId: number | null;
  onConfirm: (companyId: number, projectId: number) => void;
  onCancel?: () => void;
  reasons?: string[];
  confidence?: number;
};

export function ProjectPicker({
  initialCompanyId,
  initialProjectId,
  onConfirm,
  onCancel,
  reasons,
  confidence,
}: Props) {
  const { companies, projects, refresh } = useProjects();
  const [companyId, setCompanyId] = useState<number | null>(initialCompanyId);
  const [projectId, setProjectId] = useState<number | null>(initialProjectId);
  const [newCompany, setNewCompany] = useState('');
  const [newProject, setNewProject] = useState('');

  const projectOptions: Project[] = useMemo(
    () => projects.filter(p => p.company_id === companyId),
    [projects, companyId]
  );

  const createCompany = async () => {
    if (!newCompany.trim()) return;
    const c = await projectsApi.upsertCompany(newCompany.trim());
    await refresh();
    setCompanyId(c.id);
    setNewCompany('');
  };

  const createProject = async () => {
    if (!companyId || !newProject.trim()) return;
    const p = await projectsApi.upsertProject(companyId, newProject.trim());
    await refresh();
    setProjectId(p.id);
    setNewProject('');
  };

  const confirm = () => {
    if (companyId && projectId) onConfirm(companyId, projectId);
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Tag this meeting</h2>
          {confidence != null && (
            <span className="text-xs text-zinc-500">
              suggestion confidence {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        {reasons && reasons.length > 0 && (
          <p className="mt-1 text-xs text-zinc-500">{reasons.join(' · ')}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Company
        </label>
        <select
          className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={companyId ?? ''}
          onChange={e => {
            const v = e.target.value;
            setCompanyId(v ? Number(v) : null);
            setProjectId(null);
          }}
        >
          <option value="">— select —</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add new company"
            value={newCompany}
            onChange={e => setNewCompany(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            onClick={createCompany}
            className="rounded-md bg-zinc-100 px-3 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            Add
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Project
        </label>
        <select
          className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
          value={projectId ?? ''}
          onChange={e => {
            const v = e.target.value;
            setProjectId(v ? Number(v) : null);
          }}
          disabled={!companyId}
        >
          <option value="">— select —</option>
          {projectOptions.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add new project"
            value={newProject}
            onChange={e => setNewProject(e.target.value)}
            disabled={!companyId}
            className="flex-1 rounded-md border border-zinc-300 p-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            onClick={createProject}
            disabled={!companyId}
            className="rounded-md bg-zinc-100 px-3 text-sm hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
        )}
        <button
          onClick={confirm}
          disabled={!companyId || !projectId}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Tag
        </button>
      </div>
    </div>
  );
}
