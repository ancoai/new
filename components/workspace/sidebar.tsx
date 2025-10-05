"use client";

import classNames from "classnames";
import { useMemo } from "react";
import type { WorkspaceConversation } from "@/server/workspace-data";

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  isCreating = false,
}: {
  conversations: WorkspaceConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isCreating?: boolean;
}) {
  const items = useMemo(() => conversations, [conversations]);

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Conversations
        </h2>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs"
          onClick={onCreate}
          disabled={isCreating}
        >
          {isCreating ? "Creating…" : "New"}
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {items.map((conversation) => (
          <div key={conversation.id} className="rounded border border-transparent transition hover:border-muted">
            <button
              type="button"
              className={classNames(
                "w-full px-3 py-2 text-left text-sm",
                activeId === conversation.id
                  ? "bg-blue-500 text-white"
                  : "hover:bg-muted",
              )}
              onClick={() => onSelect(conversation.id)}
            >
              <div className="font-medium">{conversation.title}</div>
              <div className="text-xs text-muted-foreground">{conversation.modelLabel}</div>
            </button>
            <div className="flex items-center justify-end gap-2 px-3 pb-2 text-[11px] text-muted-foreground">
              <button
                type="button"
                className="underline"
                onClick={() => {
                  const title = prompt("Rename conversation", conversation.title);
                  if (title && title.trim().length > 0) {
                    onRename(conversation.id, title.trim());
                  }
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="text-red-600 underline"
                onClick={() => {
                  if (confirm("Delete this conversation?")) {
                    onDelete(conversation.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded border border-dashed p-3 text-xs text-muted-foreground">
            No conversations yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
