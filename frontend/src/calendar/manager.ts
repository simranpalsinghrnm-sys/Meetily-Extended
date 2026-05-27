import { GoogleCalendarProvider } from './google';
import { classifyMeeting, type CalendarEvent, type CalendarProvider, type MeetingPromptDecision } from './types';
import { promptMeeting } from '../notifications/meetingPrompt';

const TICK_MS = 60_000;
const LEAD_MS = 60_000;
const LOOKAHEAD_MS = 10 * 60_000;

type CalendarManagerOpts = {
  onPromptRecord: (event: CalendarEvent) => Promise<void> | void;
};

type State = {
  promptedEventIds: Set<string>;
  snoozedUntil: Map<string, number>;
  timer: ReturnType<typeof setInterval> | null;
};

export const PROVIDERS: CalendarProvider[] = [GoogleCalendarProvider];

export class CalendarManager {
  private state: State = { promptedEventIds: new Set(), snoozedUntil: new Map(), timer: null };

  constructor(private opts: CalendarManagerOpts) {}

  async start(): Promise<void> {
    if (this.state.timer) return;
    await this.tick();
    this.state.timer = setInterval(() => this.tick().catch(err => console.error('[calendar] tick', err)), TICK_MS);
  }

  stop(): void {
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const fromIso = new Date(now).toISOString();
    const toIso = new Date(now + LOOKAHEAD_MS).toISOString();

    const events: CalendarEvent[] = [];
    for (const p of PROVIDERS) {
      if (!(await p.isAuthed())) continue;
      try {
        events.push(...(await p.fetchUpcoming({ fromIso, toIso })));
      } catch (e) {
        console.error(`[calendar] ${p.id} fetch failed`, e);
      }
    }

    for (const event of events) {
      const startsAt = new Date(event.startsAt).getTime();
      const detected = classifyMeeting(event);
      if (!detected.isMeeting) continue;

      const snoozedUntil = this.state.snoozedUntil.get(event.id) ?? 0;
      if (now < snoozedUntil) continue;
      if (this.state.promptedEventIds.has(event.id) && snoozedUntil === 0) continue;

      const msUntilStart = startsAt - now;
      if (msUntilStart > LEAD_MS) continue;
      if (msUntilStart < -120_000) continue;

      this.state.promptedEventIds.add(event.id);
      this.state.snoozedUntil.delete(event.id);

      const decision = await this.promptUser(event);
      if (decision === 'record') {
        await this.opts.onPromptRecord(event);
      } else if (decision === 'snooze') {
        this.state.snoozedUntil.set(event.id, now + 5 * 60_000);
        this.state.promptedEventIds.delete(event.id);
      }
    }
  }

  private async promptUser(event: CalendarEvent): Promise<MeetingPromptDecision> {
    try {
      return await promptMeeting(event);
    } catch (e) {
      console.error('[calendar] prompt failed', e);
      return 'skip';
    }
  }

  clearMemory(): void {
    this.state.promptedEventIds.clear();
    this.state.snoozedUntil.clear();
  }
}
