import { getDatabase } from "@/lib/database";
import { getModelStore } from "@/lib/model-store";

export type WorkspaceModel = {
  id: string;
  displayName: string;
  provider: string;
  updatedAt: string;
};

export type WorkspaceMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type WorkspaceConversation = {
  id: string;
  title: string;
  modelId: string;
  modelLabel: string;
  createdAt: string;
  updatedAt: string;
  messages: WorkspaceMessage[];
};

export type WorkspaceThinkingRun = {
  id: string;
  conversationId: string;
  modelId: string;
  output: string;
  createdAt: string;
  messageId: string | null;
};

export type InitialWorkspaceData = {
  models: WorkspaceModel[];
  conversations: WorkspaceConversation[];
  thinkingRuns: Record<string, WorkspaceThinkingRun[]>;
};

export async function fetchInitialWorkspaceData(): Promise<InitialWorkspaceData> {
  const db = await getDatabase();
  const modelStore = await getModelStore();

  const models = modelStore.listModels();
  const modelMap = new Map(models.map((model) => [model.id, model]));
  const conversations = db
    .listConversations()
    .map((conversation) => ({
      ...conversation,
      modelLabel: modelMap.get(conversation.modelId)?.displayName ?? conversation.modelId,
    }));
  const thinkingRuns = db.listThinkingRuns();

  return {
    models,
    conversations,
    thinkingRuns,
  };
}
