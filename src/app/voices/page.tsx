"use client";

import { useEffect, useRef, useState } from "react";

import { apiRequest } from "@/lib/client/api";

import "./voices.css";

type Voice = {
  id: string;
  label: string;
  locale: string;
  previewSampleUrl?: string;
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

interface PreviewState {
  voiceId: string;
  name: string;
  isVisible: boolean;
  message: string;
}

export default function VoicesPage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vapiRef = useRef<VapiClient | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadVoices = (sync = false) => {
    setLoading(true);
    apiRequest<{ voices: Voice[] }>(`/api/ev/voice/voices?sync=${sync}`)
      .then((payload) => {
        setVoices(payload.voices);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadVoices(true);

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
      if (vapiRef.current) {
        void vapiRef.current.stop();
        vapiRef.current = null;
      }
    };
  }, []);

  const stopLivePreview = async () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    if (vapiRef.current) {
      try {
        await vapiRef.current.stop();
      } finally {
        vapiRef.current = null;
      }
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiRequest("/api/ev/voice/voices/sync", { method: "POST" });
      loadVoices(false);
    } catch {
      setError("Failed to sync voices");
    } finally {
      setSyncing(false);
    }
  };

  const handlePlayPreview = async (voice: Voice) => {
    setError(null);
    await stopLivePreview();

    if (voice.previewSampleUrl) {
      try {
        if (audioRef.current) {
          audioRef.current.src = voice.previewSampleUrl;
          await audioRef.current.play();
        }

        setPreview({
          voiceId: voice.id,
          name: voice.label,
          isVisible: true,
          message: "Playing preview sample.",
        });

        setTimeout(() => {
          setPreview((prev) => (prev?.voiceId === voice.id ? { ...prev, isVisible: false } : prev));
        }, 5000);
      } catch {
        setError("Failed to play preview sample.");
      }

      return;
    }

    try {
      const config = await apiRequest<VoicePreviewConfigResponse>(
        `/api/ev/voice/voices/preview-config?voiceId=${encodeURIComponent(voice.id)}`,
      );

      const mod = await import("@vapi-ai/web");
      const Vapi = mod.default as unknown as new (publicKey: string) => VapiClient;
      const client = new Vapi(config.preview.publicKey);
      vapiRef.current = client;

      setPreview({
        voiceId: voice.id,
        name: voice.label,
        isVisible: true,
        message: "Running live call preview.",
      });

      client.on("call-end", () => {
        if (vapiRef.current === client) {
          vapiRef.current = null;
        }
        setPreview((prev) => (prev?.voiceId === voice.id ? { ...prev, isVisible: false } : prev));
      });

      client.on("error", () => {
        setError("Live preview failed for this voice.");
        if (vapiRef.current === client) {
          vapiRef.current = null;
        }
        setPreview((prev) => (prev?.voiceId === voice.id ? { ...prev, isVisible: false } : prev));
      });

      await client.start(config.preview.assistantId, config.preview.assistantOverrides);

      previewTimeoutRef.current = setTimeout(() => {
        void stopLivePreview();
        setPreview((prev) => (prev?.voiceId === voice.id ? { ...prev, isVisible: false } : prev));
      }, config.preview.timeoutSeconds * 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Preview is unavailable for this voice.";
      setError(message);
      setPreview((prev) => (prev?.voiceId === voice.id ? { ...prev, isVisible: false } : prev));
    }
  };

  return (
    <div className="voicesPage">
      <audio ref={audioRef} hidden />

      <header className="voicesHead">
        <div>
          <h1 className="voicesTitle">Voices</h1>
          <p className="voicesSubtitle">Explore and preview the voice catalog available for your agents.</p>
        </div>
        <button className="secondary syncBtn" onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync Voice Catalog"}
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p className="muted">Loading voice catalog...</p>
      ) : (
        <section className="voicesGrid">
          {voices.map((voice) => (
            <article key={voice.id} className="voiceCard">
              <div className="voiceCardTop">
                <div>
                  <h3 className="voiceName">{voice.label}</h3>
                  <p className="voiceId">{voice.id}</p>
                </div>
                <span className="voiceLocale">{voice.locale}</span>
              </div>

              <div className="voiceActions">
                <button
                  className={`playBtn ${preview?.voiceId === voice.id && preview.isVisible ? "playing" : ""}`}
                  onClick={() => handlePlayPreview(voice)}
                >
                  <span className="playIcon">{preview?.voiceId === voice.id && preview.isVisible ? "🔊" : "▶"}</span>
                  Preview Voice
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {preview && preview.isVisible && (
        <div className="previewNotification">
          <div className="notifIcon">🎙️</div>
          <div className="notifContent">
            <h4>Voice Preview: {preview.name}</h4>
            <p>{preview.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
