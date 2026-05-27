export type Company = {
  id: number;
  name: string;
  color: string | null;
  domain_pattern: string | null;
  external_ref: string | null;
};

export type Project = {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  status: string;
  external_ref: string | null;
};

export type ProjectMember = {
  project_id: number;
  email: string;
  display_name: string | null;
  role: string | null;
};

export type MeetingTag = {
  meeting_id: string;
  company_id: number | null;
  project_id: number | null;
  source: string;
  confidence: number;
  calendar_event_id: string | null;
};

export type TaggingRule = {
  id: number;
  kind: 'email_domain' | 'title_keyword' | 'attendee_email';
  pattern: string;
  company_id: number | null;
  project_id: number | null;
  priority: number;
};

export type TagSuggestion = {
  company_id: number | null;
  project_id: number | null;
  confidence: number;
  reasons: string[];
};
