import { z } from "zod";
import type { ChatMessageContent } from "@/server/orchestrator";

const chatChoiceSchema = z.object({
  message: z
    .object({
      role: z.string().optional(),
      content: z.union([z.string(), z.null()]).optional(),
    })
    .optional(),
  delta: z
    .object({
      role: z.string().optional(),
      content: z.union([z.string(), z.null()]).optional(),
    })
    .optional(),
  text: z.string().optional(),
});

const chatCompletionResponseSchema = z.object({
  choices: z.array(chatChoiceSchema),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

const modelsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      owned_by: z.string().optional(),
      name: z.string().optional(),
      display_name: z.string().optional(),
      provider: z.string().optional(),
    }),
  ),
});

type ChatCompletionRequest = {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  messages: Array<{ role: string; content: ChatMessageContent }>;
  temperature?: number;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
};

type CompletionResult = {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
};

class EndpointError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export async function fetchChatCompletion(request: ChatCompletionRequest): Promise<CompletionResult> {
  try {
    return await callChatEndpoint("chat/completions", request);
  } catch (error) {
    if (error instanceof EndpointError && shouldFallbackToLegacyCompletions(error)) {
      return callChatEndpoint("completions", request, { useLegacyCompletions: true });
    }
    throw error;
  }
}

export async function fetchAvailableModels({
  baseUrl,
  apiKey,
}: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<Array<{ id: string; displayName: string; provider: string }>> {
  const resolvedBaseUrl = normalizeBaseUrl(baseUrl);
  const headers = buildHeaders(apiKey);
  const response = await fetch(`${resolvedBaseUrl}/models`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new EndpointError(response.status, `Failed to load models: ${response.status}`, text);
  }

  const data = modelsResponseSchema.parse(await response.json());
  return data.data.map((item) => ({
    id: item.id,
    displayName: item.display_name ?? item.name ?? item.id,
    provider: item.provider ?? item.owned_by ?? "remote",
  }));
}

function normalizeBaseUrl(baseUrl?: string) {
  const url = baseUrl && baseUrl.trim().length > 0 ? baseUrl.trim() : DEFAULT_BASE_URL;
  return url.replace(/\/$/, "");
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  return headers;
}

async function callChatEndpoint(
  endpoint: "chat/completions" | "completions",
  request: ChatCompletionRequest,
  options: { useLegacyCompletions?: boolean } = {},
): Promise<CompletionResult> {
  const resolvedBaseUrl = normalizeBaseUrl(request.baseUrl);
  const headers = buildHeaders(request.apiKey);
  const body = buildRequestBody(endpoint, request, options.useLegacyCompletions ?? false);

  const response = await fetch(`${resolvedBaseUrl}/${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: request.signal,
  });

  if (!response.ok) {
    const errorBody = await safeParseBody(response);
    throw new EndpointError(response.status, `Failed to call ${endpoint}`, errorBody);
  }

  if (request.onToken) {
    const { content, usage } = await streamResponse(response, request.onToken);
    return { content, usage };
  }

  const json = await response.json();
  const parsed = chatCompletionResponseSchema.parse(json);
  const content = extractChoiceContent(parsed.choices[0]);
  return { content, usage: parsed.usage ?? null };
}

function shouldFallbackToLegacyCompletions(error: EndpointError) {
  if (error.status === 404) return true;
  if (error.status === 400) {
    const body = typeof error.body === "string" ? error.body : JSON.stringify(error.body ?? {});
    return /does not exist/i.test(body) || /unsupported/.test(body);
  }
  return false;
}

function buildRequestBody(
  endpoint: "chat/completions" | "completions",
  request: ChatCompletionRequest,
  useLegacyCompletions: boolean,
) {
  const base = {
    model: request.model,
    temperature: request.temperature ?? 0.7,
  } as Record<string, unknown>;

  if (request.onToken) {
    base.stream = true;
  }

  if (endpoint === "chat/completions" && !useLegacyCompletions) {
    base.messages = request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    return base;
  }

  const prompt = messagesToPrompt(request.messages);
  base.prompt = prompt;
  base.max_tokens = 1024;
  return base;
}

function messagesToPrompt(messages: Array<{ role: string; content: ChatMessageContent }>) {
  return messages
    .map((message) => {
      const role = message.role.toUpperCase();
      const content = Array.isArray(message.content)
        ? message.content
            .map((part) => {
              if (part.type === "text") return part.text;
              if (part.type === "image_url") return "[Image omitted]";
              return "";
            })
            .join("\n")
        : message.content;
      return `${role}: ${content}`;
    })
    .join("\n");
}

async function streamResponse(response: Response, onToken: (token: string) => void) {
  if (!response.body) {
    return { content: "", usage: null };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let accumulated = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      processSseChunk(chunk, (token) => {
        accumulated += token;
        onToken(token);
      });
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.length > 0) {
    processSseChunk(buffer, (token) => {
      accumulated += token;
      onToken(token);
    });
  }

  return { content: accumulated, usage: null };
}

function processSseChunk(chunk: string, onToken: (token: string) => void) {
  const lines = chunk.split("\n");
  let eventData = "";
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        return;
      }
      eventData += data;
    }
  }

  if (!eventData) return;

  try {
    const parsed = chatCompletionResponseSchema.parse(JSON.parse(eventData));
    const token = extractChoiceDelta(parsed.choices[0]);
    if (token) {
      onToken(token);
    }
  } catch (error) {
    // ignore parsing errors for partial chunks
  }
}

function extractChoiceContent(choice: z.infer<typeof chatChoiceSchema>): string {
  if (choice.message?.content) {
    return choice.message.content;
  }
  if (choice.text) {
    return choice.text;
  }
  if (choice.delta?.content) {
    return choice.delta.content ?? "";
  }
  return "";
}

function extractChoiceDelta(choice: z.infer<typeof chatChoiceSchema>): string {
  if (choice.delta?.content) {
    return choice.delta.content ?? "";
  }
  if (choice.text) {
    return choice.text;
  }
  return "";
}

async function safeParseBody(response: Response) {
  const text = await response.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : text;
  } catch {
    return text;
  }
}
