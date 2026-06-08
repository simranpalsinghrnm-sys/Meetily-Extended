import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { CalendarEvent } from './types';
import { promptMeeting } from '../notifications/meetingPrompt';

type DetectedMeeting = {
  source: 'google-meet' | 'zoom' | 'teams' | 'webex' | string;
  title: string;
  url_hint: string;
};

const COOLDOWN_MS = 10 * 60_000; // 10-min cooldown per meeting URL

const lastPromptedAt = new Map<string, number>();

/** Subscribe to active-meeting-detected events from the Rust window watcher.
 *  Fire the same promptMeeting() flow as calendar-driven prompts.
 *  Returns an unlisten function. */
export async function bindWindowWatcher(
  onRecord: (event: CalendarEvent) => Promise<void> | void
): Promise<UnlistenFn> {
  return await listen<DetectedMeeting>('active-meeting-detected', async ev => {
    const detected = ev.payload;
    const key = detected.url_hint || detected.source;
    const now = Date.now();
    const last = lastPromptedAt.get(key) ?? 0;
    if (now - last < COOLDOWN_MS) {
      console.log('[window-watcher] cooldown active for', key);
      return;
    }
    lastPromptedAt.set(key, now);

    const fake: CalendarEvent = {
      id: `window-${now}`,
      providerId: 'window-watcher',
      title: titleFromDetected(detected),
      description: `Auto-detected ${detected.source} window. No calendar event matched.`,
      location: detected.url_hint,
      startsAt: new Date(now).toISOString(),
      endsAt: new Date(now + 60 * 60_000).toISOString(),
      attendees: [],
      videoLink: detected.url_hint,
      raw: detected,
    };

    try {
      const decision = await promptMeeting(fake);
      if (decision === 'record') {
        await onRecord(fake);
      }
    } catch (e) {
      console.error('[window-watcher] prompt failed', e);
    }
  });
}

function titleFromDetected(d: DetectedMeeting): string {
  switch (d.source) {
    case 'google-meet': return 'Google Meet detected';
    case 'zoom':        return 'Zoom meeting detected';
    case 'teams':       return 'Microsoft Teams call detected';
    case 'webex':       return 'Webex meeting detected';
    default:            return `${d.source} meeting detected`;
  }
}
