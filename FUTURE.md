# FUTURE.md — Out-of-scope for v1

Deferred by design. Re-evaluate after v1 ships and there's real usage.

## Granola-inspired daily-driver wins (post-v16)

Granola = note-taking app that listens silently, lets you type rough notes during the meeting, then enhances them with AI using transcript context.

### Shipped in v17 (templates only)

- `one_on_one.json` — 1:1 manager/report template
- `client_check_in.json` — account review template
- `recap_email.json` — generates ready-to-send recap email
- `notes_enhance.json` — polishes user-typed notes using transcript

Select via Settings → Summary → Template after recording stops.

### Wanted but deferred (need Rust work)

- **"Enhance my notes" inline button** — one-click instead of template-picker dance. Needs new Tauri command `enhance_notes(meeting_id, user_notes_md)` that calls the existing provider with the `notes_enhance` template + raw notes as context. Estimated: 1 day.
- **"Draft recap email" inline button** — same pattern, calls `recap_email` template. 1 day.
- **Recurring meeting context carryover** — when calendar event repeats (same title + ≥50% attendee overlap in past 30 days), auto-prepend prior summary into the prompt. Helps the LLM thread context across weekly 1:1s. 2 days.
- **Topic auto-segmentation** — split transcript into topic chunks (LLM-tagged), enable jump-to-topic in the transcript viewer. 3 days.
- **Inline transcript quotes** — click a sentence in the summary → highlights the source paragraph in the transcript. Granola has this. 2 days.
- **Live notes pane refinements** — upstream has BlockNote editor. Add autosave indicator + side-by-side transcript scroll-lock during recording. 2 days.
- **Meeting series view** — group recurring meetings, show "last 4 weeks" digest. 3 days.
- **Voice-memo quick capture** — global hotkey → records 30s memo, transcribes, tags to current project. 1 day.
- **Drag-and-drop audio import → transcribe** — already partial in upstream (Beta features). Promote out of beta. 0.5 day.

### Not in scope (philosophical)

- **Shareable read-only links** — Granola does this via cloud. Meetily Extended is local-first. Skip unless user wants ToolMySelf to mirror to Firebase (existing ToolMySelf feature).
- **In-meeting bot** — Granola explicitly avoids this; so do we.
- **Mobile companion app** — too big.

---

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
