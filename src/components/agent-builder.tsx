"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiRequest } from "@/lib/client/api";

type VoiceOption = {
  id: string;
  label: string;
  locale: string;
  previewSampleUrl?: string | null;
};

type AgentResponse = {
  agent: {
    id: string;
    name: string;
    intro: string;
    firstMessageMode: "assistant-speaks-first" | "assistant-waits-for-user";
    systemPrompt: string;
    voiceId: string;
    status: "draft" | "deployed";
    remoteAgentId?: string | null;
  };
};

type SessionConfig = {
  assistantId: string;
  publicKey: string;
  previewSessionId: string;
  timeoutSeconds: number;
};

type TranscriptItem = {
  role: "agent" | "user";
  text: string;
  at: string;
};

type CallState = "idle" | "connecting" | "live" | "ended" | "error";

const hardLimits = {
  name: 80,
  intro: 500,
  prompt: 5000,
};

const steps = ["Identity", "Behavior", "Voice"];

function extractTranscript(message: unknown): TranscriptItem | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const data = message as Record<string, unknown>;
  const type = typeof data.type === "string" ? data.type : "";

  const maybeText =
    (typeof data.transcript === "string" && data.transcript) ||
    (typeof data.text === "string" && data.text) ||
    (typeof data.message === "string" && data.message) ||
    (typeof data.content === "string" && data.content);

  if (!maybeText) {
    return null;
  }

  if (!type.includes("transcript") && type !== "message") {
    return null;
  }

  const role =
    data.role === "assistant" || data.source === "assistant" || data.speaker === "assistant"
      ? "agent"
      : "user";

  return {
    role,
    text: maybeText,
    at: new Date().toISOString(),
  };
}

