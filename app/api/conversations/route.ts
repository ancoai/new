import { NextRequest } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/database";

const createConversationSchema = z.object({
  title: z.string().min(1),
  modelId: z.string().min(1),
});

export async function GET() {
  const db = await getDatabase();
  const conversations = db.listConversations();
  return Response.json({ conversations });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const body = createConversationSchema.parse(json);
  const db = await getDatabase();
  const id = db.createConversation(body.title, body.modelId);
  const conversations = db.listConversations();
  return Response.json({ id, conversations }, { status: 201 });
}
