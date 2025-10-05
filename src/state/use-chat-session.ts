"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessageContent } from "@/server/orchestrator";
import type {
  InitialWorkspaceData,
  WorkspaceConversation,
  WorkspaceMessage,
  WorkspaceThinkingRun,
} from "@/server/workspace-data";

export type SendChatPayload = {
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

export type StreamingState = {
  isStreaming: boolean;
  message: string;
  thinking: string;
  error: string | null;
};

const initialStreamingState: StreamingState = {
  isStreaming: false,
  message: "",
  thinking: "",
  error: null,
};

export function useChatSession() {
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<StreamingState>(initialStreamingState);

  const updateWorkspace = useCallback(
    (updater: (current: InitialWorkspaceData | undefined) => InitialWorkspaceData | undefined) => {
      queryClient.setQueryData<InitialWorkspaceData | undefined>(["workspace"], updater);
    },
    [queryClient],
  );

  const sendChat = useCallback(
    async (payload: SendChatPayload) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ isStreaming: true, message: "", thinking: "", error: null });

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error("Chat request failed");
        }

        await readEventStream(response.body, (event, data) => {
          switch (event) {
            case "thinking_delta": {
              setState((prev) => ({ ...prev, thinking: prev.thinking + (data?.delta ?? "") }));
              break;
            }
            case "thinking_complete": {
              const run = data as WorkspaceThinkingRun;
              updateWorkspace((current) => {
                if (!current) return current;
                const thinkingRuns = { ...current.thinkingRuns };
                const existing = thinkingRuns[run.conversationId] ?? [];
                thinkingRuns[run.conversationId] = [...existing.filter((item) => item.id !== run.id), run];
                return { ...current, thinkingRuns };
              });
              break;
            }
            case "message_delta": {
              setState((prev) => ({ ...prev, message: prev.message + (data?.delta ?? "") }));
              break;
            }
            case "message_complete": {
              const message = data as WorkspaceMessage;
              setState((prev) => ({ ...prev, message: message.content }));
              updateWorkspace((current) => {
                if (!current) return current;
                const conversations = [...current.conversations];
                const index = conversations.findIndex((item) => item.id === message.conversationId);
                if (index !== -1) {
                  const existingConversation = conversations[index];
                  const messages = [...existingConversation.messages.filter((m) => m.id !== message.id), message];
                  conversations[index] = { ...existingConversation, messages };
                }
                return { ...current, conversations };
              });
              break;
            }
            case "conversation": {
              const conversation = data as WorkspaceConversation;
              updateWorkspace((current) => {
                if (!current) return current;
                const conversations = [...current.conversations];
                const index = conversations.findIndex((item) => item.id === conversation.id);
                if (index !== -1) {
                  conversations[index] = conversation;
                } else {
                  conversations.unshift(conversation);
                }
                const thinkingRuns = { ...current.thinkingRuns };
                thinkingRuns[conversation.id] = thinkingRuns[conversation.id] ?? [];
                return { ...current, conversations, thinkingRuns };
              });
              break;
            }
            case "error": {
              const message = typeof data?.message === "string" ? data.message : "Unknown error";
              setState((prev) => ({ ...prev, error: message }));
              break;
            }
            case "stopped":
            case "done": {
              setState((prev) => ({ ...prev, isStreaming: false }));
              break;
            }
          }
        });

        setState((prev) => ({ ...prev, isStreaming: false }));
      } catch (error) {
        if (controller.signal.aborted) {
          setState((prev) => ({ ...prev, isStreaming: false }));
          return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        setState({ isStreaming: false, message: "", thinking: "", error: message });
        throw error;
      }
    },
    [updateWorkspace],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const helpers = useMemo(
    () => ({
      sendChat,
      stop,
      state,
      resetError: () => setState((prev) => ({ ...prev, error: null })),
    }),
    [sendChat, stop, state],
  );

  return helpers;
}

async function readEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: unknown) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      flushBuffer(buffer, onEvent);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = flushBuffer(buffer, onEvent);
  }
}

function flushBuffer(buffer: string, onEvent: (event: string, data: unknown) => void) {
  let index = buffer.indexOf("\n\n");
  while (index !== -1) {
    const chunk = buffer.slice(0, index);
    buffer = buffer.slice(index + 2);
    processClientEventChunk(chunk, onEvent);
    index = buffer.indexOf("\n\n");
  }
  return buffer;
}

export const __testables = { readEventStream, flushBuffer };

function processClientEventChunk(chunk: string, onEvent: (event: string, data: unknown) => void) {
  if (!chunk.trim()) return;
  const lines = chunk.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventName = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      dataLines.push(line.slice(6));
    }
  }

  if (dataLines.length === 0) {
    onEvent(eventName, {});
    return;
  }

  const payload = dataLines.join("\n");
  try {
    onEvent(eventName, JSON.parse(payload));
  } catch {
    onEvent(eventName, {});
  }
}
