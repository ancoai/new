"use client";

import { useState } from "react";
import type { WorkspaceModel } from "@/server/workspace-data";

export function ChatComposer({
  models,
  activeConversationId,
}: {
  models: WorkspaceModel[];
  activeConversationId: string | null;
}) {
  const [message, setMessage] = useState("");
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [thinkingModel, setThinkingModel] = useState<string>(models[0]?.id ?? "");
  const [answerModel, setAnswerModel] = useState<string>(models[0]?.id ?? "");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: hook up to API mutation
    setMessage("");
    console.info("Submit", {
      message,
      activeConversationId,
      thinkingEnabled,
      thinkingModel,
      answerModel,
    });
  };

  return (
    <form className="border-t p-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3">
        <textarea
          className="min-h-[120px] w-full rounded border p-3 text-sm"
          placeholder="Ask anything..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={thinkingEnabled}
              onChange={(event) => setThinkingEnabled(event.target.checked)}
            />
            Enable thinking pipeline
          </label>
          {thinkingEnabled && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded border px-2 py-1"
                value={thinkingModel}
                onChange={(event) => setThinkingModel(event.target.value)}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
              <span>→</span>
              <select
                className="rounded border px-2 py-1"
                value={answerModel}
                onChange={(event) => setAnswerModel(event.target.value)}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Conversation: {activeConversationId ?? "New"}
          </div>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            disabled={!message.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
