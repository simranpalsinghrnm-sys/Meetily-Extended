import type { CalendarEvent } from '../calendar/types';
import type { Company, Project, TagSuggestion, TaggingRule } from './types';

type TaggerInput = {
  event: CalendarEvent | null;
  manualTitle?: string;
  companies: Company[];
  projects: Project[];
  rules: TaggingRule[];
  lastUsedProjectId: number | null;
};

export function suggestTag(input: TaggerInput): TagSuggestion {
  const reasons: string[] = [];
  let companyId: number | null = null;
  let projectId: number | null = null;
  let confidence = 0;

  const title = (input.event?.title ?? input.manualTitle ?? '').toLowerCase();
  const attendeeDomains = new Set(
    (input.event?.attendees ?? [])
      .filter(a => !a.isSelf)
      .map(a => a.email.split('@')[1]?.toLowerCase())
      .filter((d): d is string => !!d)
  );
  const attendeeEmails = new Set(
    (input.event?.attendees ?? []).map(a => a.email.toLowerCase())
  );

  const sortedRules = [...input.rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (rule.kind === 'email_domain' && attendeeDomains.has(rule.pattern.toLowerCase())) {
      if (rule.company_id) companyId = rule.company_id;
      if (rule.project_id) projectId = rule.project_id;
      confidence = Math.max(confidence, 0.85);
      reasons.push(`attendee domain ${rule.pattern}`);
    } else if (rule.kind === 'attendee_email' && attendeeEmails.has(rule.pattern.toLowerCase())) {
      if (rule.company_id) companyId = rule.company_id;
      if (rule.project_id) projectId = rule.project_id;
      confidence = Math.max(confidence, 0.95);
      reasons.push(`attendee ${rule.pattern}`);
    } else if (rule.kind === 'title_keyword' && title.includes(rule.pattern.toLowerCase())) {
      if (rule.company_id) companyId = rule.company_id;
      if (rule.project_id) projectId = rule.project_id;
      confidence = Math.max(confidence, 0.7);
      reasons.push(`title contains "${rule.pattern}"`);
    }
  }

  if (!companyId) {
    for (const c of input.companies) {
      if (c.domain_pattern && attendeeDomains.has(c.domain_pattern.toLowerCase())) {
        companyId = c.id;
        confidence = Math.max(confidence, 0.75);
        reasons.push(`company domain ${c.domain_pattern}`);
        break;
      }
    }
  }

  if (!projectId && companyId) {
    const candidates = input.projects.filter(p => p.company_id === companyId);
    for (const p of candidates) {
      if (title && p.name.toLowerCase().split(/\s+/).some(tok => tok.length > 3 && title.includes(tok))) {
        projectId = p.id;
        confidence = Math.max(confidence, 0.65);
        reasons.push(`title matches project "${p.name}"`);
        break;
      }
    }
  }

  if (!projectId && input.lastUsedProjectId && companyId) {
    const last = input.projects.find(p => p.id === input.lastUsedProjectId);
    if (last && last.company_id === companyId) {
      projectId = last.id;
      confidence = Math.max(confidence, 0.4);
      reasons.push('fallback: last used project for this company');
    }
  }

  if (!confidence && !companyId && !projectId) {
    reasons.push('no match — user must pick');
  }

  return { company_id: companyId, project_id: projectId, confidence, reasons };
}

export const CONFIDENCE_AUTO_THRESHOLD = 0.7;
