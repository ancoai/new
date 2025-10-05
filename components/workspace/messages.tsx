"use client";

import dayjs from "dayjs";
import type {
  WorkspaceMessage,
  WorkspaceThinkingRun,
} from "@/server/workspace-data";

export function MessageList({
  messages,
  thinkingRuns,
  streamingMessage,
  streamingThinking,
  isStreaming,
  onRegenerate,
}: {
  messages: WorkspaceMessage[];
  thinkingRuns: WorkspaceThinkingRun[];
  streamingMessage: string;
  streamingThinking: string;
  isStreaming: boolean;
  onRegenerate: (messageId: string) => void;
}) {
  const lastAssistantId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {messages.map((message) => {
          const attachments = Array.isArray((message.metadata as any)?.attachments)
            ? ((message.metadata as any).attachments as Array<{ url: string } | string>)
            : [];
          return (
            <article key={message.id} className="rounded border p-4 shadow-sm">
              <header className="mb-2 flex items-center justify-between text-xs uppercase text-muted-foreground">
                <span>{message.role}</span>
                <span>{dayjs(message.createdAt).format("YYYY-MM-DD HH:mm")}</span>
              </header>
              <div className="space-y-3 text-sm leading-6">
                <p className="whitespace-pre-wrap">{message.content}</p>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {attachments.map((attachment, index) => (
                      <figure key={index} className="w-40">
                        <img
                          src={typeof attachment === "string" ? attachment : attachment.url}
                          alt="attachment"
                          className="h-28 w-full rounded object-cover"
                        />
                      </figure>
                    ))}
                  </div>
                )}
              </div>
              {lastAssistantId === message.id && (
                <div className="mt-3 flex items-center justify-end">
                  <button
                    type="button"
                    className="rounded border px-3 py-1 text-xs"
                    onClick={() => onRegenerate(message.id)}
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </article>
          );
        })}

        {isStreaming && (
          <article className="rounded border border-dashed bg-muted/30 p-4">
            <header className="mb-2 text-xs uppercase text-muted-foreground">assistant (streaming)</header>
            <p className="whitespace-pre-wrap text-sm leading-6">{streamingMessage || "…"}</p>
          </article>
        )}

        {thinkingRuns.length > 0 || streamingThinking ? (
          <section className="rounded border border-dashed p-4 text-xs text-muted-foreground">
            <h3 className="mb-2 font-semibold uppercase">Thinking Trace</h3>
            <ol className="space-y-3">
              {thinkingRuns.map((run) => (
                <li key={run.id}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{run.modelId}</span>
                    <span>{dayjs(run.createdAt).format("HH:mm:ss")}</span>
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 text-[11px] leading-5">
                    {run.output}
                  </pre>
                </li>
              ))}
              {streamingThinking && (
                <li>
                  <div className="font-medium">live</div>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-muted p-2 text-[11px] leading-5">
                    {streamingThinking}
                  </pre>
                </li>
              )}
            </ol>
          </section>
        ) : null}

        {messages.length === 0 && !isStreaming && (
          <div className="rounded border border-dashed p-10 text-center text-sm text-muted-foreground">
            Start the conversation by sending a message.
          </div>
        )}
      </div>
    </div>
  );
}
