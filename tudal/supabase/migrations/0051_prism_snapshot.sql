begin;

create table if not exists public.prism_snapshot (
  id uuid primary key default gen_random_uuid(),
  market text not null check (market in ('kr', 'us')),
  snapshot_date date not null,
  snapshot_slot text not null check (snapshot_slot in ('am', 'pm', 'daily')),
  market_session_date date not null,
  session_date_source text not null check (session_date_source in ('payload', 'nominal')),
  generated_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  source_commit text not null check (source_commit ~ '^[0-9a-f]{40}$'),
  contract_version integer not null check (contract_version = 1),
  terminal_performance jsonb,
  first_ingested_at timestamptz not null default now(),
  last_ingested_at timestamptz not null default now(),
  constraint prism_snapshot_market_slot_check check (
    (market = 'kr' and snapshot_slot in ('am', 'pm'))
    or (market = 'us' and snapshot_slot = 'daily')
  ),
  constraint prism_snapshot_session_date_check check (market_session_date <= snapshot_date),
  constraint prism_snapshot_terminal_shape_check check (
    terminal_performance is null
    or (
      jsonb_typeof(terminal_performance) = 'object'
      and jsonb_typeof(terminal_performance->'date') = 'string'
      and terminal_performance->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
      and jsonb_typeof(terminal_performance->'cumulative_realized_profit') = 'number'
      and jsonb_typeof(terminal_performance->'prism_simulator_return') = 'number'
    )
  ),
  constraint prism_snapshot_market_date_slot_key unique (market, snapshot_date, snapshot_slot)
);

