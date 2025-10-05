import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  thinkingPrompt: z.string().optional(),
});

const COOKIE_NAME = "thinking-chat-settings";

export async function GET() {
  const store = cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  const settings = raw ? JSON.parse(raw) : {};
  return Response.json({ settings });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const body = settingsSchema.parse(json);
  cookies().set({
    name: COOKIE_NAME,
    value: JSON.stringify(body),
    httpOnly: false,
    sameSite: "lax",
  });
  return Response.json({ settings: body }, { status: 201 });
}
