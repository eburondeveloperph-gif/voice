/**
 * Supabase Backup – fire-and-forget sync layer.
 *
 * Every function catches its own errors so a Supabase outage never
 * interrupts the primary SQLite + Vapi flow.
 *
 * Supabase tables expected (create via Supabase dashboard / SQL editor):
 *
 *   orgs            (id, name, slug, created_at, updated_at)
 *   agents          (id, org_id, name, intro, system_prompt, voice_id,
 *                    vapi_assistant_id, status, deployed_at, created_at, updated_at)
 *   call_logs       (id, org_id, agent_id, vapi_call_id, from_number, to_number,
 *                    started_at, ended_at, duration_seconds, cost_usd, status,
 *                    direction, transcript, recording_url, metadata, source,
 *                    created_at, updated_at)
 *   voice_catalog   (id, label, locale, upstream_provider, upstream_voice_id,
 *                    preview_sample_url, is_approved, sort_order, created_at, updated_at)
 *   contacts        (id, org_id, full_name, phone_number, email, tags,
 *                    created_at, updated_at)
 *   crm_projects    (id, org_id, created_by_id, name, slug, custom_domain,
 *                    description, allowed_emails, logo_url, is_active,
 *                    created_at, updated_at)
 *   crm_leads       (id, org_id, project_id, full_name, email, phone, company,
 *                    stage, source, owner_email, notes, metadata,
 *                    created_at, updated_at)
 *   crm_activities  (id, org_id, project_id, lead_id, type, summary, metadata,
 *                    created_by_email, created_at)
 *   crm_files       (id, org_id, project_id, lead_id, file_name, content_type,
 *                    size_bytes, storage_path, public_url, uploaded_by_email,
 *                    created_at)
 */

import { getSupabaseAdminClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/db";

// ─── helpers ────────────────────────────────────────────────────────

function warn(label: string, err: unknown): void {
    console.warn(`[supabase-backup] ${label}:`, err instanceof Error ? err.message : err);
}

// ─── individual entity backups ──────────────────────────────────────

export async function backupOrg(org: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("orgs").upsert(
            {
                id: org.id,
                name: org.name,
                slug: org.slug,
                created_at: org.createdAt.toISOString(),
                updated_at: org.updatedAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupOrg", err);
    }
}

export async function backupAgent(agent: {
    id: string;
    orgId: string;
    name: string;
    intro: string;
    systemPrompt: string;
    voiceId: string;
    vapiAssistantId?: string | null;
    status: string;
    deployedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("agents").upsert(
            {
                id: agent.id,
                org_id: agent.orgId,
                name: agent.name,
                intro: agent.intro,
                system_prompt: agent.systemPrompt,
                voice_id: agent.voiceId,
                vapi_assistant_id: agent.vapiAssistantId ?? null,
                status: agent.status,
                deployed_at: agent.deployedAt?.toISOString() ?? null,
                created_at: agent.createdAt.toISOString(),
                updated_at: agent.updatedAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupAgent", err);
    }
}

export async function backupCallLog(callLog: {
    id: string;
    orgId: string;
    agentId?: string | null;
    vapiCallId: string;
    fromNumber?: string | null;
    toNumber?: string | null;
    startedAt?: Date | null;
    endedAt?: Date | null;
    durationSeconds?: number | null;
    costUsd?: number | null;
    status: string;
    direction?: string | null;
    transcript?: unknown;
    recordingUrl?: string | null;
    metadata?: unknown;
    source: string;
    createdAt: Date;
    updatedAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("call_logs").upsert(
            {
                id: callLog.id,
                org_id: callLog.orgId,
                agent_id: callLog.agentId ?? null,
                vapi_call_id: callLog.vapiCallId,
                from_number: callLog.fromNumber ?? null,
                to_number: callLog.toNumber ?? null,
                started_at: callLog.startedAt?.toISOString() ?? null,
                ended_at: callLog.endedAt?.toISOString() ?? null,
                duration_seconds: callLog.durationSeconds ?? null,
                cost_usd: callLog.costUsd ?? null,
                status: callLog.status,
                direction: callLog.direction ?? null,
                transcript: callLog.transcript ?? null,
                recording_url: callLog.recordingUrl ?? null,
                metadata: callLog.metadata ?? null,
                source: callLog.source,
                created_at: callLog.createdAt.toISOString(),
                updated_at: callLog.updatedAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupCallLog", err);
    }
}

export async function backupVoice(voice: {
    id: string;
    label: string;
    locale: string;
    upstreamProvider: string;
    upstreamVoiceId: string;
    previewSampleUrl?: string | null;
    isApproved: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("voice_catalog").upsert(
            {
                id: voice.id,
                label: voice.label,
                locale: voice.locale,
                upstream_provider: voice.upstreamProvider,
                upstream_voice_id: voice.upstreamVoiceId,
                preview_sample_url: voice.previewSampleUrl ?? null,
                is_approved: voice.isApproved,
                sort_order: voice.sortOrder,
                created_at: voice.createdAt.toISOString(),
                updated_at: voice.updatedAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupVoice", err);
    }
}

export async function backupContact(contact: {
    id: string;
    orgId: string;
    fullName: string;
    phoneNumber: string;
    email?: string | null;
    tags?: string | null;
    createdAt: Date;
    updatedAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("contacts").upsert(
            {
                id: contact.id,
                org_id: contact.orgId,
                full_name: contact.fullName,
                phone_number: contact.phoneNumber,
                email: contact.email ?? null,
                tags: contact.tags ?? null,
                created_at: contact.createdAt.toISOString(),
                updated_at: contact.updatedAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupContact", err);
    }
}

export async function backupCrmProject(project: {
    id: string;
    orgId: string;
    createdById?: string | null;
    name: string;
    slug: string;
    customDomain?: string | null;
    description?: string | null;
    allowedEmails?: string | null;
    logoUrl?: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("crm_projects").upsert(
            {
                id: project.id,
                org_id: project.orgId,
                created_by_id: project.createdById ?? null,
                name: project.name,
                slug: project.slug,
                custom_domain: project.customDomain ?? null,
                description: project.description ?? null,
                allowed_emails: project.allowedEmails ?? null,
                logo_url: project.logoUrl ?? null,
                is_active: project.isActive,
                created_at: project.createdAt.toISOString(),
                updated_at: project.updatedAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupCrmProject", err);
    }
}

export async function backupCrmLead(lead: {
    id: string;
    orgId: string;
    projectId: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    stage: string;
    source?: string | null;
    ownerEmail?: string | null;
    notes?: string | null;
    metadata?: unknown;
    createdAt: Date;
    updatedAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("crm_leads").upsert(
            {
                id: lead.id,
                org_id: lead.orgId,
                project_id: lead.projectId,
                full_name: lead.fullName,
                email: lead.email ?? null,
                phone: lead.phone ?? null,
                company: lead.company ?? null,
                stage: lead.stage,
                source: lead.source ?? null,
                owner_email: lead.ownerEmail ?? null,
                notes: lead.notes ?? null,
                metadata: lead.metadata ?? null,
                created_at: lead.createdAt.toISOString(),
                updated_at: lead.updatedAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupCrmLead", err);
    }
}

export async function backupCrmActivity(activity: {
    id: string;
    orgId: string;
    projectId: string;
    leadId?: string | null;
    type: string;
    summary: string;
    metadata?: unknown;
    createdByEmail?: string | null;
    createdAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("crm_activities").upsert(
            {
                id: activity.id,
                org_id: activity.orgId,
                project_id: activity.projectId,
                lead_id: activity.leadId ?? null,
                type: activity.type,
                summary: activity.summary,
                metadata: activity.metadata ?? null,
                created_by_email: activity.createdByEmail ?? null,
                created_at: activity.createdAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupCrmActivity", err);
    }
}

export async function backupCrmFile(file: {
    id: string;
    orgId: string;
    projectId: string;
    leadId?: string | null;
    fileName: string;
    contentType?: string | null;
    sizeBytes: number;
    storagePath: string;
    publicUrl?: string | null;
    uploadedByEmail?: string | null;
    createdAt: Date;
}): Promise<void> {
    try {
        const sb = getSupabaseAdminClient();
        if (!sb) return;

        await sb.from("crm_files").upsert(
            {
                id: file.id,
                org_id: file.orgId,
                project_id: file.projectId,
                lead_id: file.leadId ?? null,
                file_name: file.fileName,
                content_type: file.contentType ?? null,
                size_bytes: file.sizeBytes,
                storage_path: file.storagePath,
                public_url: file.publicUrl ?? null,
                uploaded_by_email: file.uploadedByEmail ?? null,
                created_at: file.createdAt.toISOString(),
            },
            { onConflict: "id" },
        );
    } catch (err) {
        warn("backupCrmFile", err);
    }
}

// ─── bulk sync — push everything from Prisma to Supabase ────────────

export async function backupAll(): Promise<{
    orgs: number;
    agents: number;
    callLogs: number;
    voices: number;
    contacts: number;
    crmProjects: number;
    crmLeads: number;
    crmActivities: number;
    crmFiles: number;
}> {
    const counts = {
        orgs: 0,
        agents: 0,
        callLogs: 0,
        voices: 0,
        contacts: 0,
        crmProjects: 0,
        crmLeads: 0,
        crmActivities: 0,
        crmFiles: 0,
    };

    const sb = getSupabaseAdminClient();
    if (!sb) return counts;

    try {
        const orgs = await prisma.org.findMany();
        for (const org of orgs) {
            await backupOrg(org);
            counts.orgs++;
        }

        const agents = await prisma.agent.findMany();
        for (const agent of agents) {
            await backupAgent(agent);
            counts.agents++;
        }

        const callLogs = await prisma.callLog.findMany();
        for (const log of callLogs) {
            await backupCallLog(log);
            counts.callLogs++;
        }

        const voices = await prisma.voiceCatalog.findMany();
        for (const voice of voices) {
            await backupVoice(voice);
            counts.voices++;
        }

        const contacts = await prisma.contact.findMany();
        for (const contact of contacts) {
            await backupContact(contact);
            counts.contacts++;
        }

        const crmProjects = await prisma.crmProject.findMany();
        for (const project of crmProjects) {
            await backupCrmProject(project);
            counts.crmProjects++;
        }

        const crmLeads = await prisma.crmLead.findMany();
        for (const lead of crmLeads) {
            await backupCrmLead(lead);
            counts.crmLeads++;
        }

        const crmActivities = await prisma.crmActivity.findMany();
        for (const activity of crmActivities) {
            await backupCrmActivity(activity);
            counts.crmActivities++;
        }

        const crmFiles = await prisma.crmFile.findMany();
        for (const file of crmFiles) {
            await backupCrmFile(file);
            counts.crmFiles++;
        }
    } catch (err) {
        warn("backupAll", err);
    }

    return counts;
}
