'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Building2, Folder, Plus } from 'lucide-react';
import { useProjects } from '@/projects/ProjectsProvider';
import { projectsApi } from '@/projects/api';
import type { Company, Project } from '@/projects/types';

type Props = {
  activeProjectId?: number | null;
};

export function SidebarTree({ activeProjectId }: Props) {
  const { companies, projects, refresh } = useProjects();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState<{ companyId: number } | null>(null);
  const [newName, setNewName] = useState('');

  const byCompany = useMemo<Map<number, Project[]>>(() => {
    const m = new Map<number, Project[]>();
    for (const p of projects) {
      if (!m.has(p.company_id)) m.set(p.company_id, []);
      m.get(p.company_id)!.push(p);
    }
    return m;
  }, [projects]);

  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addProject = async () => {
    if (!adding || !newName.trim()) return;
    await projectsApi.upsertProject(adding.companyId, newName.trim());
    await refresh();
    setNewName('');
    setAdding(null);
  };

  return (
    <nav className="space-y-1 px-2 py-3 text-sm">
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Project spaces
      </div>
      {companies.length === 0 ? (
        <p className="px-2 py-3 text-xs text-zinc-500">
          No companies yet. Add one in Settings or by tagging a meeting.
        </p>
      ) : (
        companies.map((c: Company) => {
          const open = expanded.has(c.id);
          const items = byCompany.get(c.id) ?? [];
          return (
            <div key={c.id}>
              <button
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Building2 size={14} className="text-zinc-500" />
                <span className="ml-1 truncate font-medium">{c.name}</span>
                <span className="ml-auto text-xs text-zinc-400">{items.length}</span>
              </button>
              {open && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                  {items.map(p => (
                    <Link
                      key={p.id}
                      href={`/projects?id=${p.id}`}
                      className={`flex items-center gap-2 rounded-md px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                        activeProjectId === p.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : ''
                      }`}
                    >
                      <Folder size={13} className="text-zinc-500" />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  ))}
                  {adding?.companyId === c.id ? (
                    <div className="flex gap-1 px-2 py-1">
                      <input
                        autoFocus
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addProject();
                          if (e.key === 'Escape') {
                            setAdding(null);
                            setNewName('');
                          }
                        }}
                        placeholder="Project name"
                        className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setAdding({ companyId: c.id })}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                    >
                      <Plus size={12} />
                      New project
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </nav>
  );
}
