import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { DEFAULT_AGENT_PHONE } from "@/lib/defaultAgent";
import { getActiveAssistantCredentialIds } from "@/lib/ev/credentials";
import { resolveDefaultApprovedVoice } from "@/lib/ev/default-voice";
import { runGatewayHandler, runGatewayOptions } from "@/lib/ev/handler";
import { buildAssistantTemplate } from "@/lib/ev/template";
import { type ListAssistantsQuery, upstream } from "@/lib/ev/vapi-client";

export const dynamic = "force-dynamic";

type FirstMessageMode = "assistant-speaks-first" | "assistant-waits-for-user";

const DEFAULT_FIRST_MESSAGE_MODE: FirstMessageMode = "assistant-speaks-first";

type AgentCard = {
  id: string;
  name: string;
  intro: string;
  firstMessageMode: FirstMessageMode;
  description: string;
  voiceLabel: string;
  skills: string[];
  tools: string[];
  phone: string;
  phoneDirection: "inbound" | "outbound" | "both";
  status: "draft" | "deployed";
  updatedAt: string;
  kbFiles: { name: string; id: string }[];
  isSample?: boolean;
};

type UnknownRecord = Record<string, unknown>;

export async function OPTIONS(req: NextRequest) {
  return runGatewayOptions(req);
}

export async function POST(req: NextRequest) {
  return runGatewayHandler(req, "agents.create", async ({ tenant }) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const name = asString(body.name) ?? "New Agent";
    const intro = asString(body.intro) ?? "Hello!";
    const systemPrompt = asString(body.systemPrompt) ?? "You are a helpful assistant.";
    const firstMessageMode = normalizeFirstMessageMode(body.firstMessageMode);
    const autoCreateRemote = body.autoCreateRemote !== false;
    const selectedVoiceId = asString(body.voiceId)?.trim();
    const voice = await resolveDefaultApprovedVoice(selectedVoiceId);

    if (!voice) {
      throw new Error("No approved voices found in VoiceCatalog. Sync voices first, then create an agent.");
    }

    let vapiAssistantId: string | null = null;
    let fallbackVoiceLabel = voice.label;

    if (autoCreateRemote) {
      const credentialIds = await getActiveAssistantCredentialIds(tenant.org.id);
      const vapiAssistant = await upstream.createAssistant(
        buildAssistantTemplate(
          {
            name,
            intro,
            firstMessageMode,
            systemPrompt,
          },
          voice,
          { credentialIds },
        ),
      );
      vapiAssistantId = asString(vapiAssistant.id) ?? asString(vapiAssistant.assistantId) ?? null;
      if (!vapiAssistantId) {
        throw Object.assign(new Error("Could not determine remote assistant id."), { status: 502 });
      }
      if (vapiAssistantId) {
        fallbackVoiceLabel = extractVoiceLabel(vapiAssistant) || voice.label;
      }
    }

    const agent = await prisma.agent.create({
      data: {
        orgId: tenant.org.id,
        name,
        intro,
        firstMessageMode,
        systemPrompt,
        voiceId: voice.id,
        vapiAssistantId,
        status: "draft",
      },
      include: { voice: true },
    });

    return {
      payload: {
        agent: {
          id: agent.vapiAssistantId || agent.id,
          name: agent.name,
          intro: agent.intro,
          firstMessageMode: normalizeFirstMessageMode(agent.firstMessageMode),
          description: summarizePrompt(agent.systemPrompt),
          voiceLabel: agent.voice.label ?? fallbackVoiceLabel,
          skills: extractSkills(agent.systemPrompt),
          tools: [],
          phone: DEFAULT_AGENT_PHONE,
          phoneDirection: "both",
          status: agent.status,
          updatedAt: agent.updatedAt.toISOString(),
          kbFiles: [],
          isSample: false,
        },
      },
      status: 201,
      resourceId: agent.id,
    };
  });
}

export async function GET(req: NextRequest) {
  return runGatewayHandler(req, "agents.list", async ({ tenant }) => {
    const shouldSyncSamples = req.nextUrl.searchParams.get("sync") !== "false";
    const assistantFilters = parseAssistantListFilters(req.nextUrl.searchParams);

    const localAgents = await prisma.agent.findMany({
      where: { orgId: tenant.org.id },
      include: { voice: true },
      orderBy: { updatedAt: "desc" },
    });

    const mappedLocal: AgentCard[] = localAgents.map((agent) => ({
      id: agent.vapiAssistantId || agent.id,
      name: agent.name,
      intro: agent.intro,
      firstMessageMode: normalizeFirstMessageMode(agent.firstMessageMode),
      description: summarizePrompt(agent.systemPrompt),
      voiceLabel: agent.voice.label,
      skills: extractSkills(agent.systemPrompt),
      tools: [],
      phone: DEFAULT_AGENT_PHONE,
      phoneDirection: "both",
      status: agent.status,
      updatedAt: agent.updatedAt.toISOString(),
      kbFiles: [],
      isSample: false,
    }));

    let mappedSamples: AgentCard[] = [];
    let syncError: string | null = null;

    if (shouldSyncSamples) {
      try {
        const upstreamAssistants = await upstream.listAssistants({
          ...assistantFilters,
          limit: assistantFilters.limit ?? 1000,
        });
        mappedSamples = normalizeAssistants(upstreamAssistants);
      } catch (error) {
        syncError = (error as Error).message;
      }
    }

    const existingIds = new Set(mappedLocal.map((agent) => agent.id));
    const dedupedSamples = mappedSamples.filter((agent) => !existingIds.has(agent.id));

    return {
      payload: {
        agents: [...mappedLocal, ...dedupedSamples],
        sampleCount: dedupedSamples.length,
        syncedFromGateway: shouldSyncSamples,
        syncError,
      },
    };
  });
}

