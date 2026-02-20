const VAPI_VOICE_IDS = [
  "Elliot",
  "Kylie",
  "Rohan",
  "Lily",
  "Savannah",
  "Hana",
  "Neha",
  "Cole",
  "Harry",
  "Paige",
  "Spencer",
  "Nico",
  "Kai",
  "Emma",
  "Sagar",
  "Neil",
  "Leah",
  "Tara",
  "Jess",
  "Leo",
  "Dan",
  "Mia",
  "Zac",
  "Zoe",
] as const;

const VAPI_VOICE_LOOKUP = new Map<string, string>(
  VAPI_VOICE_IDS.map((voiceId) => [voiceId.toLowerCase(), voiceId]),
);

function canonicalizeVapiVoiceId(value: string): string {
  return VAPI_VOICE_LOOKUP.get(value.toLowerCase()) ?? value;
}

function stripLocaleSuffix(label: string | undefined): string | undefined {
  if (!label) {
    return undefined;
  }

  const trimmed = label.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function normalizeVoiceSelection(
  provider: string,
  voiceId: string,
  label?: string,
): { provider: string; voiceId: string } {
  const normalizedProvider = provider.trim();
  const normalizedVoiceId = voiceId.trim();

  if (normalizedProvider.toLowerCase() !== "vapi") {
    return { provider: normalizedProvider, voiceId: normalizedVoiceId };
  }

  const canonicalFromId = canonicalizeVapiVoiceId(normalizedVoiceId);
  if (VAPI_VOICE_LOOKUP.has(canonicalFromId.toLowerCase())) {
    return { provider: "vapi", voiceId: canonicalFromId };
  }

  const baseLabel = stripLocaleSuffix(label);
  if (baseLabel) {
    const canonicalFromLabel = canonicalizeVapiVoiceId(baseLabel);
    if (VAPI_VOICE_LOOKUP.has(canonicalFromLabel.toLowerCase())) {
      return { provider: "vapi", voiceId: canonicalFromLabel };
    }
  }

  return { provider: "vapi", voiceId: normalizedVoiceId };
}
