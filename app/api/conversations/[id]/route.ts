import { NextRequest } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { getSessionUser } from "@/lib/auth";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
});

type RouteContext = { params: { id: string } };

export async function GET(_: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = await getDatabase();
  const conversation = db.getConversation(context.params.id);
  if (!conversation) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ conversation });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const json = await request.json();
  const body = updateSchema.parse(json);
  const db = await getDatabase();
  if (body.title) {
    db.updateConversationTitle(context.params.id, body.title);
  }
  if (body.modelId) {
    db.updateConversationModel(context.params.id, body.modelId);
  }
  const conversation = db.getConversation(context.params.id);
  return Response.json({ conversation });
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = await getDatabase();
  db.deleteConversation(context.params.id);
  return new Response(null, { status: 204 });
}
