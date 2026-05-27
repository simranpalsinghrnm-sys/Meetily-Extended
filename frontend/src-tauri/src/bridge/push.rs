use serde::Serialize;

use super::server::BridgeState;

#[derive(Debug, Serialize, Clone)]
pub struct MeetingPushPayload {
    pub meeting_id: String,
    pub title: String,
    pub started_at: String,
    pub company: Option<String>,
    pub project: Option<String>,
    pub summary: Option<String>,
    pub transcript_chars: i64,
    pub action_items: Vec<ActionItemPush>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ActionItemPush {
    pub title: String,
    pub details: Option<String>,
    pub assignee_email: Option<String>,
    pub due_at: Option<String>,
    pub status: String,
}

pub async fn push_to_toolmyself(state: &BridgeState, payload: &MeetingPushPayload) -> anyhow::Result<()> {
    let (url, token) = {
        let cfg = state.config.lock().await;
        let Some(url) = cfg.toolmyself_webhook_url.clone() else {
            log::debug!("[bridge] no ToolMySelf webhook configured");
            return Ok(());
        };
        (url, cfg.token.clone())
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let mut req = client.post(&url).json(payload);
    if !token.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", token));
    }
    let res = req.send().await?;
    if !res.status().is_success() {
        anyhow::bail!("ToolMySelf webhook returned {}", res.status());
    }
    Ok(())
}
