use std::net::SocketAddr;
use std::sync::Arc;

use serde::Serialize;
use sqlx::SqlitePool;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct BridgeConfig {
    pub bind: String,
    pub token: String,
    pub toolmyself_webhook_url: Option<String>,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            bind: "127.0.0.1:5168".to_string(),
            token: String::new(),
            toolmyself_webhook_url: None,
        }
    }
}

#[derive(Clone)]
pub struct BridgeState {
    pub pool: SqlitePool,
    pub config: Arc<Mutex<BridgeConfig>>,
}

#[derive(Debug, Serialize)]
pub struct BridgeStatus {
    pub running: bool,
    pub bind: String,
    pub has_token: bool,
    pub toolmyself_webhook_configured: bool,
}

pub async fn current_status(state: &BridgeState) -> BridgeStatus {
    let cfg = state.config.lock().await;
    BridgeStatus {
        running: true,
        bind: cfg.bind.clone(),
        has_token: !cfg.token.is_empty(),
        toolmyself_webhook_configured: cfg.toolmyself_webhook_url.is_some(),
    }
}

/// Minimal HTTP server using tokio + raw TCP.
///
/// We avoid pulling in axum/warp for v1 to stay under the dependency-weight
/// constraint. Routes:
///   GET  /api/health
///   GET  /api/projects
///   GET  /api/meetings?since=ISO
///
/// All routes require `Authorization: Bearer <token>` when `token` is set.
pub async fn run(state: BridgeState) -> anyhow::Result<()> {
    let bind = { state.config.lock().await.bind.clone() };
    let addr: SocketAddr = bind.parse()?;
    let listener = TcpListener::bind(addr).await?;
    log::info!("[bridge] listening on http://{}", addr);

    loop {
        let (mut stream, peer) = match listener.accept().await {
            Ok(x) => x,
            Err(e) => {
                log::warn!("[bridge] accept failed: {}", e);
                continue;
            }
        };
        let state = state.clone();
        tokio::spawn(async move {
            if let Err(e) = handle(&mut stream, &state, peer).await {
                log::debug!("[bridge] handler error from {}: {}", peer, e);
            }
        });
    }
}

async fn handle(
    stream: &mut tokio::net::TcpStream,
    state: &BridgeState,
    _peer: SocketAddr,
) -> anyhow::Result<()> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let mut buf = vec![0u8; 8192];
    let n = stream.read(&mut buf).await?;
    if n == 0 {
        return Ok(());
    }
    let req = String::from_utf8_lossy(&buf[..n]).to_string();

    let (method, path, headers) = parse_request_line(&req);
    let token_ok = check_token(&headers, state).await;

    let body: String = if !token_ok {
        json_response(401, &serde_json::json!({"error": "unauthorized"}))
    } else if method == "GET" && path == "/api/health" {
        json_response(200, &serde_json::json!({"status": "ok"}))
    } else if method == "GET" && path == "/api/projects" {
        match list_projects_payload(&state.pool).await {
            Ok(v) => json_response(200, &v),
            Err(e) => json_response(500, &serde_json::json!({"error": e.to_string()})),
        }
    } else if method == "GET" && path.starts_with("/api/meetings") {
        let since = query_param(&path, "since");
        match list_meetings_payload(&state.pool, since.as_deref()).await {
            Ok(v) => json_response(200, &v),
            Err(e) => json_response(500, &serde_json::json!({"error": e.to_string()})),
        }
    } else {
        json_response(404, &serde_json::json!({"error": "not found"}))
    };

    stream.write_all(body.as_bytes()).await?;
    stream.shutdown().await.ok();
    Ok(())
}

fn parse_request_line(req: &str) -> (String, String, Vec<(String, String)>) {
    let mut lines = req.split("\r\n");
    let first = lines.next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("").to_string();
    let mut headers = Vec::new();
    for line in lines {
        if line.is_empty() {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            headers.push((k.trim().to_lowercase(), v.trim().to_string()));
        }
    }
    (method, path, headers)
}

