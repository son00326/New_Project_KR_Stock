-- migration: 0040_commit_sector_personas_cron
-- purpose: PR-T2a (Tier 2 섹터 보드 → live 리포트 경로 배선) — service-role-DI 변형.
--          기존 commit_sector_personas(0019)는 auth.uid()+is_admin() 강제 + grant authenticated only라
--          report-worker의 service-role cron 경로(auth.uid()=null)에서 호출 불가
--          (= commit_persona_eval(0017) → commit_persona_eval_cron(0036)와 동일 문제·동일 해법).
-- 차이점 (0019 대비): auth.uid()/is_admin() 게이트 대신 p_called_by(cron-system user UUID)를 받아
--   auth.users 존재만 검증(섹터 보드 RPC는 caller를 어떤 테이블에도 저장하지 않음 — 0019 v_caller는
--   null/is_admin 게이트 전용이었음). 나머지 검증·section_8 partA/partC 보존 UPDATE·committee_votes
--   sector layer DELETE→INSERT 14는 0019와 BYTE-동일(파라미터/검증/매핑 보존).
-- grant: revoke public/anon/authenticated + grant service_role only (worker cron 전용; admin path는 0019 유지).
-- ref: docs/superpowers/specs/2026-06-23-tier2-sector-persona-report-wiring.md §4 PR-T2a
--      supabase/migrations/0019_commit_sector_personas.sql (admin 원본)
--      supabase/migrations/0036_commit_persona_eval_cron.sql (cron-auth 패턴)

create or replace function public.commit_sector_personas_cron(
  p_month text,                       -- 'YYYY-MM'
  p_ticker text,                      -- 6자리 KRX
  p_sector text,                      -- canonical 14 enum (D21 박제)
  p_part_a jsonb,                     -- length 14 (sectorVoteRow 14개, writer composes)
  p_sector_aggregate jsonb,           -- exact keys {buy:int, hold:int, sell:int}
  p_votes jsonb,                      -- length 14, persona_layer='sector', slim payload
  p_called_by uuid                    -- cron-system user (auth.users 존재 검증; 미저장)
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report_id uuid;
  v_section_8 jsonb;
  v_partC jsonb;
  v_sector_count int;
begin
  -- cron 경로 인증: auth.uid()/is_admin() 대신 p_called_by(cron-system user) 존재 검증 (0036 패턴).
  if p_called_by is null then
    raise exception 'auth_unavailable';
  end if;
  if not exists (select 1 from auth.users where id = p_called_by) then
    raise exception 'caller_not_found';
  end if;

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
    raise exception 'sector_aggregate_values_must_be_number';
  end if;
  if mod((p_sector_aggregate->>'buy')::numeric, 1) <> 0
     or mod((p_sector_aggregate->>'hold')::numeric, 1) <> 0
     or mod((p_sector_aggregate->>'sell')::numeric, 1) <> 0 then
    raise exception 'sector_aggregate_values_must_be_int';
  end if;
  if (p_sector_aggregate->>'buy')::numeric < 0
     or (p_sector_aggregate->>'hold')::numeric < 0
     or (p_sector_aggregate->>'sell')::numeric < 0 then
    raise exception 'sector_aggregate_values_must_be_nonneg';
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

  -- FIX(2026-06-24 live catch): committee_votes_sector_required CHECK는 sector-layer row에 sector NOT NULL
  --   요구. 0019(admin)도 sector 미설정 동일 버그였으나 dangling action이라 미발현. cron live 경로에서
  --   처음 발현 → p_sector를 sector 컬럼에 명시.
  insert into public.committee_votes (report_id, persona_id, persona_layer, sector, vote, argument_excerpt)
  select
    v_report_id,
    (v ->> 'persona_id')::text,
    'sector'::text,
    p_sector,
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

-- SECURITY DEFINER triad (feedback_supabase_security_definer_pattern):
--   revoke public/anon/authenticated + grant service_role only. 0036 cron RPC와 동일 — admin path는 0019 유지.
revoke all on function public.commit_sector_personas_cron(text, text, text, jsonb, jsonb, jsonb, uuid) from public;
revoke all on function public.commit_sector_personas_cron(text, text, text, jsonb, jsonb, jsonb, uuid) from anon;
revoke all on function public.commit_sector_personas_cron(text, text, text, jsonb, jsonb, jsonb, uuid) from authenticated;
grant execute on function public.commit_sector_personas_cron(text, text, text, jsonb, jsonb, jsonb, uuid) to service_role;
