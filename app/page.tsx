import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Thinking Chat</h1>
        <p className="text-muted-foreground">
          Multi-model chat workspace with optional thinking pipeline, model
          management, and streaming UX.
        </p>
      </header>

      <section className="rounded-lg border p-6">
        <h2 className="text-xl font-semibold">Quick Start</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-left">
          <li>Open the workspace and configure your API key/base URL.</li>
          <li>Create a conversation or pick an existing one from the sidebar.</li>
          <li>
            Toggle the thinking pipeline, select models, and start chatting with
            streaming responses and regenerate controls.
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          Sign in on the
          <Link className="mx-1 text-blue-600 underline" href="/login">
            login page
          </Link>
          and then open the
          <Link className="ml-1 text-blue-600 underline" href="/workspace">
            chat workspace
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
