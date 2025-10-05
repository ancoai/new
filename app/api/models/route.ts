import { NextRequest } from "next/server";
import { z } from "zod";
import { getModelStore } from "@/lib/model-store";
import { getDatabase } from "@/lib/database";
import { fetchAvailableModels } from "@/server/platform";
import { getSessionUser } from "@/lib/auth";

const addModelSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  provider: z.string().default("custom"),
});

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const searchParams = request.nextUrl.searchParams;
  const refresh = searchParams.get("refresh") === "1";
  const baseUrl = searchParams.get("baseUrl") ?? undefined;
  const db = await getDatabase();
  const settings = db.getUserSettings(user.id);

  if (refresh) {
    if (!settings.apiKey) {
      return Response.json({ error: "Missing API key" }, { status: 400 });
    }
    const models = await fetchAvailableModels({
      baseUrl: baseUrl ?? settings.baseUrl ?? undefined,
      apiKey: settings.apiKey,
    });
    for (const model of models) {
      db.upsertModel(model.id, model.displayName, model.provider);
    }
  }

  const store = await getModelStore();
  const models = store.listModels();
  return Response.json({ models });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await request.json();
  const body = addModelSchema.parse(json);
  const db = await getDatabase();
  db.upsertModel(body.id, body.displayName, body.provider);
  const store = await getModelStore();
  return Response.json({ models: store.listModels() }, { status: 201 });
}
