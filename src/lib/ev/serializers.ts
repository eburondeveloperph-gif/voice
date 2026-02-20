import type { Agent, VoiceCatalog } from "@prisma/client";

type AgentWithVoice = Agent & {
  voice: VoiceCatalog;
};

export function serializeAgent(agent: AgentWithVoice) {
  return {
    id: agent.id,
    name: agent.name,
    intro: agent.intro,
    firstMessageMode: agent.firstMessageMode,
    systemPrompt: agent.systemPrompt,
    voiceId: agent.voiceId,
    voiceLabel: agent.voice.label,
    status: agent.status,
    isLocked: agent.isLocked,
    deployedAt: agent.deployedAt,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    remoteAgentId: agent.vapiAssistantId,
  };
}
