import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import type {
  WorkspaceConversation,
  WorkspaceMessage,
  WorkspaceThinkingRun,
  WorkspaceModel,
} from "@/server/workspace-data";

const dbFile = path.join(process.cwd(), "data", "app.db");

let client: Database.Database | null = null;

function ensureClient(): Database.Database {
  if (!client) {
    const directory = path.dirname(dbFile);
    ensureDirectory(directory);
    client = new Database(dbFile);
    client.pragma("journal_mode = WAL");
    bootstrap(client);
  }
  return client;
}

function bootstrap(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'custom',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS thinking_runs (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      output TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export async function getDatabase() {
  const db = ensureClient();
  return {
    listModels(): WorkspaceModel[] {
      return db
        .prepare(
          `SELECT id, display_name as displayName, provider, updated_at as updatedAt FROM models ORDER BY updated_at DESC`,
        )
        .all() as WorkspaceModel[];
    },
    listConversations(): WorkspaceConversation[] {
      const conversations = db
        .prepare(
          `SELECT id, title, model_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC`,
        )
        .all() as Array<{
        id: string;
        title: string;
        model_id: string;
        created_at: string;
        updated_at: string;
      }>;

      return conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        modelId: conversation.model_id,
        modelLabel: conversation.model_id,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        messages: listMessages(conversation.id),
      }));
    },
    listThinkingRuns(): Record<string, WorkspaceThinkingRun[]> {
      const rows = db
        .prepare(
          `SELECT id, conversation_id, model_id, output, created_at FROM thinking_runs ORDER BY created_at ASC`,
        )
        .all() as Array<{
        id: string;
        conversation_id: string;
        model_id: string;
        output: string;
        created_at: string;
      }>;

      return rows.reduce<Record<string, WorkspaceThinkingRun[]>>((acc, row) => {
        if (!acc[row.conversation_id]) {
          acc[row.conversation_id] = [];
        }
        const entry: WorkspaceThinkingRun = {
          id: row.id,
          conversationId: row.conversation_id,
          modelId: row.model_id,
          output: row.output,
          createdAt: row.created_at,
        };
        acc[row.conversation_id]!.push(entry);
        return acc;
      }, {});
    },
    upsertModel(id: string, displayName: string, provider: string) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO models (id, display_name, provider, updated_at)
         VALUES (@id, @display_name, @provider, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            provider = excluded.provider,
            updated_at = excluded.updated_at`,
      ).run({
        id,
        display_name: displayName,
        provider,
        updated_at: now,
      });
    },
    createConversation(title: string, modelId: string) {
      const now = new Date().toISOString();
      const id = randomUUID();
      db.prepare(
        `INSERT INTO conversations (id, title, model_id, created_at, updated_at)
         VALUES (@id, @title, @model_id, @created_at, @updated_at)`,
      ).run({
        id,
        title,
        model_id: modelId,
        created_at: now,
        updated_at: now,
      });
      return id;
    },
    insertMessage(message: Omit<WorkspaceMessage, "id" | "createdAt"> & { createdAt?: string }) {
      const id = randomUUID();
      const createdAt = message.createdAt ?? new Date().toISOString();
      db.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, created_at)
         VALUES (@id, @conversation_id, @role, @content, @created_at)`,
      ).run({
        id,
        conversation_id: message.conversationId,
        role: message.role,
        content: message.content,
        created_at: createdAt,
      });
      touchConversation(message.conversationId, createdAt);
      return id;
    },
    insertThinkingRun(run: Omit<WorkspaceThinkingRun, "id" | "createdAt"> & { createdAt?: string }) {
      const id = randomUUID();
      const createdAt = run.createdAt ?? new Date().toISOString();
      db.prepare(
        `INSERT INTO thinking_runs (id, conversation_id, model_id, output, created_at)
         VALUES (@id, @conversation_id, @model_id, @output, @created_at)`,
      ).run({
        id,
        conversation_id: run.conversationId,
        model_id: run.modelId,
        output: run.output,
        created_at: createdAt,
      });
      touchConversation(run.conversationId, createdAt);
      return id;
    },
  };

  function listMessages(conversationId: string): WorkspaceMessage[] {
    const rows = db
      .prepare(
        `SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = @conversationId ORDER BY created_at ASC`,
      )
      .all({ conversationId }) as Array<{
      id: string;
      conversation_id: string;
      role: string;
      content: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as WorkspaceMessage["role"],
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  function touchConversation(conversationId: string, isoDate: string) {
    db.prepare(
      `UPDATE conversations SET updated_at = @updated_at WHERE id = @conversation_id`,
    ).run({
      updated_at: isoDate,
      conversation_id: conversationId,
    });
  }
}

function ensureDirectory(directory: string) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}
