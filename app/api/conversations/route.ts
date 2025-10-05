import { NextRequest } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { getSessionUser } from "@/lib/auth";

const createConversationSchema = z.object({
  title: z.string().min(1).default("Untitled conversation"),
  modelId: z.string().min(1),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDatabase();
  const conversations = db.listConversations();
  return Response.json({ conversations });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const json = await request.json();
  const body = createConversationSchema.parse(json);
  const db = await getDatabase();
  const id = db.createConversation(body.title, body.modelId);
  const conversation = db.getConversation(id);
  return Response.json({ id, conversation }, { status: 201 });
}
