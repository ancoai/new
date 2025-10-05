import { fetchInitialWorkspaceData } from "@/server/workspace-data";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await fetchInitialWorkspaceData();
  return Response.json(data);
}
