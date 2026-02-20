import { z } from "zod";

const forbiddenKeyPattern = /(llm|stt|tts|provider|model|transcriber)/i;
export const firstMessageModeSchema = z.enum(["assistant-speaks-first", "assistant-waits-for-user"]);

export const agentInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  intro: z.string().trim().min(4).max(500),
  systemPrompt: z.string().trim().min(20).max(5000),
  voiceId: z.string().trim().min(2).max(120),
  firstMessageMode: firstMessageModeSchema.optional(),
}).strict();

export function rejectForbiddenKeys(raw: Record<string, unknown>): void {
  for (const key of Object.keys(raw)) {
    if (forbiddenKeyPattern.test(key)) {
      throw Object.assign(
        new Error(`Field '${key}' is not editable in this builder.`),
        { status: 400 },
      );
    }
  }
}
