'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

type BridgeStatus = {
  running: boolean;
  bind: string;
  has_token: boolean;
  toolmyself_webhook_configured: boolean;
};

export function BridgeSettings() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [token, setToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('http://127.0.0.1:5169/');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const s = await invoke<BridgeStatus>('bridge_status');
      setStatus(s);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await invoke('bridge_set_config', { token, toolmyselfWebhookUrl: webhookUrl });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <header>
        <h2 className="text-lg font-semibold">ToolMySelf bridge</h2>
        <p className="text-sm text-zinc-500">
          Loopback HTTP server lets ToolMySelf consume tagged meetings + action items directly.
          Off by default. Enable when ToolMySelf is also running on this machine.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Server status</h3>
        {status ? (
          <ul className="space-y-1 text-sm">
            <li>Bind: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{status.bind}</code></li>
            <li>Running: {status.running ? '✓' : '✗'}</li>
            <li>Token set: {status.has_token ? '✓' : '✗'}</li>
            <li>ToolMySelf webhook configured: {status.toolmyself_webhook_configured ? '✓' : '✗'}</li>
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Shared token</h3>
        <p className="text-xs text-zinc-500">
          Any random string. Paste the same value into ToolMySelf's Meetily Extended bridge settings.
          Leave blank to disable auth (loopback-only, low risk).
        </p>
        <input
          type="password"
          placeholder="Shared token"
          value={token}
          onChange={e => setToken(e.target.value)}
          className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">ToolMySelf webhook URL</h3>
        <p className="text-xs text-zinc-500">
          Where to POST completed meetings. Default ToolMySelf port is 5169.
        </p>
        <input
          type="text"
          placeholder="http://127.0.0.1:5169/"
          value={webhookUrl}
          onChange={e => setWebhookUrl(e.target.value)}
          className="w-full rounded-md border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
