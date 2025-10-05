import { NextRequest } from "next/server";
import { z } from "zod";
import { fetchChatCompletion } from "@/server/platform";

const requestSchema = z.object({
  image: z.string().min(1),
  mimeType: z.string().min(1),
  prompt: z.string().optional(),
  settings: z.object({
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    model: z.string(),
  }),
});

export async function POST(request: NextRequest) {
  const json = await request.json();
  const body = requestSchema.parse(json);

  const promptText = body.prompt?.trim();
  const prompt =
    promptText && promptText.length > 0
      ? promptText
      : "Generate a concise, human-friendly caption for the attached image.";

  const content = await fetchChatCompletion({
    baseUrl: body.settings.baseUrl,
    apiKey: body.settings.apiKey,
    model: body.settings.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `${prompt} Respond with a single sentence.` },
          { type: "image_url", image_url: { url: `data:${body.mimeType};base64,${body.image}` } },
        ],
      },
    ],
  });

  return Response.json({ caption: content.content.trim() });
}
