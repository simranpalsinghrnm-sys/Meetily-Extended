import { Store } from '@tauri-apps/plugin-store';
import type { CalendarEvent, CalendarProvider } from './types';
import { extractVideoLink } from './types';

const tauriFetch: typeof fetch = (...args) => fetch(...args);

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const EVENTS_URL = (calId: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;

type StoredAuth = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  account_email: string;
};

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
  error?: string;
};

const STORE_PATH = '.meetily-extended.calendar.json';
const STORE_KEY = 'google.auth';

let pendingDevice: { code: DeviceCodeResponse; startedAt: number } | null = null;

async function store(): Promise<Store> {
  return await Store.load(STORE_PATH);
}

async function loadAuth(): Promise<StoredAuth | null> {
  const s = await store();
  return (await s.get<StoredAuth>(STORE_KEY)) ?? null;
}

async function saveAuth(auth: StoredAuth): Promise<void> {
  const s = await store();
  await s.set(STORE_KEY, auth);
  await s.save();
}

async function clearAuth(): Promise<void> {
  const s = await store();
  await s.delete(STORE_KEY);
  await s.save();
}

async function getClientCreds(): Promise<{ client_id: string; client_secret: string }> {
  const s = await Store.load('.meetily-extended.calendar.json');
  const creds = await s.get<{ client_id: string; client_secret: string }>('google.client');
  if (!creds?.client_id || !creds?.client_secret) {
    throw new Error('Google OAuth client not configured. Open Settings → Calendar.');
  }
  return creds;
}

export async function setClientCreds(client_id: string, client_secret: string): Promise<void> {
  const s = await store();
  await s.set('google.client', { client_id, client_secret });
  await s.save();
}

async function refreshIfNeeded(auth: StoredAuth): Promise<StoredAuth> {
  if (auth.expires_at - 60_000 > Date.now()) return auth;
  const creds = await getClientCreds();
  const body = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    refresh_token: auth.refresh_token,
    grant_type: 'refresh_token',
  });
  const res = await tauriFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) throw new Error('No access_token in refresh response');
  const next: StoredAuth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? auth.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    account_email: auth.account_email,
  };
  await saveAuth(next);
  return next;
}

export const GoogleCalendarProvider: CalendarProvider = {
  id: 'google',
  label: 'Google Calendar',

  async isAuthed() {
    return (await loadAuth()) !== null;
  },

  async beginAuth() {
    const creds = await getClientCreds();
    const body = new URLSearchParams({ client_id: creds.client_id, scope: SCOPE });
    const res = await tauriFetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new Error(`Device code request failed: ${res.status}`);
    const data = (await res.json()) as DeviceCodeResponse;
    pendingDevice = { code: data, startedAt: Date.now() };
    return {
      verificationUrl: data.verification_url,
      userCode: data.user_code,
      pollIntervalSec: data.interval,
    };
  },

  async completeAuth() {
    if (!pendingDevice) throw new Error('No pending device-flow auth. Call beginAuth first.');
    const creds = await getClientCreds();
    const { code } = pendingDevice;
    const deadline = pendingDevice.startedAt + code.expires_in * 1000;
    while (Date.now() < deadline) {
      const body = new URLSearchParams({
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        device_code: code.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
      const res = await tauriFetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = (await res.json()) as TokenResponse;
      if (data.error === 'authorization_pending' || data.error === 'slow_down') {
        await new Promise(r => setTimeout(r, (code.interval + (data.error === 'slow_down' ? 5 : 0)) * 1000));
        continue;
      }
      if (data.access_token) {
        const email = await fetchAccountEmail(data.access_token);
        await saveAuth({
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? '',
          expires_at: Date.now() + data.expires_in * 1000,
          account_email: email,
        });
        pendingDevice = null;
        return;
      }
      throw new Error(`Device auth failed: ${data.error ?? 'unknown'}`);
    }
    pendingDevice = null;
    throw new Error('Device-flow auth timed out. Try again.');
  },

  async signOut() {
    await clearAuth();
    pendingDevice = null;
  },

  async fetchUpcoming({ fromIso, toIso }) {
    const auth0 = await loadAuth();
    if (!auth0) return [];
    const auth = await refreshIfNeeded(auth0);
    const params = new URLSearchParams({
      timeMin: fromIso,
      timeMax: toIso,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });
    const res = await tauriFetch(`${EVENTS_URL('primary')}?${params}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });
    if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
    const data = (await res.json()) as { items?: unknown[] };
    return (data.items ?? []).map(raw => normalize(raw, auth.account_email));
  },
};

async function fetchAccountEmail(accessToken: string): Promise<string> {
  const res = await tauriFetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return 'unknown';
  const data = (await res.json()) as { email?: string };
  return data.email ?? 'unknown';
}

type GEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string; organizer?: boolean; self?: boolean }[];
  conferenceData?: { entryPoints?: { uri?: string; entryPointType?: string }[] };
  hangoutLink?: string;
};

function normalize(raw: unknown, selfEmail: string): CalendarEvent {
  const g = raw as GEvent;
  const description = g.description ?? null;
  const location = g.location ?? null;
  const conf = g.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ?? null;
  const videoLink = g.hangoutLink ?? conf ?? extractVideoLink({ description, location });
  return {
    id: g.id,
    providerId: 'google',
    title: g.summary ?? '(no title)',
    description,
    location,
    startsAt: g.start?.dateTime ?? `${g.start?.date}T00:00:00Z`,
    endsAt: g.end?.dateTime ?? `${g.end?.date}T23:59:59Z`,
    attendees: (g.attendees ?? []).map(a => ({
      email: a.email ?? '',
      name: a.displayName ?? null,
      isOrganizer: !!a.organizer,
      isSelf: !!a.self || (a.email ?? '').toLowerCase() === selfEmail.toLowerCase(),
    })),
    videoLink,
    raw: g,
  };
}
