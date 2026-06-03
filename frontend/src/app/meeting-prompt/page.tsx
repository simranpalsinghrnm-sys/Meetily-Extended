'use client';

import { useEffect, useState } from 'react';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { MeetingPromptDecision } from '@/calendar/types';

type Payload = {
  id: string;
  title: string;
  startsAt: string;
  attendees: number;
  videoLink: string | null;
  description: string | null;
};

const RESPONSE_EVENT = 'meeting-prompt:response';

export default function MeetingPromptPage() {
  const [event, setEvent] = useState<Payload | null>(null);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('event');
    if (raw) {
      try {
        setEvent(JSON.parse(raw) as Payload);
      } catch (e) {
        console.error('[meeting-prompt] bad payload', e);
      }
    }
  }, []);

  useEffect(() => {
    if (!event) return;
    const update = () => {
      const ms = new Date(event.startsAt).getTime() - Date.now();
      if (ms <= 0) {
        const overdue = Math.round(-ms / 1000);
        setCountdown(`started ${overdue}s ago`);
      } else if (ms < 60_000) {
        setCountdown(`in ${Math.round(ms / 1000)}s`);
      } else {
        setCountdown(`in ${Math.round(ms / 60_000)} min`);
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [event]);

  const decide = async (d: MeetingPromptDecision) => {
    await emit(RESPONSE_EVENT, d);
    await getCurrentWebviewWindow().close();
  };

  if (!event) return null;

  const start = new Date(event.startsAt);
  return (
    <div className="flex h-screen flex-col justify-between bg-gradient-to-br from-blue-50 to-white p-6 dark:from-zinc-900 dark:to-zinc-950 dark:text-white">
      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            🔔 Meeting {countdown}
          </div>
          <div className="text-xs text-zinc-500">{start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <h1 className="mt-2 text-xl font-semibold leading-snug">{event.title}</h1>
        <div className="mt-1 text-sm text-zinc-500">
          {event.attendees} attendee{event.attendees === 1 ? '' : 's'}
          {event.videoLink ? ' · 🎥 video call' : ''}
        </div>
        {event.description && (
          <p className="mt-3 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">{event.description}</p>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => decide('record')}
          autoFocus
          className="flex-1 rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          🔴 Record
        </button>
        <button
          onClick={() => decide('snooze')}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Snooze 2m
        </button>
        <button
          onClick={() => decide('skip')}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
