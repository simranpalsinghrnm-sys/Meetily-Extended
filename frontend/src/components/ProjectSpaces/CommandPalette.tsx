'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/projects/ProjectsProvider';

type Item = {
  kind: 'project' | 'action';
  label: string;
  hint?: string;
  onSelect: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const { companies, projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
        setQuery('');
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = useMemo<Item[]>(() => {
    const projectItems: Item[] = projects.map(p => {
      const company = companies.find(c => c.id === p.company_id);
      return {
        kind: 'project',
        label: p.name,
        hint: company?.name ?? '',
        onSelect: () => {
          setOpen(false);
          router.push(`/projects?id=${p.id}`);
        },
      };
    });
    const actions: Item[] = [
      {
        kind: 'action',
        label: 'Start ad-hoc recording',
        onSelect: () => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'));
        },
      },
    ];
    return [...actions, ...projectItems];
  }, [companies, projects, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      it => it.label.toLowerCase().includes(q) || (it.hint ?? '').toLowerCase().includes(q)
    );
  }, [items, query]);

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Jump to project, run command…"
          className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm outline-none dark:border-zinc-800"
        />
        <ul className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">No matches.</li>
          ) : (
            filtered.slice(0, 50).map((it, i) => (
              <li key={i}>
                <button
                  onClick={it.onSelect}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <span className="truncate">{it.label}</span>
                  <span className="ml-3 truncate text-xs text-zinc-500">{it.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
