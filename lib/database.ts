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

type ConversationRow = {
  id: string;
  title: string;
  model_id: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  metadata: string | null;
};

type ThinkingRunRow = {
  id: string;
  conversation_id: string;
  model_id: string;
  output: string;
  system_prompt: string | null;
  created_at: string;
  message_id: string | null;
};

function ensureClient(): Database.Database {
  if (!client) {
    const directory = path.dirname(dbFile);
    ensureDirectory(directory);
    client = new Database(dbFile);
    client.pragma("journal_mode = WAL");
    bootstrap(client);
    migrate(client);
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
      system_prompt TEXT,
      created_at TEXT NOT NULL,
      message_id TEXT
    );
  `);
}

function migrate(db: Database.Database) {
  ensureColumn(db, "messages", "metadata", "TEXT");
  ensureColumn(db, "thinking_runs", "system_prompt", "TEXT");
  ensureColumn(db, "thinking_runs", "message_id", "TEXT");
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function mapMessageRow(row: MessageRow): WorkspaceMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as WorkspaceMessage["role"],
    content: row.content,
    createdAt: row.created_at,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
  };
}

function mapConversationRow(
  row: ConversationRow,
  messages: WorkspaceMessage[],
): WorkspaceConversation {
  return {
    id: row.id,
    title: row.title,
    modelId: row.model_id,
    modelLabel: row.model_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
  };
}

function mapThinkingRunRow(row: ThinkingRunRow): WorkspaceThinkingRun {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    modelId: row.model_id,
    output: row.output,
    createdAt: row.created_at,
    messageId: row.message_id,
  };
}

export async function getDatabase() {
  const db = ensureClient();

  function getMessageById(messageId: string): WorkspaceMessage | null {
    const row = db
      .prepare(
        `SELECT id, conversation_id, role, content, created_at, metadata FROM messages WHERE id = @messageId LIMIT 1`,
      )
      .get({ messageId }) as MessageRow | undefined;
    return row ? mapMessageRow(row) : null;
  }

  function listMessages(conversationId: string): WorkspaceMessage[] {
    const rows = db
      .prepare(
        `SELECT id, conversation_id, role, content, created_at, metadata FROM messages WHERE conversation_id = @conversationId ORDER BY created_at ASC`,
      )
      .all({ conversationId }) as MessageRow[];

    return rows.map((row) => mapMessageRow(row));
  }

  function touchConversation(conversationId: string, isoDate: string) {
    db.prepare(`UPDATE conversations SET updated_at = @updated_at WHERE id = @conversation_id`).run({
      updated_at: isoDate,
      conversation_id: conversationId,
    });
  }

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
        .all() as ConversationRow[];

      return conversations.map((conversation) => {
        const messages = listMessages(conversation.id);
        return mapConversationRow(conversation, messages);
      });
    },
    listThinkingRuns(): Record<string, WorkspaceThinkingRun[]> {
      const rows = db
        .prepare(
          `SELECT id, conversation_id, model_id, output, system_prompt, created_at, message_id FROM thinking_runs ORDER BY created_at ASC`,
        )
        .all() as ThinkingRunRow[];

      return rows.reduce<Record<string, WorkspaceThinkingRun[]>>((acc, row) => {
        const run = mapThinkingRunRow(row);
        if (!acc[run.conversationId]) {
          acc[run.conversationId] = [];
        }
        acc[run.conversationId]!.push(run);
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
    updateConversationTitle(conversationId: string, title: string) {
      db.prepare(`UPDATE conversations SET title = @title WHERE id = @id`).run({
        id: conversationId,
        title,
      });
      touchConversation(conversationId, new Date().toISOString());
    },
    updateConversationModel(conversationId: string, modelId: string) {
      db.prepare(`UPDATE conversations SET model_id = @modelId WHERE id = @id`).run({
        id: conversationId,
        modelId,
      });
      touchConversation(conversationId, new Date().toISOString());
    },
    deleteConversation(conversationId: string) {
      db.prepare(`DELETE FROM messages WHERE conversation_id = @conversationId`).run({
        conversationId,
      });
      db.prepare(`DELETE FROM thinking_runs WHERE conversation_id = @conversationId`).run({
        conversationId,
      });
      db.prepare(`DELETE FROM conversations WHERE id = @conversationId`).run({
        conversationId,
      });
    },
    getConversation(conversationId: string): WorkspaceConversation | null {
      const row = db
        .prepare(
          `SELECT id, title, model_id, created_at, updated_at FROM conversations WHERE id = @conversationId LIMIT 1`,
        )
        .get({ conversationId }) as ConversationRow | undefined;
      if (!row) {
        return null;
      }
      const messages = listMessages(conversationId);
      return mapConversationRow(row, messages);
    },
    getMessage(messageId: string): WorkspaceMessage | null {
      return getMessageById(messageId);
    },
    listMessages(conversationId: string): WorkspaceMessage[] {
      return listMessages(conversationId);
    },
    insertMessage(message: Omit<WorkspaceMessage, "id" | "createdAt"> & { createdAt?: string }) {
      const id = randomUUID();
      const createdAt = message.createdAt ?? new Date().toISOString();
      db.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, metadata, created_at)
         VALUES (@id, @conversation_id, @role, @content, @metadata, @created_at)`,
      ).run({
        id,
        conversation_id: message.conversationId,
        role: message.role,
        content: message.content,
        metadata: message.metadata ? JSON.stringify(message.metadata) : null,
        created_at: createdAt,
      });
      touchConversation(message.conversationId, createdAt);
      return id;
    },
    updateMessageMetadata(messageId: string, metadata: Record<string, unknown> | null) {
      db.prepare(`UPDATE messages SET metadata = @metadata WHERE id = @id`).run({
        id: messageId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    },
    deleteMessage(messageId: string) {
      const message = getMessageById(messageId);
      if (!message) return;
      db.prepare(`DELETE FROM messages WHERE id = @id`).run({ id: messageId });
      touchConversation(message.conversationId, new Date().toISOString());
    },
    deleteMessagesAfter(conversationId: string, createdAt: string) {
      db.prepare(
        `DELETE FROM messages WHERE conversation_id = @conversationId AND created_at >= @createdAt`,
      ).run({ conversationId, createdAt });
    },
    insertThinkingRun(run: {
      conversationId: string;
      modelId: string;
      output: string;
      systemPrompt?: string;
      messageId?: string | null;
      createdAt?: string;
    }) {
      const id = randomUUID();
      const createdAt = run.createdAt ?? new Date().toISOString();
      db.prepare(
        `INSERT INTO thinking_runs (id, conversation_id, model_id, output, system_prompt, created_at, message_id)
         VALUES (@id, @conversation_id, @model_id, @output, @system_prompt, @created_at, @message_id)`,
      ).run({
        id,
        conversation_id: run.conversationId,
        model_id: run.modelId,
        output: run.output,
        system_prompt: run.systemPrompt ?? null,
        created_at: createdAt,
        message_id: run.messageId ?? null,
      });
      touchConversation(run.conversationId, createdAt);
      return id;
    },
    updateThinkingRunMessage(runId: string, messageId: string) {
      db.prepare(`UPDATE thinking_runs SET message_id = @messageId WHERE id = @id`).run({
        id: runId,
        messageId,
      });
    },
    deleteThinkingRunsAfter(conversationId: string, createdAt: string) {
      db.prepare(
        `DELETE FROM thinking_runs WHERE conversation_id = @conversationId AND created_at >= @createdAt`,
      ).run({ conversationId, createdAt });
    },
  };

  };
}

function ensureDirectory(directory: string) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}
