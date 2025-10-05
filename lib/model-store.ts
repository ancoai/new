import type { WorkspaceModel } from "@/server/workspace-data";
import { getDatabase } from "@/lib/database";

const defaultModels: WorkspaceModel[] = [
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    provider: "openai",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "gpt-4o",
    displayName: "GPT-4o",
    provider: "openai",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "qwen-plus",
    displayName: "Qwen Plus",
    provider: "aliyun",
    updatedAt: new Date().toISOString(),
  },
];

let hydrated = false;

export async function getModelStore() {
  const db = await getDatabase();

  if (!hydrated) {
    for (const model of defaultModels) {
      db.upsertModel(model.id, model.displayName, model.provider);
    }
    hydrated = true;
  }

  return {
    listModels(): WorkspaceModel[] {
      return db.listModels();
    },
  };
}
