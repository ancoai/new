import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Thinking Chat</h1>
        <p className="text-muted-foreground">
          A Next.js starter for a multi-model chat client with optional thinking
          pipeline.
        </p>
      </header>

      <section className="rounded-lg border p-6">
        <h2 className="text-xl font-semibold">Getting Started</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-left">
          <li>Configure your API key and base URL in the Settings panel.</li>
          <li>
            Create a conversation from the sidebar and pick your primary model.
          </li>
          <li>
            (Optional) Enable the thinking pipeline by choosing a thinking model
            and answer model.
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          The full chat workspace is under construction. Visit the
          <Link className="ml-1 text-blue-600 underline" href="/workspace">
            workspace preview
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
