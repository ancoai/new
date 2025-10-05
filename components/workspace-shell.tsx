"use client";

import { useMemo, useState } from "react";
import { ConversationList } from "@/components/workspace/sidebar";
import { ChatComposer } from "@/components/workspace/composer";
import { MessageList } from "@/components/workspace/messages";
import type { InitialWorkspaceData } from "@/server/workspace-data";

export function WorkspaceShell({
  initialData,
}: {
  initialData: InitialWorkspaceData;
}) {
  const [activeConversationId, setActiveConversationId] = useState(
    initialData.conversations[0]?.id ?? null,
  );

  const activeConversation = useMemo(
    () =>
      initialData.conversations.find((item) => item.id === activeConversationId) ??
      null,
    [activeConversationId, initialData.conversations],
  );

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr]">
      <aside className="border-r">
        <ConversationList
          conversations={initialData.conversations}
          activeId={activeConversationId}
          onSelect={setActiveConversationId}
        />
      </aside>
      <main className="flex flex-col">
        <MessageList
          messages={activeConversation?.messages ?? []}
          thinkingRuns={initialData.thinkingRuns[activeConversationId ?? ""] ?? []}
        />
        <ChatComposer
          models={initialData.models}
          activeConversationId={activeConversationId}
        />
      </main>
    </div>
  );
}
