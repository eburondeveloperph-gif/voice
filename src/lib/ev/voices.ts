import { prisma } from "@/lib/db";
import { normalizeVoiceSelection } from "@/lib/ev/vapi-voice";
import { upstream } from "@/lib/ev/vapi-client";
import { backupVoice as syncVoiceToSupabase } from "@/lib/ev/backup";

type VoiceLike = Record<string, unknown>;

type SyncedVoice = {
  id: string;
  label: string;
  locale: string;
  previewSampleUrl?: string;
  upstreamProvider: string;
  upstreamVoiceId: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeVoicePayload(payload: unknown): VoiceLike[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is VoiceLike => typeof item === "object" && item !== null);
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.voices, record.items, record.results, record.data];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is VoiceLike => typeof item === "object" && item !== null);
    }
  }

  return [];
}

function voiceLocale(voice: VoiceLike): string {
  const locale = asString(voice.locale) ?? asString(voice.language);
  if (locale) {
    return locale;
  }

  const accent = asString(voice.accent)?.toLowerCase() ?? "";
  if (accent.includes("british")) return "en-GB";
  if (accent.includes("indian")) return "en-IN";
  if (accent.includes("canadian")) return "en-CA";
  if (accent.includes("australian")) return "en-AU";
  return "en-US";
}

function toCatalogId(raw: string): string {
  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `orbit-${slug || "voice"}`;
}

function normalizeVoice(voice: VoiceLike): SyncedVoice | null {
  const rawProvider = asString(voice.provider) ?? "vapi";
  const rawVoiceId =
    asString(voice.providerId) ?? asString(voice.slug) ?? asString(voice.name) ?? asString(voice.id);

  if (!rawVoiceId) {
    return null;
  }

  const label = asString(voice.name) ?? rawVoiceId;
  const normalizedVoice = normalizeVoiceSelection(rawProvider, rawVoiceId, label);
  const catalogId = toCatalogId(normalizedVoice.voiceId);

  return {
    id: catalogId,
    label,
    locale: voiceLocale(voice),
    previewSampleUrl: asString(voice.previewUrl),
    upstreamProvider: normalizedVoice.provider,
    upstreamVoiceId: normalizedVoice.voiceId,
  };
}

export async function syncVoicesFromUpstream(provider = "vapi"): Promise<SyncedVoice[]> {
  const payload = await upstream.listVoicesByProvider(provider);
  const records = normalizeVoicePayload(payload);

  const deduped = new Map<string, SyncedVoice>();
  for (const record of records) {
    if (asBoolean(record.isDeleted) === true) {
      continue;
    }

    const normalized = normalizeVoice(record);
    if (!normalized) {
      continue;
    }

    deduped.set(normalized.id, normalized);
  }

  const voices = Array.from(deduped.values()).sort((a, b) => a.label.localeCompare(b.label));
  const syncedIds = voices.map((voice) => voice.id);

  if (syncedIds.length > 0) {
    await prisma.voiceCatalog.updateMany({
      where: {
        upstreamProvider: provider,
        id: { notIn: syncedIds },
      },
      data: {
        isApproved: false,
      },
    });
  } else {
    await prisma.voiceCatalog.updateMany({
      where: {
        upstreamProvider: provider,
      },
      data: {
        isApproved: false,
      },
    });
  }

  await Promise.all(
    voices.map(async (voice, index) => {
      const record = await prisma.voiceCatalog.upsert({
        where: { id: voice.id },
        update: {
          label: voice.label,
          locale: voice.locale,
          upstreamProvider: voice.upstreamProvider,
          upstreamVoiceId: voice.upstreamVoiceId,
          previewSampleUrl: voice.previewSampleUrl,
          isApproved: true,
          sortOrder: 100 + index,
        },
        create: {
          id: voice.id,
          label: voice.label,
          locale: voice.locale,
          upstreamProvider: voice.upstreamProvider,
          upstreamVoiceId: voice.upstreamVoiceId,
          previewSampleUrl: voice.previewSampleUrl,
          isApproved: true,
          sortOrder: 100 + index,
        },
      });

      // Fire-and-forget Supabase backup
      void syncVoiceToSupabase(record).catch(() => { });
    }),
  );

  return voices;
}
