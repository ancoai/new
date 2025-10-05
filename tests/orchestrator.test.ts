import { describe, expect, beforeEach, vi, it } from "vitest";

const fetchChatCompletion = vi.fn();
let mockDb: any;

vi.mock("@/lib/database", () => ({
  getDatabase: vi.fn(async () => mockDb),
}));

vi.mock("@/server/platform", () => ({
  fetchChatCompletion,
}));

import { orchestrateChat } from "@/server/orchestrator";

describe("orchestrateChat", () => {
  beforeEach(() => {
    const insertMessage = vi.fn(({ role }: { role: string }) => {
      return `${role}-${insertMessage.mock.calls.length + 1}`;
    });

    mockDb = {
      createConversation: vi.fn(() => "conv-new"),
      updateConversationModel: vi.fn(),
      insertMessage,
      updateMessageMetadata: vi.fn(),
      updateConversationTitle: vi.fn(),
      insertThinkingRun: vi.fn(() => "thinking-1"),
      updateThinkingRunMessage: vi.fn(),
      getMessage: vi.fn(),
      deleteThinkingRunsAfter: vi.fn(),
      deleteMessagesAfter: vi.fn(),
      getConversation: vi.fn(),
    };

    fetchChatCompletion.mockReset();
  });

  it("runs thinking and answer models sequentially", async () => {
    fetchChatCompletion
      .mockResolvedValueOnce({ content: "analysis", usage: null })
      .mockResolvedValueOnce({ content: "final answer", usage: null });

    const result = await orchestrateChat(
      {
        conversationId: "conv-1",
        messages: [{ role: "user", content: "Explain quantum mechanics" }],
        settings: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "secret",
          model: "answer-model",
          thinking: {
            enabled: true,
            thinkingModel: "thinking-model",
            answerModel: "answer-model",
            systemPrompt: "Think first",
          },
        },
      },
      {
        onThinkingToken: vi.fn(),
        onAnswerToken: vi.fn(),
      },
    );

    expect(fetchChatCompletion).toHaveBeenCalledTimes(2);
    expect(fetchChatCompletion.mock.calls[0][0]).toMatchObject({
      model: "thinking-model",
    });
    const answerCall = fetchChatCompletion.mock.calls[1][0];
    expect(answerCall.model).toBe("answer-model");
    expect(answerCall.messages.at(-1)).toMatchObject({
      role: "system",
      content: expect.stringContaining("Prior thinking"),
    });

    expect(mockDb.insertThinkingRun).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-1",
        modelId: "thinking-model",
        output: "analysis",
      }),
    );
    expect(mockDb.updateThinkingRunMessage).toHaveBeenCalledWith(
      "thinking-1",
      "assistant-2",
    );

    expect(result.conversationId).toBe("conv-1");
    expect(result.message.content).toBe("final answer");
    expect(result.thinkingRun).toMatchObject({
      id: "thinking-1",
      output: "analysis",
      messageId: "assistant-2",
    });
  });

  it("handles single model chats", async () => {
    fetchChatCompletion.mockResolvedValueOnce({ content: "just answer", usage: null });

    const result = await orchestrateChat({
      conversationId: "conv-1",
      messages: [{ role: "user", content: "Hello" }],
      settings: {
        baseUrl: "https://api.example.com/v1",
        apiKey: "secret",
        model: "answer-model",
      },
    });

    expect(fetchChatCompletion).toHaveBeenCalledTimes(1);
    expect(mockDb.insertThinkingRun).not.toHaveBeenCalled();
    expect(result.thinkingRun).toBeUndefined();
    expect(result.message.content).toBe("just answer");
  });
});
