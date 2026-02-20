"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { createClient, isSupabaseEnabled } from "@/lib/supabase";

type CrmLead = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  stage: "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
  source: string | null;
  ownerEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type CrmFile = {
  id: string;
  leadId: string | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  storagePath: string;
  publicUrl: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
};

type CrmAgent = {
  id: string;
  name: string;
  intro: string;
  firstMessageMode: "assistant-speaks-first" | "assistant-waits-for-user";
  description: string;
  systemPrompt: string;
  status: "draft" | "deployed";
  voiceId: string;
  voiceLabel: string;
  voiceLocale: string;
  updatedAt: string;
};

type VoiceOption = {
  id: string;
  label: string;
  locale: string;
  previewSampleUrl?: string | null;
};

type VoicePreviewConfigResponse = {
  preview: {
    assistantId: string;
    publicKey: string;
    timeoutSeconds: number;
    assistantOverrides: Record<string, unknown>;
  };
};

type VapiClient = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  start: (assistantId: string, assistantOverrides?: Record<string, unknown>) => Promise<unknown>;
  stop: () => Promise<void>;
};

type CrmCall = {
  id: string;
  vapiCallId: string;
  status: string;
  fromNumber: string | null;
  toNumber: string | null;
  durationSeconds: number | null;
  costUsd: number | null;
  startedAt: string | null;
  recordingUrl: string | null;
  agent: { id: string; name: string } | null;
};

type CrmNumber = {
  id: string;
  displayNumber: string;
  status: string;
  monthlyPriceCents: number;
  assignedAgent: { id: string; name: string } | null;
};

type BillingSummary = {
  balanceCents: number;
  monthlyPhoneCostCents: number;
  entryCount: number;
};

type BillingEntry = {
  id: string;
  entryType: string;
  amountCents: number;
  description: string;
  referenceId: string | null;
  metadata: unknown;
  createdAt: string;
};

type BootstrapPayload = {
  project: {
    id: string;
    name: string;
    slug: string;
    customDomain: string | null;
    description: string | null;
    logoUrl: string | null;
  };
  leads: CrmLead[];
  files: CrmFile[];
};

type ProjectDetailsPayload = {
  project: {
    id: string;
    name: string;
    slug: string;
    customDomain: string | null;
    description: string | null;
    logoUrl: string | null;
    embedStatus: string | null;
    updatedAt: string;
  };
};

type AgentsPayload = {
  agents: CrmAgent[];
  voices: VoiceOption[];
};

type CallsPayload = {
  calls: CrmCall[];
};

type NumbersPayload = {
  numbers: CrmNumber[];
};

type BillingPayload = {
  summary: BillingSummary;
  entries: BillingEntry[];
};

type PortalProps = {
  clientSlug: string;
  projectName: string;
  projectDescription: string | null;
  logoUrl: string | null;
};

type TabId = "dashboard" | "agents" | "calls" | "leads" | "files" | "settings";
type EmbedState = "disabled" | "requested" | "approved";

const STAGE_OPTIONS: Array<CrmLead["stage"]> = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const AUTO_SIP_NUMBER_OPTION = "__auto_vapi_sip__";

const TAB_SUBTITLES: Record<TabId, string> = {
  dashboard: "A quick glance at your recent activity.",
  agents: "Create and manage agents generated inside this client CRM.",
  calls: "Client call logs filtered to this CRM, including recordings.",
  leads: "Manage and convert your prospective clients.",
  files: "Secure document and asset tracking.",
  settings: "Manage branding, billing, numbers, and embed settings.",
};

function normalizeEmbedState(value: string | null | undefined): EmbedState | null {
  if (value === "disabled" || value === "requested" || value === "approved") {
    return value;
  }
  return null;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return "-";
  }
  return parsed.toLocaleString();
}

