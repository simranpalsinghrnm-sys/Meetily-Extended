export type CalendarEvent = {
  id: string;
  providerId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  attendees: { email: string; name: string | null; isOrganizer: boolean; isSelf: boolean }[];
  videoLink: string | null;
  raw: unknown;
};

export type CalendarProvider = {
  id: string;
  label: string;
  isAuthed(): Promise<boolean>;
  beginAuth(): Promise<{ verificationUrl: string; userCode: string; pollIntervalSec: number }>;
  completeAuth(): Promise<void>;
  signOut(): Promise<void>;
  fetchUpcoming(opts: { fromIso: string; toIso: string }): Promise<CalendarEvent[]>;
};

export type MeetingPromptDecision = 'record' | 'skip' | 'snooze';

export type DetectedMeeting = {
  event: CalendarEvent;
  isMeeting: boolean;
  reason: string;
};

const VIDEO_HOST_PATTERNS = [
  /\bmeet\.google\.com\/[a-z0-9-]+/i,
  /\bzoom\.us\/j\/\d+/i,
  /\bteams\.microsoft\.com\/l\/meetup-join/i,
  /\bwebex\.com\/meet\//i,
  /\bwhereby\.com\//i,
  /\baround\.co\//i,
];

export function extractVideoLink(event: { description: string | null; location: string | null }): string | null {
  const haystack = `${event.location ?? ''} ${event.description ?? ''}`;
  for (const pat of VIDEO_HOST_PATTERNS) {
    const m = haystack.match(pat);
    if (m) return m[0];
  }
  return null;
}

export function classifyMeeting(event: CalendarEvent): DetectedMeeting {
  if (event.videoLink) return { event, isMeeting: true, reason: 'has video link' };
  const others = event.attendees.filter(a => !a.isSelf);
  if (others.length >= 1) return { event, isMeeting: true, reason: `${others.length} other attendee(s)` };
  return { event, isMeeting: false, reason: 'solo event' };
}
