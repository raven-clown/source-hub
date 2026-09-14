create extension if not exists pgcrypto;

create table raw_items (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('email', 'notion', 'linear', 'calendar')),
  source_id text not null,
  source_url text,
  content_hash text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  extracted_at timestamptz,
  unique (source, source_id)
);

create index raw_items_pending_idx on raw_items (source) where extracted_at is null;

create table items (
  id uuid primary key default gen_random_uuid(),
  raw_item_id uuid not null references raw_items(id) on delete cascade,
  source text not null check (source in ('email', 'notion', 'linear', 'calendar')),
  source_id text not null,
  source_url text,
  sender_name text,
  sender_identifier text,
  origin_org text,
  title text not null,
  summary text not null,
  category text not null check (category in ('urgent_reply', 'fyi', 'billing', 'task', 'appointment', 'promo')),
  event_at timestamptz,
  event_at_type text check (event_at_type in ('deadline', 'meeting')),
  source_created_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'archived')),
  extraction_model text not null,
  extraction_confidence numeric,
  metadata jsonb not null default '{}',
  search_text tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create index items_category_idx on items (category);
create index items_status_idx on items (status);
create index items_source_created_at_idx on items (source_created_at desc);
create index items_event_at_idx on items (event_at) where event_at is not null;
create index items_metadata_idx on items using gin (metadata);
create index items_search_idx on items using gin (search_text);

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger items_set_updated_at
  before update on items
  for each row
  execute function set_updated_at();

create table sync_cursors (
  source text primary key check (source in ('email', 'notion', 'linear', 'calendar')),
  cursor jsonb not null default '{}',
  last_synced_at timestamptz,
  last_status text not null default 'never_run' check (last_status in ('never_run', 'ok', 'error')),
  last_error text
);

create table pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('email', 'notion', 'linear', 'calendar')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_fetched int not null default 0,
  items_extracted int not null default 0,
  items_failed int not null default 0,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  error text
);
