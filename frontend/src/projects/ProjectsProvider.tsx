'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { projectsApi } from './api';
import type { Company, Project, TaggingRule } from './types';

type ProjectsCtx = {
  companies: Company[];
  projects: Project[];
  rules: TaggingRule[];
  loading: boolean;
  refresh: () => Promise<void>;
  lastUsedProjectId: number | null;
  setLastUsedProjectId: (id: number | null) => void;
};

const Ctx = createContext<ProjectsCtx | null>(null);

const LS_LAST_PROJECT = 'meetily-extended.lastProjectId';

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rules, setRules] = useState<TaggingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUsedProjectId, setLastUsedProjectIdState] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, r] = await Promise.all([
        projectsApi.listCompanies(),
        projectsApi.listProjects(undefined),
        projectsApi.listTaggingRules(),
      ]);
      setCompanies(c);
      setProjects(p);
      setRules(r);
    } catch (e) {
      console.error('[projects] refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const setLastUsedProjectId = useCallback((id: number | null) => {
    setLastUsedProjectIdState(id);
    try {
      if (id == null) localStorage.removeItem(LS_LAST_PROJECT);
      else localStorage.setItem(LS_LAST_PROJECT, String(id));
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_LAST_PROJECT);
      if (raw) setLastUsedProjectIdState(Number(raw));
    } catch {
      /* no-op */
    }
    refresh();
  }, [refresh]);

  const value = useMemo<ProjectsCtx>(
    () => ({ companies, projects, rules, loading, refresh, lastUsedProjectId, setLastUsedProjectId }),
    [companies, projects, rules, loading, refresh, lastUsedProjectId, setLastUsedProjectId]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects(): ProjectsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProjects must be used within ProjectsProvider');
  return v;
}
