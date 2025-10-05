"use client";

import classNames from "classnames";
import { useMemo } from "react";
import type { WorkspaceConversation } from "@/server/workspace-data";

export function ConversationList({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: WorkspaceConversation[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const items = useMemo(() => conversations, [conversations]);

  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Conversations
        </h2>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs"
          onClick={() => onSelect(items[0]?.id ?? null)}
        >
          Refresh
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {items.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            className={classNames(
              "w-full rounded px-3 py-2 text-left text-sm transition",
              activeId === conversation.id
                ? "bg-blue-500 text-white"
                : "hover:bg-muted",
            )}
            onClick={() => onSelect(conversation.id)}
          >
            <div className="font-medium">{conversation.title}</div>
            <div className="text-xs text-muted-foreground">
              {conversation.modelLabel}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="rounded border border-dashed p-3 text-xs text-muted-foreground">
            No conversations yet. Create one from the composer.
          </div>
        )}
      </div>
    </div>
  );
}
