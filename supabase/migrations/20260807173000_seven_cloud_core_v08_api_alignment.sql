-- Align the Cloud Core API with the persistent Vault/session lifecycle used by v0.8.
alter table public.seven_sessions add column if not exists browser_kind text;
alter table public.seven_sessions add column if not exists browser_version text;

alter table public.seven_session_handles add column if not exists last_used_at timestamptz;
create index if not exists seven_session_handles_expiry_idx on public.seven_session_handles(expires_at);

alter table public.seven_vault_assets add column if not exists status text not null default 'uploading';
alter table public.seven_vault_assets add column if not exists deleted_at timestamptz;
do $$ begin
  alter table public.seven_vault_assets add constraint seven_vault_assets_status_check
    check (status in ('uploading','ready','failed'));
exception when duplicate_object then null; end $$;
create index if not exists seven_vault_assets_workspace_status_created_idx
  on public.seven_vault_assets(workspace_id,status,created_at desc);

create or replace function public.seven_vault_search(
  _workspace uuid,
  _query text default null,
  _project text default null,
  _niche text default null,
  _tags text[] default null,
  _mime_type text default null,
  _limit integer default 20
)
returns table(
  id uuid, workspace_id uuid, project_id uuid, kind text, name text, mime_type text,
  storage_path text, sha256 text, byte_size bigint, width integer, height integer,
  source_url text, source_domain text, source_title text, niche text, tags text[], metadata jsonb,
  status text, created_at timestamptz, updated_at timestamptz, project_name text, project_slug text
)
language sql stable security definer set search_path=public
as $$
  select a.id,a.workspace_id,a.project_id,a.kind,a.name,a.mime_type,a.storage_path,a.sha256,a.byte_size,
         a.width,a.height,a.source_url,a.source_domain,a.source_title,a.niche,a.tags,a.metadata,a.status,
         a.created_at,a.updated_at,p.name,p.slug
  from public.seven_vault_assets a
  left join public.seven_projects p on p.id=a.project_id
  where a.workspace_id=_workspace
    and a.status='ready'
    and a.deleted_at is null
    and (_project is null or lower(coalesce(p.slug,''))=lower(_project) or lower(coalesce(p.name,''))=lower(_project))
    and (_niche is null or lower(coalesce(a.niche,p.niche,''))=lower(_niche))
    and (_mime_type is null or lower(a.mime_type) like lower(_mime_type)||'%')
    and (_tags is null or a.tags @> _tags)
    and (_query is null or concat_ws(' ',a.name,p.name,p.slug,a.niche,a.source_domain,a.source_title,array_to_string(a.tags,' '),a.metadata::text) ilike '%'||_query||'%')
  order by a.created_at desc
  limit greatest(1,least(coalesce(_limit,20),100));
$$;
revoke all on function public.seven_vault_search(uuid,text,text,text,text[],text,integer) from public,anon,authenticated;
grant execute on function public.seven_vault_search(uuid,text,text,text,text[],text,integer) to service_role;

create or replace function public.seven_cleanup()
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from public.seven_results where created_at < now()-interval '24 hours';
  delete from public.seven_commands where created_at < now()-interval '24 hours';
  delete from public.seven_session_handles where expires_at < now()-interval '24 hours' or revoked_at < now()-interval '24 hours';
  delete from public.seven_rate_limits where window_started_at < now()-interval '1 day';
  update public.seven_sessions set pair_code=null where pair_expires_at<now() and pair_code is not null;
end $$;
revoke all on function public.seven_cleanup() from public,anon,authenticated;
grant execute on function public.seven_cleanup() to service_role;