async fn check_token(headers: &[(String, String)], state: &BridgeState) -> bool {
    let cfg = state.config.lock().await;
    if cfg.token.is_empty() {
        return true;
    }
    let auth = headers
        .iter()
        .find(|(k, _)| k == "authorization")
        .map(|(_, v)| v.clone())
        .unwrap_or_default();
    auth == format!("Bearer {}", cfg.token)
}

fn query_param(path: &str, key: &str) -> Option<String> {
    let q = path.split_once('?').map(|x| x.1).unwrap_or("");
    for pair in q.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == key {
                return Some(urlencoding_decode(v));
            }
        }
    }
    None
}

fn urlencoding_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next();
            let h2 = chars.next();
            if let (Some(a), Some(b)) = (h1, h2) {
                if let Ok(byte) = u8::from_str_radix(&format!("{}{}", a, b), 16) {
                    out.push(byte as char);
                    continue;
                }
            }
        } else if c == '+' {
            out.push(' ');
        } else {
            out.push(c);
        }
    }
    out
}

fn json_response<T: Serialize>(status: u16, body: &T) -> String {
    let body = serde_json::to_string(body).unwrap_or_else(|_| "{}".into());
    let phrase = match status {
        200 => "OK",
        401 => "Unauthorized",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "OK",
    };
    format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        phrase,
        body.len(),
        body
    )
}

#[derive(Serialize)]
struct ProjectPayload {
    id: i64,
    company_id: i64,
    company_name: String,
    name: String,
    description: Option<String>,
    status: String,
}

async fn list_projects_payload(pool: &SqlitePool) -> sqlx::Result<Vec<ProjectPayload>> {
    sqlx::query_as::<_, (i64, i64, String, String, Option<String>, String)>(
        "SELECT p.id, p.company_id, c.name, p.name, p.description, p.status
         FROM projects p JOIN companies c ON c.id = p.company_id
         ORDER BY c.name, p.name",
    )
    .fetch_all(pool)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|(id, cid, cname, name, desc, status)| ProjectPayload {
                id,
                company_id: cid,
                company_name: cname,
                name,
                description: desc,
                status,
            })
            .collect()
    })
}

#[derive(Serialize)]
struct MeetingPayload {
    id: String,
    title: String,
    created_at: String,
    company: Option<String>,
    project: Option<String>,
    summary: Option<String>,
    action_items: Vec<ActionItemPayload>,
}

#[derive(Serialize)]
struct ActionItemPayload {
    title: String,
    details: Option<String>,
    assignee_email: Option<String>,
    due_at: Option<String>,
    status: String,
}

async fn list_meetings_payload(
    pool: &SqlitePool,
    since: Option<&str>,
) -> sqlx::Result<Vec<MeetingPayload>> {
    let since = since.unwrap_or("1970-01-01T00:00:00Z");
    let rows: Vec<(String, String, String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT m.id, m.title, m.created_at,
                c.name AS company, p.name AS project,
                (SELECT result FROM summary_processes WHERE meeting_id = m.id AND status = 'completed' LIMIT 1) AS summary
         FROM meetings m
         LEFT JOIN meeting_tags t ON t.meeting_id = m.id
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN companies c ON c.id = t.company_id
         WHERE m.created_at >= ?
         ORDER BY m.created_at DESC
         LIMIT 200",
    )
    .bind(since)
    .fetch_all(pool)
    .await?;

    let mut out = Vec::with_capacity(rows.len());
    for (id, title, created_at, company, project, summary) in rows {
        let action_rows: Vec<ActionItemPayload> = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, String)>(
            "SELECT title, details, assignee_email, due_at, status
             FROM meeting_action_items WHERE meeting_id = ?",
        )
        .bind(&id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|(title, details, assignee_email, due_at, status)| ActionItemPayload {
            title,
            details,
            assignee_email,
            due_at,
            status,
        })
        .collect();

        out.push(MeetingPayload {
            id,
            title,
            created_at,
            company,
            project,
            summary,
            action_items: action_rows,
        });
    }
    Ok(out)
}

