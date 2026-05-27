# DISCOVERY — Meetily Extended

Phase 0 output. No code changes yet. Review before Phase 1.

Generated: 2026-05-26.

---

## 1. Source fork — Zackriya-Solutions/meetily

Cloned shallow at `./upstream/` (read-only reference). New fork will be initialized at repo root with upstream code copied in (not as submodule).

### Stack

| Layer | Tech | Notes |
|---|---|---|
| Desktop shell | Tauri 2.x | bundle id `com.meetily.ai`, product `meetily`, v0.3.0 |
| Frontend | Next.js 14 + React 18 + TypeScript | dev port 3118, pnpm-based, Tailwind, shadcn/ui, BlockNote editor, Radix |
| Audio (native) | Rust — cpal, whisper-rs, custom mixer + VAD | modularized: `audio/{devices,capture,pipeline,recording_*}` |
| Transcription | whisper.cpp (local, GPU-accel: Metal/CUDA/Vulkan) | server on :8178 |
| Backend API | FastAPI + Python 3 + aiosqlite | port :5167, `/backend/app/{main,db,transcript_processor,schema_validator}.py` |
| LLM | Ollama (default :11434), Claude, Groq, OpenRouter | summarization pipeline server-side |
| Storage | SQLite at `%APPDATA%/com.meetily.ai/meeting_minutes.sqlite` | aiosqlite, same DB consumed by ToolMySelf |
| Updater | Tauri updater plugin → GitHub releases `latest.json` | upstream pubkey will be replaced |
| Build | pnpm + Tauri CLI; Windows via `clean_run_windows.bat` / `clean_build_windows.bat` | requires VS Build Tools (C++) |

### Existing capabilities we keep

- Local Mic + System audio capture (WASAPI loopback on Windows).
- Real-time transcription via whisper.cpp with VAD.
- Server-side meeting CRUD + summarization (`/backend/app/main.py`).
- SidebarProvider holds global meeting state.
- Tauri command/event IPC pattern.

### Capabilities missing (this fork adds)

1. Calendar awareness — Meetily today is manual: user clicks Record.
2. Pre-meeting notification opt-in.
3. Company/Project tagging at capture time.
4. Project-scoped UI (left rail Company → Project → Meetings).
5. Bidirectional integration with ToolMySelf beyond passive SQLite reads.

---

## 2. ToolMySelf — current Meetily integration

Lives at `E:\MacNetwork\ToolMySelf`. Electron + Vite + React + TypeScript + better-sqlite3 + Anthropic SDK + Notion sync.

### Integration surface today (files)

| File | Role |
|---|---|
| `src/main/meetily.ts` | Read-only SQLite reader. Resolves DB path from `settings.meetily_db_path` or `%APPDATA%/com.meetily.ai/meeting_minutes.sqlite` (sqlite/db fallback). `listMeetings`, `getMeetingDetail`, `buildContent`, `importMeeting`, `dbStatus`. |
| `src/main/meetilyWatch.ts` | 60s poller. Detects new meetings via `MAX(created_at)`. Routes through inbox if `meetily_auto_inbox`. Fires desktop toast via `notifyMeetilyMeeting`. Per-meeting skip list. |
| `src/shared/types.ts` | `NoteSource` includes `'meetily'`. Settings keys: `meetily_db_path`, `meetily_notify_enabled`, `meetily_auto_inbox`, `meetily_include_transcript`, `meetily_include_summary`, `meetily_include_notes`, `meetily_skipped_ids`. |

### Data hierarchy in ToolMySelf

`Agency → Client → Project`. Meetings land as `Note(source='meetily', project_id=N, meta={meetily_id, meetily_created_at, has_summary})`.

ToolMySelf assumes user manually routes each Meetily meeting to a project (via inbox flow). No company/project hint comes from Meetily.

### Tables ToolMySelf reads from Meetily SQLite

| Table | Columns used |
|---|---|
| `meetings` | `id, title, created_at, updated_at, folder_path` |
| `transcripts` | `meeting_id, transcript, speaker, audio_start_time, timestamp` |
| `summary_processes` | `meeting_id, result, status` (filters `status='completed'`) |
| `meeting_notes` | `meeting_id, notes_markdown` |

### "Better integration" — what Phase 5 must deliver

1. **Replace read-only SQLite peek with a tagged push.** Meetily Extended already knows the Company + Project for each meeting. It should push to ToolMySelf with `(company, project, action_items[])` so ToolMySelf skips the inbox triage step.
2. **Map ToolMySelf `Client → Project` to Meetily Extended `Company → Project`.** Hierarchies are compatible (Client = Company). Agency is a ToolMySelf-only concept and stays out of Meetily Extended.
3. **Bidirectional metadata.** Meetily Extended's Project picker pulls from ToolMySelf's `projects.list()` so the same names exist in both apps. New projects created in Meetily Extended round-trip to ToolMySelf via the bridge.
4. **Keep the SQLite reader as a fallback path** for users who run only Meetily Extended without ToolMySelf, or vice-versa. Push API is additive, not a replacement.
5. **Action items.** ToolMySelf has a full Task model (`tasks` table with status, priority, due_at, project_id). Meetily Extended will extract action items during summarization and push them as tasks with `source='meetily'`, `ext_id=<meetily_meeting_id>:<idx>`.

---

## 3. Proposed bridge contract (validate before Phase 5)

Both apps run on the same host. Loopback HTTP, token-auth.

