create extension if not exists pgcrypto;

create table if not exists public.seven_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seven_sessions (
  session_id uuid primary key,
  workspace_id uuid references public.seven_workspaces(id) on delete cascade,
  pair_code text unique,
  pair_expires_at timestamptz,
  extension_token_hash text not null,
  claimed_at timestamptz,
  last_seen_at timestamptz,
  page_origin text,
  tab_id text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seven_pair_code_format check (pair_code is null or pair_code ~ '^[0-9]{6}$')
);

create table if not exists public.seven_session_handles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.seven_sessions(session_id) on delete cascade,
  handle_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.seven_commands (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.seven_sessions(session_id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','delivered','completed','failed','cancelled')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  completed_at timestamptz
);

create index if not exists seven_commands_session_status_created_idx
  on public.seven_commands(session_id, status, created_at);

create table if not exists public.seven_results (
  command_id uuid primary key references public.seven_commands(id) on delete cascade,
  session_id uuid not null references public.seven_sessions(session_id) on delete cascade,
  payload jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.seven_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.seven_workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  client_name text,
  niche text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, slug)
);

create table if not exists public.seven_vault_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.seven_workspaces(id) on delete cascade,
  project_id uuid references public.seven_projects(id) on delete set null,
  kind text not null default 'image',
  name text not null,
  mime_type text not null,
  storage_path text not null unique,
  sha256 text,
  byte_size bigint,
  width integer,
  height integer,
  source_url text,
  source_domain text,
  source_title text,
  niche text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists seven_vault_assets_workspace_sha256_uidx
  on public.seven_vault_assets(workspace_id, sha256)
  where sha256 is not null;

create index if not exists seven_vault_assets_project_idx on public.seven_vault_assets(project_id);
create index if not exists seven_vault_assets_niche_idx on public.seven_vault_assets(niche);
create index if not exists seven_vault_assets_tags_gin_idx on public.seven_vault_assets using gin(tags);
create index if not exists seven_vault_assets_metadata_gin_idx on public.seven_vault_assets using gin(metadata);

create table if not exists public.seven_rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  hits integer not null default 0
);

create or replace function public.seven_rate_limit(_key text, _limit integer, _window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  rec public.seven_rate_limits%rowtype;
begin
  insert into public.seven_rate_limits(key, window_started_at, hits)
  values (_key, now_ts, 1)
  on conflict (key) do update
    set window_started_at = case
      when public.seven_rate_limits.window_started_at < now_ts - make_interval(secs => _window_seconds)
      then now_ts else public.seven_rate_limits.window_started_at end,
      hits = case
      when public.seven_rate_limits.window_started_at < now_ts - make_interval(secs => _window_seconds)
      then 1 else public.seven_rate_limits.hits + 1 end
  returning * into rec;
  return rec.hits <= _limit;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seven-vault',
  'seven-vault',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm','application/pdf','application/zip','text/plain','application/json']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.seven_workspaces enable row level security;
alter table public.seven_sessions enable row level security;
alter table public.seven_session_handles enable row level security;
alter table public.seven_commands enable row level security;
alter table public.seven_results enable row level security;
alter table public.seven_projects enable row level security;
alter table public.seven_vault_assets enable row level security;
alter table public.seven_rate_limits enable row level security;

revoke all on table public.seven_workspaces from anon, authenticated;
revoke all on table public.seven_sessions from anon, authenticated;
revoke all on table public.seven_session_handles from anon, authenticated;
revoke all on table public.seven_commands from anon, authenticated;
revoke all on table public.seven_results from anon, authenticated;
revoke all on table public.seven_projects from anon, authenticated;
revoke all on table public.seven_vault_assets from anon, authenticated;
revoke all on table public.seven_rate_limits from anon, authenticated;
revoke all on function public.seven_rate_limit(text, integer, integer) from public, anon, authenticated;

insert into public.seven_workspaces(name, slug)
values ('SEVEN', 'seven')
on conflict (slug) do nothing;