create table if not exists public.prism_benchmark_meta (
  market text primary key check (market in ('kr', 'us')),
  benchmark_session_date date not null,
  anchored_snapshot_id uuid not null references public.prism_snapshot(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.prism_snapshot enable row level security;
alter table public.prism_benchmark_meta enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['prism_snapshot', 'prism_benchmark_meta'] loop
    execute format('revoke all on table public.%I from public', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('revoke all on table public.%I from service_role', t);
    execute format('grant select on table public.%I to authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || ' admin select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin())',
      t || ' admin select', t
    );
    execute format('drop policy if exists %I on public.%I', t || ' anon block', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon using (false)',
      t || ' anon block', t
    );
  end loop;
end $$;

create or replace function public.upsert_prism_snapshot(
  p_market text,
  p_snapshot_date text,
  p_snapshot_slot text,
  p_market_session_date text,
  p_session_date_source text,
  p_generated_at text,
  p_payload jsonb,
  p_payload_sha256 text,
  p_source_commit text,
  p_contract_version text,
  p_terminal_performance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot_date date;
  v_market_session_date date;
  v_nominal_session_date date;
  v_generated_at timestamptz;
  v_contract_version integer;
  v_terminal_date date;
  v_received_at timestamptz := clock_timestamp();
  v_id uuid;
  v_inserted boolean;
  v_last_ingested_at timestamptz;
  v_status text;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_market is null or p_market not in ('kr', 'us') then
    raise exception 'bad_market';
  end if;
  if p_snapshot_slot is null or p_snapshot_slot not in ('am', 'pm', 'daily') then
    raise exception 'bad_snapshot_slot';
  end if;
  if not (
    (p_market = 'kr' and p_snapshot_slot in ('am', 'pm'))
    or (p_market = 'us' and p_snapshot_slot = 'daily')
  ) then
    raise exception 'market_slot_mismatch';
  end if;
  if p_session_date_source is null or p_session_date_source not in ('payload', 'nominal') then
    raise exception 'bad_session_date_source';
  end if;

  if p_snapshot_date is null or p_snapshot_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'bad_snapshot_date';
  end if;
  begin
    v_snapshot_date := p_snapshot_date::date;
    if to_char(v_snapshot_date, 'YYYY-MM-DD') <> p_snapshot_date then
      raise exception 'bad_snapshot_date';
    end if;
  exception when others then
    raise exception 'bad_snapshot_date';
  end;

  if p_market_session_date is null or p_market_session_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'bad_market_session_date';
  end if;
  begin
    v_market_session_date := p_market_session_date::date;
    if to_char(v_market_session_date, 'YYYY-MM-DD') <> p_market_session_date then
      raise exception 'bad_market_session_date';
    end if;
  exception when others then
    raise exception 'bad_market_session_date';
  end;
  if v_market_session_date > v_snapshot_date then
    raise exception 'market_session_after_snapshot';
  end if;
  v_nominal_session_date := case
    when p_market = 'kr' then v_snapshot_date
    else v_snapshot_date - 1
  end;
  if v_nominal_session_date - v_market_session_date > 7 then
    raise exception 'market_session_too_old';
  end if;

  if p_generated_at is null or p_generated_at !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
    raise exception 'bad_generated_at';
  end if;
  begin
    v_generated_at := p_generated_at::timestamptz;
  exception when others then
    raise exception 'bad_generated_at';
  end;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_must_be_object';
  end if;
  if pg_column_size(p_payload) > 8 * 1024 * 1024 then
    raise exception 'payload_too_large';
  end if;
  if p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'bad_payload_sha256';
  end if;
  if p_source_commit is null or p_source_commit !~ '^[0-9a-f]{40}$' then
    raise exception 'bad_source_commit';
  end if;
  if p_source_commit <> 'b8171a4e95314b2fc29b81af0ee74d47e8a705e9' then
    raise exception 'source_commit_pin_mismatch';
  end if;
  if p_contract_version is null or p_contract_version !~ '^[0-9]+$' or length(p_contract_version) > 10 then
    raise exception 'bad_contract_version';
  end if;
  begin
    if p_contract_version::numeric > 2147483647 then
      raise exception 'bad_contract_version';
    end if;
    v_contract_version := p_contract_version::integer;
  exception when others then
    raise exception 'bad_contract_version';
  end;
  if v_contract_version <> 1 then
    raise exception 'unsupported_contract_version';
  end if;

  if p_terminal_performance is not null then
    if jsonb_typeof(p_terminal_performance) <> 'object'
       or jsonb_typeof(p_terminal_performance->'date') <> 'string'
       or jsonb_typeof(p_terminal_performance->'cumulative_realized_profit') <> 'number'
       or jsonb_typeof(p_terminal_performance->'prism_simulator_return') <> 'number' then
      raise exception 'bad_terminal_performance_shape';
    end if;
    if p_terminal_performance->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'bad_terminal_performance_date';
    end if;
    begin
      v_terminal_date := (p_terminal_performance->>'date')::date;
      if to_char(v_terminal_date, 'YYYY-MM-DD') <> p_terminal_performance->>'date' then
        raise exception 'bad_terminal_performance_date';
      end if;
    exception when others then
      raise exception 'bad_terminal_performance_date';
    end;
    if v_terminal_date > v_market_session_date then
      raise exception 'terminal_performance_after_session';
    end if;
    begin
      perform (p_terminal_performance->>'cumulative_realized_profit')::numeric;
      perform (p_terminal_performance->>'prism_simulator_return')::numeric;
    exception when others then
      raise exception 'bad_terminal_performance_number';
    end;
  end if;

  with applied as (
    insert into public.prism_snapshot as current_snapshot (
      market, snapshot_date, snapshot_slot, market_session_date, session_date_source,
      generated_at, payload, payload_sha256, source_commit, contract_version,
      terminal_performance, first_ingested_at, last_ingested_at
    ) values (
      p_market, v_snapshot_date, p_snapshot_slot, v_market_session_date, p_session_date_source,
      v_generated_at, p_payload, p_payload_sha256, p_source_commit, v_contract_version,
      p_terminal_performance, v_received_at, v_received_at
    )
    on conflict (market, snapshot_date, snapshot_slot) do update set
      market_session_date = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then current_snapshot.market_session_date
        else excluded.market_session_date
      end,
      session_date_source = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then current_snapshot.session_date_source
        else excluded.session_date_source
      end,
      generated_at = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then current_snapshot.generated_at
        else excluded.generated_at
      end,
      payload = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then current_snapshot.payload
        else excluded.payload
      end,
      payload_sha256 = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then current_snapshot.payload_sha256
        else excluded.payload_sha256
      end,
      source_commit = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then current_snapshot.source_commit
        else excluded.source_commit
      end,
      contract_version = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then current_snapshot.contract_version
        else excluded.contract_version
      end,
      terminal_performance = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then current_snapshot.terminal_performance
        else excluded.terminal_performance
      end,
      -- A one-microsecond marker distinguishes updated from unchanged in this statement's RETURNING
      -- result without a race-prone pre-SELECT. Both values are the successful RPC receive instant.
      last_ingested_at = case
        when current_snapshot.payload_sha256 = excluded.payload_sha256 then v_received_at
        else v_received_at + interval '1 microsecond'
      end
    where excluded.generated_at >= current_snapshot.generated_at
    returning id, (xmax = 0) as inserted, last_ingested_at
  )
  select id, inserted, last_ingested_at
    into v_id, v_inserted, v_last_ingested_at
  from applied;

  if v_id is null then
    return jsonb_build_object('status', 'stale_rejected');
  end if;

  if v_inserted then
    v_status := 'inserted';
    insert into public.prism_benchmark_meta (market, benchmark_session_date, anchored_snapshot_id)
    values (p_market, v_market_session_date, v_id)
    on conflict (market) do nothing;
  elsif v_last_ingested_at = v_received_at then
    v_status := 'unchanged_noop';
  else
    v_status := 'updated';
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id);
end;
$$;

revoke all on function public.upsert_prism_snapshot(text, text, text, text, text, text, jsonb, text, text, text, jsonb) from public;
revoke all on function public.upsert_prism_snapshot(text, text, text, text, text, text, jsonb, text, text, text, jsonb) from anon;
revoke all on function public.upsert_prism_snapshot(text, text, text, text, text, text, jsonb, text, text, text, jsonb) from authenticated;
revoke all on function public.upsert_prism_snapshot(text, text, text, text, text, text, jsonb, text, text, text, jsonb) from service_role;
grant execute on function public.upsert_prism_snapshot(text, text, text, text, text, text, jsonb, text, text, text, jsonb) to service_role;

commit;
