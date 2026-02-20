const CRM_PROJECT_MARKER_PREFIX = "[crm-project:";

export function crmProjectAgentMarker(projectId: string): string {
  return `${CRM_PROJECT_MARKER_PREFIX}${projectId}]`;
}

export function ensureCrmProjectAgentMarker(systemPrompt: string, projectId: string): string {
  const marker = crmProjectAgentMarker(projectId);
  const trimmed = systemPrompt.trim();
  if (trimmed.includes(marker)) {
    return trimmed;
  }
  if (!trimmed) {
    return marker;
  }
  return `${trimmed}\n\n${marker}`;
}

