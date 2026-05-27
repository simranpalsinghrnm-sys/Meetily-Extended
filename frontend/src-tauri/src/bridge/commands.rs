use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex;

use super::push::{push_to_toolmyself, ActionItemPush, MeetingPushPayload};
use super::server::{current_status, run as run_server, BridgeConfig, BridgeState, BridgeStatus};
use crate::state::AppState;

const TAG: &str = "[bridge]";

/// Start the loopback HTTP server. Called once during app setup.
pub async fn ensure_bridge_started(app: &AppHandle) -> anyhow::Result<()> {
    if app.try_state::<BridgeState>().is_some() {
        return Ok(());
    }
    let app_state = app
        .try_state::<AppState>()
        .ok_or_else(|| anyhow::anyhow!("AppState not initialized yet"))?;
    let pool = app_state.db_manager.pool().clone();

    let cfg = BridgeConfig::default();
    let bridge_state = BridgeState {
        pool,
        config: Arc::new(Mutex::new(cfg)),
    };
    app.manage(bridge_state.clone());

    let spawn_state = bridge_state.clone();
    tokio::spawn(async move {
        if let Err(e) = run_server(spawn_state).await {
            log::error!("{} server crashed: {}", TAG, e);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn bridge_status(state: State<'_, BridgeState>) -> Result<BridgeStatus, String> {
    Ok(current_status(&state).await)
}

#[tauri::command]
pub async fn bridge_set_config(
    state: State<'_, BridgeState>,
    token: Option<String>,
    toolmyself_webhook_url: Option<String>,
) -> Result<BridgeStatus, String> {
    {
        let mut cfg = state.config.lock().await;
        if let Some(t) = token {
            cfg.token = t;
        }
        if let Some(u) = toolmyself_webhook_url {
            cfg.toolmyself_webhook_url = if u.is_empty() { None } else { Some(u) };
        }
    }
    Ok(current_status(&state).await)
}

#[derive(serde::Deserialize)]
pub struct PushInput {
    pub meeting_id: String,
    pub title: String,
    pub started_at: String,
    pub company: Option<String>,
    pub project: Option<String>,
    pub summary: Option<String>,
    pub transcript_chars: i64,
    pub action_items: Vec<ActionItemPush>,
}

#[tauri::command]
pub async fn bridge_push_meeting(
    state: State<'_, BridgeState>,
    payload: PushInput,
) -> Result<(), String> {
    let p = MeetingPushPayload {
        meeting_id: payload.meeting_id,
        title: payload.title,
        started_at: payload.started_at,
        company: payload.company,
        project: payload.project,
        summary: payload.summary,
        transcript_chars: payload.transcript_chars,
        action_items: payload.action_items,
    };
    push_to_toolmyself(&state, &p).await.map_err(|e| e.to_string())
}
