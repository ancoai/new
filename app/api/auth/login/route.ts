import { NextRequest } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/database";
import { createUserSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/security";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const json = await request.json();
  const body = loginSchema.parse(json);
  const db = await getDatabase();
  const user = db.getUserByUsername(body.username);
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createUserSession(user.id);
  return Response.json({ user: { username: user.username, role: user.role } }, { status: 200 });
}
