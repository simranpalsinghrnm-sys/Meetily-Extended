use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Company {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub domain_pattern: Option<String>,
    pub external_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Project {
    pub id: i64,
    pub company_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub external_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProjectMember {
    pub project_id: i64,
    pub email: String,
    pub display_name: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MeetingTag {
    pub meeting_id: String,
    pub company_id: Option<i64>,
    pub project_id: Option<i64>,
    pub source: String,
    pub confidence: f64,
    pub calendar_event_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaggingRule {
    pub id: i64,
    pub kind: String,
    pub pattern: String,
    pub company_id: Option<i64>,
    pub project_id: Option<i64>,
    pub priority: i64,
}

pub struct ProjectsRepo<'a> {
    pub pool: &'a SqlitePool,
}

impl<'a> ProjectsRepo<'a> {
    pub async fn list_companies(&self) -> sqlx::Result<Vec<Company>> {
        sqlx::query_as::<_, Company>(
            "SELECT id, name, color, domain_pattern, external_ref FROM companies ORDER BY name",
        )
        .fetch_all(self.pool)
        .await
    }

    pub async fn upsert_company(
        &self,
        name: &str,
        color: Option<&str>,
        domain_pattern: Option<&str>,
        external_ref: Option<&str>,
    ) -> sqlx::Result<Company> {
        sqlx::query(
            "INSERT INTO companies (name, color, domain_pattern, external_ref)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(name) DO UPDATE SET
               color = COALESCE(excluded.color, companies.color),
               domain_pattern = COALESCE(excluded.domain_pattern, companies.domain_pattern),
               external_ref = COALESCE(excluded.external_ref, companies.external_ref),
               updated_at = datetime('now')",
        )
        .bind(name)
        .bind(color)
        .bind(domain_pattern)
        .bind(external_ref)
        .execute(self.pool)
        .await?;

        sqlx::query_as::<_, Company>(
            "SELECT id, name, color, domain_pattern, external_ref FROM companies WHERE name = ?",
        )
        .bind(name)
        .fetch_one(self.pool)
        .await
    }

    pub async fn list_projects(&self, company_id: Option<i64>) -> sqlx::Result<Vec<Project>> {
        if let Some(cid) = company_id {
            sqlx::query_as::<_, Project>(
                "SELECT id, company_id, name, description, status, external_ref
                 FROM projects WHERE company_id = ? ORDER BY name",
            )
            .bind(cid)
            .fetch_all(self.pool)
            .await
        } else {
            sqlx::query_as::<_, Project>(
                "SELECT id, company_id, name, description, status, external_ref
                 FROM projects ORDER BY company_id, name",
            )
            .fetch_all(self.pool)
            .await
        }
    }

    pub async fn upsert_project(
        &self,
        company_id: i64,
        name: &str,
        description: Option<&str>,
        external_ref: Option<&str>,
    ) -> sqlx::Result<Project> {
        sqlx::query(
            "INSERT INTO projects (company_id, name, description, external_ref)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(company_id, name) DO UPDATE SET
               description = COALESCE(excluded.description, projects.description),
               external_ref = COALESCE(excluded.external_ref, projects.external_ref),
               updated_at = datetime('now')",
        )
        .bind(company_id)
        .bind(name)
        .bind(description)
        .bind(external_ref)
        .execute(self.pool)
        .await?;

        sqlx::query_as::<_, Project>(
            "SELECT id, company_id, name, description, status, external_ref
             FROM projects WHERE company_id = ? AND name = ?",
        )
        .bind(company_id)
        .bind(name)
        .fetch_one(self.pool)
        .await
    }

    pub async fn set_meeting_tag(
        &self,
        meeting_id: &str,
        company_id: Option<i64>,
        project_id: Option<i64>,
        source: &str,
        confidence: f64,
        calendar_event_id: Option<&str>,
    ) -> sqlx::Result<()> {
        sqlx::query(
            "INSERT INTO meeting_tags (meeting_id, company_id, project_id, source, confidence, calendar_event_id)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(meeting_id) DO UPDATE SET
               company_id = excluded.company_id,
               project_id = excluded.project_id,
               source = excluded.source,
               confidence = excluded.confidence,
               calendar_event_id = excluded.calendar_event_id,
               tagged_at = datetime('now')",
        )
        .bind(meeting_id)
        .bind(company_id)
        .bind(project_id)
        .bind(source)
        .bind(confidence)
        .bind(calendar_event_id)
        .execute(self.pool)
        .await
        .map(|_| ())
    }

    pub async fn get_meeting_tag(&self, meeting_id: &str) -> sqlx::Result<Option<MeetingTag>> {
        sqlx::query_as::<_, MeetingTag>(
            "SELECT meeting_id, company_id, project_id, source, confidence, calendar_event_id
             FROM meeting_tags WHERE meeting_id = ?",
        )
        .bind(meeting_id)
        .fetch_optional(self.pool)
        .await
    }

    pub async fn list_rules(&self) -> sqlx::Result<Vec<TaggingRule>> {
        sqlx::query_as::<_, TaggingRule>(
            "SELECT id, kind, pattern, company_id, project_id, priority
             FROM tagging_rules ORDER BY priority, id",
        )
        .fetch_all(self.pool)
        .await
    }

    pub async fn create_rule(
        &self,
        kind: &str,
        pattern: &str,
        company_id: Option<i64>,
        project_id: Option<i64>,
        priority: i64,
    ) -> sqlx::Result<i64> {
        let r = sqlx::query(
            "INSERT INTO tagging_rules (kind, pattern, company_id, project_id, priority)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(kind)
        .bind(pattern)
        .bind(company_id)
        .bind(project_id)
        .bind(priority)
        .execute(self.pool)
        .await?;
        Ok(r.last_insert_rowid())
    }

    pub async fn delete_rule(&self, id: i64) -> sqlx::Result<()> {
        sqlx::query("DELETE FROM tagging_rules WHERE id = ?")
            .bind(id)
            .execute(self.pool)
            .await
            .map(|_| ())
    }

    pub async fn list_project_members(&self, project_id: i64) -> sqlx::Result<Vec<ProjectMember>> {
        sqlx::query_as::<_, ProjectMember>(
            "SELECT project_id, email, display_name, role FROM project_members WHERE project_id = ?",
        )
        .bind(project_id)
        .fetch_all(self.pool)
        .await
    }

    pub async fn add_project_member(
        &self,
        project_id: i64,
        email: &str,
        display_name: Option<&str>,
        role: Option<&str>,
    ) -> sqlx::Result<()> {
        sqlx::query(
            "INSERT INTO project_members (project_id, email, display_name, role)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(project_id, email) DO UPDATE SET
               display_name = COALESCE(excluded.display_name, project_members.display_name),
               role = COALESCE(excluded.role, project_members.role)",
        )
        .bind(project_id)
        .bind(email)
        .bind(display_name)
        .bind(role)
        .execute(self.pool)
        .await
        .map(|_| ())
    }
}
