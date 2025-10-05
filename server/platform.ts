import { z } from "zod";

const chatCompletionSchema = z.object({
  content: z.string(),
});

type ChatCompletionRequest = {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
};

export async function fetchChatCompletion(
  request: ChatCompletionRequest,
): Promise<{ content: string }> {
  // Placeholder: in development we simulate a response to keep the UI working offline.
  // Integrators should replace this with real fetch() calls to the OpenAI-compatible endpoint.
  const simulatedContent = `Model ${request.model} would respond to ${request.messages.length} message(s).`;
  return chatCompletionSchema.parse({ content: simulatedContent });
}
