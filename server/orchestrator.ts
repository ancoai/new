import type { WorkspaceMessage, WorkspaceThinkingRun } from "@/server/workspace-data";
import { getDatabase } from "@/lib/database";
import { fetchChatCompletion } from "@/server/platform";

export type ChatMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
    >;

export type OrchestratorRequest = {
  conversationId?: string;
  messages: Array<{ role: WorkspaceMessage["role"]; content: ChatMessageContent }>;
  settings: {
    baseUrl?: string;
    apiKey?: string;
    model: string;
    temperature?: number;
    thinking?: {
      enabled: boolean;
      thinkingModel: string;
      answerModel: string;
      systemPrompt?: string;
    };
  };
  regenerateMessageId?: string;
};

export type OrchestratorResponse = {
  conversationId: string;
  message: WorkspaceMessage;
  thinkingRun?: WorkspaceThinkingRun;
};

export type OrchestratorCallbacks = {
  onThinkingToken?: (token: string) => void;
  onAnswerToken?: (token: string) => void;
  signal?: AbortSignal;
};

const DEFAULT_SYSTEM_PROMPT =
  "You are an expert reasoning assistant. Think through the user's request in detail and provide a plan.";

const DEFAULT_CONVERSATION_TITLE = "Untitled conversation";

export async function orchestrateChat(
  request: OrchestratorRequest,
  callbacks: OrchestratorCallbacks = {},
): Promise<OrchestratorResponse> {
  const db = await getDatabase();
  const finalModel = request.settings.thinking?.enabled
    ? request.settings.thinking.answerModel
    : request.settings.model;

  const conversationId =
    request.conversationId ?? db.createConversation(DEFAULT_CONVERSATION_TITLE, finalModel);

  // persist the active model selection on the conversation record
  db.updateConversationModel(conversationId, finalModel);

  if (request.regenerateMessageId) {
    const message = db.getMessage(request.regenerateMessageId);
    if (message) {
      db.deleteThinkingRunsAfter(conversationId, message.createdAt);
      db.deleteMessagesAfter(conversationId, message.createdAt);
    }
  }

  const latestUserMessage = [...request.messages].reverse().find((message) => message.role === "user");
  if (!request.regenerateMessageId && latestUserMessage) {
    const insertedId = db.insertMessage({
      conversationId,
      role: "user",
      content: typeof latestUserMessage.content === "string"
        ? latestUserMessage.content
        : extractTextFromContent(latestUserMessage.content),
      metadata: buildMetadata(latestUserMessage.content),
    });

    if (latestUserMessage && shouldDeriveTitle(latestUserMessage.content)) {
      const snippet = deriveTitle(latestUserMessage.content);
      db.updateConversationTitle(conversationId, snippet);
    }

    // ensure metadata stored for structured content (e.g., image attachments)
    if (Array.isArray(latestUserMessage.content)) {
      db.updateMessageMetadata(insertedId, buildMetadata(latestUserMessage.content));
    }
  }

  let thinkingOutput: string | null = null;
  let thinkingRunId: string | null = null;
  let lastThinkingCreatedAt: string | null = null;

  const thinkingConfig = request.settings.thinking;
  if (thinkingConfig?.enabled) {
    const thinkingPrompt = thinkingConfig.systemPrompt?.trim().length
      ? thinkingConfig.systemPrompt
      : DEFAULT_SYSTEM_PROMPT;

    const thinkingResponse = await fetchChatCompletion({
      baseUrl: request.settings.baseUrl,
      apiKey: request.settings.apiKey,
      model: thinkingConfig.thinkingModel,
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
      temperature: request.settings.temperature,
      onToken: callbacks.onThinkingToken,
      signal: callbacks.signal,
    });

    thinkingOutput = thinkingResponse.content;
    const thinkingCreatedAt = new Date().toISOString();
    thinkingRunId = db.insertThinkingRun({
      conversationId,
      modelId: thinkingConfig.thinkingModel,
      output: thinkingOutput,
      systemPrompt: thinkingPrompt,
      createdAt: thinkingCreatedAt,
    });
    lastThinkingCreatedAt = thinkingCreatedAt;
  }

  const answerMessages =
    thinkingConfig?.enabled && thinkingOutput
      ? [
          ...request.messages,
          { role: "system", content: `Prior thinking:\n${thinkingOutput}` },
        ]
      : request.messages;

  const completion = await fetchChatCompletion({
    baseUrl: request.settings.baseUrl,
    apiKey: request.settings.apiKey,
    model: finalModel,
    messages: answerMessages,
    temperature: request.settings.temperature,
    onToken: callbacks.onAnswerToken,
    signal: callbacks.signal,
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
    metadata: null,
    createdAt,
  });

  if (thinkingRunId) {
    db.updateThinkingRunMessage(thinkingRunId, messageId);
  }

  const message: WorkspaceMessage = {
    id: messageId,
    conversationId,
    role: "assistant",
    content: completion.content,
    createdAt,
    metadata: null,
  };

  const thinkingRun: WorkspaceThinkingRun | undefined = thinkingRunId
    ? {
        id: thinkingRunId,
        conversationId,
        modelId: thinkingConfig!.thinkingModel,
        output: thinkingOutput ?? "",
        createdAt: lastThinkingCreatedAt ?? createdAt,
        messageId,
      }
    : undefined;

  return {
    conversationId,
    message,
    thinkingRun,
  };
}

function extractTextFromContent(content: ChatMessageContent): string {
  if (typeof content === "string") return content;
  return content
    .map((item) => {
      if (item.type === "text") {
        return item.text;
      }
      if (item.type === "image_url") {
        return "[Image]";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildMetadata(content: ChatMessageContent): Record<string, unknown> | null {
  if (typeof content === "string") return null;
  const attachments = content
    .filter((item): item is { type: "image_url"; image_url: { url: string; detail?: string } } => item.type === "image_url")
    .map((item) => item.image_url);
  if (attachments.length === 0) {
    return null;
  }
  return { attachments };
}

function shouldDeriveTitle(content: ChatMessageContent): boolean {
  if (typeof content === "string") {
    return content.trim().length > 0;
  }
  return content.some((item) => (item.type === "text" ? item.text.trim().length > 0 : false));
}

function deriveTitle(content: ChatMessageContent): string {
  const text = extractTextFromContent(content).replace(/\s+/g, " ").trim();
  if (!text) {
    return DEFAULT_CONVERSATION_TITLE;
  }
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
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
