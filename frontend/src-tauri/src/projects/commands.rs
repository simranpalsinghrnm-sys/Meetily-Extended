use tauri::State;

use super::repo::{Company, MeetingTag, Project, ProjectMember, ProjectsRepo, TaggingRule};
use crate::state::AppState;

#[tauri::command]
pub async fn list_companies(state: State<'_, AppState>) -> Result<Vec<Company>, String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.list_companies().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_company(
    state: State<'_, AppState>,
    name: String,
    color: Option<String>,
    domain_pattern: Option<String>,
    external_ref: Option<String>,
) -> Result<Company, String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.upsert_company(&name, color.as_deref(), domain_pattern.as_deref(), external_ref.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_projects(
    state: State<'_, AppState>,
    company_id: Option<i64>,
) -> Result<Vec<Project>, String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.list_projects(company_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn upsert_project(
    state: State<'_, AppState>,
    company_id: i64,
    name: String,
    description: Option<String>,
    external_ref: Option<String>,
) -> Result<Project, String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.upsert_project(company_id, &name, description.as_deref(), external_ref.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_meeting_tag(
    state: State<'_, AppState>,
    meeting_id: String,
    company_id: Option<i64>,
    project_id: Option<i64>,
    source: String,
    confidence: f64,
    calendar_event_id: Option<String>,
) -> Result<(), String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.set_meeting_tag(
        &meeting_id,
        company_id,
        project_id,
        &source,
        confidence,
        calendar_event_id.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_meeting_tag(
    state: State<'_, AppState>,
    meeting_id: String,
) -> Result<Option<MeetingTag>, String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.get_meeting_tag(&meeting_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_tagging_rules(state: State<'_, AppState>) -> Result<Vec<TaggingRule>, String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.list_rules().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_tagging_rule(
    state: State<'_, AppState>,
    kind: String,
    pattern: String,
    company_id: Option<i64>,
    project_id: Option<i64>,
    priority: i64,
) -> Result<i64, String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.create_rule(&kind, &pattern, company_id, project_id, priority)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_tagging_rule(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.delete_rule(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_project_members(
    state: State<'_, AppState>,
    project_id: i64,
) -> Result<Vec<ProjectMember>, String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.list_project_members(project_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_project_member(
    state: State<'_, AppState>,
    project_id: i64,
    email: String,
    display_name: Option<String>,
    role: Option<String>,
) -> Result<(), String> {
    let repo = ProjectsRepo { pool: state.db_manager.pool() };
    repo.add_project_member(project_id, &email, display_name.as_deref(), role.as_deref())
        .await
        .map_err(|e| e.to_string())
}
