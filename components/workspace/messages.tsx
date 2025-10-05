"use client";

import type {
  WorkspaceMessage,
  WorkspaceThinkingRun,
} from "@/server/workspace-data";

export function MessageList({
  messages,
  thinkingRuns,
}: {
  messages: WorkspaceMessage[];
  thinkingRuns: WorkspaceThinkingRun[];
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((message) => (
          <article key={message.id} className="rounded border p-4">
            <header className="mb-2 flex items-center justify-between text-xs uppercase text-muted-foreground">
              <span>{message.role}</span>
              <span>{message.createdAt}</span>
            </header>
            <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
          </article>
        ))}
        {thinkingRuns.length > 0 && (
          <section className="rounded border border-dashed p-4 text-xs text-muted-foreground">
            <h3 className="mb-2 font-semibold uppercase">Thinking Trace</h3>
            <ol className="space-y-3">
              {thinkingRuns.map((run) => (
                <li key={run.id}>
                  <div className="font-medium">{run.modelId}</div>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 text-[11px] leading-5">
                    {run.output}
                  </pre>
                </li>
              ))}
            </ol>
          </section>
        )}
        {messages.length === 0 && (
          <div className="rounded border border-dashed p-10 text-center text-sm text-muted-foreground">
            Start the conversation by sending a message.
          </div>
        )}
      </div>
    </div>
  );
}