function normalizeAssistants(raw: unknown[]): AgentCard[] {
  const items = raw
    .filter((item): item is UnknownRecord => typeof item === "object" && item !== null)
    .map(toSampleCard)
    .filter((item): item is AgentCard => item !== null);

  const seen = new Set<string>();
  const deduped: AgentCard[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    deduped.push(item);
  }

  return deduped.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function toSampleCard(assistant: UnknownRecord): AgentCard | null {
  const id = asString(assistant.id);
  if (!id) {
    return null;
  }

  const name = asString(assistant.name) ?? `Assistant ${id.slice(0, 6)}`;
  const intro = asString(assistant.firstMessage) ?? "Hello, how can I help you today?";
  const firstMessageMode = normalizeFirstMessageMode(assistant.firstMessageMode);
  const prompt = extractSystemPrompt(assistant);
  const updatedAt = asString(assistant.updatedAt) ?? new Date().toISOString();
  const voiceLabel = extractVoiceLabel(assistant);

  return {
    id,
    name,
    intro,
    firstMessageMode,
    description: summarizePrompt(prompt),
    voiceLabel,
    skills: extractSkills(prompt),
    tools: extractTools(assistant),
    phone: DEFAULT_AGENT_PHONE,
    phoneDirection: "both",
    status: "deployed",
    updatedAt,
    kbFiles: [],
    isSample: true,
  };
}

function extractSystemPrompt(assistant: UnknownRecord): string {
  const model = asRecord(assistant.model);
  const messages = asArray(model?.messages);

  for (const msg of messages) {
    const role = asString(msg.role)?.toLowerCase();
    const content = asString(msg.content);
    if (role === "system" && content) {
      return content;
    }
  }

  return asString(assistant.description) ?? "Sample assistant imported from upstream.";
}

function extractVoiceLabel(assistant: UnknownRecord): string {
  const voice = asRecord(assistant.voice);
  return (
    asString(voice?.voiceId) ??
    asString(voice?.name) ??
    asString(voice?.id) ??
    "Default Voice"
  );
}

function extractTools(assistant: UnknownRecord): string[] {
  const model = asRecord(assistant.model);
  const tools = asArray(model?.tools ?? assistant.tools);
  const mapped = tools
    .map((tool) => asString(tool.name) ?? asString(tool.type))
    .filter((item): item is string => Boolean(item));

  return mapped.slice(0, 8);
}

function summarizePrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Sample assistant imported from upstream.";
  }
  return compact.length > 220 ? `${compact.slice(0, 220)}…` : compact;
}

function extractSkills(prompt: string): string[] {
  const fromSections = Array.from(prompt.matchAll(/\[([^\]]{2,40})\]/g))
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 6);

  if (fromSections.length > 0) {
    return fromSections;
  }

  const tokens = prompt
    .split(/[\n,.]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4)
    .slice(0, 4);

  return tokens.length > 0 ? tokens : ["General Conversation"];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeFirstMessageMode(value: unknown): FirstMessageMode {
  if (value === "assistant-waits-for-user") {
    return "assistant-waits-for-user";
  }
  return DEFAULT_FIRST_MESSAGE_MODE;
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null;
}

function asArray(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is UnknownRecord => typeof item === "object" && item !== null);
}

function parseAssistantListFilters(searchParams: URLSearchParams): ListAssistantsQuery {
  const parsed: ListAssistantsQuery = {};
  const limitRaw = searchParams.get("limit");
  if (limitRaw) {
    const value = Number(limitRaw);
    if (Number.isFinite(value)) {
      parsed.limit = Math.max(0, Math.min(1000, Math.floor(value)));
    }
  }

  const dateFilterKeys = [
    "createdAtGt",
    "createdAtLt",
    "createdAtGe",
    "createdAtLe",
    "updatedAtGt",
    "updatedAtLt",
    "updatedAtGe",
    "updatedAtLe",
  ] as const;

  for (const key of dateFilterKeys) {
    const value = searchParams.get(key);
    if (value && value.trim()) {
      parsed[key] = value.trim();
    }
  }

  return parsed;
}
