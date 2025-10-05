"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConversationList } from "@/components/workspace/sidebar";
import { ChatComposer, type ComposerConfig, type ComposerSubmitPayload } from "@/components/workspace/composer";
import { MessageList } from "@/components/workspace/messages";
import type {
  InitialWorkspaceData,
  WorkspaceConversation,
  WorkspaceMessage,
  WorkspaceThinkingRun,
  WorkspaceModel,
} from "@/server/workspace-data";
import type { ChatMessageContent } from "@/server/orchestrator";
import { useChatSession } from "@/src/state/use-chat-session";
import { useSettings, type ClientSettings } from "@/src/state/use-settings";

const WORKSPACE_QUERY_KEY = ["workspace"] as const;

async function fetchWorkspaceData(): Promise<InitialWorkspaceData> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Failed to load workspace");
  }
  return (await response.json()) as InitialWorkspaceData;
}

export function WorkspaceShell({
  initialData,
}: {
  initialData: InitialWorkspaceData;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: WORKSPACE_QUERY_KEY,
    queryFn: fetchWorkspaceData,
    initialData,
    refetchOnWindowFocus: false,
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialData.conversations[0]?.id ?? null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, saveSettings, isSaving } = useSettings();
  const [settingsDraft, setSettingsDraft] = useState(settings);

  useEffect(() => {
    setSettingsDraft(settings);
  }, [settings]);

  const { sendChat, stop, state: streamState, resetError } = useChatSession();

  const models = workspaceQuery.data?.models ?? [];
  const conversations = workspaceQuery.data?.conversations ?? [];
  const thinkingRunsMap = workspaceQuery.data?.thinkingRuns ?? {};

  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const activeThinkingRuns = (activeConversationId && thinkingRunsMap[activeConversationId]) || [];

  const [composerConfig, setComposerConfig] = useState<ComposerConfig>(() => ({
    modelId: settings.model ?? models[0]?.id ?? "",
    thinkingEnabled: false,
    thinkingModelId: models[0]?.id ?? "",
    answerModelId: settings.model ?? models[0]?.id ?? "",
    temperature: 0.7,
    systemPrompt: settings.thinkingPrompt ?? "",
  }));

  const updateWorkspace = (updater: (current: InitialWorkspaceData) => InitialWorkspaceData) => {
    queryClient.setQueryData<InitialWorkspaceData>(WORKSPACE_QUERY_KEY, (current) =>
      current ? updater(current) : current,
    );
  };

  useEffect(() => {
    if (!composerConfig.modelId && models[0]) {
      setComposerConfig((config) => ({
        ...config,
        modelId: models[0]!.id,
        thinkingModelId: models[0]!.id,
        answerModelId: models[0]!.id,
      }));
    }
  }, [models, composerConfig.modelId]);

  useEffect(() => {
    setComposerConfig((config) => {
      let next = config;
      if (settings.model && settings.model !== config.modelId) {
        next = {
          ...next,
          modelId: settings.model,
          answerModelId: settings.model,
        };
      }
      if (settings.thinkingPrompt && settings.thinkingPrompt !== config.systemPrompt) {
        next = { ...next, systemPrompt: settings.thinkingPrompt };
      }
      return next === config ? config : next;
    });
  }, [settings.model, settings.thinkingPrompt]);

  const createConversationMutation = useMutation({
    mutationFn: async (modelId: string) => {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, title: "Untitled conversation" }),
      });
      if (!response.ok) {
        throw new Error("Failed to create conversation");
      }
      return (await response.json()) as { id: string; conversation: WorkspaceConversation };
    },
    onSuccess(result) {
      updateWorkspace((current) => {
        const conversations = [
          result.conversation,
          ...current.conversations.filter((item) => item.id !== result.conversation.id),
        ];
        const thinkingRuns = {
          ...current.thinkingRuns,
          [result.conversation.id]: current.thinkingRuns[result.conversation.id] ?? [],
        };
        return { ...current, conversations, thinkingRuns };
      });
      setActiveConversationId(result.conversation.id);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        throw new Error("Failed to delete conversation");
      }
      return conversationId;
    },
    onSuccess(id) {
      updateWorkspace((current) => {
        const conversations = current.conversations.filter((item) => item.id !== id);
        const thinkingRuns = { ...current.thinkingRuns };
        delete thinkingRuns[id];
        return { ...current, conversations, thinkingRuns };
      });
      setActiveConversationId((current) => (current === id ? null : current));
    },
  });

  const renameConversationMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        throw new Error("Failed to rename conversation");
      }
      return (await response.json()) as { conversation: WorkspaceConversation };
    },
    onSuccess(result) {
      updateWorkspace((current) => {
        const conversations = current.conversations.map((conversation) =>
          conversation.id === result.conversation.id ? result.conversation : conversation,
        );
        return { ...current, conversations };
      });
    },
  });

  const addModelMutation = useMutation({
    mutationFn: async (model: { id: string; displayName: string; provider?: string }) => {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(model),
      });
      if (!response.ok) {
        throw new Error("Failed to add model");
      }
      return (await response.json()) as { models: WorkspaceModel[] };
    },
    onSuccess(data) {
      updateWorkspace((current) => ({ ...current, models: data.models }));
    },
  });

  const refreshModelsMutation = useMutation({
    mutationFn: async () => {
      if (!settings.apiKeySet) {
      if (!settings.apiKey) {
        throw new Error("API key required to sync models");
      }
      const params = new URLSearchParams({ refresh: "1" });
      if (settings.baseUrl) params.set("baseUrl", settings.baseUrl);
      params.set("apiKey", settings.apiKey);
      const response = await fetch(`/api/models?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to refresh models");
      }
      return (await response.json()) as { models: WorkspaceModel[] };
    },
    onSuccess(data) {
      updateWorkspace((current) => ({ ...current, models: data.models }));
    },
  });

  const captionImageMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!settings.apiKeySet) {
      if (!settings.apiKey) {
        throw new Error("API key required for image captioning");
      }
      const base64 = await readFileAsBase64(file);
      const response = await fetch("/api/media/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mimeType: file.type,
          settings: {
            baseUrl: settings.baseUrl,
            apiKey: settings.apiKey,
            model: composerConfig.thinkingEnabled ? composerConfig.thinkingModelId : composerConfig.modelId,
          },
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to caption image");
      }
      const data = (await response.json()) as { caption: string };
      return data.caption;
    },
  });

  const ensureConversation = async (modelId: string) => {
    if (activeConversationId) return activeConversationId;
    const result = await createConversationMutation.mutateAsync(modelId);
    return result.conversation.id;
  };

  const handleSubmit = async (payload: ComposerSubmitPayload) => {
    try {
      const targetModel = composerConfig.thinkingEnabled
        ? composerConfig.answerModelId
        : composerConfig.modelId;
      if (!targetModel) {
        alert("Select a model before sending a message");
        return;
      }
      const conversationId = await ensureConversation(targetModel);
      setActiveConversationId(conversationId);

      const modelLabel = models.find((model) => model.id === targetModel)?.displayName ?? targetModel;

      const conversation = queryClient.getQueryData<InitialWorkspaceData>(WORKSPACE_QUERY_KEY)?.conversations.find((item) => item.id === conversationId);
      const history = conversation?.messages ?? [];
      const chatMessages = history.map((message) => ({
        role: message.role,
        content: messageToChatContent(message),
      }));
      chatMessages.push({ role: "user", content: payload.content });

      optimisticInsertUserMessage(conversationId, payload, targetModel, modelLabel);

      await sendChat({
        conversationId,
        messages: chatMessages,
        settings: {
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: composerConfig.modelId,
          temperature: composerConfig.temperature,
          thinking: composerConfig.thinkingEnabled
            ? {
                enabled: true,
                thinkingModel: composerConfig.thinkingModelId,
                answerModel: composerConfig.answerModelId,
                systemPrompt: composerConfig.systemPrompt || undefined,
              }
            : undefined,
        },
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to send message");
      resetError();
    }
  };

  const handleRegenerate = async (messageId: string) => {
    if (!activeConversation) return;
    const index = activeConversation.messages.findIndex((message) => message.id === messageId);
    if (index === -1) return;
    const history = activeConversation.messages.slice(0, index).map((message) => ({
      role: message.role,
      content: messageToChatContent(message),
    }));
    try {
      await sendChat({
        conversationId: activeConversation.id,
        messages: history,
        settings: {
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: composerConfig.modelId,
          temperature: composerConfig.temperature,
          thinking: composerConfig.thinkingEnabled
            ? {
                enabled: true,
                thinkingModel: composerConfig.thinkingModelId,
                answerModel: composerConfig.answerModelId,
                systemPrompt: composerConfig.systemPrompt || undefined,
              }
            : undefined,
        },
        regenerateMessageId: messageId,
      });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to regenerate response");
      resetError();
    }
  };

  const optimisticInsertUserMessage = (
    conversationId: string,
    payload: ComposerSubmitPayload,
    modelId: string,
    modelLabel: string,
  ) => {
    const now = new Date().toISOString();
    const messageText = typeof payload.content === "string" ? payload.content : extractText(payload.content);
    const metadata = payload.attachment
      ? { attachments: [{ url: payload.attachment.dataUrl, name: payload.attachment.name }] }
      : null;

    updateWorkspace((current) => {
      const conversations = current.conversations.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const messages: WorkspaceMessage[] = [
          ...conversation.messages,
          {
            id: `temp-${now}`,
            conversationId,
            role: "user",
            content: messageText,
            createdAt: now,
            metadata,
          },
        ];
        return { ...conversation, messages, modelId, modelLabel };
      });
      return { ...current, conversations };
    });
  };

  const settingsSummary = buildSettingsSummary(settings);

  const handleSettingsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const submission: ClientSettings = {};
      const draftBaseUrl = settingsDraft.baseUrl ?? "";
      const currentBaseUrl = settings.baseUrl ?? "";
      if (draftBaseUrl.trim() !== currentBaseUrl.trim()) {
        submission.baseUrl = draftBaseUrl.trim() ? draftBaseUrl.trim() : "";
      }
      const draftModel = settingsDraft.model ?? "";
      const currentModel = settings.model ?? "";
      if (draftModel.trim() !== currentModel.trim()) {
        submission.model = draftModel.trim() ? draftModel.trim() : "";
      }
      const draftPrompt = settingsDraft.thinkingPrompt ?? "";
      const currentPrompt = settings.thinkingPrompt ?? "";
      if (draftPrompt !== currentPrompt) {
        submission.thinkingPrompt = draftPrompt;
      }
      if (settingsDraft.apiKey && settingsDraft.apiKey.trim().length > 0) {
        submission.apiKey = settingsDraft.apiKey;
      }
      if (settingsDraft.clearApiKey) {
        submission.clearApiKey = true;
      }

      await saveSettings(submission);
      await saveSettings(settingsDraft);
      setSettingsOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save settings");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr]">
      <aside className="border-r">
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={setActiveConversationId}
          onCreate={() => {
            const targetModel = composerConfig.thinkingEnabled
              ? composerConfig.answerModelId
              : composerConfig.modelId || models[0]?.id;
            if (!targetModel) {
              alert("Select a model before creating a conversation");
              return;
            }
            createConversationMutation.mutate(targetModel);
          }}
          onDelete={(id) => deleteConversationMutation.mutate(id)}
          onRename={(id, title) => renameConversationMutation.mutate({ id, title })}
          isCreating={createConversationMutation.isPending}
        />
      </aside>
      <main className="flex flex-col">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">{activeConversation?.title ?? "New conversation"}</h1>
            <p className="text-xs text-muted-foreground">{settingsSummary}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              {settingsOpen ? "Close settings" : "Settings"}
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={() => setSettingsOpen((value) => !value)}
          >
            {settingsOpen ? "Close settings" : "Settings"}
          </button>
        </header>

        {settingsOpen && (
          <section className="border-b bg-muted/30 px-6 py-4 text-sm">
            <form className="flex flex-col gap-3" onSubmit={handleSettingsSubmit}>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-muted-foreground">Base URL</span>
                <input
                  type="url"
                  className="rounded border px-2 py-1"
                  placeholder="https://api.openai.com/v1"
                  value={settingsDraft.baseUrl ?? ""}
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-muted-foreground">API Key</span>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    className="flex-1 rounded border px-2 py-1"
                    placeholder={settings.apiKeySet && !settingsDraft.clearApiKey ? "••••••••" : ""}
                    value={settingsDraft.apiKey ?? ""}
                    onChange={(event) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        apiKey: event.target.value,
                        clearApiKey: false,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="rounded border px-3 py-1 text-xs"
                    onClick={() =>
                      setSettingsDraft((prev) => ({ ...prev, apiKey: "", clearApiKey: true }))
                    }
                    disabled={!settings.apiKeySet}
                  >
                    Clear stored key
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.apiKeySet
                    ? settingsDraft.clearApiKey
                      ? "Stored key will be removed on save."
                      : "An API key is stored securely on the server."
                    : "No API key stored yet."}
                </p>
                <input
                  type="password"
                  className="rounded border px-2 py-1"
                  value={settingsDraft.apiKey ?? ""}
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-muted-foreground">Default Model</span>
                <input
                  type="text"
                  className="rounded border px-2 py-1"
                  value={settingsDraft.model ?? ""}
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, model: event.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase text-muted-foreground">Default Thinking Prompt</span>
                <textarea
                  className="min-h-[80px] rounded border px-2 py-1"
                  value={settingsDraft.thinkingPrompt ?? ""}
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, thinkingPrompt: event.target.value }))}
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </section>
        )}

        <MessageList
          messages={activeConversation?.messages ?? []}
          thinkingRuns={activeThinkingRuns as WorkspaceThinkingRun[]}
          streamingMessage={streamState.message}
          streamingThinking={streamState.thinking}
          isStreaming={streamState.isStreaming}
          onRegenerate={handleRegenerate}
        />
        <ChatComposer
          models={models}
          config={composerConfig}
          onConfigChange={setComposerConfig}
          onSubmit={handleSubmit}
          isStreaming={streamState.isStreaming}
          onStop={stop}
          onCaptionImage={async (file) => {
            try {
              return await captionImageMutation.mutateAsync(file);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to caption image";
              alert(message);
              throw error;
            }
          }}
          onAddModel={(model) => addModelMutation.mutateAsync(model)}
          onRefreshModels={async () => {
            try {
              await refreshModelsMutation.mutateAsync();
            } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to sync models";
              alert(message);
            }
          }}
          isRefreshingModels={refreshModelsMutation.isPending}
          isAddingModel={addModelMutation.isPending}
          settingsSummary={settingsSummary}
        />
      </main>
    </div>
  );
}

function messageToChatContent(message: WorkspaceMessage): ChatMessageContent {
  if (message.metadata?.attachments && Array.isArray(message.metadata.attachments)) {
    const parts: ChatMessageContent = [
      { type: "text", text: message.content },
      ...message.metadata.attachments.map((attachment: any) => ({
        type: "image_url" as const,
        image_url: { url: typeof attachment === "string" ? attachment : attachment.url },
      })),
    ];
    return parts;
  }
  return message.content;
}

function extractText(content: ChatMessageContent): string {
  if (typeof content === "string") return content;
  return content
    .map((item) => (item.type === "text" ? item.text : ""))
    .filter(Boolean)
    .join("\n");
}

function buildSettingsSummary(settings: ClientSettings): string {
  const base = settings.baseUrl?.trim() ? settings.baseUrl : "OpenAI";
  const key = settings.apiKeySet ? "stored" : "not stored";
  const key = settings.apiKey ? "set" : "not set";
  return `Endpoint: ${base} · API key: ${key}`;
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const [, base64] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
