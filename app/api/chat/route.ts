import { NextRequest } from "next/server";
import { z } from "zod";
import { orchestrateChat, type ChatMessageContent } from "@/server/orchestrator";
import { getDatabase } from "@/lib/database";
import { getSessionUser } from "@/lib/auth";

const textContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const imageContentSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string(),
    detail: z.enum(["auto", "low", "high"]).optional(),
  }),
});

const messageContentSchema: z.ZodType<ChatMessageContent> = z.union([
  z.string(),
  z.array(z.union([textContentSchema, imageContentSchema])),
]);

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: messageContentSchema,
});

const requestSchema = z.object({
  conversationId: z.string().optional(),
  messages: z.array(messageSchema).min(1),
  settings: z.object({
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    model: z.string(),
    temperature: z.number().min(0).max(2).optional(),
    thinking: z
      .object({
        enabled: z.boolean(),
        thinkingModel: z.string(),
        answerModel: z.string(),
        systemPrompt: z.string().optional(),
      })
      .optional(),
  }),
  regenerateMessageId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await request.json();
  const body = requestSchema.parse(json);
  const db = await getDatabase();
  const userSettings = db.getUserSettings(user.id);
  if (!userSettings.apiKey) {
    return Response.json({ error: "Missing API key" }, { status: 400 });
  }

  const payload = {
    ...body,
    settings: {
      ...body.settings,
      baseUrl: body.settings.baseUrl ?? userSettings.baseUrl ?? undefined,
      apiKey: userSettings.apiKey,
    },
  };
  const json = await request.json();
  const body = requestSchema.parse(json);
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const sendError = (message: string) => {
        send("error", { message });
      };

      try {
        send("status", { stage: "starting" });
        const result = await orchestrateChat(payload, {
        const result = await orchestrateChat(body, {
          onThinkingToken: (token) => {
            if (token.trim().length > 0) {
              send("thinking_delta", { delta: token });
            }
          },
          onAnswerToken: (token) => {
            send("message_delta", { delta: token });
          },
          signal: abortController.signal,
        });

        if (result.thinkingRun) {
          send("thinking_complete", result.thinkingRun);
        }

        send("message_complete", result.message);

        const db = await getDatabase();
        const conversation = db.getConversation(result.conversationId);
        if (conversation) {
          send("conversation", conversation);
        }

        send("done", { conversationId: result.conversationId });
        controller.close();
      } catch (error) {
        if (abortController.signal.aborted) {
          send("stopped", {});
        } else {
          const message = error instanceof Error ? error.message : "Unknown error";
          sendError(message);
        }
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
