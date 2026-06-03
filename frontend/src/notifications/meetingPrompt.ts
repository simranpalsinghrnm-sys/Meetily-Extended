import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize, LogicalPosition, currentMonitor } from '@tauri-apps/api/window';
import { listen, once } from '@tauri-apps/api/event';
import type { CalendarEvent, MeetingPromptDecision } from '../calendar/types';

const PROMPT_LABEL = 'meeting-prompt';
const PROMPT_TIMEOUT_MS = 90_000;     // 90s window to decide
const RESPONSE_EVENT = 'meeting-prompt:response';
const WINDOW_W = 520;
const WINDOW_H = 280;

export async function promptMeeting(event: CalendarEvent): Promise<MeetingPromptDecision> {
  await ensurePermission();
  await fireToast(event);
  beep();
  return await openPromptWindow(event);
}

async function ensurePermission(): Promise<void> {
  try {
    if (!(await isPermissionGranted())) {
      await requestPermission();
    }
  } catch (e) {
    console.warn('[meeting-prompt] permission probe failed', e);
  }
}

async function fireToast(event: CalendarEvent): Promise<void> {
  const startsAt = new Date(event.startsAt);
  const min = Math.max(0, Math.round((startsAt.getTime() - Date.now()) / 60_000));
  try {
    sendNotification({
      title: `🔔 Meeting in ${min} min: ${event.title}`,
      body: `${formatTime(startsAt)} · ${event.attendees.length} attendee${event.attendees.length === 1 ? '' : 's'}. Click app to choose.`,
    });
  } catch (e) {
    console.warn('[meeting-prompt] toast failed', e);
  }
}

function beep(): void {
  try {
    // Browser bell — reliable in webview
    const audio = new Audio(
      'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAAA='
    );
    audio.volume = 0.5;
    audio.play().catch(() => undefined);
    // Also try system beep via window.print() trick? No — skip.
  } catch {
    /* no-op */
  }
}

async function openPromptWindow(event: CalendarEvent): Promise<MeetingPromptDecision> {
  const existing = await WebviewWindow.getByLabel(PROMPT_LABEL);
  if (existing) {
    try { await existing.close(); } catch { /* ignore */ }
  }

  const url = `/meeting-prompt?event=${encodeURIComponent(JSON.stringify({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    attendees: event.attendees.length,
    videoLink: event.videoLink,
    description: event.description?.slice(0, 200) ?? null,
  }))}`;

  // Position roughly top-center of primary monitor for visibility
  let posX = 100;
  let posY = 80;
  try {
    const monitor = await currentMonitor();
    if (monitor) {
      const scale = monitor.scaleFactor ?? 1;
      posX = Math.max(0, Math.round(monitor.size.width / scale / 2 - WINDOW_W / 2));
      posY = 80;
    }
  } catch {
    /* keep defaults */
  }

  const win = new WebviewWindow(PROMPT_LABEL, {
    url,
    title: '🔔 Record this meeting?',
    width: WINDOW_W,
    height: WINDOW_H,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    focus: true,
    decorations: true,
    center: false,
    x: posX,
    y: posY,
  });

  try {
    await win.once('tauri://created', () => undefined);
    await win.setSize(new LogicalSize(WINDOW_W, WINDOW_H));
    await win.setPosition(new LogicalPosition(posX, posY));
    await win.setAlwaysOnTop(true);
    await win.setFocus();
  } catch {
    /* window may already be ready */
  }

  return await waitForResponse(win);
}

async function waitForResponse(win: WebviewWindow): Promise<MeetingPromptDecision> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (d: MeetingPromptDecision) => {
      if (settled) return;
      settled = true;
      win.close().catch(() => undefined);
      resolve(d);
    };

    const timeout = setTimeout(() => finish('skip'), PROMPT_TIMEOUT_MS);

    once<MeetingPromptDecision>(RESPONSE_EVENT, e => {
      clearTimeout(timeout);
      finish(e.payload);
    }).catch(err => {
      console.error('[meeting-prompt] listen failed', err);
      clearTimeout(timeout);
      finish('skip');
    });

    listen<{ label: string }>('tauri://destroyed', e => {
      if (e.payload?.label === PROMPT_LABEL) {
        clearTimeout(timeout);
        finish('skip');
      }
    }).catch(() => undefined);
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
