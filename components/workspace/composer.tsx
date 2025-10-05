"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceModel } from "@/server/workspace-data";
import type { ChatMessageContent } from "@/server/orchestrator";

export type ComposerConfig = {
  modelId: string;
  thinkingEnabled: boolean;
  thinkingModelId: string;
  answerModelId: string;
  temperature: number;
  systemPrompt: string;
};

export type ComposerSubmitPayload = {
  content: ChatMessageContent;
  text: string;
  attachment?: {
    dataUrl: string;
    mimeType: string;
    name: string;
  } | null;
};

export function ChatComposer({
  models,
  config,
  onConfigChange,
  onSubmit,
  isStreaming,
  onStop,
  onCaptionImage,
  onAddModel,
  onRefreshModels,
  isRefreshingModels,
  isAddingModel,
  settingsSummary,
}: {
  models: WorkspaceModel[];
  config: ComposerConfig;
  onConfigChange: (config: ComposerConfig) => void;
  onSubmit: (payload: ComposerSubmitPayload) => Promise<void>;
  isStreaming: boolean;
  onStop: () => void;
  onCaptionImage: (file: File) => Promise<string>;
  onAddModel: (model: { id: string; displayName: string; provider?: string }) => Promise<void>;
  onRefreshModels: () => Promise<void>;
  isRefreshingModels: boolean;
  isAddingModel: boolean;
  settingsSummary: string;
}) {
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<ComposerSubmitPayload["attachment"]>(null);
  const [newModelId, setNewModelId] = useState("");
  const [newModelLabel, setNewModelLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!models.some((model) => model.id === config.modelId) && models.length > 0) {
      onConfigChange({ ...config, modelId: models[0].id, thinkingModelId: models[0].id, answerModelId: models[0].id });
    }
  }, [models, config, onConfigChange]);

  const canSubmit = useMemo(() => {
    return !isStreaming && (message.trim().length > 0 || attachment);
  }, [isStreaming, message, attachment]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const content = buildContent(message, attachment);
    await onSubmit({ content, text: message, attachment });
    setMessage("");
    setAttachment(null);
  };

  const handleAttachImage = async (file: File, autoCaption: boolean) => {
    const dataUrl = await readFileAsDataUrl(file);
    setAttachment({ dataUrl, mimeType: file.type, name: file.name });
    if (autoCaption) {
      const caption = await onCaptionImage(file);
      setMessage(caption);
    }
  };

  const handleModelSubmit = async () => {
    if (!newModelId.trim() || !newModelLabel.trim()) return;
    try {
      await onAddModel({ id: newModelId.trim(), displayName: newModelLabel.trim(), provider: "custom" });
      setNewModelId("");
      setNewModelLabel("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add model";
      alert(message);
    }
  };

  return (
    <form className="border-t p-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">
        <textarea
          className="min-h-[120px] w-full rounded border p-3 text-sm"
          placeholder="Ask anything..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={isStreaming}
        />

        {attachment && (
          <div className="flex items-center justify-between rounded border bg-muted/40 p-3 text-xs">
            <div>
              Attached image: <span className="font-medium">{attachment.name}</span>
            </div>
            <button
              type="button"
              className="underline"
              onClick={() => setAttachment(null)}
            >
              Remove
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.thinkingEnabled}
              onChange={(event) =>
                onConfigChange({ ...config, thinkingEnabled: event.target.checked })
              }
            />
            Enable thinking pipeline
          </label>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => {
              fileInputRef.current?.removeAttribute("data-caption");
              fileInputRef.current?.click();
            }}
            disabled={isStreaming}
          >
            Attach image
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => {
              fileInputRef.current?.click();
              fileInputRef.current?.setAttribute("data-caption", "true");
            }}
            disabled={isStreaming}
          >
            Caption image
          </button>
          <span className="ml-auto">{settingsSummary}</span>
        </div>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const shouldCaption = fileInputRef.current?.getAttribute("data-caption") === "true";
            fileInputRef.current?.removeAttribute("data-caption");
            await handleAttachImage(file, shouldCaption);
            event.target.value = "";
          }}
        />

        <div className="flex flex-col gap-2 rounded border p-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="uppercase text-muted-foreground">Model</span>
              <select
                className="rounded border px-2 py-1"
                value={config.modelId}
                onChange={(event) =>
                  onConfigChange({ ...config, modelId: event.target.value, answerModelId: event.target.value })
                }
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span>Temperature</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={config.temperature}
                onChange={(event) =>
                  onConfigChange({ ...config, temperature: Number(event.target.value) })
                }
                className="w-20 rounded border px-2 py-1"
              />
            </label>
          </div>

          {config.thinkingEnabled && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="uppercase text-muted-foreground">Thinking</span>
                <select
                  className="rounded border px-2 py-1"
                  value={config.thinkingModelId}
                  onChange={(event) =>
                    onConfigChange({ ...config, thinkingModelId: event.target.value })
                  }
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <span>→</span>
              <label className="flex items-center gap-2">
                <span className="uppercase text-muted-foreground">Answer</span>
                <select
                  className="rounded border px-2 py-1"
                  value={config.answerModelId}
                  onChange={(event) =>
                    onConfigChange({ ...config, answerModelId: event.target.value })
                  }
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <input
                type="text"
                className="flex-1 rounded border px-2 py-1"
                placeholder="Thinking system prompt"
                value={config.systemPrompt}
                onChange={(event) =>
                  onConfigChange({ ...config, systemPrompt: event.target.value })
                }
              />
            </div>
          )}
        </div>

        <div className="rounded border p-3 text-xs">
          <h3 className="mb-2 font-semibold uppercase">Model Manager</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="w-32 rounded border px-2 py-1"
              placeholder="model id"
              value={newModelId}
              onChange={(event) => setNewModelId(event.target.value)}
            />
            <input
              type="text"
              className="w-40 rounded border px-2 py-1"
              placeholder="display name"
              value={newModelLabel}
              onChange={(event) => setNewModelLabel(event.target.value)}
            />
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={handleModelSubmit}
              disabled={isAddingModel}
            >
              {isAddingModel ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={onRefreshModels}
              disabled={isRefreshingModels}
            >
              {isRefreshingModels ? "Syncing…" : "Sync remote"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {isStreaming ? (
            <button
              type="button"
              className="rounded border px-4 py-2 text-sm"
              onClick={onStop}
            >
              Stop
            </button>
          ) : (
            <div />
          )}
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!canSubmit}
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}

function buildContent(
  text: string,
  attachment: ComposerSubmitPayload["attachment"],
): ChatMessageContent {
  if (!attachment) {
    return text;
  }
  const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
  if (text.trim().length > 0) {
    parts.push({ type: "text", text });
  }
  parts.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
  return parts;
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
