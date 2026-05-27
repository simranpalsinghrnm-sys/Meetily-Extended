'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarManager, PROVIDERS } from './manager';
import type { CalendarEvent } from './types';

type CalendarCtx = {
  isAnyAuthed: boolean;
  refreshAuthState: () => Promise<void>;
};

const Ctx = createContext<CalendarCtx | null>(null);

type Props = {
  children: React.ReactNode;
  onPromptRecord: (event: CalendarEvent) => Promise<void> | void;
};

export function CalendarProvider({ children, onPromptRecord }: Props) {
  const managerRef = useRef<CalendarManager | null>(null);
  const [isAnyAuthed, setIsAnyAuthed] = useState(false);

  const refreshAuthState = useMemo(
    () => async () => {
      const checks = await Promise.all(PROVIDERS.map(p => p.isAuthed().catch(() => false)));
      setIsAnyAuthed(checks.some(Boolean));
    },
    []
  );

  useEffect(() => {
    const m = new CalendarManager({ onPromptRecord });
    managerRef.current = m;
    refreshAuthState();
    m.start().catch(err => console.error('[calendar] start failed', err));
    return () => {
      m.stop();
      managerRef.current = null;
    };
  }, [onPromptRecord, refreshAuthState]);

  const value = useMemo<CalendarCtx>(() => ({ isAnyAuthed, refreshAuthState }), [isAnyAuthed, refreshAuthState]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCalendar(): CalendarCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCalendar must be used within CalendarProvider');
  return v;
}
