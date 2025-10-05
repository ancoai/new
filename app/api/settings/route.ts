import { NextRequest } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { getSessionUser } from "@/lib/auth";

const settingsSchema = z.object({
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  thinkingPrompt: z.string().optional(),
  clearApiKey: z.boolean().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDatabase();
  const settings = db.getUserSettings(user.id);
  return Response.json({
    settings: {
      baseUrl: settings.baseUrl ?? undefined,
      model: settings.model ?? undefined,
      thinkingPrompt: settings.thinkingPrompt ?? undefined,
      apiKeySet: Boolean(settings.apiKey),
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await request.json();
  const body = settingsSchema.parse(json);
  const db = await getDatabase();

  let baseUrl: string | null | undefined;
  if (body.baseUrl !== undefined) {
    const trimmed = body.baseUrl.trim();
    baseUrl = trimmed.length > 0 ? trimmed : null;
  }
  let model: string | null | undefined;
  if (body.model !== undefined) {
    const trimmed = body.model.trim();
    model = trimmed.length > 0 ? trimmed : null;
  }
  let thinkingPrompt: string | null | undefined;
  if (body.thinkingPrompt !== undefined) {
    thinkingPrompt = body.thinkingPrompt.trim().length > 0 ? body.thinkingPrompt : null;
  }

  let apiKey: string | null | undefined = undefined;
  if (body.clearApiKey) {
    apiKey = null;
  } else if (typeof body.apiKey === "string" && body.apiKey.trim().length > 0) {
    apiKey = body.apiKey.trim();
  }

  db.setUserSettings(user.id, {
    baseUrl,
    apiKey,
    model,
    thinkingPrompt,
  });

  const updated = db.getUserSettings(user.id);
  return Response.json(
    {
      settings: {
        baseUrl: updated.baseUrl ?? undefined,
        model: updated.model ?? undefined,
        thinkingPrompt: updated.thinkingPrompt ?? undefined,
        apiKeySet: Boolean(updated.apiKey),
      },
    },
    { status: 201 },
  );
}
