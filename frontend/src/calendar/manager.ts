import { GoogleCalendarProvider } from './google';
import { classifyMeeting, type CalendarEvent, type CalendarProvider, type MeetingPromptDecision } from './types';
import { promptMeeting } from '../notifications/meetingPrompt';

const TICK_MS = 30_000;            // poll every 30s instead of 60s
const LEAD_MS = 3 * 60_000;        // fire prompt 3 min before start
const REPROMPT_MS = 30_000;        // re-fire if user dismissed and meeting is < 30s away
const LOOKAHEAD_MS = 15 * 60_000;  // fetch events up to 15 min out

type CalendarManagerOpts = {
  onPromptRecord: (event: CalendarEvent) => Promise<void> | void;
  onStateChange?: (state: WatcherState) => void;
};

type State = {
  promptedEventIds: Map<string, number>;  // id -> last prompted timestamp
  snoozedUntil: Map<string, number>;
  declinedEventIds: Set<string>;
  timer: ReturnType<typeof setInterval> | null;
  lastPollAt: number | null;
  lastError: string | null;
  upcoming: CalendarEvent[];
};

export type WatcherState = {
  lastPollAt: number | null;
  lastError: string | null;
  upcoming: { id: string; title: string; startsAt: string; isMeeting: boolean }[];
};

export const PROVIDERS: CalendarProvider[] = [GoogleCalendarProvider];

export class CalendarManager {
  private state: State = {
    promptedEventIds: new Map(),
    snoozedUntil: new Map(),
    declinedEventIds: new Set(),
    timer: null,
    lastPollAt: null,
    lastError: null,
    upcoming: [],
  };

  constructor(private opts: CalendarManagerOpts) {}

  async start(): Promise<void> {
    if (this.state.timer) return;
    await this.tick();
    this.state.timer = setInterval(
      () => this.tick().catch(err => console.error('[calendar] tick', err)),
      TICK_MS
    );
  }

  stop(): void {
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
  }

  /** Manually trigger the prompt UI with a synthetic event — used by the "Test prompt" button. */
  async testPrompt(): Promise<MeetingPromptDecision> {
    const now = new Date();
    const start = new Date(now.getTime() + 30_000);
    const fake: CalendarEvent = {
      id: `test-${now.getTime()}`,
      providerId: 'test',
      title: 'Test meeting (Settings → Calendar)',
      description: 'Synthetic event to verify the prompt flow works.',
      location: null,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
      attendees: [{ email: 'you@example.com', name: 'You', isOrganizer: true, isSelf: true }],
      videoLink: 'https://example.com/test',
      raw: null,
    };
    return await promptMeeting(fake);
  }

  getState(): WatcherState {
    return {
      lastPollAt: this.state.lastPollAt,
      lastError: this.state.lastError,
      upcoming: this.state.upcoming.map(e => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt,
        isMeeting: classifyMeeting(e).isMeeting,
      })),
    };
  }

  private emit(): void {
    this.opts.onStateChange?.(this.getState());
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const fromIso = new Date(now).toISOString();
    const toIso = new Date(now + LOOKAHEAD_MS).toISOString();

    const events: CalendarEvent[] = [];
    let anyAuthed = false;
    for (const p of PROVIDERS) {
      try {
        if (!(await p.isAuthed())) continue;
        anyAuthed = true;
        events.push(...(await p.fetchUpcoming({ fromIso, toIso })));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.state.lastError = `${p.id}: ${msg}`;
        console.error(`[calendar] ${p.id} fetch failed`, e);
      }
    }

    if (anyAuthed) {
      this.state.lastPollAt = now;
      this.state.upcoming = events;
      this.state.lastError = null;
    }

    for (const event of events) {
      const startsAt = new Date(event.startsAt).getTime();
      const detected = classifyMeeting(event);
      if (!detected.isMeeting) continue;
      if (this.state.declinedEventIds.has(event.id)) continue;

      const snoozedUntil = this.state.snoozedUntil.get(event.id) ?? 0;
      if (now < snoozedUntil) continue;

      const msUntilStart = startsAt - now;
      if (msUntilStart > LEAD_MS) continue;
      if (msUntilStart < -120_000) continue;

      const lastPromptedAt = this.state.promptedEventIds.get(event.id) ?? 0;
      const promptedRecently = now - lastPromptedAt < REPROMPT_MS;
      if (lastPromptedAt && promptedRecently) continue;

      // Re-prompt if first prompt fired earlier but meeting is now imminent.
      const isImminent = msUntilStart <= REPROMPT_MS;
      if (lastPromptedAt && !isImminent) continue;

      this.state.promptedEventIds.set(event.id, now);
      this.state.snoozedUntil.delete(event.id);
      this.emit();

      const decision = await this.promptUser(event);
      if (decision === 'record') {
        await this.opts.onPromptRecord(event);
        this.state.declinedEventIds.add(event.id);
      } else if (decision === 'snooze') {
        this.state.snoozedUntil.set(event.id, now + 2 * 60_000);
      } else {
        // skip — but allow re-prompt at imminent threshold
      }
    }

    this.emit();
  }

  private async promptUser(event: CalendarEvent): Promise<MeetingPromptDecision> {
    try {
      return await promptMeeting(event);
    } catch (e) {
      console.error('[calendar] prompt failed', e);
      this.state.lastError = `prompt: ${e instanceof Error ? e.message : String(e)}`;
      return 'skip';
    }
  }

  clearMemory(): void {
    this.state.promptedEventIds.clear();
    this.state.snoozedUntil.clear();
    this.state.declinedEventIds.clear();
  }
}
