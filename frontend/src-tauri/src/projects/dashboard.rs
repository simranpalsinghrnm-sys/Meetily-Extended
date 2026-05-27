use serde::Serialize;
use sqlx::{FromRow, SqlitePool};
use tauri::State;

use super::repo::Project;
use crate::state::AppState;

#[derive(Debug, Serialize, FromRow)]
pub struct ProjectMeetingRow {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub has_summary: i64,
    pub action_items_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ProjectActionItemRow {
    pub id: i64,
    pub meeting_id: String,
    pub title: String,
    pub details: Option<String>,
    pub status: String,
    pub due_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub project: Project,
    pub meetings: Vec<ProjectMeetingRow>,
    pub open_action_items: Vec<ProjectActionItemRow>,
    pub member_count: i64,
}

async fn load_project(pool: &SqlitePool, project_id: i64) -> sqlx::Result<Option<Project>> {
    sqlx::query_as::<_, Project>(
        "SELECT id, company_id, name, description, status, external_ref
         FROM projects WHERE id = ?",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
}

async fn load_meetings(pool: &SqlitePool, project_id: i64) -> sqlx::Result<Vec<ProjectMeetingRow>> {
    sqlx::query_as::<_, ProjectMeetingRow>(
        "SELECT m.id, m.title, m.created_at,
                COALESCE((SELECT 1 FROM summary_processes sp WHERE sp.meeting_id = m.id AND sp.status = 'completed' LIMIT 1), 0) AS has_summary,
                COALESCE((SELECT COUNT(*) FROM meeting_action_items ai WHERE ai.meeting_id = m.id AND ai.status = 'open'), 0) AS action_items_count
         FROM meetings m
         JOIN meeting_tags t ON t.meeting_id = m.id
         WHERE t.project_id = ?
         ORDER BY m.created_at DESC
         LIMIT 100",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

async fn load_open_actions(
    pool: &SqlitePool,
    project_id: i64,
) -> sqlx::Result<Vec<ProjectActionItemRow>> {
    sqlx::query_as::<_, ProjectActionItemRow>(
        "SELECT ai.id, ai.meeting_id, ai.title, ai.details, ai.status, ai.due_at
         FROM meeting_action_items ai
         JOIN meeting_tags t ON t.meeting_id = ai.meeting_id
         WHERE t.project_id = ? AND ai.status = 'open'
         ORDER BY COALESCE(ai.due_at, '9999-12-31') ASC, ai.created_at DESC
         LIMIT 100",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

#[tauri::command]
pub async fn project_dashboard(
    state: State<'_, AppState>,
    project_id: i64,
) -> Result<DashboardData, String> {
    let pool = state.db_manager.pool();
    let project = load_project(pool, project_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "project not found".to_string())?;
    let meetings = load_meetings(pool, project_id).await.map_err(|e| e.to_string())?;
    let open_action_items = load_open_actions(pool, project_id).await.map_err(|e| e.to_string())?;
    let member_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM project_members WHERE project_id = ?")
            .bind(project_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;
    Ok(DashboardData {
        project,
        meetings,
        open_action_items,
        member_count,
    })
}
