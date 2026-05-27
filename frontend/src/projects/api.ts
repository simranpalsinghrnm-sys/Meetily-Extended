import { invoke } from '@tauri-apps/api/core';
import type { Company, MeetingTag, Project, ProjectMember, TaggingRule } from './types';

export const projectsApi = {
  listCompanies: () => invoke<Company[]>('list_companies'),
  upsertCompany: (name: string, color?: string | null, domain_pattern?: string | null, external_ref?: string | null) =>
    invoke<Company>('upsert_company', { name, color, domainPattern: domain_pattern, externalRef: external_ref }),

  listProjects: (companyId?: number) => invoke<Project[]>('list_projects', { companyId }),
  upsertProject: (companyId: number, name: string, description?: string | null, externalRef?: string | null) =>
    invoke<Project>('upsert_project', { companyId, name, description, externalRef }),

  setMeetingTag: (
    meetingId: string,
    companyId: number | null,
    projectId: number | null,
    source: 'auto' | 'manual',
    confidence: number,
    calendarEventId: string | null
  ) =>
    invoke<void>('set_meeting_tag', {
      meetingId,
      companyId,
      projectId,
      source,
      confidence,
      calendarEventId,
    }),
  getMeetingTag: (meetingId: string) =>
    invoke<MeetingTag | null>('get_meeting_tag', { meetingId }),

  listTaggingRules: () => invoke<TaggingRule[]>('list_tagging_rules'),
  createTaggingRule: (
    kind: TaggingRule['kind'],
    pattern: string,
    companyId: number | null,
    projectId: number | null,
    priority = 100
  ) => invoke<number>('create_tagging_rule', { kind, pattern, companyId, projectId, priority }),
  deleteTaggingRule: (id: number) => invoke<void>('delete_tagging_rule', { id }),

  listProjectMembers: (projectId: number) =>
    invoke<ProjectMember[]>('list_project_members', { projectId }),
  addProjectMember: (
    projectId: number,
    email: string,
    displayName?: string | null,
    role?: string | null
  ) => invoke<void>('add_project_member', { projectId, email, displayName, role }),
};
