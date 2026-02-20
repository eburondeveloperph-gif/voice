import { env } from "@/lib/env";
import { DEFAULT_AGENT, DEFAULT_AGENT_ID } from "@/lib/defaultAgent";

const BASE_URL = "https://api.vapi.ai";

export type ListAssistantsQuery = {
  limit?: number;
  createdAtGt?: string;
  createdAtLt?: string;
  createdAtGe?: string;
  createdAtLe?: string;
  updatedAtGt?: string;
  updatedAtLt?: string;
  updatedAtGe?: string;
  updatedAtLe?: string;
};

export class GatewayUpstreamError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function requirePrivateToken(): string {
  const token = env.EV_PRIVATE_TOKEN?.trim();
  if (!token) {
    throw new GatewayUpstreamError("Gateway private token is not configured.", 500);
  }
  return token;
}

function safeUrl(path: string): string {
  const url = new URL(path, BASE_URL);
  if (url.hostname !== "api.vapi.ai") {
    throw new GatewayUpstreamError("Outbound host is not allowed.", 500);
  }
  return url.toString();
}

function asBearerAuthorizationHeader(token: string): string {
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

function toPathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function assistantsQueryString(params?: ListAssistantsQuery): string {
  if (!params) {
    return "";
  }

  const search = new URLSearchParams();
  const appendNumber = (key: string, value: number | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      search.set(key, String(value));
    }
  };
  const appendString = (key: string, value: string | undefined) => {
    if (value && value.trim()) {
      search.set(key, value.trim());
    }
  };

  appendNumber("limit", params.limit);
  appendString("createdAtGt", params.createdAtGt);
  appendString("createdAtLt", params.createdAtLt);
  appendString("createdAtGe", params.createdAtGe);
  appendString("createdAtLe", params.createdAtLe);
  appendString("updatedAtGt", params.updatedAtGt);
  appendString("updatedAtLt", params.updatedAtLt);
  appendString("updatedAtGe", params.updatedAtGe);
  appendString("updatedAtLe", params.updatedAtLe);

  const query = search.toString();
  return query ? `?${query}` : "";
}

async function requestUpstream<T>(path: string, init: RequestInit): Promise<T> {
  const token = requirePrivateToken();

  const res = await fetch(safeUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: asBearerAuthorizationHeader(token),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  const payload = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    throw new GatewayUpstreamError(`Upstream request failed for ${path}`, res.status, payload);
  }

  return payload as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export const upstream = {
  listAssistants: (params?: ListAssistantsQuery) =>
    requestUpstream<unknown[]>(`/assistant${assistantsQueryString(params)}`, { method: "GET" }),
  getAssistant: (assistantId?: string) => {
    const id = assistantId ?? env.VAPI_DEFAULT_AGENT_ID ?? DEFAULT_AGENT_ID;
    return requestUpstream<Record<string, unknown>>(`/assistant/${toPathSegment(id)}`, { method: "GET" });
  },
  getDefaultAssistant: () => Promise.resolve(DEFAULT_AGENT),
  createAssistant: (payload: unknown) => requestUpstream<Record<string, unknown>>("/assistant", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  updateAssistant: (assistantId: string, payload: unknown) =>
    requestUpstream<Record<string, unknown>>(`/assistant/${toPathSegment(assistantId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  listCalls: () => requestUpstream<Record<string, unknown>[]>("/call", { method: "GET" }),
  createCall: (payload: unknown) =>
    requestUpstream<Record<string, unknown>>("/call", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listVoicesByProvider: (provider = "vapi") =>
    requestUpstream<unknown>(`/voice-library/${encodeURIComponent(provider)}`, {
      method: "GET",
    }),
  listPhoneNumbers: () => requestUpstream<Record<string, unknown>[]>("/phone-number", { method: "GET" }),
  createPhoneNumber: (payload: unknown) =>
    requestUpstream<Record<string, unknown>>("/phone-number", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listCredentials: () => requestUpstream<Record<string, unknown>[]>("/credential", { method: "GET" }),
  getCredential: (credentialId: string) =>
    requestUpstream<Record<string, unknown>>(`/credential/${toPathSegment(credentialId)}`, {
      method: "GET",
    }),
  createCredential: (payload: unknown) =>
    requestUpstream<Record<string, unknown>>("/credential", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCredential: (credentialId: string, payload: unknown) =>
    requestUpstream<Record<string, unknown>>(`/credential/${toPathSegment(credentialId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteCredential: (credentialId: string) =>
    requestUpstream<Record<string, unknown> | null>(`/credential/${toPathSegment(credentialId)}`, {
      method: "DELETE",
    }),
};
