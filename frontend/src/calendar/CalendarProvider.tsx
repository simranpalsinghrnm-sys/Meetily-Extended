'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarManager, PROVIDERS, type WatcherState } from './manager';
import type { CalendarEvent, MeetingPromptDecision } from './types';
import { bindWindowWatcher } from './windowWatcherBridge';

type CalendarCtx = {
  isAnyAuthed: boolean;
  refreshAuthState: () => Promise<void>;
  watcher: WatcherState | null;
  testPrompt: () => Promise<MeetingPromptDecision>;
};

const Ctx = createContext<CalendarCtx | null>(null);

type Props = {
  children: React.ReactNode;
  onPromptRecord: (event: CalendarEvent) => Promise<void> | void;
};

export function CalendarProvider({ children, onPromptRecord }: Props) {
  const managerRef = useRef<CalendarManager | null>(null);
  const [isAnyAuthed, setIsAnyAuthed] = useState(false);
  const [watcher, setWatcher] = useState<WatcherState | null>(null);

  const refreshAuthState = useMemo(
    () => async () => {
      const checks = await Promise.all(PROVIDERS.map(p => p.isAuthed().catch(() => false)));
      setIsAnyAuthed(checks.some(Boolean));
    },
    []
  );

  useEffect(() => {
    const m = new CalendarManager({
      onPromptRecord,
      onStateChange: state => setWatcher(state),
    });
    managerRef.current = m;
    refreshAuthState();
    m.start().catch(err => console.error('[calendar] start failed', err));

    let unlistenWindow: (() => void) | null = null;
    bindWindowWatcher(onPromptRecord)
      .then(fn => { unlistenWindow = fn; })
      .catch(err => console.error('[window-watcher] bind failed', err));

    return () => {
      m.stop();
      managerRef.current = null;
      if (unlistenWindow) unlistenWindow();
    };
  }, [onPromptRecord, refreshAuthState]);

  const testPrompt = useMemo(
    () => async () => {
      if (!managerRef.current) throw new Error('Calendar manager not initialized');
      return await managerRef.current.testPrompt();
    },
    []
  );

  const value = useMemo<CalendarCtx>(
    () => ({ isAnyAuthed, refreshAuthState, watcher, testPrompt }),
    [isAnyAuthed, refreshAuthState, watcher, testPrompt]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCalendar(): CalendarCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCalendar must be used within CalendarProvider');
  return v;
}