async function crmJsonRequest<T>(slug: string, path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/crm/${encodeURIComponent(slug)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export function CrmPortal({ clientSlug, projectName, projectDescription, logoUrl }: PortalProps) {
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [embedState, setEmbedState] = useState<EmbedState | null>(null);
  const [origin, setOrigin] = useState("");

  const [projectInfo, setProjectInfo] = useState({
    name: projectName,
    description: projectDescription,
    logoUrl,
  });

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [files, setFiles] = useState<CrmFile[]>([]);
  const [agents, setAgents] = useState<CrmAgent[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [calls, setCalls] = useState<CrmCall[]>([]);
  const [numbers, setNumbers] = useState<CrmNumber[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [billingEntries, setBillingEntries] = useState<BillingEntry[]>([]);

  const [leadForm, setLeadForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    company: "",
    source: "",
    notes: "",
  });
  const [uploadLeadId, setUploadLeadId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const [newAgentForm, setNewAgentForm] = useState({
    name: "",
    intro: "",
    firstMessageMode: "assistant-speaks-first" as "assistant-speaks-first" | "assistant-waits-for-user",
    systemPrompt: "",
    voiceId: "",
    phoneSelection: "",
    numberDesiredAreaCode: "",
  });
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingAgentForm, setEditingAgentForm] = useState({
    name: "",
    intro: "",
    firstMessageMode: "assistant-speaks-first" as "assistant-speaks-first" | "assistant-waits-for-user",
    systemPrompt: "",
    voiceId: "",
  });
  const [updatingAgent, setUpdatingAgent] = useState(false);

  const [numberForm, setNumberForm] = useState({
    country: "US",
    areaCode: "",
    assignAgentId: "",
  });
  const [buyingNumber, setBuyingNumber] = useState(false);

  const [callQuery, setCallQuery] = useState("");
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voicePreviewClientRef = useRef<VapiClient | null>(null);

  const accessToken = session?.access_token ?? null;

  const leadsById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const numberByAgentId = useMemo(() => {
    const mapping = new Map<string, string>();
    for (const number of numbers) {
      if (number.assignedAgent?.id) {
        mapping.set(number.assignedAgent.id, number.displayNumber);
      }
    }
    return mapping;
  }, [numbers]);

  useEffect(() => {
    const sb = createClient();
    if (!sb) {
      setAuthReady(true);
      setStatus("Supabase auth is not configured. Please set Supabase env vars.");
      return;
    }

    let active = true;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
        }
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    const { data: subscription } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!voiceOptions.length) return;
    setNewAgentForm((prev) => (prev.voiceId ? prev : { ...prev, voiceId: voiceOptions[0].id }));
  }, [voiceOptions]);

  useEffect(() => {
    if (!agents.length) return;
    setNumberForm((prev) => (prev.assignAgentId ? prev : { ...prev, assignAgentId: agents[0].id }));
  }, [agents]);

  useEffect(() => {
    if (!editingAgentId) {
      return;
    }
    const stillExists = agents.some((agent) => agent.id === editingAgentId);
    if (!stillExists) {
      setEditingAgentId(null);
    }
  }, [agents, editingAgentId]);

  const stopVoicePreview = useCallback(async () => {
    if (voicePreviewTimeoutRef.current) {
      clearTimeout(voicePreviewTimeoutRef.current);
      voicePreviewTimeoutRef.current = null;
    }

    const audio = voicePreviewAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (voicePreviewClientRef.current) {
      try {
        await voicePreviewClientRef.current.stop();
      } catch {
        // ignore stop errors
      } finally {
        voicePreviewClientRef.current = null;
      }
    }

    setPlayingVoiceId(null);
  }, []);

  useEffect(
    () => () => {
      void stopVoicePreview();
    },
    [stopVoicePreview],
  );

  const loadBootstrapData = useCallback(
    async (token: string) => {
      const payload = await crmJsonRequest<BootstrapPayload>(clientSlug, "/bootstrap", token);
      setLeads(payload.leads);
      setFiles(payload.files);
      setProjectInfo((prev) => ({
        ...prev,
        name: payload.project.name,
        description: payload.project.description,
        logoUrl: payload.project.logoUrl,
      }));
    },
    [clientSlug],
  );

  const loadProjectDetails = useCallback(
    async (token: string) => {
      const payload = await crmJsonRequest<ProjectDetailsPayload>(clientSlug, "", token);
      setEmbedState(normalizeEmbedState(payload.project.embedStatus));
      setProjectInfo((prev) => ({
        ...prev,
        name: payload.project.name,
        description: payload.project.description,
        logoUrl: payload.project.logoUrl,
      }));
    },
    [clientSlug],
  );

  const loadAgentsData = useCallback(
    async (token: string) => {
      const payload = await crmJsonRequest<AgentsPayload>(clientSlug, "/agents", token);
      setAgents(payload.agents);
      setVoiceOptions(payload.voices);
    },
    [clientSlug],
  );

  const loadCallsData = useCallback(
    async (token: string, options?: { sync?: boolean }) => {
      const params = new URLSearchParams();
      params.set("sync", options?.sync ? "true" : "false");
      if (callQuery.trim()) {
        params.set("q", callQuery.trim());
      }
      const payload = await crmJsonRequest<CallsPayload>(clientSlug, `/calls?${params.toString()}`, token);
      setCalls(payload.calls);
    },
    [callQuery, clientSlug],
  );

  const loadNumbersData = useCallback(
    async (token: string) => {
      const payload = await crmJsonRequest<NumbersPayload>(clientSlug, "/phone-numbers", token);
      setNumbers(payload.numbers);
    },
    [clientSlug],
  );

  const loadBillingData = useCallback(
    async (token: string) => {
      const payload = await crmJsonRequest<BillingPayload>(clientSlug, "/billing", token);
      setBillingSummary(payload.summary);
      setBillingEntries(payload.entries);
    },
    [clientSlug],
  );

  const refreshPortalData = useCallback(
    async (options?: { syncCalls?: boolean }) => {
      if (!accessToken) return;
      setLoading(true);

      const results = await Promise.allSettled([
        loadBootstrapData(accessToken),
        loadProjectDetails(accessToken),
        loadAgentsData(accessToken),
        loadCallsData(accessToken, { sync: options?.syncCalls === true }),
        loadNumbersData(accessToken),
        loadBillingData(accessToken),
      ]);

      const firstError = results.find((result) => result.status === "rejected");
      if (firstError && firstError.status === "rejected") {
        const message = firstError.reason instanceof Error ? firstError.reason.message : "Failed loading CRM data.";
        setStatus(message);
      }

      setLoading(false);
    },
    [
      accessToken,
      loadAgentsData,
      loadBillingData,
      loadBootstrapData,
      loadCallsData,
      loadNumbersData,
      loadProjectDetails,
    ],
  );

  useEffect(() => {
    if (!accessToken) return;
    void refreshPortalData();
  }, [accessToken, refreshPortalData]);

  async function sendMagicLink() {
    const sb = createClient();
    if (!sb) {
      setStatus("Supabase auth is not configured.");
      return;
    }
    if (!email.trim()) {
      setStatus("Enter your email to continue.");
      return;
    }

    setStatus("Sending sign-in link...");
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: window.location.href,
      },
    });

    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Check your email for a secure sign-in link.");
  }

  async function signOut() {
    const sb = createClient();
    if (!sb) return;
    await sb.auth.signOut();
    setLeads([]);
    setFiles([]);
    setAgents([]);
    setCalls([]);
    setNumbers([]);
    setBillingSummary(null);
    setBillingEntries([]);
    setEditingAgentId(null);
    setStatus("Signed out.");
  }

  async function addLead() {
    if (!accessToken) return;
    if (!leadForm.fullName.trim()) {
      setStatus("Lead name is required.");
      return;
    }

    setStatus("Creating lead...");
    try {
      const payload = await crmJsonRequest<{ lead: CrmLead }>(clientSlug, "/leads", accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: leadForm.fullName.trim(),
          email: leadForm.email.trim() || undefined,
          phone: leadForm.phone.trim() || undefined,
          company: leadForm.company.trim() || undefined,
          source: leadForm.source.trim() || undefined,
          notes: leadForm.notes.trim() || undefined,
        }),
      });
      setLeads((prev) => [payload.lead, ...prev]);
      setLeadForm({ fullName: "", email: "", phone: "", company: "", source: "", notes: "" });
      setStatus("Lead created.");
      setActiveTab("leads");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function updateLeadStage(leadId: string, stage: CrmLead["stage"]) {
    if (!accessToken) return;
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, stage } : lead)));
    try {
      await crmJsonRequest<{ lead: CrmLead }>(clientSlug, `/leads/${encodeURIComponent(leadId)}`, accessToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      setStatus(null);
    } catch (error) {
      setStatus((error as Error).message);
      await loadBootstrapData(accessToken);
    }
  }

  async function uploadAttachment() {
    if (!accessToken || !uploadFile) return;
    setStatus("Uploading file...");

    const form = new FormData();
    form.append("file", uploadFile);
    if (uploadLeadId) {
      form.append("leadId", uploadLeadId);
    }

    try {
      const payload = await crmJsonRequest<{ file: CrmFile }>(clientSlug, "/files", accessToken, {
        method: "POST",
        body: form,
      });

      setFiles((prev) => [payload.file, ...prev]);
      setUploadFile(null);
      setUploadLeadId("");
      setStatus("File uploaded.");
      setActiveTab("files");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function requestEmbedAccess() {
    if (!accessToken) return;
    setLoading(true);
    setStatus("Requesting embed access...");

    try {
      const payload = await crmJsonRequest<ProjectDetailsPayload>(clientSlug, "", accessToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedStatus: "requested" }),
      });
      const nextEmbedState = normalizeEmbedState(payload.project.embedStatus);
      if (nextEmbedState) {
        setEmbedState(nextEmbedState);
      }
      setStatus("Embed access requested. Pending admin approval.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo() {
    if (!accessToken || !logoFile) {
      setStatus("Select a logo image first.");
      return;
    }

    setLogoUploading(true);
    setStatus("Uploading company logo...");

    try {
      const form = new FormData();
      form.append("logo", logoFile);
      const payload = await crmJsonRequest<{ project: { logoUrl: string | null } }>(
        clientSlug,
        "/branding",
        accessToken,
        {
          method: "POST",
          body: form,
        },
      );

      setProjectInfo((prev) => ({
        ...prev,
        logoUrl: payload.project.logoUrl,
      }));
      setLogoFile(null);
      setStatus("Logo updated successfully.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLogoUploading(false);
    }
  }

  async function previewSelectedVoice() {
    const selectedVoiceId = newAgentForm.voiceId.trim();
    if (!selectedVoiceId) {
      setStatus("Select a voice first.");
      return;
    }

    const selectedVoice = voiceOptions.find((voice) => voice.id === selectedVoiceId);
    if (!selectedVoice) {
      setStatus("Selected voice is not available.");
      return;
    }

    const audio = voicePreviewAudioRef.current;
    if (!audio) {
      setStatus("Voice preview player is unavailable.");
      return;
    }

    if (playingVoiceId === selectedVoiceId) {
      await stopVoicePreview();
      return;
    }

    setPreviewingVoice(true);
    try {
      await stopVoicePreview();

      if (selectedVoice.previewSampleUrl) {
        audio.src = selectedVoice.previewSampleUrl;
        await audio.play();
        setPlayingVoiceId(selectedVoiceId);
        setStatus(`Playing voice preview for ${selectedVoice.label}.`);
        return;
      }

      const configRes = await fetch(`/api/ev/voice/voices/preview-config?voiceId=${encodeURIComponent(selectedVoiceId)}`);
      const configPayload = (await configRes.json().catch(() => ({}))) as
        | VoicePreviewConfigResponse
        | { error?: string };

      if (!configRes.ok || !("preview" in configPayload)) {
        const message =
          typeof (configPayload as { error?: string }).error === "string"
            ? (configPayload as { error?: string }).error
            : "Preview is unavailable for this voice.";
        throw new Error(message);
      }

      const mod = await import("@vapi-ai/web");
      const Vapi = mod.default as unknown as new (publicKey: string) => VapiClient;
      const client = new Vapi(configPayload.preview.publicKey);
      voicePreviewClientRef.current = client;
      setPlayingVoiceId(selectedVoiceId);

      client.on("call-end", () => {
        if (voicePreviewClientRef.current === client) {
          voicePreviewClientRef.current = null;
        }
        setPlayingVoiceId((prev) => (prev === selectedVoiceId ? null : prev));
      });

      client.on("error", () => {
        if (voicePreviewClientRef.current === client) {
          voicePreviewClientRef.current = null;
        }
        setPlayingVoiceId((prev) => (prev === selectedVoiceId ? null : prev));
        setStatus("Live voice preview failed.");
      });

      await client.start(configPayload.preview.assistantId, configPayload.preview.assistantOverrides);

      voicePreviewTimeoutRef.current = setTimeout(() => {
        void stopVoicePreview();
      }, configPayload.preview.timeoutSeconds * 1000);

      setStatus(`Running live voice preview for ${selectedVoice.label}.`);
    } catch {
      setPlayingVoiceId(null);
      setStatus("Failed to play selected voice preview.");
    } finally {
      setPreviewingVoice(false);
    }
  }

  async function createAgent() {
    if (!accessToken) return;
    if (!newAgentForm.name.trim()) {
      setStatus("Agent name is required.");
      return;
    }

    setCreatingAgent(true);
    setStatus("Creating CRM agent...");

    try {
      const selectedPhoneOption = newAgentForm.phoneSelection.trim();
      const autoGeneratePhoneNumber = selectedPhoneOption === AUTO_SIP_NUMBER_OPTION;
      const phoneNumberId = selectedPhoneOption && !autoGeneratePhoneNumber ? selectedPhoneOption : undefined;
      const payload = await crmJsonRequest<{ agent: CrmAgent; number: CrmNumber | null }>(clientSlug, "/agents", accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAgentForm.name.trim(),
          intro: newAgentForm.intro.trim() || undefined,
          firstMessageMode: newAgentForm.firstMessageMode,
          systemPrompt: newAgentForm.systemPrompt.trim() || undefined,
          voiceId: newAgentForm.voiceId || undefined,
          phoneNumberId,
          autoGeneratePhoneNumber: autoGeneratePhoneNumber || undefined,
          numberDesiredAreaCode:
            autoGeneratePhoneNumber && newAgentForm.numberDesiredAreaCode.trim()
              ? newAgentForm.numberDesiredAreaCode.trim()
              : undefined,
        }),
      });

      setAgents((prev) => [payload.agent, ...prev]);
      const assignedNumber = payload.number;
      if (assignedNumber) {
        setNumbers((prev) => [assignedNumber, ...prev.filter((num) => num.id !== assignedNumber.id)]);
      }
      setNewAgentForm((prev) => ({
        name: "",
        intro: "",
        firstMessageMode: prev.firstMessageMode,
        systemPrompt: "",
        voiceId: prev.voiceId,
        phoneSelection: "",
        numberDesiredAreaCode: "",
      }));
      setStatus(payload.number ? "CRM agent created and phone number connected." : "CRM agent created.");
      setActiveTab("agents");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setCreatingAgent(false);
    }
  }

  function startEditingAgent(agent: CrmAgent) {
    setEditingAgentId(agent.id);
    setEditingAgentForm({
      name: agent.name,
      intro: agent.intro,
      firstMessageMode: agent.firstMessageMode,
      systemPrompt: agent.systemPrompt,
      voiceId: agent.voiceId,
    });
    setStatus(`Editing ${agent.name}.`);
  }

  function cancelEditingAgent() {
    setEditingAgentId(null);
    setStatus("Canceled CRM agent edit.");
  }

  async function updateAgent() {
    if (!accessToken || !editingAgentId) return;
    if (!editingAgentForm.name.trim()) {
      setStatus("Agent name is required.");
      return;
    }

    setUpdatingAgent(true);
    setStatus("Updating CRM agent...");

    try {
      const payload = await crmJsonRequest<{ agent: CrmAgent }>(
        clientSlug,
        `/agents/${encodeURIComponent(editingAgentId)}`,
        accessToken,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingAgentForm.name.trim(),
            intro: editingAgentForm.intro.trim() || undefined,
            firstMessageMode: editingAgentForm.firstMessageMode,
            systemPrompt: editingAgentForm.systemPrompt.trim() || undefined,
            voiceId: editingAgentForm.voiceId || undefined,
          }),
        },
      );

      setAgents((prev) => prev.map((agent) => (agent.id === payload.agent.id ? payload.agent : agent)));
      setEditingAgentId(null);
      setStatus("CRM agent updated.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setUpdatingAgent(false);
    }
  }

  async function purchaseNumber() {
    if (!accessToken) return;
    if (!numberForm.assignAgentId) {
      setStatus("Select an agent for the new phone number.");
      return;
    }

    setBuyingNumber(true);
    setStatus("Purchasing phone number...");

    try {
      const payload = await crmJsonRequest<{ number: CrmNumber }>(clientSlug, "/phone-numbers", accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: numberForm.country.trim() || "US",
          areaCode: numberForm.areaCode.trim() || undefined,
          assignAgentId: numberForm.assignAgentId,
        }),
      });

      setNumbers((prev) => [payload.number, ...prev]);
      await loadBillingData(accessToken);
      setStatus("Number purchase submitted.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBuyingNumber(false);
    }
  }

  async function searchCalls(sync = false) {
    if (!accessToken) return;
    setLoading(true);

    try {
      await loadCallsData(accessToken, { sync });
      setStatus(null);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<{ id: TabId; label: string }> = useMemo(
    () => [
      { id: "dashboard", label: "Overview" },
      { id: "agents", label: `Agents (${agents.length})` },
      { id: "calls", label: `Calls (${calls.length})` },
      { id: "leads", label: `Leads (${leads.length})` },
      { id: "files", label: `Files (${files.length})` },
      { id: "settings", label: "Settings" },
    ],
    [agents.length, calls.length, leads.length, files.length],
  );

  if (!authReady) {
    return (
      <div className="crmPortalRoot crmPortalCenter">
        <p className="muted">Initializing workspace...</p>
      </div>
    );
  }

  if (!isSupabaseEnabled()) {
    return (
      <div className="crmPortalRoot crmPortalCenter">
        <section className="card crmPortalNoticeCard">
          <p className="muted crmTextCenter">
            Auth is disabled. Please configure `NEXT_PUBLIC_SUPABASE_URL` to continue.
          </p>
        </section>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="crmPortalRoot crmPortalCenter">
        <section className="card crmAuthCard crmAuthCardCompact">
          <div className="crmAuthHeader">
            {projectInfo.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={projectInfo.logoUrl} alt={projectInfo.name} width={120} height={48} className="crmAuthLogo" />
            ) : null}
            <h2 className="crmAuthTitle">{projectInfo.name} Workspace</h2>
            <p className="muted crmAuthSubtitle">Sign in with your client email to access your CRM.</p>
          </div>
          <div className="crmAuthForm">
            <input
              type="email"
              placeholder="you@client.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="crmInputWide"
            />
            <button type="button" className="crmButtonFull" onClick={() => void sendMagicLink()}>
              Continue with Email Link
            </button>
          </div>
          {status ? <p className="muted crmAuthStatus">{status}</p> : null}
        </section>
      </div>
    );
  }

  const embedHost = origin || "{YOUR_CRM_HOST}";
  const embedCodeSnippet = `<iframe src="${embedHost}/portal/${clientSlug}" width="100%" height="800px" style="border:none; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.1);"></iframe>`;
  const dashboardSubtitle = projectInfo.description?.trim() || TAB_SUBTITLES.dashboard;

  return (
    <div className="crmDashboardLayout">
      <audio ref={voicePreviewAudioRef} hidden onEnded={() => setPlayingVoiceId(null)} />

      <aside className="crmSidebar">
        <div className="crmSidebarBrand">
          {projectInfo.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={projectInfo.logoUrl} alt={projectInfo.name} className="crmSidebarLogo" />
          ) : null}
          <h2 className="crmSidebarName">{projectInfo.name}</h2>
          <div className="muted crmSidebarSlug">/{clientSlug}</div>
          {projectInfo.description ? <p className="muted crmSidebarDescription">{projectInfo.description}</p> : null}
        </div>

        <nav className="crmSidebarNav">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`crmSidebarTab${activeTab === tab.id ? " isActive" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="crmSidebarFooter">
          <div className="crmSidebarEmail">{session.user.email ?? "Unknown email"}</div>
          <button type="button" className="secondary crmButtonFull crmButtonSmall" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="crmMain">
        <div className="crmTopBar">
          <div>
            <h1 className="crmTopTitle">{activeTab === "dashboard" ? "Overview" : activeTab}</h1>
            <p className="muted crmTopSubtitle">
              {activeTab === "dashboard" ? dashboardSubtitle : TAB_SUBTITLES[activeTab]}
            </p>
          </div>
          <div className="inlineActions inlineActionsCenter">
            {status ? <span className="crmTopStatus">{status}</span> : null}
            <button
              type="button"
              className="secondary crmButtonSmall"
              onClick={() => void refreshPortalData()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
        </div>

        {activeTab === "dashboard" && (
          <div className="crmStackLg">
            <div className="crmMetricGrid">
              <div className="card crmMetricCardWide">
                <div className="muted crmMetricLabel">Total Leads</div>
                <div className="crmMetricValueStrong">{leads.length}</div>
              </div>
              <div className="card crmMetricCardWide">
                <div className="muted crmMetricLabel">Client Agents</div>
                <div className="crmMetricValueStrong">{agents.length}</div>
              </div>
              <div className="card crmMetricCardWide">
                <div className="muted crmMetricLabel">Recent Calls</div>
                <div className="crmMetricValueStrong">{calls.length}</div>
              </div>
              <div className="card crmMetricCardWide">
                <div className="muted crmMetricLabel">Active Numbers</div>
                <div className="crmMetricValueStrong">{numbers.length}</div>
              </div>
            </div>

            <div className="card crmCardPadded">
              <h3 className="crmCardHeading">Recent Calls (Client-Only)</h3>
              <div className="tableWrap crmTableWrapFlush">
                <table className="crmTableWide">
                  <thead className="crmTableHeadSmall">
                    <tr>
                      <th>Call</th>
                      <th>Agent</th>
                      <th>Status</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Started</th>
                      <th>Recording</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.slice(0, 8).map((call) => (
                      <tr key={call.id} className="crmRowCompact">
                        <td>{call.vapiCallId}</td>
                        <td>{call.agent?.name ?? "-"}</td>
                        <td>{call.status}</td>
                        <td>{call.fromNumber ?? "-"}</td>
                        <td>{call.toNumber ?? "-"}</td>
                        <td>{formatDate(call.startedAt)}</td>
                        <td>
                          {call.recordingUrl ? (
                            <audio controls preload="none" src={call.recordingUrl} className="crmAudioPlayer" />
                          ) : (
                            <span className="muted">No recording</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {calls.length === 0 && (
                      <tr>
                        <td colSpan={7} className="muted crmTableEmpty">
                          No client calls logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card crmCardPadded">
              <h3 className="crmCardHeading">Quick Add Lead</h3>
              <div className="fieldGrid crmQuickLeadGrid">
                <input
                  placeholder="Full Name"
                  value={leadForm.fullName}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, fullName: e.target.value }))}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="crmActionsEnd">
                <button type="button" onClick={() => void addLead()}>
                  Save Lead
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "agents" && (
          <div className="crmStack">
            <div className="card crmCardPadded">
              <h3 className="crmCardHeading">Create CRM Agent</h3>
              <div className="fieldGrid crmAgentGrid">
                <label>
                  Name
                  <input
                    value={newAgentForm.name}
                    onChange={(e) => setNewAgentForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Client Assistant"
                  />
                </label>
                <label>
                  Voice
                  <div className="crmVoiceSelectGroup">
                    <select
                      aria-label="Agent Voice"
                      value={newAgentForm.voiceId}
                      onChange={(e) => setNewAgentForm((prev) => ({ ...prev, voiceId: e.target.value }))}
                      className="crmInputGrow"
                    >
                      {!voiceOptions.length && <option value="">No approved voices</option>}
                      {voiceOptions.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.label} ({voice.locale})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void previewSelectedVoice()}
                      disabled={previewingVoice || !newAgentForm.voiceId}
                      aria-label="Preview selected voice"
                      title="Preview selected voice"
                    >
                      {playingVoiceId === newAgentForm.voiceId ? "■" : "▶"}
                    </button>
                  </div>
                  <p className="muted crmInputHint">
                    If no voice is selected, a default approved voice is auto-assigned.
                  </p>
                </label>
                <label>
                  Phone Number
                  <select
                    aria-label="Assign Phone Number"
                    value={newAgentForm.phoneSelection}
                    onChange={(e) => setNewAgentForm((prev) => ({ ...prev, phoneSelection: e.target.value }))}
                  >
                    <option value="">No number selected</option>
                    <option value={AUTO_SIP_NUMBER_OPTION}>Auto-generate free VAPI SIP number</option>
                    {numbers.map((number) => (
                      <option key={number.id} value={number.id}>
                        {number.displayNumber}
                        {number.assignedAgent ? ` (assigned: ${number.assignedAgent.name})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {newAgentForm.phoneSelection === AUTO_SIP_NUMBER_OPTION ? (
                  <label>
                    Preferred Area Code (optional)
                    <input
                      value={newAgentForm.numberDesiredAreaCode}
                      onChange={(e) =>
                        setNewAgentForm((prev) => ({
                          ...prev,
                          numberDesiredAreaCode: e.target.value.replace(/\D/g, "").slice(0, 3),
                        }))}
                      placeholder="212"
                      inputMode="numeric"
                      maxLength={3}
                    />
                  </label>
                ) : null}
                <label className="crmFieldFull">
                  Intro (optional)
                  <input
                    value={newAgentForm.intro}
                    onChange={(e) => setNewAgentForm((prev) => ({ ...prev, intro: e.target.value }))}
                    placeholder="Hi, this is your assistant. How can I help?"
                  />
                </label>
                <label>
                  Conversation Start
                  <select
                    aria-label="Conversation Start Mode"
                    value={newAgentForm.firstMessageMode}
                    onChange={(e) =>
                      setNewAgentForm((prev) => ({
                        ...prev,
                        firstMessageMode: e.target.value as "assistant-speaks-first" | "assistant-waits-for-user",
                      }))}
                  >
                    <option value="assistant-speaks-first">Agent speaks first</option>
                    <option value="assistant-waits-for-user">User speaks first</option>
                  </select>
                </label>
                <label className="crmFieldFull">
                  System Prompt (optional)
                  <textarea
                    rows={5}
                    value={newAgentForm.systemPrompt}
                    onChange={(e) => setNewAgentForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder="Instructions for this client's voice agent..."
                  />
                </label>
              </div>
              <div className="inlineActions crmTopGap">
                <button type="button" onClick={() => void createAgent()} disabled={creatingAgent}>
                  {creatingAgent ? "Creating..." : "Create Agent"}
                </button>
                <button type="button" className="secondary" onClick={() => void refreshPortalData()} disabled={loading}>
                  Refresh
                </button>
              </div>
            </div>

            {editingAgentId ? (
              <div className="card crmCardPadded">
                <h3 className="crmCardHeading">Edit CRM Agent</h3>
                <div className="fieldGrid crmAgentGrid">
                  <label>
                    Name
                    <input
                      value={editingAgentForm.name}
                      onChange={(e) => setEditingAgentForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Client Assistant"
                    />
                  </label>
                  <label>
                    Voice
                    <select
                      aria-label="Agent Voice"
                      value={editingAgentForm.voiceId}
                      onChange={(e) => setEditingAgentForm((prev) => ({ ...prev, voiceId: e.target.value }))}
                    >
                      {!voiceOptions.length && <option value="">Default voice</option>}
                      {voiceOptions.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.label} ({voice.locale})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crmFieldFull">
                    Intro
                    <input
                      value={editingAgentForm.intro}
                      onChange={(e) => setEditingAgentForm((prev) => ({ ...prev, intro: e.target.value }))}
                      placeholder="Hi, this is your assistant. How can I help?"
                    />
                  </label>
                  <label>
                    Conversation Start
                    <select
                      aria-label="Conversation Start Mode"
                      value={editingAgentForm.firstMessageMode}
                      onChange={(e) =>
                        setEditingAgentForm((prev) => ({
                          ...prev,
                          firstMessageMode: e.target.value as "assistant-speaks-first" | "assistant-waits-for-user",
                        }))}
                    >
                      <option value="assistant-speaks-first">Agent speaks first</option>
                      <option value="assistant-waits-for-user">User speaks first</option>
                    </select>
                  </label>
                  <label className="crmFieldFull">
                    System Prompt
                    <textarea
                      rows={5}
                      value={editingAgentForm.systemPrompt}
                      onChange={(e) => setEditingAgentForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                      placeholder="Instructions for this client's voice agent..."
                    />
                  </label>
                </div>
                <div className="inlineActions crmTopGap">
                  <button type="button" onClick={() => void updateAgent()} disabled={updatingAgent}>
                    {updatingAgent ? "Updating..." : "Update Agent"}
                  </button>
                  <button type="button" className="secondary" onClick={cancelEditingAgent} disabled={updatingAgent}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            <div className="card crmCardPadded">
              <h3 className="crmCardHeading">CRM Agents</h3>
              <div className="tableWrap crmTableWrapFlush">
                <table className="crmTableWide">
                  <thead className="crmTableHeadSmall">
                    <tr>
                      <th>Name</th>
                      <th>Voice</th>
                      <th>Status</th>
                      <th>Conversation Start</th>
                      <th>Phone Number</th>
                      <th>Description</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.id} className="crmRowCompact">
                        <td className="crmLeadName">{agent.name}</td>
                        <td>{agent.voiceLabel}</td>
                        <td>{agent.status}</td>
                        <td>{agent.firstMessageMode === "assistant-waits-for-user" ? "User first" : "Agent first"}</td>
                        <td>{numberByAgentId.get(agent.id) ?? "-"}</td>
                        <td className="muted">{agent.description}</td>
                        <td>{formatDate(agent.updatedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary crmButtonSmall"
                            onClick={() => startEditingAgent(agent)}
                            disabled={updatingAgent}
                          >
                            {editingAgentId === agent.id ? "Editing" : "Edit"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!agents.length && (
                      <tr>
                        <td colSpan={8} className="muted crmTableEmpty">
                          No CRM agents yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "calls" && (
          <div className="crmStack">
            <section className="card crmCardPadded">
              <div className="inlineActions">
                <input
                  aria-label="Search Calls"
                  value={callQuery}
                  onChange={(e) => setCallQuery(e.target.value)}
                  placeholder="Search number or call id"
                  className="crmInputSearch"
                />
                <button type="button" className="secondary" onClick={() => void searchCalls(false)} disabled={loading}>
                  Search
                </button>
                <button type="button" onClick={() => void searchCalls(true)} disabled={loading}>
                  Sync + Refresh
                </button>
              </div>
            </section>

            <section className="card crmCardPadded">
              <div className="tableWrap crmTableWrapFlush">
                <table className="crmTableWide">
                  <thead className="crmTableHeadSmall">
                    <tr>
                      <th>Call</th>
                      <th>Agent</th>
                      <th>Status</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Duration</th>
                      <th>Cost</th>
                      <th>Started</th>
                      <th>Recording</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((call) => (
                      <tr key={call.id} className="crmRowCompact">
                        <td>{call.vapiCallId}</td>
                        <td>{call.agent?.name ?? "-"}</td>
                        <td>{call.status}</td>
                        <td>{call.fromNumber ?? "-"}</td>
                        <td>{call.toNumber ?? "-"}</td>
                        <td>{call.durationSeconds ?? "-"}</td>
                        <td>{typeof call.costUsd === "number" ? `$${call.costUsd.toFixed(3)}` : "-"}</td>
                        <td>{formatDate(call.startedAt)}</td>
                        <td>
                          {call.recordingUrl ? (
                            <audio controls preload="none" src={call.recordingUrl} className="crmAudioPlayer" />
                          ) : (
                            <span className="muted">No recording</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!calls.length && (
                      <tr>
                        <td colSpan={9} className="muted crmTableEmpty">
                          No client calls logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === "leads" && (
          <div className="crmStack">
            <div className="card crmCardPadded">
              <div className="tableWrap crmTableWrapFlush">
                <table className="crmTableWide">
                  <thead className="crmTableHeadSmall">
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Company</th>
                      <th>Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="crmRowCompact">
                        <td className="crmLeadName">{lead.fullName}</td>
                        <td className="muted">{lead.email ?? "-"}</td>
                        <td className="muted">{lead.phone ?? "-"}</td>
                        <td className="muted">{lead.company ?? "-"}</td>
                        <td>
                          <select
                            aria-label="Lead Stage"
                            value={lead.stage}
                            onChange={(e) => void updateLeadStage(lead.id, e.target.value as CrmLead["stage"])}
                            className="crmStageSelect"
                          >
                            {STAGE_OPTIONS.map((stage) => (
                              <option key={stage} value={stage}>
                                {stage}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {!leads.length && (
                      <tr>
                        <td colSpan={5} className="muted crmTableEmpty">
                          No leads exist yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="crmStack">
            <div className="card crmCardPadded crmFileUploadCard">
              <select aria-label="Select lead" value={uploadLeadId} onChange={(e) => setUploadLeadId(e.target.value)}>
                <option value="">General (no lead)</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.fullName}
                  </option>
                ))}
              </select>
              <input
                aria-label="Upload File"
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="crmUploadInput crmFileInputGrow"
              />
              <button type="button" onClick={() => void uploadAttachment()} disabled={!uploadFile}>
                Upload File
              </button>
            </div>

            <div className="card crmCardPadded">
              <div className="tableWrap crmTableWrapFlush">
                <table className="crmTableWide">
                  <thead className="crmTableHeadSmall">
                    <tr>
                      <th>File Name</th>
                      <th>Associated Lead</th>
                      <th>Uploaded By</th>
                      <th>Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.id} className="crmRowCompact">
                        <td>
                          {file.publicUrl ? (
                            <a href={file.publicUrl} target="_blank" rel="noreferrer" className="crmFileLink">
                              {file.fileName}
                            </a>
                          ) : (
                            file.fileName
                          )}
                        </td>
                        <td className="muted">{file.leadId ? leadsById.get(file.leadId)?.fullName ?? file.leadId : "General"}</td>
                        <td className="muted">{file.uploadedByEmail ?? "-"}</td>
                        <td className="muted">{Math.round(file.sizeBytes / 1024)} KB</td>
                      </tr>
                    ))}
                    {!files.length && (
                      <tr>
                        <td colSpan={4} className="muted crmTableEmpty">
                          No files uploaded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="crmSettingsStack">
            <div className="card crmSettingsCard">
              <h3 className="crmSettingsTitle">Company Branding</h3>
              <p className="muted crmSettingsHelp">Upload your company logo. It will appear beside your CRM title.</p>
              <div className="crmSettingsDivider crmLogoUpload">
                {projectInfo.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={projectInfo.logoUrl}
                    alt="Company logo"
                    width={72}
                    height={72}
                    className="crmCompanyLogoLarge"
                  />
                ) : (
                  <div className="crmCompanyLogoPlaceholder">
                    No Logo
                  </div>
                )}
                <div className="crmLogoActions">
                  <input aria-label="Upload Logo" type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                  <div className="inlineActions">
                    <button type="button" onClick={() => void uploadLogo()} disabled={logoUploading || !logoFile}>
                      {logoUploading ? "Uploading..." : "Upload Logo"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card crmSettingsCard">
              <h3 className="crmSettingsTitle">Billing</h3>
              <p className="muted crmSettingsHelp">CRM-specific billing summary for this client project.</p>
              <div className="crmSettingsDivider">
                <div className="crmBillingGrid">
                  <div className="card crmBillingCard">
                    <div className="muted crmBillingLabel">Balance</div>
                    <div className="crmBillingValue">{formatMoney(billingSummary?.balanceCents ?? 0)}</div>
                  </div>
                  <div className="card crmBillingCard">
                    <div className="muted crmBillingLabel">Monthly Phone Cost</div>
                    <div className="crmBillingValue">{formatMoney(billingSummary?.monthlyPhoneCostCents ?? 0)}</div>
                  </div>
                  <div className="card crmBillingCard">
                    <div className="muted crmBillingLabel">Entries</div>
                    <div className="crmBillingValue">{billingSummary?.entryCount ?? 0}</div>
                  </div>
                </div>

                <div className="tableWrap crmTableWrapFlush">
                  <table className="crmTableWide">
                    <thead className="crmTableHeadSmall">
                      <tr>
                        <th>Description</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingEntries.map((entry) => (
                        <tr key={entry.id} className="crmRowCompact">
                          <td>{entry.description}</td>
                          <td>{entry.entryType}</td>
                          <td>{formatMoney(entry.amountCents)}</td>
                          <td>{formatDate(entry.createdAt)}</td>
                        </tr>
                      ))}
                      {!billingEntries.length && (
                        <tr>
                          <td colSpan={4} className="muted crmTableEmpty">
                            No billing entries for this CRM yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card crmSettingsCard">
              <h3 className="crmSettingsTitle">Phone Numbers</h3>
              <p className="muted crmSettingsHelp">Purchase numbers and assign them to your CRM agents.</p>
              <div className="crmSettingsDivider">
                <div className="fieldGrid crmPhoneGrid">
                  <label>
                    Country
                    <input
                      value={numberForm.country}
                      onChange={(e) => setNumberForm((prev) => ({ ...prev, country: e.target.value }))}
                      placeholder="US"
                    />
                  </label>
                  <label>
                    Area Code (optional)
                    <input
                      value={numberForm.areaCode}
                      onChange={(e) => setNumberForm((prev) => ({ ...prev, areaCode: e.target.value }))}
                      placeholder="212"
                    />
                  </label>
                  <label>
                    Assign Agent
                    <select
                      aria-label="Assign Agent"
                      value={numberForm.assignAgentId}
                      onChange={(e) => setNumberForm((prev) => ({ ...prev, assignAgentId: e.target.value }))}
                    >
                      {!agents.length && <option value="">No CRM agents</option>}
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="inlineActions crmTopGapSmall">
                  <button type="button" onClick={() => void purchaseNumber()} disabled={buyingNumber || !agents.length}>
                    {buyingNumber ? "Purchasing..." : "Purchase Number"}
                  </button>
                </div>

                <div className="tableWrap crmTableWrapFlush crmTopGap">
                  <table className="crmTableWide">
                    <thead className="crmTableHeadSmall">
                      <tr>
                        <th>Number</th>
                        <th>Status</th>
                        <th>Assigned Agent</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {numbers.map((num) => (
                        <tr key={num.id} className="crmRowCompact">
                          <td>{num.displayNumber}</td>
                          <td>{num.status}</td>
                          <td>{num.assignedAgent?.name ?? "-"}</td>
                          <td>{formatMoney(num.monthlyPriceCents)}</td>
                        </tr>
                      ))}
                      {!numbers.length && (
                        <tr>
                          <td colSpan={4} className="muted crmTableEmpty">
                            No CRM numbers yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card crmSettingsCard">
              <div className="crmSettingsHeader">
                <div>
                  <h3 className="crmSettingsTitle">Dashboard Embed</h3>
                  <p className="muted crmSettingsHelp">
                    Request permission from the admin to embed this CRM directly into your own internal tools or intranet via an iframe.
                  </p>
                </div>
                <div
                  className={`crmEmbedStatusPill${embedState === "approved" ? " isApproved" : ""}${embedState === "requested" ? " isRequested" : ""}`}
                >
                  Status: <span className="crmEmbedStatusValue">{embedState ? embedState.toUpperCase() : "DISABLED"}</span>
                </div>
              </div>

              <div className="crmSettingsDivider">
                {(!embedState || embedState === "disabled") && (
                  <button type="button" onClick={() => void requestEmbedAccess()} disabled={loading}>
                    Request Embed Access
                  </button>
                )}

                {embedState === "requested" && (
                  <div className="crmEmbedPending">
                    <p className="crmEmbedPendingTitle">Your request is currently pending admin review.</p>
                    <p className="crmEmbedPendingCopy">You will see the embed code snippet here once approved.</p>
                  </div>
                )}

                {embedState === "approved" && (
                  <div>
                    <h4 className="crmSnippetTitle">Your Integration Snippet</h4>
                    <div className="crmSnippetWrap">
                      <pre className="crmSnippetCode">
                        <code>{embedCodeSnippet}</code>
                      </pre>
                      <button
                        type="button"
                        className="secondary crmSnippetCopyButton"
                        onClick={() => {
                          void navigator.clipboard.writeText(embedCodeSnippet);
                          setStatus("Snippet copied to clipboard!");
                        }}
                      >
                        Copy Code
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
