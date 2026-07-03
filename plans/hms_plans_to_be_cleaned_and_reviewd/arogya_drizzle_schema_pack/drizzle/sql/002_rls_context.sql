-- Request-scoped database context for Postgres RLS.
-- The API/BFF must call app.set_request_context(...) at transaction start.

create schema if not exists app;

create or replace function app.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

create or replace function app.current_facility_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.facility_id', true), '')::uuid
$$;

create or replace function app.current_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')
$$;

create or replace function app.current_purpose_of_use()
returns text
language sql
stable
as $$
  select nullif(current_setting('app.purpose_of_use', true), '')
$$;

create or replace function app.rls_bypass_enabled()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.bypass_rls', true), '')::boolean, false)
$$;

create or replace function app.set_request_context(
  p_tenant_id uuid,
  p_facility_id uuid default null,
  p_user_id text default null,
  p_purpose_of_use text default null,
  p_bypass_rls boolean default false
)
returns void
language plpgsql
as $$
begin
  perform set_config('app.tenant_id', coalesce(p_tenant_id::text, ''), true);
  perform set_config('app.facility_id', coalesce(p_facility_id::text, ''), true);
  perform set_config('app.user_id', coalesce(p_user_id, ''), true);
  perform set_config('app.purpose_of_use', coalesce(p_purpose_of_use, ''), true);
  perform set_config('app.bypass_rls', coalesce(p_bypass_rls, false)::text, true);
end;
$$;
