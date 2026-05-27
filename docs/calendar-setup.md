# Google Calendar setup

Meetily Extended needs a Google OAuth client to read your calendar. Free, 5 minutes.

## 1. Create a Google Cloud project

1. Open https://console.cloud.google.com/
2. Top bar → project picker → **New Project**. Name it anything (`meetily-extended` works). Create.

## 2. Enable the Calendar API

1. Left menu → **APIs & Services** → **Library**.
2. Search "Google Calendar API" → **Enable**.

## 3. Configure OAuth consent

1. **APIs & Services** → **OAuth consent screen**.
2. User type: **External** (unless you're on a Workspace and want Internal). Create.
3. App name: `Meetily Extended`. Support email: your email. Save & Continue.
4. Scopes → **Add or remove scopes** → tick `.../auth/calendar.readonly`. Save & Continue.
5. Test users → add your own Gmail. Save.
6. Publish status: leave as **Testing**. Fine for personal use.

## 4. Create OAuth client (TV / Limited Input type)

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
2. Application type: **TVs and Limited Input devices**.
3. Name: `Meetily Extended desktop`. Create.
4. Copy the **Client ID** and **Client secret**.

## 5. Paste into Meetily Extended

1. Open Meetily Extended → **Settings** → **Calendar**.
2. Paste Client ID + Client secret. **Save**.
3. Click **Connect Google Calendar**.
4. App shows a code + opens https://www.google.com/device in your browser. Enter the code. Approve.
5. Done. Background watcher kicks in within 60s.

## Notes

- Secrets are stored locally only (Tauri Store). Never leave your machine.
- `calendar.readonly` is read-only — Meetily Extended cannot create, modify, or delete events.
- Token refresh happens automatically. Revoke any time at https://myaccount.google.com/permissions.
- If you hit a rate limit (very unlikely for personal use), poll interval will fall back to 5 min.
