# TOOLMYSELF_CHANGES.md

Files modified in `E:\MacNetwork\ToolMySelf\` for Phase 5 (Meetily Extended bridge).

All changes are **additive**. No existing columns dropped or renamed. Defaults are no-op when bridge settings are unset.

## New file

### `src/main/meetilyBridge.ts`

Local HTTP webhook receiver + Meetily Extended client.

- `startMeetilyBridgeReceiver()` — listens on `127.0.0.1:<meetily_bridge_webhook_port>` (default 5169) for `POST /` from Meetily Extended.
- `stopMeetilyBridgeReceiver()` — stops the listener.
- `fetchMeetilyExtendedProjects()` — pulls `GET /api/projects` from `meetily_bridge_url`.
- `meetilyBridgeStatus()` / `setMeetilyBridgeConfig()` — settings helpers.

Auth: `Authorization: Bearer <meetily_bridge_token>` when token is set.

On valid push:
- Resolves ToolMySelf `client.name = company AND project.name = project` → `project_id`.
- Writes a `notes` row (`source='meetily'`, `meta_json` containing `bridge: true`, company, project, meetily_id).
- Inserts `tasks` rows for each action item (`source='meetily'`, `ext_id = <meetily_id>:<title>`).
- If no match: row goes to `inbox_items` for manual routing — same UX as the current poller.

## Modified files

### `src/shared/types.ts`

Added to `Settings` type (additive, no removals):

```ts
meetily_bridge_url: string;
meetily_bridge_token: string;
meetily_bridge_webhook_port: number;
meetily_bridge_enabled: boolean;
```

## Files referenced but not yet patched

These need a one-line wire-up by the user (or a follow-up turn) to fully activate the bridge:

1. `src/main/settings.ts` — defaults for the four new keys (`meetily_bridge_url: ''`, `meetily_bridge_token: ''`, `meetily_bridge_webhook_port: 5169`, `meetily_bridge_enabled: false`).
2. `src/main/index.ts` — on app ready, call `startMeetilyBridgeReceiver()`; on quit, call `stopMeetilyBridgeReceiver()`.
3. `src/main/ipc.ts` — expose `meetilyBridgeStatus`, `setMeetilyBridgeConfig`, `fetchMeetilyExtendedProjects` so the renderer can manage the bridge.
4. `src/preload/index.ts` — surface the IPC handlers on `window.api`.
5. `src/renderer/src/pages/Integrations.tsx` — new "Meetily Extended bridge" section with URL/token/port/enabled toggles + "Pull projects" button.

These were deliberately left as a single follow-up commit so the destructive surface area is one file at a time and easy to review.

## Database schema

**No schema changes to ToolMySelf.** The bridge writes only to existing tables: `notes`, `tasks`, `inbox_items`. Constraint in DISCOVERY.md (§stop_and_ask_before) is honored.

## Notion routing (v.16+)

Meetily Extended does NOT integrate with Notion directly. Instead, when ToolMySelf receives a meeting via the bridge (POST to its webhook), it should:

1. Create the Note + Tasks rows (existing behavior in `meetilyBridge.ts`).
2. If ToolMySelf settings have `notion_auto_sync = true` and `notion_database_id` set, fire its existing Notion sync against that note / those tasks.

Recommended patch to ToolMySelf `meetilyBridge.ts` (inside `ingest()` after `insertActionItems`):

```ts
if (projectId && getSettings().notion_auto_sync) {
  try {
    await notionSyncSingleNote(noteId);
    await notionSyncProjectTasks(projectId);
  } catch (e) {
    console.warn('[meetilyBridge] notion sync failed', e);
  }
}
```

`notionSyncSingleNote` / `notionSyncProjectTasks` already exist in `src/main/notion.ts` (used by manual sync UI). No new Notion auth needed.

This keeps the integration matrix simple:
- Meetily Extended → ToolMySelf (bridge)
- ToolMySelf → Notion (existing)
- Meetily Extended → Notion (never direct)

## Rollback

Setting `meetily_bridge_enabled = false` stops the webhook receiver. The existing SQLite poller in `src/main/meetilyWatch.ts` continues to work unchanged, so ToolMySelf still picks up Meetily meetings even with the bridge fully off.
