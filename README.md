# Thinking Chat

A Next.js + TypeScript workspace for building a multi-model chat client inspired by NextChat/LobeChat. The app persists data in SQLite, supports OpenAI-compatible APIs (including custom endpoints such as newapi), and offers an optional two-model “thinking” pipeline.

## Key Features

- **SQLite persistence** – conversations, messages (including attachments), available models, and thinking traces are stored locally via `better-sqlite3`.
- **OpenAI-compatible orchestration** – the `/api/chat` route streams Server-Sent Events while coordinating a thinking model and an answering model. Both chat and legacy completion endpoints are supported and can be toggled at runtime.
- **Full-featured workspace UI** – the `/workspace` route provides:
  - Conversation list with create/rename/delete actions and automatic title generation.
  - Message history with live streaming, regenerate controls, and thinking trace viewer.
  - Composer with model selectors, temperature control, thinking pipeline toggle, image attachment + captioning, and custom model manager.
  - Settings panel for configuring API base URL, API key, default model, and default thinking prompt (persisted per user in SQLite with server-side encryption).
- **Model management** – sync available models from any OpenAI-compatible endpoint and add custom model IDs manually.
- **Image captioning** – upload an image to request a concise title using any multimodal-capable model.
- **Authentication** – the workspace is protected by a built-in admin account (`admin` / `12345678`) with cookie-backed sessions stored in SQLite.
- **Encrypted secrets** – API keys are encrypted at rest via AES-256-GCM using the `APP_ENCRYPTION_KEY` secret.
  - Settings panel for configuring API base URL, API key, default model, and default thinking prompt (stored client-side).
- **Model management** – sync available models from any OpenAI-compatible endpoint and add custom model IDs manually.
- **Image captioning** – upload an image to request a concise title using any multimodal-capable model.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
A Next.js + TypeScript starter implementing the foundations for a multi-model chat client inspired by NextChat/LobeChat with an optional thinking pipeline.

## Features

- Server components backed by SQLite (via `better-sqlite3`) with tables for models, conversations, messages, and thinking runs.
- API routes for managing models, conversations, settings, and orchestrating thinking + answering model flows.
- React client workspace with sidebar, message viewer, composer, and thinking trace preview.
- Extensible architecture for OpenAI-compatible endpoints with customizable base URLs and API keys.

## Getting Started

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Launch the dev server:

   ```bash
   npm run dev
   ```

3. Visit `http://localhost:3000/login`, sign in with the default admin credentials, and then open `/workspace`. Configure your API key/base URL from the Settings drawer before sending messages.

### Required environment variables

- `APP_ENCRYPTION_KEY` – 32+ character secret used to derive the AES-256-GCM key that protects stored API credentials. Development falls back to `development-secret`, but production deployments must override it.
   pnpm dev
   ```

3. Visit `http://localhost:3000/workspace` to access the chat workspace. Configure your API key/base URL from the Settings button before sending messages.

## Tech Notes

- Server-side orchestration lives in `server/orchestrator.ts` and streams results through the SSE handler in `app/api/chat/route.ts`.
- Database access is centralized in `lib/database.ts`, which applies lightweight migrations to add new columns when needed.
- Client state is driven by React Query (`src/state/*`), with optimistic updates for outgoing messages and streaming updates coming from SSE events.

## Testing

Automated unit and integration tests cover orchestrator workflows, encrypted storage helpers, and the streaming client hook.

```bash
npm test
```

## Deployment

### Docker

1. Build the production image:

   ```bash
   docker build -t thinking-chat .
   ```

2. Run the container (mount a volume for SQLite data to persist conversations):

   ```bash
   docker run -p 3000:3000 \
     -e APP_ENCRYPTION_KEY="replace-with-strong-secret" \
     -v $(pwd)/data:/app/data \
     thinking-chat
   ```

### Vercel

The repository includes a `vercel.json` manifest for one-click deployments. Configure the following environment variable in the Vercel dashboard (or via `vercel env add APP_ENCRYPTION_KEY production` and repeating for other environments) before deploying:

- `APP_ENCRYPTION_KEY` – 32+ character secret used for encrypting stored API credentials. One-click deploys prompt for the value automatically; you can generate a strong secret locally with `openssl rand -base64 48`.

> **Vercel secret tip**
>
> If the dashboard shows “Environment Variable `APP_ENCRYPTION_KEY` references Secret `app_encryption_key`, which does not exist,” either enter the secret value directly in the form (without the leading `@`), or create the secret ahead of time:
>
> ```bash
> vercel secrets add app_encryption_key "$(openssl rand -base64 48)"
> vercel env add APP_ENCRYPTION_KEY production @app_encryption_key
> vercel env add APP_ENCRYPTION_KEY preview @app_encryption_key
> vercel env add APP_ENCRYPTION_KEY development @app_encryption_key
> ```
>
> After the secret exists you can reference it from the environment variable field with `@app_encryption_key` during deployment.

Because SQLite is file-based, attach a persistent volume or migrate to a hosted database when running in multi-instance environments.
The repository includes a `vercel.json` manifest for one-click deployments. Configure the following environment variable in the Vercel dashboard (or via `vercel secrets add app_encryption_key <value>`) before deploying:

- `APP_ENCRYPTION_KEY`

Because SQLite is file-based, attach a persistent volume or migrate to a hosted database when running in multi-instance environments.
## Future Improvements

- Add authentication/encryption for persisted API keys.
- Expand automated test coverage (unit + integration) for orchestrator and UI flows.
- Package the workspace into a deployable Docker/Vercel setup.
