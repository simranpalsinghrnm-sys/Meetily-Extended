# FUTURE.md — Out-of-scope for v1

Deferred by design. Re-evaluate after v1 ships and there's real usage.

## Calendar providers

- Outlook / Microsoft 365 (Graph API) — interface is already provider-agnostic; add a `OutlookCalendarProvider` mirroring `GoogleCalendarProvider`.
- Apple Calendar (CalDAV) — same shape.
- Raw `.ics` URL — for self-hosted / privacy users.

## Recording

- Overlapping meeting handling — current pipeline records one stream at a time. Need a recorder pool with per-meeting audio routing.
- Mid-meeting tag change — today, tag is locked at start. Allow re-tagging from the project tree without re-recording.

## Tagging

- LLM-assisted tagging — only when deterministic rules + history all miss. Run locally via Ollama to stay offline.
- Org chart import — pull Company / Project / Members from a CRM (HubSpot, Pipedrive) instead of typing in.
- "Why did you tag this?" — explainable trail in the meeting detail view.

## ToolMySelf integration

- Real-time live transcription stream to ToolMySelf during the meeting (today: post-meeting push only).
- Reverse-direction sync — when a ToolMySelf project is archived/renamed, propagate to Meetily Extended.
- Conflict resolution UI when the same meeting ID lands twice (network retry).

## UX

- Tray icon background mode — keep the app running while window is closed so the calendar watcher stays alive.
- Pin a project to the top of the tree.
- Per-project Whisper model / LLM prompt overrides (one client wants verbose, another wants terse).
- Search across all transcripts — currently scoped to a single project.

## Distribution

- Auto-update channel via the user's own GitHub releases (the upstream Meetily updater pubkey was stripped during rebrand — needs replacement before publishing).
- Signed Windows installer.
- macOS notarized build.

## Schema migration

- Wizard to import existing meetings from upstream `%APPDATA%\com.meetily.ai\meeting_minutes.sqlite` into the new `com.meetily.extended\` location.
- Backfill wizard to tag pre-existing untagged meetings using current `tagging_rules`.

## Privacy / compliance

- Per-attendee opt-out — if any attendee email matches a "do not record" list, suppress the toast.
- Local encryption at rest for `meeting_minutes.sqlite` (Tauri stronghold).

## Telemetry

- Disabled entirely in the fork. PostHog dep stays in code for now but no events emit. Strip if it's confusing.
