import { NextRequest } from "next/server";
import { z } from "zod";
import { orchestrateChat } from "@/server/orchestrator";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
});

const requestSchema = z.object({
  conversationId: z.string().optional(),
  messages: z.array(messageSchema),
  settings: z.object({
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    thinking: z
      .object({
        enabled: z.boolean(),
        thinkingModel: z.string(),
        answerModel: z.string(),
        systemPrompt: z.string().optional(),
      })
      .optional(),
    model: z.string(),
  }),
});

export async function POST(request: NextRequest) {
  const json = await request.json();
  const body = requestSchema.parse(json);
  const result = await orchestrateChat(body);
  return Response.json(result);
}
