# AB Sample - Analytics + Commerce Chatbots

This project is a UX/A-B experiment focused sample app with:

- Event collection (`/collect`)
- Experiment management (`/api/experiments*`, `/api/config`)
- Metrics dashboard (`/dashboard`, `/api/metrics`)
- Visual editor (`/editor`)
- Dual chat agents (`analytics_copilot`, `commerce_support`)

## Quick Start

```bash
npm install
npm run dev
```

- Main: `http://localhost:3000/`
- Dashboard: `http://localhost:3000/dashboard`
- Editor: `http://localhost:3000/editor`

## LLM Runtime Modes (Mock / Real)

The server always stays alive. Chat works in both modes.

### 1) Mock mode (default fallback)

If `OPENAI_API_KEY` is missing (or provider is unavailable), the app runs in mock mode automatically.

- No extra setup required
- Rule/tool-based responses are returned
- `meta.llmMode` in `/api/chat` response is `mock`

### 2) Real mode (OpenAI)

Create `.env` in project root from `.env.example`:

```bash
cp .env.example .env
```

Set real values:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=YOUR_REAL_KEY
OPENAI_MODEL=gpt-4.1-mini
PORT=3000
```

Then run:

```bash
npm run dev
```

If OpenAI call fails at runtime, the response flow gracefully falls back to draft/tool text (server does not crash).

## LLM Abstraction Structure

- `services/llm/config.js`: loads `.env` and returns provider config
- `services/llm/index.js`: client factory (`openai` vs `mock`)
- `services/llm/responses-client.js`: OpenAI Responses API client
- `services/llm/mock-client.js`: deterministic fallback client

Orchestrator (`services/chat/chat-orchestrator.js`) consumes a generic `llmClient.rewrite(...)` interface.

## Chat API Notes

### `POST /api/chat`

- `agent=analytics_copilot`
  - `generate/suggest/create`: returns draft JSON action only
  - explicit save phrases (`저장`, `draft로 저장`, `save draft`): persists draft
  - never auto-publishes

- `agent=commerce_support`
  - order/refund/exchange/cancel handled by tool + rule services
  - sensitive actions are draft/ticket/handoff oriented

### OpenAPI

API schema file: `docs/openapi.json`

## Validation Checklist

- `collect` keeps writing events
- `metrics` endpoint still works
- `dashboard` and `editor` remain functional
- `analytics_copilot` generation and save are separated
- `commerce_support` does not auto-execute irreversible operations
