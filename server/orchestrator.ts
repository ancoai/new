import type { WorkspaceMessage } from "@/server/workspace-data";
import { getDatabase } from "@/lib/database";
import { fetchChatCompletion } from "@/server/platform";

export type OrchestratorRequest = {
  conversationId?: string;
  messages: Array<Pick<WorkspaceMessage, "role" | "content">>;
  settings: {
    baseUrl?: string;
    apiKey?: string;
    model: string;
    thinking?: {
      enabled: boolean;
      thinkingModel: string;
      answerModel: string;
      systemPrompt?: string;
    };
  };
};

export type OrchestratorResponse = {
  conversationId: string;
  message: WorkspaceMessage;
  thinkingRun?: {
    modelId: string;
    output: string;
  };
};

export async function orchestrateChat(
  request: OrchestratorRequest,
): Promise<OrchestratorResponse> {
  const db = await getDatabase();
  const conversationId =
    request.conversationId ?? db.createConversation("New conversation", request.settings.model);

  let thinkingOutput: string | null = null;

  const latestUserMessage = [...request.messages]
    .reverse()
    .find((message) => message.role === "user");
  if (latestUserMessage) {
    db.insertMessage({
      conversationId,
      role: "user",
      content: latestUserMessage.content,
    });
  }

  if (request.settings.thinking?.enabled) {
    const thinkingPrompt = request.settings.thinking.systemPrompt ??
      "You are an expert reasoning assistant. Think through the user's request in detail and provide a plan.";
    const thinkingResponse = await fetchChatCompletion({
      baseUrl: request.settings.baseUrl,
      apiKey: request.settings.apiKey,
      model: request.settings.thinking.thinkingModel,
      messages: [
        { role: "system", content: thinkingPrompt },
        ...request.messages,
      ],
    });
    thinkingOutput = thinkingResponse.content;
    db.insertThinkingRun({
      conversationId,
      modelId: request.settings.thinking.thinkingModel,
      output: thinkingOutput,
    });
  }

  const answerMessages = request.settings.thinking?.enabled && thinkingOutput
    ? [
        ...request.messages,
        { role: "system", content: `Prior thinking:\n${thinkingOutput}` },
      ]
    : request.messages;

  const completion = await fetchChatCompletion({
    baseUrl: request.settings.baseUrl,
    apiKey: request.settings.apiKey,
    model: request.settings.thinking?.enabled
      ? request.settings.thinking.answerModel
      : request.settings.model,
    messages: answerMessages,
  });

  const createdAt = new Date().toISOString();
  const messageId = db.insertMessage({
    conversationId,
    role: "assistant",
    content: completion.content,
    createdAt,
  });

  return {
    conversationId,
    message: {
      id: messageId,
      conversationId,
      role: "assistant",
      content: completion.content,
      createdAt,
    },
    thinkingRun: thinkingOutput
      ? {
          modelId: request.settings.thinking!.thinkingModel,
          output: thinkingOutput,
        }
      : undefined,
  };
}
