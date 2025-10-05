import React from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, vi, it } from "vitest";
import { useChatSession } from "@/src/state/use-chat-session";

function createWrapper() {
  const queryClient = new QueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useChatSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("streams server-sent events into state", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const now = new Date().toISOString();
        controller.enqueue(
          encoder.encode(`event: message_delta\ndata: ${JSON.stringify({ delta: "Hel" })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(`event: message_delta\ndata: ${JSON.stringify({ delta: "lo" })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(
            `event: message_complete\ndata: ${JSON.stringify({
              id: "assistant-1",
              conversationId: "conv-1",
              role: "assistant",
              content: "Hello",
              createdAt: now,
              metadata: null,
            })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      },
    });

    const response = new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });

    vi.spyOn(global, "fetch").mockResolvedValue(response as Response);

    const { result } = renderHook(() => useChatSession(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendChat({
        conversationId: "conv-1",
        messages: [{ role: "user", content: "Hello" }],
        settings: { model: "answer", baseUrl: undefined },
      });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.current.state.message).toBe("Hello");
    expect(result.current.state.isStreaming).toBe(false);
  });
});
