import { destroySession, getSessionUser } from "@/lib/auth";

export async function POST() {
  const user = await getSessionUser();
  if (user) {
    await destroySession();
  }
  return Response.json({ success: true });
}
