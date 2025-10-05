# Thinking Chat

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

2. Run database migrations (tables are created automatically on first run).

3. Start the development server

   ```bash
   pnpm dev
   ```

4. Open `http://localhost:3000` to explore the landing page or `http://localhost:3000/workspace` for the chat workspace preview.

## Next Steps

- Wire `fetchChatCompletion` to real OpenAI/newapi endpoints with streaming support.
- Implement pause/resume, regenerate, image captioning, and settings UI.
- Add authentication and encryption for sensitive settings if needed.
- Expand test coverage and add CI workflows.
