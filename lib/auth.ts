import { cookies } from "next/headers";
import { getDatabase } from "@/lib/database";

const SESSION_COOKIE_NAME = "thinking-chat-session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

type SessionUser = {
  id: string;
  username: string;
  role: string;
  token: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const db = await getDatabase();
  const session = db.getSession(token);
  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  const user = db.getUserById(session.user_id);
  if (!user) {
    db.deleteSession(token);
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return { id: user.id, username: user.username, role: user.role, token };
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return user;
}

export async function createUserSession(userId: string) {
  const db = await getDatabase();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = db.createSession(userId, expiresAt);
  cookies().set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const db = await getDatabase();
    db.deleteSession(token);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export { SESSION_COOKIE_NAME };
