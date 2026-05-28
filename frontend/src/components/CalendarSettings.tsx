'use client';

import { useEffect, useState } from 'react';
import { GoogleCalendarProvider, setClientCreds } from '@/calendar/google';
import { useCalendar } from '@/calendar/CalendarProvider';

export function CalendarSettings() {
  const { isAnyAuthed, refreshAuthState } = useCalendar();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savedCreds, setSavedCreds] = useState(false);
  const [device, setDevice] = useState<{ verificationUrl: string; userCode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  const saveCreds = async () => {
    setError(null);
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Both Client ID and Client Secret required.');
      return;
    }
    try {
      await setClientCreds(clientId.trim(), clientSecret.trim());
      setSavedCreds(true);
    } catch (e) {
      setError(String(e));
    }
  };

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const d = await GoogleCalendarProvider.beginAuth();
      setDevice({ verificationUrl: d.verificationUrl, userCode: d.userCode });
      await GoogleCalendarProvider.completeAuth();
      setDevice(null);
      await refreshAuthState();
    } catch (e) {
      setError(String(e));
      setDevice(null);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setError(null);
    try {
      await GoogleCalendarProvider.signOut();
      await refreshAuthState();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6 p-4">
      <header>
        <h2 className="text-lg font-semibold">Google Calendar</h2>
        <p className="text-sm text-zinc-500">
          Meetily Extended watches your calendar and prompts you ~1 minute before each meeting.
          Recording starts only when you click Record. Nothing is sent to Google beyond reading your events.
        </p>
        <a
          href="https://github.com/simranpalsinghrnm-sys/Meetily-Extended/blob/main/docs/calendar-setup.md"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Setup guide ↗
        </a>
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">OAuth client</h3>
        <p className="text-xs text-zinc-500">
          Create a "TVs and Limited Input devices" OAuth client in Google Cloud Console. Paste credentials below.
          Stored locally only.
        </p>
        <input
          type="text"
          placeholder="Client ID"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        <input
          type="password"
          placeholder="Client Secret"
          value={clientSecret}
          onChange={e => setClientSecret(e.target.value)}
          className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          onClick={saveCreds}
          className="rounded-md bg-zinc-100 px-3 py-2 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          Save credentials
        </button>
        {savedCreds && <span className="ml-2 text-xs text-green-600">Saved.</span>}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Connection</h3>
        {isAnyAuthed ? (
          <div className="space-y-2">
            <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
              ✓ Connected to Google Calendar
            </div>
            <button
              onClick={disconnect}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={busy}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Waiting for approval…' : 'Connect Google Calendar'}
          </button>
        )}

        {device && (
          <div className="space-y-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
            <div>
              1. Open <a href={device.verificationUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline dark:text-blue-300">{device.verificationUrl}</a>
            </div>
            <div>
              2. Enter code:{' '}
              <code className="rounded bg-white px-2 py-1 font-mono text-base dark:bg-zinc-900">{device.userCode}</code>
            </div>
            <div className="text-xs text-zinc-500">Approve in the browser. This dialog auto-closes when done.</div>
          </div>
        )}
      </section>
    </div>
  );
}
