import type { Agent, VoiceCatalog } from "@prisma/client";

import { normalizeVoiceSelection } from "@/lib/ev/vapi-voice";

type AgentInputLike = Pick<Agent, "name" | "intro" | "firstMessageMode" | "systemPrompt">;

type BuildAssistantTemplateOptions = {
  credentialIds?: string[];
};

export function buildAssistantTemplate(
  agent: AgentInputLike,
  voice: VoiceCatalog,
  options: BuildAssistantTemplateOptions = {},
) {
  const firstMessageMode =
    agent.firstMessageMode === "assistant-waits-for-user"
      ? "assistant-waits-for-user"
      : "assistant-speaks-first";

  const voiceSelection = normalizeVoiceSelection(
    voice.upstreamProvider,
    voice.upstreamVoiceId,
    voice.label,
  );

  const template: Record<string, unknown> = {
    name: agent.name,
    firstMessage: agent.intro,
    firstMessageMode,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: agent.systemPrompt }],
      temperature: 0.4,
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-3",
      language: "en-US",
    },
    voice: voiceSelection,
    endCallMessage: "Thanks for calling Eburon Voice. Goodbye.",
    recordingEnabled: true,
    maxDurationSeconds: 900,
  };

  if (options.credentialIds && options.credentialIds.length > 0) {
    template.credentialIds = Array.from(new Set(options.credentialIds));
  }

  return template;
}
