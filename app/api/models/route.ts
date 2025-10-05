import { NextRequest } from "next/server";
import { z } from "zod";
import { getModelStore } from "@/lib/model-store";
import { getDatabase } from "@/lib/database";
import { fetchAvailableModels } from "@/server/platform";
import { getModelStore } from "@/lib/model-store";
import { getDatabase } from "@/lib/database";
import { z } from "zod";

const addModelSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  provider: z.string().default("custom"),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const refresh = searchParams.get("refresh") === "1";
  const baseUrl = searchParams.get("baseUrl") ?? undefined;
  const apiKey = searchParams.get("apiKey") ?? undefined;

  if (refresh && apiKey) {
    const db = await getDatabase();
    const models = await fetchAvailableModels({ baseUrl, apiKey });
    for (const model of models) {
      db.upsertModel(model.id, model.displayName, model.provider);
    }
  }

export async function GET() {
  const store = await getModelStore();
  const models = store.listModels();
  return Response.json({ models });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const body = addModelSchema.parse(json);
  const db = await getDatabase();
  db.upsertModel(body.id, body.displayName, body.provider);
  const store = await getModelStore();
  return Response.json({ models: store.listModels() }, { status: 201 });
}
