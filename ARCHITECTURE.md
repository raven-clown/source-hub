# Architecture

## Pipeline

```
connector.fetchSince(cursor)
        │
        ▼
  raw_items (upsert by source+source_id, content-hashed)
        │  skipped if content_hash unchanged
        ▼
  extraction (pluggable LLM provider, forced structured output)
        │
        ▼
  items (upsert by source+source_id)
        │
        ▼
  sync_cursors updated, pipeline_runs logged
```

`src/pipeline/runSource.ts` runs this for one source; `runAll.ts` loops over every configured connector, isolating failures per source so one broken integration doesn't block the others.

## Data model

Two-stage storage, not one flat table:

- **`raw_items`** — landing zone. One row per `(source, source_id)`, holding the untouched API payload plus a `content_hash`. Re-fetching an unchanged item is a no-op; a changed one clears `extracted_at` so the next run knows to re-extract only what actually changed.
- **`items`** — the normalized table everything else reads from. Fixed columns for the common shape (sender/creator, origin org, title, summary, category, status), a generated `tsvector` column for full-text search, and a `metadata jsonb` catch-all for source-specific fields that don't need their own column (Linear priority, calendar attendees, etc.).
- **`sync_cursors`** — per-source incremental-fetch state, so polling doesn't re-scan history every run.
- **`pipeline_runs`** — audit log of each sync (counts, status, error).

See [migrations/0001_init.sql](migrations/0001_init.sql) for the exact schema.

## Connectors

Each connector implements one interface:

```ts
interface Connector {
  source: Source;
  fetchSince(cursor: Record<string, unknown>): Promise<{
    items: RawFetchedItem[];
    nextCursor: Record<string, unknown>;
  }>;
}
```

API clients are constructed lazily inside `fetchSince`, not at module load — so importing a connector module (or the whole `connectors/index.ts` barrel) never fails just because one source's credentials aren't configured. This matters because `cli.ts` dynamic-imports per command, and `runAll` iterates every connector regardless of which ones you've actually set up.

## Extraction / LLM provider

`src/llm/types.ts` defines a small `LlmProvider` interface with exactly the two operations the pipeline needs:

- `extractStructured` — force a single tool call, return its parsed arguments (used for normalizing one raw item)
- `runAgentLoop` — a bounded multi-turn tool-use loop (used by `/ask`, where the model chooses its own query filters)

Two implementations: `AnthropicProvider` and `OpenAiCompatibleProvider` (targets any server implementing the OpenAI chat-completions API — Ollama, vLLM, LM Studio, OpenRouter, and others all speak this, so one adapter covers open-weight models generally rather than one integration per host). Selected at runtime via `LLM_PROVIDER`.

## API layer

Fastify. Routes are thin — they parse/validate query params and call straight into the `db/repositories/*` functions, which own all SQL. A global error handler logs full error detail server-side but returns a generic message to the client, so internal failures (DB errors, etc.) never leak connection strings or schema details over HTTP.

## MCP server

`@modelcontextprotocol/sdk` over stdio, exposing the same repository functions as MCP tools. Never writes to stdout outside the protocol transport — all logging goes to stderr — so it's safe to wrap with `mcp-debug` for protocol tracing during development.

## Security notes

- All SQL is parameterized; the handful of places that need a dynamic column/identifier (stats grouping dimension, series granularity) go through a fixed whitelist, never raw string interpolation of user input.
- `/items` query `limit` is clamped server-side regardless of what the client requests.
- Content hashing (`util/hash.ts`) does a full recursive stable stringify — not a shallow one — so nested payload changes (e.g. a Notion property edit) are actually reflected in the hash.