**Meetily Extended exposes** (port 5168, configurable):
- `GET  /api/projects` → returns list of `(company, project, members)` known to Meetily Extended
- `GET  /api/meetings?since=<iso>` → meetings with full payload incl. company, project, summary, action items
- `GET  /api/meetings/:id` → single meeting detail
- `POST /api/webhooks/subscribe` → `{ url, token }` for push
- `POST /api/projects` → create company/project (called by ToolMySelf when user creates a project there)

**Meetily Extended pushes to ToolMySelf** (when a meeting completes):
- `POST {toolmyself_webhook_url}` with `{ meeting_id, company, project, title, started_at, summary, transcript_url, action_items[] }`
- ToolMySelf maps `company → client_id` and `project → project_id`, creates the Note + Tasks atomically.

Auth: shared secret stored in both apps' settings (`meetily_bridge_token`). Loopback-only bind (127.0.0.1).

---

## 4. Top 10 risks / unknowns

1. **Calendar auth on Windows.** Google OAuth device-flow works but requires a Google Cloud project with `https://www.googleapis.com/auth/calendar.readonly`. User must create OAuth client. No client secrets bundled.
2. **Notification UX on Windows.** Tauri `notification` plugin supports actions but Windows toast action buttons need an AUMID + the app installed (not portable). Verify in Phase 2; fallback = in-app prompt window.
3. **Auto-detection of "is this a meeting".** Heuristic: event has a video link (Zoom/Meet/Teams URL in location/description) OR has ≥2 attendees including the user. Cheap, no LLM call.
4. **Tagging confidence.** Email-domain → company is reliable; event-title → project is noisy. Need user-editable rules table + per-meeting override before recording starts.
5. **Schema migration risk.** Adding `companies`, `projects`, `meeting_tags` to upstream Meetily DB. Upstream owns `meeting_minutes.sqlite`; we add migrations in a separate file, never touch existing tables. ToolMySelf is read-only against this DB so safe.
6. **ToolMySelf write-side changes.** Phase 5 must update ToolMySelf's `meetily.ts` to consume tagged push instead of (or in addition to) SQLite peek. Listed in `<stop_and_ask_before>`: any schema change to ToolMySelf requires user OK.
7. **Audio capture during overlapping meetings.** If two events overlap, current Meetily pipeline can only record one. Out of scope for v1; documented in FUTURE.md.
8. **Whisper model size on first run.** Default `small` ~244MB; user choice. Document in SETUP.md.
9. **OAuth secret storage.** Reuse Tauri Stash / OS keychain (Windows Credential Manager via `tauri-plugin-stronghold` or simple DPAPI). Decide in Phase 2.
10. **Upstream divergence.** We fork at HEAD; future upstream changes must be pulled manually. Branch strategy: `main` = our fork, `upstream` = read-only reference clone, periodic rebase via cherry-pick of upstream commits we want.

---

## 5. File scope for the fork (will be created/modified)

**New top-level (this repo):**
- `frontend/` ← copied from upstream, then modified
- `backend/` ← copied from upstream, then modified
- `bridge/` ← new — local HTTP server for ToolMySelf integration (Node or Rust; TBD Phase 5)
- `docs/` ← copied + extended

**New modules inside frontend:**
- `src/calendar/` — provider abstraction + Google impl
- `src/projects/` — Company/Project store, picker UI, tagging rules engine
- `src/notifications/` — pre-meeting toast + opt-in flow
- `src-tauri/src/calendar/` — Rust side of calendar polling (or Node sidecar; decide Phase 2)
- `src-tauri/src/projects.rs` — SQLite DAL for new tables
- `src-tauri/src/bridge.rs` — local HTTP server

**ToolMySelf changes (Phase 5 only, all listed in `TOOLMYSELF_CHANGES.md`):**
- `src/main/meetily.ts` — add bridge client; keep SQLite reader as fallback
- `src/main/meetilyWatch.ts` — switch primary trigger from poll to webhook; keep poll as safety net
- `src/shared/types.ts` — add settings keys `meetily_bridge_url`, `meetily_bridge_token`
- New: `src/main/meetilyBridge.ts` — webhook receiver + push client

---

## 6. Out of scope for v1 (going to FUTURE.md)

- Outlook / Apple Calendar / ICS providers (interface stubbed, only Google works)
- Multi-meeting overlap recording
- Cloud sync of meetings (Meetily stays local; ToolMySelf has its own Firebase channel)
- Mobile companion app
- Real-time live transcription pushed to ToolMySelf during the meeting (only post-meeting push in v1)
- Slack / Teams / Notion direct destinations from Meetily Extended (route through ToolMySelf if user wants those)
- LLM-based smart project routing — v1 uses deterministic rules only; LLM optional later

---

## 7. Decisions needed from user before Phase 1

1. **OK to keep `com.meetily.ai` bundle id?** Sharing the upstream id means same `%APPDATA%` folder → fork can read existing user data. Pro: zero migration. Con: can't run upstream + extended side-by-side. **Recommend: change to `com.meetily.extended` and migrate on first run.**
2. **Whisper model default for the installer.** Recommend `small.en` (244MB, English-only, fast).
3. **OAuth client for Google Calendar.** User creates project in Google Cloud Console, downloads `client_id` + `client_secret`, pastes into app settings. No secrets in repo. Confirm willing.
4. **Branch hygiene.** New repo `Meetily Extended` initialized at root, `upstream/` kept as a separate untracked clone for diffs. Confirm OK or prefer git submodule.

---

## ✅ Phase 0 complete — discovery written, upstream cloned, integration contract drafted.

Stopping here per execution plan. Awaiting review + answers to §7 before Phase 1.
