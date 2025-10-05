import { NextRequest } from "next/server";
import { getModelStore } from "@/lib/model-store";
import { getDatabase } from "@/lib/database";
import { z } from "zod";

const addModelSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  provider: z.string().default("custom"),
});

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
