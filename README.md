# Meetily Extended

Fork of [Zackriya-Solutions/meetily](https://github.com/Zackriya-Solutions/meetily) tuned for solo operators who run many client meetings across multiple companies and projects.

**What it adds on top of upstream Meetily:**

1. **Calendar-driven opt-in.** Watches your Google Calendar in the background. ~1 minute before any meeting (event with a video link or attendees) you get a system toast: **Record / Skip / Snooze**. Recording starts only if you click Record. Nothing auto-runs.
2. **Company / Project tagging.** Every recording is tagged with a Company + Project at capture time. Tags are auto-suggested from attendee email domains, event titles, and prior history. Low-confidence suggestions ask you to confirm; high-confidence ones tag silently.
3. **Project Spaces UI.** Left rail tree: Company → Project → Meetings. Per-project dashboard with recent meetings, open action items, and members. Global `Cmd/Ctrl+K` palette.
4. **ToolMySelf bridge.** Optional local-only HTTP bridge (`127.0.0.1:5168`) that hands tagged meetings, summaries, and action items to [ToolMySelf](../ToolMySelf) — landing each meeting directly in the matching project without manual inbox triage.

Everything else from upstream Meetily — local Whisper transcription, local LLM summaries, no cloud, mic + system audio capture — works identically.

---

## Quick start

```powershell
# One-time
cd "E:\MacNetwork\Meetily Extended"
git submodule update --init --recursive
cd backend
.\build_whisper.cmd small.en
cd ..\frontend
pnpm install

# Run dev
# Terminal 1
cd "E:\MacNetwork\Meetily Extended\backend"
.\start_with_output.ps1

# Terminal 2
cd "E:\MacNetwork\Meetily Extended\frontend"
pnpm tauri:dev
```

Full Windows setup including platform deps: [SETUP.md](SETUP.md).
Google Calendar OAuth setup: [docs/calendar-setup.md](docs/calendar-setup.md).

---

## How tagging works

When a calendar event fires the opt-in toast, the tagger runs these rules in order until it has a `(company, project)` pair with confidence ≥ 0.70:

| Rule | Pattern | Confidence |
|---|---|---|
| Attendee email match | `tagging_rules` rows of kind `attendee_email` | 0.95 |
| Attendee domain match | `tagging_rules.kind = 'email_domain'` | 0.85 |
| Company.domain_pattern match | exact attendee domain → company | 0.75 |
| Title keyword | `tagging_rules.kind = 'title_keyword'` | 0.70 |
| Title contains project name token | tokens > 3 chars | 0.65 |
| Last-used project for this company | fallback | 0.40 |

Below 0.70: the picker pops open before recording starts so you pick / confirm.

Rules live in the `tagging_rules` table. Edit them in **Settings → Tagging** (UI lands with v1) or via SQL directly.

---

## ToolMySelf bridge

Off by default. Enable when you also run ToolMySelf on the same machine.

**Meetily Extended side** (Settings → Integrations → ToolMySelf):
- Pick a shared token (any random string).
- Optionally set the ToolMySelf webhook URL: `http://127.0.0.1:5169/`.

**ToolMySelf side** (Settings → Integrations → Meetily Extended bridge — TS code in `src/main/meetilyBridge.ts`):
- Enable.
- Paste the same token.
- Paste Meetily Extended URL: `http://127.0.0.1:5168/`.
- Click **Pull projects** to mirror Meetily Extended's Company/Project list.

Once both sides are configured, recording a meeting tagged `Acme / Website Redesign` in Meetily Extended will land the meeting note + action items directly in the matching ToolMySelf project within seconds. No inbox triage required.

If you don't run ToolMySelf, the bridge does nothing — Meetily Extended works fine standalone.

---

## What's new vs. upstream Meetily

| Area | Upstream | Extended |
|---|---|---|
| Bundle id | `com.meetily.ai` | `com.meetily.extended` |
| Start trigger | Manual click | Calendar opt-in (still manual underneath) |
| Tagging | None | Company / Project at capture |
| Project hierarchy | None | Company → Project → Meetings tree |
| ToolMySelf bridge | None | Loopback HTTP + webhook push |
| Action item extraction | Part of summary | First-class table + push to ToolMySelf tasks |

---

## Architecture

Same Tauri + Next.js + Rust + whisper.cpp + FastAPI + SQLite + Ollama stack as upstream. New surfaces:

```
frontend/
  src/
    calendar/          ← Google Calendar provider, manager, classifier
    notifications/     ← pre-meeting toast + always-on-top fallback window
    projects/          ← Company/Project store, tagger, picker UI, provider
    components/
      ProjectSpaces/   ← left rail tree, project dashboard, command palette
    app/
      meeting-prompt/  ← always-on-top opt-in window route
      projects/[id]/   ← per-project dashboard route
  src-tauri/
    src/
      projects/        ← SQLite repo + Tauri commands + dashboard query
      bridge/          ← loopback HTTP server + ToolMySelf push client
    migrations/
      20260527000000_add_companies_projects.sql
```

ToolMySelf side adds `src/main/meetilyBridge.ts` and four `Settings` keys. See [TOOLMYSELF_CHANGES.md](TOOLMYSELF_CHANGES.md).

---

## Project status

v1.0.0-extended.0 — scaffolded, not yet shipped. First binary needs a manual `pnpm tauri:build` per [SETUP.md](SETUP.md). Roadmap in [FUTURE.md](FUTURE.md).

Upstream Meetily license (MIT) applies. See [LICENSE.md](LICENSE.md).
