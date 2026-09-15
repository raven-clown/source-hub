# source-hub

Backend pipeline that pulls items from Gmail, Notion, Linear, and Google Calendar into a single Postgres database, normalizing each one into a common shape (source, sender/creator, origin org, summary, category, relevant date) via a pluggable language-model extraction step. Exposes the result through a REST API, a set of stats endpoints for charting, and an MCP server for querying directly from a client that speaks MCP.

No frontend here by design — this is the data layer a separate web app is expected to read from.

## Features

- **Connectors**: Gmail, Notion, Linear, Google Calendar — each does incremental polling via a stored cursor, so re-runs only fetch what changed.
- **Extraction**: every new/changed item is normalized into a fixed schema (title, summary, category, sender, org, relevant date) through a pluggable LLM provider — Anthropic by default, or any OpenAI-compatible endpoint (Ollama, vLLM, LM Studio, OpenRouter, etc.), so it also runs against open-weight models.
- **Storage**: Postgres with a two-stage design — a `raw_items` landing table (content-hashed, so unchanged items skip re-extraction) and a normalized `items` table with full-text search, JSONB metadata per source, and indexes for common filters.
- **REST API**: filtered item queries, status updates, a natural-language `/ask` endpoint (the model chooses its own query filters), and stats endpoints (breakdown, time-series at any granularity from year down to second, period-over-period comparison, distribution histograms).
- **MCP server**: the same data, exposed as MCP tools, so a chat client can query it directly without opening a web page.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design in detail.

## Requirements

- Node.js 18+
- Docker (for local Postgres) or any reachable Postgres 14+ instance
- API credentials for whichever sources you want to sync, and for whichever LLM provider you configure

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and the credentials you have
docker compose up -d   # starts a local Postgres if you don't have one already
npm run migrate
```

## Usage

```bash
npm run sync                  # sync all configured sources once
npm run sync -- --source=email
npm run api                   # start the REST API
npm run mcp                   # start the MCP server (stdio)
npm run mcp:debug             # same, wrapped with protocol tracing for debugging
```

### Scans

```bash
npm run typecheck
npm run scan:sast             # ESLint + security rules
npm run scan:secrets          # secretlint
npm run scan:deps             # npm audit
```

## REST API

| Endpoint | Description |
|---|---|
| `GET /items` | Filtered item list (`sources`, `categories`, `status`, `fromDate`, `toDate`, `search`, `limit`) |
| `GET /items/:id` | Single item |
| `PATCH /items/:id/status` | Update status |
| `POST /ask` | Natural-language question → filtered lookup → summarized answer |
| `GET /stats/today` | Today's counts per source |
| `GET /stats/series` | Time-bucketed counts (`granularity`: second…year, or a custom `fromDate`/`toDate` range) |
| `GET /stats/breakdown` | Share per source/category (pie-chart shape) |
| `GET /stats/compare` | Current vs. previous period per source/category (paired-bar shape) |
| `GET /stats/distribution` | Histogram by hour-of-day or extraction confidence |

Set `API_KEY` in `.env` to require a bearer token on every route except `/health`.

## MCP tools

`query_items`, `get_urgent_today`, `get_today_counts`, `get_series`, `get_breakdown`, `get_compare`, `get_distribution`, `get_item`, `set_item_status`.

## Configuration

See [.env.example](.env.example) for the full list. Only `DATABASE_URL` and one LLM provider's credentials are required; source credentials (Gmail/Notion/Linear/Calendar) are independent of each other — configure only the ones you use.
