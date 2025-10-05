import { fetchInitialWorkspaceData } from "@/server/workspace-data";

export async function GET() {
  const data = await fetchInitialWorkspaceData();
  return Response.json(data);
}
