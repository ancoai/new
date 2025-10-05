# Thinking Chat

A Next.js + TypeScript workspace for building a multi-model chat client inspired by NextChat/LobeChat. The app persists data in SQLite, supports OpenAI-compatible APIs (including custom endpoints such as newapi), and offers an optional two-model “thinking” pipeline.

## Key Features

- **SQLite persistence** – conversations, messages (including attachments), available models, and thinking traces are stored locally via `better-sqlite3`.
- **OpenAI-compatible orchestration** – the `/api/chat` route streams Server-Sent Events while coordinating a thinking model and an answering model. Both chat and legacy completion endpoints are supported and can be toggled at runtime.
- **Full-featured workspace UI** – the `/workspace` route provides:
  - Conversation list with create/rename/delete actions and automatic title generation.
  - Message history with live streaming, regenerate controls, and thinking trace viewer.
  - Composer with model selectors, temperature control, thinking pipeline toggle, image attachment + captioning, and custom model manager.
  - Settings panel for configuring API base URL, API key, default model, and default thinking prompt (stored client-side).
- **Model management** – sync available models from any OpenAI-compatible endpoint and add custom model IDs manually.
- **Image captioning** – upload an image to request a concise title using any multimodal-capable model.

## Getting Started

1. Install dependencies:
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
   pnpm dev
   ```

3. Visit `http://localhost:3000/workspace` to access the chat workspace. Configure your API key/base URL from the Settings button before sending messages.

## Tech Notes

- Server-side orchestration lives in `server/orchestrator.ts` and streams results through the SSE handler in `app/api/chat/route.ts`.
- Database access is centralized in `lib/database.ts`, which applies lightweight migrations to add new columns when needed.
- Client state is driven by React Query (`src/state/*`), with optimistic updates for outgoing messages and streaming updates coming from SSE events.

## Future Improvements

- Add authentication/encryption for persisted API keys.
- Expand automated test coverage (unit + integration) for orchestrator and UI flows.
- Package the workspace into a deployable Docker/Vercel setup.
