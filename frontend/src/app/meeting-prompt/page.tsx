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
};

const RESPONSE_EVENT = 'meeting-prompt:response';

export default function MeetingPromptPage() {
  const [event, setEvent] = useState<Payload | null>(null);

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

  const decide = async (d: MeetingPromptDecision) => {
    await emit(RESPONSE_EVENT, d);
    await getCurrentWebviewWindow().close();
  };

  if (!event) return null;

  const start = new Date(event.startsAt);
  return (
    <div className="flex h-screen flex-col justify-between bg-white p-5 dark:bg-zinc-900 dark:text-white">
      <div>
        <div className="text-xs uppercase tracking-wide text-zinc-500">Meeting in &lt; 1 min</div>
        <h1 className="mt-1 text-lg font-semibold leading-snug">{event.title}</h1>
        <div className="mt-1 text-sm text-zinc-500">
          {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ·{' '}
          {event.attendees} attendee{event.attendees === 1 ? '' : 's'}
          {event.videoLink ? ' · video' : ''}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => decide('record')}
          className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Record
        </button>
        <button
          onClick={() => decide('snooze')}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Snooze 5m
        </button>
        <button
          onClick={() => decide('skip')}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
