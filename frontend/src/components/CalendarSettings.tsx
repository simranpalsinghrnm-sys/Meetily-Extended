'use client';

import { useEffect, useState } from 'react';
import { GoogleCalendarProvider, setClientCreds, listGoogleAccounts, removeGoogleAccount } from '@/calendar/google';
import { useCalendar } from '@/calendar/CalendarProvider';

export function CalendarSettings() {
  const { isAnyAuthed, refreshAuthState, watcher, testPrompt } = useCalendar();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savedCreds, setSavedCreds] = useState(false);
  const [device, setDevice] = useState<{ verificationUrl: string; userCode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; email: string }[]>([]);

  const reloadAccounts = async () => {
    try {
      setAccounts(await listGoogleAccounts());
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    refreshAuthState();
    reloadAccounts();
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
      await reloadAccounts();
    } catch (e) {
      setError(String(e));
      setDevice(null);
    } finally {
      setBusy(false);
    }
  };

  const disconnectAll = async () => {
    setError(null);
    try {
      await GoogleCalendarProvider.signOut();
      await refreshAuthState();
      await reloadAccounts();
    } catch (e) {
      setError(String(e));
    }
  };

  const removeOne = async (email: string) => {
    setError(null);
    try {
      await removeGoogleAccount(email);
      await refreshAuthState();
      await reloadAccounts();
    } catch (e) {
      setError(String(e));
    }
  };

  const runTest = async () => {
    setTestResult(null);
    try {
      const r = await testPrompt();
      setTestResult(`Prompt fired. You chose: ${r}`);
    } catch (e) {
      setTestResult(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <header>
        <h2 className="text-lg font-semibold">Google Calendar</h2>
        <p className="text-sm text-zinc-500">
          Polls every 30s. Pops a Record / Skip / Snooze dialog 3 minutes before any meeting (event with a video link or attendees).
          Re-prompts at T-30s if first one was dismissed.
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

      <section className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Watcher status</h3>
        {watcher ? (
          <ul className="space-y-1 text-sm">
            <li>
              Last poll: {watcher.lastPollAt ? new Date(watcher.lastPollAt).toLocaleTimeString() : '— not yet —'}
            </li>
            <li>Upcoming events (next 15 min): {watcher.upcoming.length}</li>
            <li>Likely meetings among them: {watcher.upcoming.filter(e => e.isMeeting).length}</li>
            {watcher.lastError && (
              <li className="text-red-600">Last error: {watcher.lastError}</li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Initializing…</p>
        )}

        {watcher && watcher.upcoming.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
            {watcher.upcoming.slice(0, 5).map(e => {
              const min = Math.round((new Date(e.startsAt).getTime() - Date.now()) / 60_000);
              return (
                <li key={e.id} className="flex items-center justify-between">
                  <span className={e.isMeeting ? 'font-medium' : 'text-zinc-500'}>
                    {e.isMeeting ? '🔔' : '·'} {e.title}
                  </span>
                  <span className="text-zinc-500">in {min}m</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
        {accounts.length > 0 && (
          <ul className="space-y-1 rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
            {accounts.map(a => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="flex items-center gap-2">
                  <span className="text-green-600">●</span>
                  <span>{a.email}</span>
                </span>
                <button
                  onClick={() => removeOne(a.email)}
                  className="text-xs text-zinc-500 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <button
            onClick={connect}
            disabled={busy}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Waiting for approval…' : accounts.length === 0 ? 'Connect Google Calendar' : '+ Add another account'}
          </button>
          {isAnyAuthed && (
            <>
              <button
                onClick={runTest}
                className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-zinc-800"
              >
                Test prompt
              </button>
              <button
                onClick={disconnectAll}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Disconnect all
              </button>
            </>
          )}
        </div>
        {testResult && <p className="text-sm text-zinc-500">{testResult}</p>}

        {device && (
          <div className="space-y-2 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950">
            <div>
              1. Open{' '}
              <a
                href={device.verificationUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-700 underline dark:text-blue-300"
              >
                {device.verificationUrl}
              </a>
            </div>
            <div>
              2. Enter code:{' '}
              <code className="rounded bg-white px-2 py-1 font-mono text-base dark:bg-zinc-900">
                {device.userCode}
              </code>
            </div>
            <div className="text-xs text-zinc-500">Approve in the browser. This dialog auto-closes when done.</div>
          </div>
        )}
      </section>
    </div>
  );
}
