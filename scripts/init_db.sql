PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Org" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_orgId_email_key" ON "User"("orgId", "email");
CREATE INDEX IF NOT EXISTS "User_orgId_idx" ON "User"("orgId");

CREATE TABLE IF NOT EXISTS "VoiceCatalog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "label" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "upstreamProvider" TEXT NOT NULL,
  "upstreamVoiceId" TEXT NOT NULL,
  "previewSampleUrl" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Agent" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "createdById" TEXT,
  "name" TEXT NOT NULL,
  "intro" TEXT NOT NULL,
  "systemPrompt" TEXT NOT NULL,
  "voiceId" TEXT NOT NULL,
  "vapiAssistantId" TEXT UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'deployed')),
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "deployedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Agent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Agent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Agent_voiceId_fkey" FOREIGN KEY ("voiceId") REFERENCES "VoiceCatalog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Agent_orgId_status_idx" ON "Agent"("orgId", "status");
CREATE INDEX IF NOT EXISTS "Agent_orgId_updatedAt_idx" ON "Agent"("orgId", "updatedAt");

CREATE TABLE IF NOT EXISTS "CallLog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "agentId" TEXT,
  "vapiCallId" TEXT NOT NULL UNIQUE,
  "fromNumber" TEXT,
  "toNumber" TEXT,
  "startedAt" DATETIME,
  "endedAt" DATETIME,
  "durationSeconds" INTEGER,
  "costUsd" REAL,
  "status" TEXT NOT NULL,
  "direction" TEXT,
  "transcript" JSON,
  "recordingUrl" TEXT,
  "metadata" JSON,
  "source" TEXT NOT NULL DEFAULT 'sync' CHECK ("source" IN ('preview', 'production', 'sync')),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CallLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CallLog_orgId_startedAt_idx" ON "CallLog"("orgId", "startedAt");
CREATE INDEX IF NOT EXISTS "CallLog_orgId_status_idx" ON "CallLog"("orgId", "status");
CREATE INDEX IF NOT EXISTS "CallLog_orgId_agentId_idx" ON "CallLog"("orgId", "agentId");

CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "email" TEXT,
  "tags" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contact_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_orgId_phoneNumber_key" ON "Contact"("orgId", "phoneNumber");
CREATE INDEX IF NOT EXISTS "Contact_orgId_fullName_idx" ON "Contact"("orgId", "fullName");

CREATE TABLE IF NOT EXISTS "Integration" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "mode" TEXT NOT NULL CHECK ("mode" IN ('vapi_credential', 'local_config')),
  "vapiProvider" TEXT,
  "upstreamCredentialId" TEXT UNIQUE,
  "config" JSON,
  "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'disabled')),
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Integration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Integration_orgId_providerKey_idx" ON "Integration"("orgId", "providerKey");
CREATE INDEX IF NOT EXISTS "Integration_orgId_category_idx" ON "Integration"("orgId", "category");
CREATE INDEX IF NOT EXISTS "Integration_orgId_status_idx" ON "Integration"("orgId", "status");

CREATE TABLE IF NOT EXISTS "BillingLedger" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "entryType" TEXT NOT NULL CHECK ("entryType" IN ('credit', 'usage', 'number_purchase', 'adjustment')),
  "amountCents" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "referenceId" TEXT,
  "metadata" JSON,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingLedger_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BillingLedger_orgId_createdAt_idx" ON "BillingLedger"("orgId", "createdAt");

CREATE TABLE IF NOT EXISTS "PhoneNumber" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "displayNumber" TEXT NOT NULL,
  "vapiPhoneNumberId" TEXT UNIQUE,
  "assignedAgentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'active', 'suspended', 'released')),
  "monthlyPriceCents" INTEGER NOT NULL DEFAULT 1500,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneNumber_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PhoneNumber_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PhoneNumber_orgId_displayNumber_key" ON "PhoneNumber"("orgId", "displayNumber");
CREATE INDEX IF NOT EXISTS "PhoneNumber_orgId_status_idx" ON "PhoneNumber"("orgId", "status");

CREATE TABLE IF NOT EXISTS "CrmProject" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "createdById" TEXT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "customDomain" TEXT UNIQUE,
  "description" TEXT,
  "allowedEmails" TEXT,
  "logoUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmProject_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CrmProject_orgId_updatedAt_idx" ON "CrmProject"("orgId", "updatedAt");
CREATE INDEX IF NOT EXISTS "CrmProject_orgId_isActive_idx" ON "CrmProject"("orgId", "isActive");

CREATE TABLE IF NOT EXISTS "CrmLead" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "company" TEXT,
  "stage" TEXT NOT NULL DEFAULT 'new' CHECK ("stage" IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
  "source" TEXT,
  "ownerEmail" TEXT,
  "notes" TEXT,
  "metadata" JSON,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmLead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CrmProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CrmLead_orgId_projectId_updatedAt_idx" ON "CrmLead"("orgId", "projectId", "updatedAt");
CREATE INDEX IF NOT EXISTS "CrmLead_projectId_stage_idx" ON "CrmLead"("projectId", "stage");

CREATE TABLE IF NOT EXISTS "CrmActivity" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "leadId" TEXT,
  "type" TEXT NOT NULL CHECK ("type" IN ('note', 'call', 'email', 'meeting', 'status_change', 'file')),
  "summary" TEXT NOT NULL,
  "metadata" JSON,
  "createdByEmail" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmActivity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CrmProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CrmActivity_orgId_projectId_createdAt_idx" ON "CrmActivity"("orgId", "projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmActivity_projectId_leadId_createdAt_idx" ON "CrmActivity"("projectId", "leadId", "createdAt");

CREATE TABLE IF NOT EXISTS "CrmFile" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "leadId" TEXT,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT,
  "sizeBytes" INTEGER NOT NULL,
  "storagePath" TEXT NOT NULL,
  "publicUrl" TEXT,
  "uploadedByEmail" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmFile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CrmProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmFile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CrmFile_orgId_projectId_createdAt_idx" ON "CrmFile"("orgId", "projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmFile_projectId_leadId_createdAt_idx" ON "CrmFile"("projectId", "leadId", "createdAt");

CREATE TABLE IF NOT EXISTS "PreviewSession" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "userId" TEXT,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" DATETIME,
  "status" TEXT NOT NULL,
  "transcript" JSON,
  CONSTRAINT "PreviewSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreviewSession_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PreviewSession_orgId_agentId_startedAt_idx" ON "PreviewSession"("orgId", "agentId", "startedAt");

CREATE TABLE IF NOT EXISTS "GatewayAuditLog" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT,
  "requestType" TEXT NOT NULL,
  "resourceId" TEXT,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "success" BOOLEAN NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GatewayAuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GatewayAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "GatewayAuditLog_orgId_createdAt_idx" ON "GatewayAuditLog"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "GatewayAuditLog_orgId_userId_createdAt_idx" ON "GatewayAuditLog"("orgId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "GatewayAuditLog_orgId_requestType_createdAt_idx" ON "GatewayAuditLog"("orgId", "requestType", "createdAt");