export function AgentBuilder() {
  const [step, setStep] = useState(0);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Fill all required fields to unlock preview.");
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [calling, setCalling] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);

  const [form, setForm] = useState({
    name: "",
    intro: "",
    firstMessageMode: "assistant-speaks-first" as "assistant-speaks-first" | "assistant-waits-for-user",
    systemPrompt: "",
    voiceId: "",
  });

  const vapiRef = useRef<{ stop: () => void } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    apiRequest<{ voices: VoiceOption[] }>("/api/ev/voice/voices")
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setVoices(payload.voices);
        setForm((prev) => ({ ...prev, voiceId: prev.voiceId || payload.voices[0]?.id || "" }));
      })
      .catch((error) => {
        if (mounted) {
          setStatusText(error.message);
        }
      });

    return () => {
      mounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      vapiRef.current?.stop();
    };
  }, []);

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (form.name.trim().length < 2 || form.name.trim().length > hardLimits.name) {
      errors.push(`Agent Name must be 2-${hardLimits.name} characters.`);
    }
    if (form.intro.trim().length < 4 || form.intro.trim().length > hardLimits.intro) {
      errors.push(`Intro / First Message must be 4-${hardLimits.intro} characters.`);
    }
    if (form.systemPrompt.trim().length < 20 || form.systemPrompt.trim().length > hardLimits.prompt) {
      errors.push(`Skills and Description must be 20-${hardLimits.prompt} characters.`);
    }
    return errors;
  }, [form]);

  const ready = validation.length === 0;

  async function syncDraft(): Promise<string> {
    if (!ready) {
      throw new Error("Complete all required fields before saving.");
    }

    if (!draftId) {
      const payload = await apiRequest<AgentResponse>("/api/ev/voice/agents", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          status: "draft",
          autoCreateRemote: true,
        }),
      });

      setDraftId(payload.agent.id);
      return payload.agent.id;
    }

    await apiRequest<AgentResponse>(`/api/ev/voice/agents/${draftId}`, {
      method: "PATCH",
      body: JSON.stringify(form),
    });

    return draftId;
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const id = await syncDraft();
      setStatusText(`Draft saved (${id.slice(0, 8)}...).`);
    } catch (error) {
      setStatusText((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function finishPreview(reason: string) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    vapiRef.current?.stop();
    vapiRef.current = null;
    setCalling(false);
    setCallState("ended");

    if (previewSessionId) {
      await apiRequest(`/api/ev/voice/preview-sessions/${previewSessionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: reason,
          transcript,
          ended: true,
        }),
      }).catch(() => {
        // do not block UI on telemetry write
      });
    }
  }

  async function handleStartPreview() {
    if (!ready) {
      setStatusText(validation[0] ?? "Complete all required fields first.");
      return;
    }

    setCalling(true);
    setCallState("connecting");
    setStatusText("Starting preview...");

    try {
      const id = await syncDraft();
      const config = await apiRequest<SessionConfig>(`/api/ev/voice/session-config?agentId=${id}`);

      setPreviewSessionId(config.previewSessionId);
      setTranscript([]);

      const mod = await import("@vapi-ai/web");
      const VapiCtor = mod.default;
      const client = new VapiCtor(config.publicKey);

      client.on("call-start", () => {
        setCallState("live");
        setStatusText("Preview call is live.");
      });

      client.on("call-end", () => {
        void finishPreview("ended");
      });

      client.on("message", (message: unknown) => {
        const line = extractTranscript(message);
        if (line) {
          setTranscript((prev) => [...prev.slice(-99), line]);
        }
      });

      client.on("error", (error: unknown) => {
        setCallState("error");
        setStatusText(`Preview error: ${String(error)}`);
      });

      vapiRef.current = client;
      await client.start(config.assistantId);

      timeoutRef.current = setTimeout(() => {
        void finishPreview("timeout");
      }, config.timeoutSeconds * 1000);
    } catch (error) {
      setCallState("error");
      setCalling(false);
      setStatusText((error as Error).message);
    }
  }

  async function handleStopPreview() {
    await finishPreview("stopped");
    setStatusText("Preview stopped.");
  }

  async function handleDeploy() {
    setDeploying(true);
    try {
      const id = await syncDraft();
      await apiRequest<{ message: string }>(`/api/ev/voice/agents/${id}/deploy`, {
        method: "POST",
      });
      setStatusText("Agent is live and attached to dashboard routing.");
    } catch (error) {
      setStatusText((error as Error).message);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="split">
      <section className="card">
        <div className="stepTabs">
          {steps.map((label, idx) => (
            <button
              type="button"
              key={label}
              className={`stepTab ${step === idx ? "active" : ""}`}
              onClick={() => setStep(idx)}
            >
              {idx + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="fieldGrid">
            <label>
              Agent Name
              <input
                value={form.name}
                maxLength={hardLimits.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Weekend Support Desk"
              />
            </label>

            <label>
              Intro / First Message
              <textarea
                rows={4}
                value={form.intro}
                maxLength={hardLimits.intro}
                onChange={(e) => setForm((prev) => ({ ...prev, intro: e.target.value }))}
                placeholder="Hi, you reached Eburon Voice support. How can I help you today?"
              />
            </label>

            <label>
              Conversation Start
              <select
                value={form.firstMessageMode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    firstMessageMode: e.target.value as "assistant-speaks-first" | "assistant-waits-for-user",
                  }))}
              >
                <option value="assistant-speaks-first">Agent speaks first</option>
                <option value="assistant-waits-for-user">User speaks first</option>
              </select>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="fieldGrid">
            <label>
              Skills and Description
              <textarea
                rows={10}
                value={form.systemPrompt}
                maxLength={hardLimits.prompt}
                onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="You are a CSR assistant for Eburon Voice. Keep responses concise, polite, and actionable."
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="fieldGrid">
            <label>
              Voice
              <select
                value={form.voiceId}
                onChange={(e) => setForm((prev) => ({ ...prev, voiceId: e.target.value }))}
              >
                {!voices.length && <option value="">Default voice</option>}
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.label} ({voice.locale})
                  </option>
                ))}
              </select>
            </label>

            <p className="muted">Only approved voices are shown. If none is selected, a default voice is auto-assigned.</p>
          </div>
        )}

        <div className="inlineActions templateMarginTopLarge">
          <button type="button" className="secondary" onClick={handleSaveDraft} disabled={saving || !ready}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button type="button" className="warn" onClick={handleStartPreview} disabled={!ready || calling}>
            {calling ? "Connecting..." : "Preview"}
          </button>
          <button type="button" onClick={handleDeploy} disabled={!ready || deploying}>
            {deploying ? "Deploying..." : "Deploy"}
          </button>
        </div>

        <p className="muted templateMarginTopMedium">
          Readiness: {ready ? "Ready for preview" : validation[0]}
        </p>
      </section>

      <section className="phoneMock">
        <div className="phoneState">
          <div>
            <p className="kicker">Preview Dialer</p>
            <h3 className="templateMarginTopSmall">Web Call Test</h3>
          </div>
          <span className={`badge ${callState === "live" ? "live" : "idle"}`}>{callState}</span>
        </div>

        <div className="inlineActions templateMarginBottomMedium">
          <button type="button" className="ghost" onClick={handleStopPreview} disabled={!calling && callState !== "live"}>
            Stop
          </button>
        </div>

        <div className="transcriptList">
          {transcript.length === 0 ? (
            <p className="muted">Transcript will appear here during the call.</p>
          ) : (
            transcript.map((line, idx) => (
              <div key={`${line.at}-${idx}`} className={`transcriptItem ${line.role === "user" ? "me" : ""}`}>
                <strong>{line.role === "agent" ? "Agent" : "User"}:</strong> {line.text}
              </div>
            ))
          )}
        </div>

        <p className="muted templateMarginTopMedium">{statusText}</p>
      </section>
    </div>
  );
}
