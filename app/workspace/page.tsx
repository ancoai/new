import { Suspense } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { fetchInitialWorkspaceData } from "@/server/workspace-data";

export default async function WorkspacePage() {
  const data = await fetchInitialWorkspaceData();

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading workspace…</div>}>
      <WorkspaceShell initialData={data} />
    </Suspense>
  );
}
