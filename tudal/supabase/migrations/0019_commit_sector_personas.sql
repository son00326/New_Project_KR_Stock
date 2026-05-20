-- migration: 0019_commit_sector_personas
-- purpose: D21 (52차) Tier 2 implementation — Sector Board 14 personas RPC.
--          additive only — Core 11 commit_persona_eval (0017) 보존, race-free section_8 partA UPDATE.
-- ref: Document/Service/Planning/ServicePlan-Admin.md §1A.5 D21
--      Document/Service/Report/ReportFramework.md §7.2 + §7.3 v2.5
--      tudal/src/lib/screening/canonical-sectors.ts CANONICAL_SECTORS
-- omxy R1~R3 CONVERGED (4 rounds + 4 acceptance details):
--   R1 #1: SELECT FOR UPDATE → section_8 = coalesce(section_8,'{}'::jsonb) || jsonb_build_object('partA', ...)
--          → Core 필드(partB/partC.core_revote/partD) 보존
--   R1 #2: ON CONFLICT 회피 — Core가 row 생성 후 본 RPC는 UPDATE만 (core_report_missing exception)
--   R1 #4: SECURITY DEFINER triad (revoke public + revoke anon + grant authenticated)
--   R2 B2: signature lock + Core 필드 보존 SQL test
--   R3 acc#1: p_sector_aggregate exact keys {buy,hold,sell}
--   R3 acc#2: SQL in-list = canonical-sectors.ts 14개 drift 방지 (snapshot test 동반)
--   R3 acc#3: idempotency — same ticker/month 2회 호출 후 sector 14 중복 0 (DELETE then INSERT)
--   R3 acc#4: degraded → RPC 호출 자체 skip (본 RPC는 happy-path만)

create or replace function public.commit_sector_personas(
  p_month text,                       -- 'YYYY-MM'
  p_ticker text,                      -- 6자리 KRX
  p_sector text,                      -- canonical 14 enum (D21 박제)
  p_part_a jsonb,                     -- length 14 (sectorVoteRow 14개, writer composes)
  p_sector_aggregate jsonb,           -- exact keys {buy:int, hold:int, sell:int}
  p_votes jsonb                       -- length 14, persona_layer='sector', slim payload
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_report_id uuid;
  v_section_8 jsonb;
  v_partC jsonb;
  v_sector_count int;
begin
  if v_caller is null then raise exception 'auth_unavailable'; end if;
  if not public.is_admin() then raise exception 'admin_required'; end if;

  -- R3 acc#2: p_sector canonical 14 drift 방지 (canonical-sectors.ts와 동일)
  if p_sector is null or p_sector not in (
    '바이오','반도체','건설','금융','2차전지','자동차','IT/SW','유통/소비재',
    '에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권'
  ) then
    raise exception 'invalid_sector';
  end if;

  -- R2 B2: p_part_a length=14 + vote enum 검증
  if p_part_a is null or jsonb_typeof(p_part_a) is distinct from 'array' then
    raise exception 'part_a_must_be_array';
  end if;
  if jsonb_array_length(p_part_a) is distinct from 14 then
    raise exception 'part_a_length_must_be_14';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_part_a) v
    where coalesce(v->>'vote', '') not in ('BUY','HOLD','SELL')
  ) then
    raise exception 'invalid_part_a_vote';
  end if;

  -- R3 acc#1: p_sector_aggregate exact keys {buy,hold,sell} (extra key reject)
  if p_sector_aggregate is null or jsonb_typeof(p_sector_aggregate) is distinct from 'object' then
    raise exception 'sector_aggregate_must_be_object';
  end if;
  if (select count(*) from jsonb_object_keys(p_sector_aggregate)) is distinct from 3 then
    raise exception 'sector_aggregate_keys_must_be_exactly_3';
  end if;
  if not (p_sector_aggregate ? 'buy' and p_sector_aggregate ? 'hold' and p_sector_aggregate ? 'sell') then
    raise exception 'sector_aggregate_keys_invalid';
  end if;
  if jsonb_typeof(p_sector_aggregate->'buy') <> 'number'
     or jsonb_typeof(p_sector_aggregate->'hold') <> 'number'
     or jsonb_typeof(p_sector_aggregate->'sell') <> 'number' then
    raise exception 'sector_aggregate_values_must_be_int';
  end if;

  -- R1 #1: p_votes length=14 + persona_layer='sector' + vote enum + required fields
  if p_votes is null or jsonb_typeof(p_votes) is distinct from 'array' then
    raise exception 'votes_must_be_array';
  end if;
  if jsonb_array_length(p_votes) is distinct from 14 then
    raise exception 'votes_length_must_be_14';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_votes) v
    where coalesce(v->>'persona_id', '') = ''
       or coalesce(v->>'persona_layer', '') <> 'sector'
       or coalesce(v->>'argument_excerpt', '') = ''
       or coalesce(v->>'vote', '') not in ('BUY','HOLD','SELL')
  ) then
    raise exception 'invalid_vote_row';
  end if;

  -- R1 #2: Core가 만든 stock_reports row SELECT FOR UPDATE (race-free, no INSERT)
  select id, section_8 into v_report_id, v_section_8
  from public.stock_reports
  where ticker = p_ticker
    and month = to_date(p_month || '-01', 'YYYY-MM-DD')
    and is_latest = true
  for update;

  if v_report_id is null then
    raise exception 'core_report_missing';
  end if;

  -- R1 #1 + R3 acc#4: section_8 || ... 패턴 — Core 필드(partB/partD/partC.core_revote/verdict) 보존
  -- partC는 sub-jsonb이므로 부분 update via jsonb concat
  v_partC := coalesce(v_section_8->'partC', '{}'::jsonb) || jsonb_build_object('sector_aggregate', p_sector_aggregate);

  update public.stock_reports
  set section_8 = coalesce(section_8, '{}'::jsonb)
                  || jsonb_build_object('partA', p_part_a)
                  || jsonb_build_object('partC', v_partC),
      generated_at = now()
  where id = v_report_id;

  -- R3 acc#3 idempotency: sector layer 기존 row 제거 후 14 INSERT — Core layer rows 보존
  delete from public.committee_votes
  where report_id = v_report_id and persona_layer = 'sector';

  -- INSERT 14 sector votes (BUY→approve / HOLD→abstain / SELL→reject — 0017 매핑 일관)
  insert into public.committee_votes (report_id, persona_id, persona_layer, vote, argument_excerpt)
  select
    v_report_id,
    (v ->> 'persona_id')::text,
    'sector'::text,
    case (v ->> 'vote')
      when 'BUY' then 'approve'
      when 'HOLD' then 'abstain'
      when 'SELL' then 'reject'
    end,
    (v ->> 'argument_excerpt')::text
  from jsonb_array_elements(p_votes) as v;

  get diagnostics v_sector_count = row_count;

  return jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'sector', p_sector,
    'votes_inserted', v_sector_count
  );
end;
$$;

-- R1 #4: SECURITY DEFINER triad (revoke public + revoke anon + grant authenticated)
revoke execute on function public.commit_sector_personas(text, text, text, jsonb, jsonb, jsonb) from public;
revoke execute on function public.commit_sector_personas(text, text, text, jsonb, jsonb, jsonb) from anon;
grant execute on function public.commit_sector_personas(text, text, text, jsonb, jsonb, jsonb) to authenticated;
