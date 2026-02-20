import type { Org, User } from "@prisma/client";

export type TenantContext = {
  org: Org;
  user: User;
  requestOrigin?: string;
};

export type GatewayAction =
  | "agents.create"
  | "agents.update"
  | "agents.list"
  | "agents.deploy"
  | "session-config.get"
  | "preview.update"
  | "voices.list"
  | "voices.sync"
  | "voices.preview"
  | "calls.create"
  | "calls.list"
  | "calls.sync"
  | "calls.outbound"
  | "calls.bulk"
  | "phone-numbers.list"
  | "phone-numbers.create"
  | "contacts.list"
  | "contacts.create"
  | "crm.projects.list"
  | "crm.projects.create"
  | "crm.projects.get"
  | "crm.projects.update"
  | "settings.integrations.providers"
  | "settings.integrations.list"
  | "settings.integrations.create"
  | "settings.integrations.update"
  | "settings.integrations.delete"
  | "dashboard.overview"
  | "settings.status"
  | "webhooks.receive";
