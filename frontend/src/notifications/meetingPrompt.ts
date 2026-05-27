import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { LogicalSize } from '@tauri-apps/api/window';
import { listen, once } from '@tauri-apps/api/event';
import type { CalendarEvent, MeetingPromptDecision } from '../calendar/types';

const PROMPT_LABEL = 'meeting-prompt';
const PROMPT_TIMEOUT_MS = 45_000;
const RESPONSE_EVENT = 'meeting-prompt:response';

export async function promptMeeting(event: CalendarEvent): Promise<MeetingPromptDecision> {
  await ensurePermission();
  await fireToast(event);
  return await openPromptWindow(event);
}

async function ensurePermission(): Promise<void> {
  if (!(await isPermissionGranted())) {
    const r = await requestPermission();
    if (r !== 'granted') throw new Error('Notification permission denied');
  }
}

async function fireToast(event: CalendarEvent): Promise<void> {
  const startsAt = new Date(event.startsAt);
  const body = `${formatTime(startsAt)} · ${event.attendees.length} attendees`;
  sendNotification({
    title: `Meeting starting: ${event.title}`,
    body,
  });
}

async function openPromptWindow(event: CalendarEvent): Promise<MeetingPromptDecision> {
  const existing = await WebviewWindow.getByLabel(PROMPT_LABEL);
  if (existing) await existing.close();

  const url = `/meeting-prompt?event=${encodeURIComponent(JSON.stringify({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    attendees: event.attendees.length,
    videoLink: event.videoLink,
  }))}`;

  const win = new WebviewWindow(PROMPT_LABEL, {
    url,
    title: 'Record this meeting?',
    width: 460,
    height: 240,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    focus: true,
    decorations: true,
  });

  try {
    await win.once('tauri://created', () => undefined);
    await win.setSize(new LogicalSize(460, 240));
  } catch {
    /* the window may already be ready */
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
