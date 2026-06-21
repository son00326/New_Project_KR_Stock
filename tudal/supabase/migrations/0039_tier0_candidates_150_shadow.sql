-- migration: 0039_tier0_candidates_150_shadow
-- purpose: 경로 A — Track 2 generator-shadow. Sector-aware shadow 150 + full-universe
--          counterfactual snapshot, forward-only 150-recall 측정용. PRODUCTION 무변경:
--          tier0_candidates_150 / short_list_30 / producer / consumer / money-path 전부 BYTE-UNCHANGED.
--          본 migration은 신규 shadow artifact만 CREATE한다(table 4 + RPC 1 finalize + 1 register
--          + 3 internal helper).
-- spec SoT: docs/superpowers/specs/2026-06-20-pathA-track2-generator-shadow.md §1(T2-I-1..11)·§4·§5·§10·§11
-- ref invariants:
--   T2-I-2/I-3/I-5  production Tier0 150 무변경 (shadow write는 tier0_candidates_150_shadow에만).
--   T2-I-6          production K=0 DB 안전장치 — shadow table에 service_role SELECT grant 부재.
--                   write는 SECURITY DEFINER RPC(owner=migration 적용자) 경유 → service_role엔 EXECUTE만.
--   T2-I-7          sector-hard-gate = shadow diagnostic-only(full-universe counterfactual 동반). production 영구 금지.
--   T2-I-9          LLM source 미사용(stage 0 manual/absent). production cost_log 무변경.
--   T2-I-10         본 migration apply = USER-only(Claude/omxy 실행 금지).
--   T2-I-11         D30 no-apply 정직 scope — 산출물은 "shadow 생성-단계 counterfactual 관측"까지만.
--
-- 보안(0034/0016 패턴 동형):
--   - 모든 RPC SECURITY DEFINER + set search_path = public, pg_temp.
--   - 미인증(auth.uid() IS NULL & role <> service_role) → auth_unavailable / 비-어드민 → admin_required.
--   - created_by는 함수 인자 아님; service_role 외 caller는 auth.uid()로 결정(spoof 차단).
--   - table-level write grant 부재: 모든 write는 SECURITY DEFINER RPC 단일 경로.
--   - feedback_supabase_security_definer_pattern: revoke public+anon → grant 명시.
--
-- 적대 리뷰 반영(grounded findings, 2026-06-21):
--   F1/F3/AB-BUG  snapshot writer의 undefined p_arm_payload → p_payload 정정(매 finalize abort 방지).
--   F2/A-MIDRUN   period-level stale snapshot 정리 + run-level snapshot 완전성 단언(foreign-run pairing 차단).
--   completeness  hypothesis row write path 부재 → register_shadow_hypothesis append-only RPC 추가.
--   F3            hard-gate underfill 모순(gate_eligible_size<150 & status=logged) RPC guard + table CHECK.
--   F5            hypothesis content binding을 identity 필드(source/leadingSectors/hash)만 비교(timestamptz byte-match foot-gun 회피).
--   F7            RLS policy DROP-first 멱등화(0034 패턴).
--   F8/F9         snapshot row typed guard: bucket/ticker regex + (ticker,bucket) 중복 + sector/sector_source enum.
--   F10           shadow tier0_score numeric(12,2)로 rounding-parity DB 보장.
--
-- rollback = 0039_tier0_candidates_150_shadow.rollback.sql.

begin;

-- ===========================================================================
-- (0) immutable sector hypothesis / pre-registration artifact (append-only)
-- ===========================================================================
create table if not exists public.tier0_shadow_sector_hypothesis (
  id uuid primary key default gen_random_uuid(),
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  source text not null check (source in ('absent','manual_pre_registered')),
  leading_sectors jsonb not null default '[]'::jsonb,
  as_of timestamptz,
  selection_as_of timestamptz not null,
  params jsonb not null default '{}'::jsonb,
  hypothesis_hash text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint shadow_hypothesis_uniq unique (period_key, source, hypothesis_hash),
  constraint shadow_hypothesis_asof_preselection check (as_of is null or as_of < selection_as_of)
);

-- append-only: no update/delete API or grant. 정정은 selection_as_of 이전에 새 hash/id로만.
-- candidate logging은 정확히 하나의 hypothesis_id를 참조한다.

-- ===========================================================================
-- (1) shadow 150 candidates (per arm) — production tier0_candidates_150(0028) safety 패턴 mirror
-- ===========================================================================
create table if not exists public.tier0_candidates_150_shadow (
  id uuid primary key default gen_random_uuid(),
  -- period_key = 평가 identity; month = production 0028 date 키 mirror(join 가능).
  --   monthly stage-0 예: period_key='2026-06', month='2026-06-01'.
  --   future weekly short 예: period_key='2026-W25', month='2026-06-01' (서로 overwrite 안 함).
  --   주의(F4): weekly period_key는 SECONDARY(vs-persisted-150) 비교 대상이 아니다(monthly만 persisted 대응).
  --             weekly는 PRIMARY(arm-vs-mirror) 전용 — read/evaluator 단계에서 강제(§3.8).
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  month date not null check (extract(day from month) = 1),
  arm text not null check (
    arm in ('production-mirror','sector-soft-tilt','sector-hard-gate')
  ),
  hypothesis_id uuid not null references public.tier0_shadow_sector_hypothesis(id),
  ticker text not null check (ticker ~ '^[0-9]{6}$'),          -- 0028 패턴
  name text,                                                    -- descriptive, nullable(seam: ScoredStock엔 name 없음 — PR-B3가 universe join)
  -- canonical-14 OR 'unresolved' (shadow는 unresolved 허용; production은 canonical-14 only).
  sector text not null check (
    sector in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
               '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권','unresolved')
  ),
  bucket text not null check (bucket in ('short','mid','long')),
  rank int not null check (rank between 1 and 50),
  -- F10: shadow는 numeric(12,2)로 rounding 계약을 DB-layer에서 보장(SECONDARY parity ε=0 안전).
  --      production 0028은 numeric not null; shadow는 incomplete_run/invalid_input row가 score 없을 수 있어 nullable.
  tier0_score numeric(12, 2),
  signal_label text,                                            -- descriptive, nullable(seam: PR-B3가 build_bpp_candidate_rows에서 join)
  sector_view jsonb not null default '{"source":"absent","leadingSectors":[]}'::jsonb,
  counterfactual_cut jsonb not null default '[]'::jsonb,        -- hard-gate가 자른 종목(soft/mirror=[])
  sector_distribution jsonb not null default '{}'::jsonb,
  universe_hash text not null,
  -- universe_size = full pre-cut production universe = N DISTINCT tickers (NOT total rows; snapshot은 최대 3N row emit).
  -- 모든 arm(sector-hard-gate 포함)에서 full pre-cut universe (분모 universe-wide 고정, §6.2).
  universe_size int not null check (universe_size >= 150),
  -- post-(sector-)cut universe size = distinct gated sector-member ticker count (hard-gate arm only).
  --   섹터 멤버십 카운트(유동성 플로어/eligibility 적용 전) = compute_shadow_selections gate_eligible_size.
  --   nullable: mirror/soft-tilt ⇒ null, hard-gate ⇒ non-null(RPC가 강제). diagnostic metadata.
  gate_eligible_size int,
  run_id text not null,
  run_date timestamptz not null,
  status text not null default 'logged' check (status in ('logged','invalid_input','incomplete_run')),
  error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  -- 0028 contract mirror: 150 distinct per (period_key,arm); 50×3 disjoint bucket-rank.
  constraint shadow_uniq_period_arm_ticker unique (period_key, arm, ticker),
  constraint shadow_uniq_period_arm_bucket_rank unique (period_key, arm, bucket, rank),
  -- F3: hard-gate가 logged인데 gated universe < 150이면 150 disjoint 선정이 구조적으로 불가능 — DB-layer reject.
  --     RPC도 동일 guard(gate_underfill_must_be_incomplete)를 둔다(2중 방어).
  constraint shadow_hardgate_underfill_chk check (
    arm <> 'sector-hard-gate'
    or status <> 'logged'
    or (gate_eligible_size is not null and gate_eligible_size >= 150)
  )
);

-- ===========================================================================
-- (2) full-universe ranked snapshot (하드게이트 counterfactual + recall 분모 입력, §3.7)
--     ONE row per (ticker, bucket): N tickers → 최대 3N row. universe_size = N DISTINCT tickers.
--     forward 수익률 컬럼은 저장하지 않는다(ticker set만; forward는 PIT panel에서 계산, §3.7).
-- ===========================================================================
create table if not exists public.tier0_shadow_universe_snapshot (
  id uuid primary key default gen_random_uuid(),
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  month date not null check (extract(day from month) = 1),
  run_id text not null,
  ticker text not null check (ticker ~ '^[0-9]{6}$'),
  name text,
  sector text not null check (           -- 현재맵 스냅샷(PIT forward 누적)
    sector in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
               '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권','unresolved')
  ),
  sector_source text check (sector_source in ('override','mapper','unresolved')),
  induty_code text,
  sector_view jsonb not null default '{"source":"absent","leadingSectors":[]}'::jsonb,
  bucket text not null check (bucket in ('short','mid','long')),
  rank int check (rank is null or rank >= 1), -- full-universe rank within bucket, candidate 1..50 아님
  tier0_score numeric(12, 2),
  universe_hash text not null,
  universe_size int not null check (universe_size >= 150),
  run_date timestamptz not null,
  created_at timestamptz not null default now(),
  constraint shadow_universe_uniq unique (period_key, run_id, ticker, bucket)
);

-- ===========================================================================
-- (3) unresolved 진단 (B89 relaxation, informational; candidates payload 미혼합 — FIX-I)
-- ===========================================================================
create table if not exists public.tier0_shadow_unresolved_issues (
  id uuid primary key default gen_random_uuid(),
  period_key text not null check (
    period_key ~ '^\d{4}-\d{2}$' or period_key ~ '^\d{4}-W\d{2}$'
  ),
  month date not null check (extract(day from month) = 1),
  run_id text not null,
  ticker text not null check (ticker ~ '^[0-9]{6}$'),
  name text,
  induty_code text,
  sector_source text not null check (sector_source in ('override','mapper','unresolved')),
  created_at timestamptz not null default now(),
  constraint shadow_unresolved_uniq unique (period_key, run_id, ticker)
);

-- ===========================================================================
-- RLS + grants
-- ===========================================================================
alter table public.tier0_shadow_sector_hypothesis   enable row level security;
alter table public.tier0_candidates_150_shadow      enable row level security;
alter table public.tier0_shadow_universe_snapshot   enable row level security;
alter table public.tier0_shadow_unresolved_issues   enable row level security;

-- grant 패턴 (feedback_supabase_security_definer_pattern + T2-I-6 production K=0):
--   revoke all → authenticated만 SELECT(RLS admin gate). service_role은 SELECT조차 부여 안 함
--   (production cron/server-action가 service_role로 shadow를 우연히 read→오염하는 경로를 DB-layer로 차단).
--   shadow write는 전부 SECURITY DEFINER RPC(owner=migration 적용자) 경유 → service_role엔 RPC EXECUTE만.
-- F7: policy DROP-first로 멱등(0034 패턴) — 부분 재적용/복구 재실행 안전.
do $$
declare t text;
begin
  foreach t in array array[
    'tier0_shadow_sector_hypothesis','tier0_candidates_150_shadow',
    'tier0_shadow_universe_snapshot','tier0_shadow_unresolved_issues'
  ] loop
    execute format('revoke all on table public.%I from public', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('revoke all on table public.%I from service_role', t);    -- SELECT 포함 전부 revoke
    execute format('grant select on table public.%I to authenticated', t);   -- RLS admin gate (UI read만)
    -- ⚠️ service_role SELECT grant 의도적 부재 (T2-I-6): production 경로가 shadow를 못 읽게 DB-layer 봉쇄.
    --    write는 DEFINER RPC(owner 권한)로 동작하므로 service_role table grant 불필요.
    execute format('drop policy if exists %I on public.%I', t || ' admin select', t);   -- F7 멱등
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin())',
      t || ' admin select', t
    );
    -- 적대 리뷰(security P2): 0034/0001 house 패턴 정합 — anon RESTRICTIVE deny backstop.
    --   anon은 이미 grant 부재로 read 불가하나, 미래 우발 grant/default-privilege 재부여에도
    --   구조적으로 막히도록 restrictive 정책을 둔다(grant 부재 단독 의존 제거).
    execute format('drop policy if exists %I on public.%I', t || ' anon block', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon using (false)',
      t || ' anon block', t
    );
  end loop;
end $$;

-- ===========================================================================
-- register_shadow_hypothesis — append-only pre-registration write path (completeness F1).
--   finalize RPC는 pre-existing hypothesis row를 요구하나 0039는 그 row를 만들 write 경로가 없었다.
--   service_role/authenticated EXECUTE. immutable: 같은 (period_key,source,hypothesis_hash)면
--   내용까지 동일할 때만 기존 id를 idempotent하게 반환(no overwrite). 같은 hash로 다른 내용을
--   재등록하면 caller-supplied hash collision/p-hack로 보고 reject한다.
--   absent-shape 강제(leading_sectors=[], params={}, as_of null) + canonical-14 + as_of<selection_as_of.
--   hypothesis_hash = caller가 계산한 identity 키(서버 재계산 안 함 — pgcrypto 의존/cross-lang 결합 회피).
--   immutability = unique(period_key,source,hypothesis_hash) + shape guard + on-conflict-do-nothing.
-- ===========================================================================
create or replace function public.register_shadow_hypothesis(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_created_by uuid;
  v_period_key text;
  v_source text;
  v_leading jsonb;
  v_as_of timestamptz;
  v_selection_as_of timestamptz;
  v_params jsonb;
  v_hash text;
  v_id uuid;
  v_created_at timestamptz;
  v_existing record;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload_must_be_object'; end if;

  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
    v_created_by := auth.uid();
  end if;

  v_period_key := p_payload->>'period_key';
  v_source := p_payload->>'source';
  v_leading := coalesce(p_payload->'leading_sectors', '[]'::jsonb);
  v_params := coalesce(p_payload->'params', '{}'::jsonb);
  v_hash := p_payload->>'hypothesis_hash';

  if v_period_key is null or not (v_period_key ~ '^\d{4}-\d{2}$' or v_period_key ~ '^\d{4}-W\d{2}$') then
    raise exception 'bad_period_key';
  end if;
  if v_source not in ('absent','manual_pre_registered') then raise exception 'bad_source'; end if;
  if jsonb_typeof(v_leading) <> 'array' then raise exception 'leading_sectors_must_be_array'; end if;
  if jsonb_typeof(v_params) <> 'object' then raise exception 'params_must_be_object'; end if;
  if nullif(v_hash,'') is null then raise exception 'hypothesis_hash_required'; end if;

  if nullif(p_payload->>'selection_as_of','') is null then raise exception 'selection_as_of_required'; end if;
  begin
    v_selection_as_of := (p_payload->>'selection_as_of')::timestamptz;
  exception when others then raise exception 'bad_selection_as_of';
  end;
  if nullif(p_payload->>'as_of','') is not null then
    begin
      v_as_of := (p_payload->>'as_of')::timestamptz;
    exception when others then raise exception 'bad_as_of';
    end;
  end if;
  if v_as_of is not null and v_as_of >= v_selection_as_of then raise exception 'asof_must_precede_selection'; end if;

  -- canonical-14 enum guard (SQL == canonical-sectors.ts; 'unresolved'는 leadingSectors 멤버 불가).
  if exists (
    select 1 from jsonb_array_elements_text(v_leading) s(sec)
    where s.sec not in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
                        '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권')
  ) then raise exception 'bad_canonical_sector'; end if;
  -- duplicate leading sector reject.
  if (select count(*) from jsonb_array_elements_text(v_leading)) <>
     (select count(distinct s.sec) from jsonb_array_elements_text(v_leading) s(sec)) then
    raise exception 'duplicate_leading_sector';
  end if;

  if v_source = 'absent' then
    if v_leading <> '[]'::jsonb or v_params <> '{}'::jsonb or v_as_of is not null then
      raise exception 'bad_absent_hypothesis';
    end if;
  else  -- manual_pre_registered
    if jsonb_array_length(v_leading) = 0 then raise exception 'leading_sectors_required'; end if;
    if v_as_of is null then raise exception 'as_of_required'; end if;
  end if;

  -- append-only / immutable: hypothesis_hash는 caller가 SHA-256으로 계산한 identity 키다.
  --   server-side hash 재계산은 의도적으로 하지 않는다(pgcrypto digest()는 Supabase에서 extensions 스키마라
  --   `set search_path = public, pg_temp`와 충돌하고, cross-language hash-format 결합이 brittle하다).
  --   대신 conflict path에서 기존 row의 content를 재대조한다. 동일 키+동일 identity 내용 재호출만 idempotent이고,
  --   같은 caller-supplied hash로 다른 sectors/asOf/params를 보내면 p-hack/collision으로 reject.
  select coalesce(jsonb_agg(to_jsonb(s.sec) order by case s.sec
      when '바이오' then 1 when '반도체' then 2 when '건설' then 3 when '금융' then 4
      when '2차전지' then 5 when '자동차' then 6 when 'IT/SW' then 7
      when '유통/소비재' then 8 when '에너지' then 9 when '엔터/미디어' then 10
      when '통신' then 11 when '철강/소재' then 12 when '운송/물류' then 13
      when '보험/증권' then 14 end), '[]'::jsonb)
    into v_leading
  from jsonb_array_elements_text(v_leading) s(sec);
  insert into public.tier0_shadow_sector_hypothesis
    (period_key, source, leading_sectors, as_of, selection_as_of, params, hypothesis_hash, created_by)
  values
    (v_period_key, v_source, v_leading, v_as_of, v_selection_as_of, v_params, v_hash, v_created_by)
  on conflict (period_key, source, hypothesis_hash) do nothing
  returning id, created_at into v_id, v_created_at;

  if v_id is null then
    -- 같은 (period_key,source,hypothesis_hash) row가 이미 있음. IDENTITY content 동일할 때만 idempotent.
    select * into v_existing
    from public.tier0_shadow_sector_hypothesis
    where period_key = v_period_key and source = v_source and hypothesis_hash = v_hash;
    if not found then raise exception 'hypothesis_conflict_not_found'; end if;
    -- PR-B3 F3-NEW: selection_as_of는 hash IDENTITY가 아니다(caller hypothesis_hash가 제외) — 같은 가설을
    --   다른 run에서 재선정하면 selection_as_of만 달라지므로 idempotent re-register여야 한다(append-only:
    --   최초 등록 selection_as_of가 canonical, 유지). recheck는 identity content(leading_sectors/params/as_of)만
    --   비교한다. selection_as_of까지 비교하면 동일 period 2회차 absent run이 hypothesis_hash_content_mismatch로
    --   깨진다(stage-0 re-run은 정상 동작이어야 함). 진짜 hash 충돌(다른 identity, 같은 hash)은 여전히 잡힌다.
    if v_existing.leading_sectors <> v_leading
       or v_existing.params <> v_params
       or v_existing.as_of is distinct from v_as_of then
      raise exception 'hypothesis_hash_content_mismatch';
    end if;
    v_id := v_existing.id;
    v_created_at := v_existing.created_at;
    return jsonb_build_object('id', v_id, 'created_at', v_created_at, 'idempotent', true);
  end if;

  return jsonb_build_object('id', v_id, 'created_at', v_created_at, 'idempotent', false);
end; $$;

-- ===========================================================================
-- INTERNAL helper: _shadow_write_candidates — one arm payload(finalize가 arms[]에서 분해).
--   un-granted, finalize RPC 내부에서만 호출. SECURITY DEFINER, owner = migration 적용자.
-- ===========================================================================
create or replace function public._shadow_write_candidates(p_arm_payload jsonb)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_period_key text;
  v_month_input text;
  v_month date;
  v_arm text;
  v_bucket text;
  v_hash text;
  v_run_id text;
  v_hypothesis_id uuid;
  v_hypothesis_id_input text;
  v_universe_size int;
  v_universe_size_input text;
  v_gate_eligible_size int;
  v_gate_eligible_size_input text;
  v_status text;
  v_created_by uuid;
  v_count int;
  v_sector_source text;
begin
  if p_arm_payload is null or jsonb_typeof(p_arm_payload) <> 'object' then
    raise exception 'payload_must_be_object';
  end if;

  -- authz: stage 0 = service_role only. admin replay UI는 별도 PR에서 grant + caller spec.
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
    v_created_by := auth.uid();
  end if;

  v_period_key := p_arm_payload->>'period_key';
  v_month_input := p_arm_payload->>'month';
  if nullif(v_period_key,'') is null then v_period_key := v_month_input; end if; -- monthly shorthand only
  v_arm := p_arm_payload->>'arm';
  v_hash := p_arm_payload->>'universe_hash';
  v_run_id := p_arm_payload->>'run_id';
  v_hypothesis_id_input := nullif(p_arm_payload->>'hypothesis_id','');
  v_universe_size_input := nullif(p_arm_payload->>'universe_size','');
  v_gate_eligible_size_input := nullif(p_arm_payload->>'gate_eligible_size','');
  v_status := coalesce(p_arm_payload->>'status','logged');
  v_sector_source := coalesce(p_arm_payload#>>'{sector_view,source}', 'absent');

  if v_period_key is null or not (v_period_key ~ '^\d{4}-\d{2}$' or v_period_key ~ '^\d{4}-W\d{2}$') then
    raise exception 'bad_period_key';
  end if;
  begin
    if v_month_input ~ '^\d{4}-\d{2}$' then
      v_month := (v_month_input || '-01')::date;
    elsif v_month_input ~ '^\d{4}-\d{2}-01$' then
      v_month := v_month_input::date;
    else
      raise exception 'bad_month';
    end if;
  exception when others then raise exception 'bad_month';
  end;
  if v_period_key ~ '^\d{4}-\d{2}$' and v_period_key <> to_char(v_month, 'YYYY-MM') then
    raise exception 'period_month_mismatch';
  end if;
  if v_arm not in ('production-mirror','sector-soft-tilt','sector-hard-gate') then raise exception 'bad_arm'; end if;
  if v_hypothesis_id_input is null then raise exception 'hypothesis_id_required'; end if;
  if v_hypothesis_id_input !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'bad_hypothesis_id';
  end if;
  if v_universe_size_input is null or v_universe_size_input !~ '^[0-9]+$' or length(v_universe_size_input) > 10 then
    raise exception 'bad_universe_size';
  end if;
  if v_universe_size_input::numeric > 2147483647 then raise exception 'bad_universe_size'; end if;
  if v_gate_eligible_size_input is not null then
    if v_gate_eligible_size_input !~ '^[0-9]+$' or length(v_gate_eligible_size_input) > 10 then
      raise exception 'bad_gate_eligible_size';
    end if;
    if v_gate_eligible_size_input::numeric > 2147483647 then raise exception 'bad_gate_eligible_size'; end if;
  end if;
  v_hypothesis_id := v_hypothesis_id_input::uuid;
  v_universe_size := v_universe_size_input::int;
  v_gate_eligible_size := v_gate_eligible_size_input::int;
  if v_arm = 'sector-hard-gate' and (v_gate_eligible_size is null or v_gate_eligible_size < 0) then
    raise exception 'gate_eligible_size_required_for_hard_gate';
  end if;
  if v_arm <> 'sector-hard-gate' and v_gate_eligible_size is not null then
    raise exception 'gate_eligible_size_only_for_hard_gate';
  end if;
  if nullif(v_hash,'') is null then raise exception 'universe_hash_required'; end if;   -- parity 강제
  if nullif(v_run_id,'') is null then raise exception 'run_id_required'; end if;
  if v_universe_size is null or v_universe_size < 150 then raise exception 'bad_universe_size'; end if;
  if not exists (
    select 1 from public.tier0_shadow_sector_hypothesis h
    where h.id = v_hypothesis_id and h.period_key = v_period_key
  ) then raise exception 'hypothesis_not_registered'; end if;
  if v_status not in ('logged','invalid_input','incomplete_run') then raise exception 'bad_status'; end if;
  if v_sector_source not in ('absent','manual_pre_registered') then raise exception 'bad_sector_source'; end if;
  if v_sector_source = 'manual_pre_registered' then
    if jsonb_array_length(coalesce(p_arm_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) = 0 then
      raise exception 'leading_sectors_required';
    end if;
    if nullif(p_arm_payload#>>'{sector_view,asOf}', '') is null then raise exception 'sector_asof_required'; end if;
    begin
      perform (p_arm_payload#>>'{sector_view,asOf}')::timestamptz;
    exception when others then raise exception 'bad_sector_asof';
    end;
  end if;
  -- canonical-14 enum 가드 (SQL == canonical-sectors.ts; §5.4 parity 검증)
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_arm_payload#>'{sector_view,leadingSectors}', '[]'::jsonb)) s(sec)
    where s.sec not in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
                        '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권')
  ) then raise exception 'bad_canonical_sector'; end if;
  -- F3: hard-gate가 logged인데 gated universe < 150이면 150 disjoint 선정 불가 → incomplete_run으로만 허용.
  if v_arm = 'sector-hard-gate' and v_status = 'logged' and v_gate_eligible_size < 150 then
    raise exception 'gate_underfill_must_be_incomplete';
  end if;
  if pg_column_size(p_arm_payload) > 8 * 1024 * 1024 then raise exception 'payload_too_large'; end if;
  -- FIX-B (symmetric fail-closed, last cast boundary): run_date ::timestamptz throws opaque 22007 on a malformed
  --   value; wrap in a typed guard so producer bugs surface as bad_run_date, not a raw datetime error.
  if nullif(p_arm_payload->>'run_date','') is not null then
    begin
      perform (p_arm_payload->>'run_date')::timestamptz;
    exception when others then raise exception 'bad_run_date';
    end;
  end if;

  -- per-row FORMAT guard runs for ANY row-bearing status (logged/incomplete_run/invalid_input): the INSERT below
  --   casts (e->>'rank')::int and ::numeric REGARDLESS of status, so a malformed row in a NON-logged arm would
  --   otherwise leak opaque 22P02/22008 instead of a typed error (symmetric fail-closed,
  --   feedback_failclosed_symmetric_completion — was previously logged-only). Absent/empty rows allowed for
  --   non-logged arms (0 elements → no checks). FIX-C: sector mirrors the snapshot guard (else opaque 23514/23502).
  if (p_arm_payload ? 'rows') and jsonb_typeof(p_arm_payload->'rows') <> 'array' then
    raise exception 'rows_must_be_array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_arm_payload->'rows','[]'::jsonb)) e
    where coalesce(e->>'ticker','') !~ '^[0-9]{6}$'
       or coalesce(e->>'bucket','') not in ('short','mid','long')
       or coalesce(e->>'sector','') not in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
              '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권','unresolved')
       -- FIX-B: numeric rank(1..50, cast-free range regex)/tier0_score(format+overflow) typed before the INSERT cast.
       or coalesce(e->>'rank','') !~ '^([1-9]|[1-4][0-9]|50)$'
       or case
            when nullif(e->>'tier0_score','') is null then false
            when e->>'tier0_score' !~ '^-?[0-9]+(\.[0-9]+)?$' or length(e->>'tier0_score') > 32 then true
            else abs((e->>'tier0_score')::numeric) >= 9999999999.995
          end
  ) then raise exception 'row_invalid'; end if;

  -- 150 COUNT contract is logged-only (incomplete_run/invalid_input may carry fewer/no rows).
  if v_status = 'logged' then
    -- fail-closed: logged candidates require a complete matching full-universe snapshot first(같은 run_id).
    if not exists (
      select 1
      from public.tier0_shadow_universe_snapshot s
      where s.period_key = v_period_key
        and s.run_id = v_run_id
        and s.universe_hash = v_hash
        and s.universe_size = v_universe_size
      group by s.period_key, s.run_id, s.universe_hash, s.universe_size
      having count(distinct s.ticker) = v_universe_size
    ) then raise exception 'matching_complete_snapshot_required'; end if;
    if jsonb_array_length(coalesce(p_arm_payload->'rows','[]'::jsonb)) <> 150 then raise exception 'rows_count_must_be_150'; end if;
    if (select count(distinct e->>'ticker') from jsonb_array_elements(p_arm_payload->'rows') e) <> 150 then
      raise exception 'rows_duplicate_ticker';
    end if;
    foreach v_bucket in array array['short','mid','long'] loop
      if (select count(*) from jsonb_array_elements(p_arm_payload->'rows') e where e->>'bucket' = v_bucket) <> 50 then
        raise exception 'bucket_count_must_be_50:%', v_bucket;
      end if;
    end loop;
  end if;

  -- idempotent per (period_key, arm): delete then insert (set-based, 0028 mirror — shadow table만)
  delete from public.tier0_candidates_150_shadow where period_key = v_period_key and arm = v_arm;

  insert into public.tier0_candidates_150_shadow (
    period_key, month, arm, hypothesis_id, ticker, name, sector, bucket, rank, tier0_score, signal_label,
    sector_view, counterfactual_cut, sector_distribution, universe_hash, universe_size, gate_eligible_size,
    run_id, run_date, status, error, created_by
  )
  select
    v_period_key, v_month, v_arm, v_hypothesis_id,
    e->>'ticker', e->>'name', e->>'sector', e->>'bucket', (e->>'rank')::int,
    nullif(e->>'tier0_score','')::numeric, e->>'signal_label',
    coalesce(p_arm_payload->'sector_view', '{"source":"absent","leadingSectors":[]}'::jsonb),
    coalesce(p_arm_payload->'counterfactual_cut', '[]'::jsonb),
    coalesce(p_arm_payload->'sector_distribution', '{}'::jsonb),
    v_hash, v_universe_size, v_gate_eligible_size,
    v_run_id, coalesce((p_arm_payload->>'run_date')::timestamptz, now()),
    v_status, p_arm_payload->>'error', v_created_by
  from jsonb_array_elements(coalesce(p_arm_payload->'rows','[]'::jsonb)) e;

  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- ===========================================================================
-- INTERNAL helper: _shadow_write_universe_snapshot — full-universe snapshot writer.
--   un-granted, finalize RPC 내부에서만 호출. insert-only(hard-gate counterfactual + recall 분모).
--   F1/F3/AB-BUG 정정: undefined p_arm_payload → p_payload.
--   F8/F9: snapshot row typed guard(bucket/ticker regex + (ticker,bucket) 중복 + sector/sector_source enum).
--   F2: run-level snapshot 완전성은 _shadow_write_candidates의 matching_complete_snapshot 게이트가
--       (period_key,run_id) 스코프로 보장 — 여기선 period-level stale run을 finalize가 미리 정리한다.
-- ===========================================================================
create or replace function public._shadow_write_universe_snapshot(p_payload jsonb)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_period_key text;
  v_month_input text;
  v_month date;
  v_hash text;
  v_run_id text;
  v_universe_size int;
  v_universe_size_input text;
  v_count int;
begin
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
  end if;
  v_period_key := p_payload->>'period_key'; v_month_input := p_payload->>'month'; v_hash := p_payload->>'universe_hash';
  v_run_id := p_payload->>'run_id'; v_universe_size_input := nullif(p_payload->>'universe_size','');
  if nullif(v_period_key,'') is null then v_period_key := v_month_input; end if;
  if v_period_key is null or not (v_period_key ~ '^\d{4}-\d{2}$' or v_period_key ~ '^\d{4}-W\d{2}$') then
    raise exception 'bad_period_key';
  end if;
  begin
    if v_month_input ~ '^\d{4}-\d{2}$' then
      v_month := (v_month_input || '-01')::date;
    elsif v_month_input ~ '^\d{4}-\d{2}-01$' then
      v_month := v_month_input::date;
    else
      raise exception 'bad_month';
    end if;
  exception when others then raise exception 'bad_month';
  end;
  if v_period_key ~ '^\d{4}-\d{2}$' and v_period_key <> to_char(v_month, 'YYYY-MM') then
    raise exception 'period_month_mismatch';
  end if;
  if nullif(v_hash,'') is null then raise exception 'universe_hash_required'; end if;
  if nullif(v_run_id,'') is null then raise exception 'run_id_required'; end if;
  if v_universe_size_input is null or v_universe_size_input !~ '^[0-9]+$' or length(v_universe_size_input) > 10 then
    raise exception 'bad_universe_size';
  end if;
  if v_universe_size_input::numeric > 2147483647 then raise exception 'bad_universe_size'; end if;
  v_universe_size := v_universe_size_input::int;
  if v_universe_size is null or v_universe_size < 150 then raise exception 'bad_universe_size'; end if;
  if coalesce(jsonb_typeof(p_payload->'snapshot_rows'),'null') <> 'array' then raise exception 'snapshot_rows_must_be_array'; end if;
  if jsonb_array_length(p_payload->'snapshot_rows') < v_universe_size then raise exception 'snapshot_rows_lt_universe_size'; end if;
  if (select count(distinct e->>'ticker') from jsonb_array_elements(p_payload->'snapshot_rows') e) <> v_universe_size then
    raise exception 'snapshot_distinct_ticker_mismatch';
  end if;
  -- F8: (ticker,bucket) 중복은 unique 위반(opaque 23505) 대신 typed error로 fail-closed.
  if (select count(*) from jsonb_array_elements(p_payload->'snapshot_rows') e)
     <> (select count(distinct (e->>'ticker', e->>'bucket')) from jsonb_array_elements(p_payload->'snapshot_rows') e) then
    raise exception 'snapshot_duplicate_ticker_bucket';
  end if;
  -- F8/F9: row typed guard — bucket/ticker regex + sector enum(canonical-14 ∪ unresolved) + sector_source enum.
  --   (unresolved writer와 대칭; snapshot은 recall 분모 입력이라 NULL/garbage sector를 막아야 PIT 정확).
  if exists (
    select 1 from jsonb_array_elements(p_payload->'snapshot_rows') e
    where coalesce(e->>'ticker','') !~ '^[0-9]{6}$'
       or coalesce(e->>'bucket','') not in ('short','mid','long')
       or coalesce(e->>'sector','') not in ('바이오','반도체','건설','금융','2차전지','자동차','IT/SW',
              '유통/소비재','에너지','엔터/미디어','통신','철강/소재','운송/물류','보험/증권','unresolved')
       or (nullif(e->>'sector_source','') is not null
           and e->>'sector_source' not in ('override','mapper','unresolved'))
       -- FIX-B (symmetric fail-closed): nullable rank/tier0_score도 present일 때 typed 포맷 가드
       --   (비숫자/overflow가 ::int/::numeric cast에서 opaque error로 새지 않게). snapshot rank는 nullable.
       or case
            when nullif(e->>'rank','') is null then false
            when e->>'rank' !~ '^[0-9]+$' or length(e->>'rank') > 10 then true
            else (e->>'rank')::numeric > 2147483647
          end
       or case
            when nullif(e->>'tier0_score','') is null then false
            when e->>'tier0_score' !~ '^-?[0-9]+(\.[0-9]+)?$' or length(e->>'tier0_score') > 32 then true
            else abs((e->>'tier0_score')::numeric) >= 9999999999.995
          end
  ) then raise exception 'snapshot_row_invalid'; end if;
  -- FIX-B (symmetric fail-closed, last cast boundary): run_date ::timestamptz typed guard (bad_run_date).
  if nullif(p_payload->>'run_date','') is not null then
    begin
      perform (p_payload->>'run_date')::timestamptz;
    exception when others then raise exception 'bad_run_date';
    end;
  end if;

  -- idempotent per (period_key, run_id). period-level stale run 정리는 finalize RPC가 수행(F2).
  delete from public.tier0_shadow_universe_snapshot where period_key = v_period_key and run_id = v_run_id;
  insert into public.tier0_shadow_universe_snapshot (
    period_key, month, run_id, ticker, name, sector, sector_source, induty_code, sector_view,
    bucket, rank, tier0_score, universe_hash, universe_size, run_date
  )
  select v_period_key, v_month, v_run_id, e->>'ticker', e->>'name', e->>'sector',
         e->>'sector_source', e->>'induty_code',
         coalesce(p_payload->'sector_view', '{"source":"absent","leadingSectors":[]}'::jsonb),   -- F1: p_payload (was p_arm_payload)
         e->>'bucket',
         nullif(e->>'rank','')::int, nullif(e->>'tier0_score','')::numeric,
         v_hash, v_universe_size, coalesce((p_payload->>'run_date')::timestamptz, now())          -- F1: p_payload (was p_arm_payload)
  from jsonb_array_elements(p_payload->'snapshot_rows') e;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- ===========================================================================
-- INTERNAL helper: _shadow_write_unresolved — unresolved 진단 writer.
--   un-granted, finalize RPC 내부에서만 호출. insert-only(B89 relaxation, informational).
-- ===========================================================================
create or replace function public._shadow_write_unresolved(p_payload jsonb)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_role text; v_period_key text; v_month_input text; v_month date; v_run_id text; v_count int;
begin
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
  end if;
  v_period_key := p_payload->>'period_key'; v_month_input := p_payload->>'month'; v_run_id := p_payload->>'run_id';
  if nullif(v_period_key,'') is null then v_period_key := v_month_input; end if;
  if v_period_key is null or not (v_period_key ~ '^\d{4}-\d{2}$' or v_period_key ~ '^\d{4}-W\d{2}$') then
    raise exception 'bad_period_key';
  end if;
  begin
    if v_month_input ~ '^\d{4}-\d{2}$' then
      v_month := (v_month_input || '-01')::date;
    elsif v_month_input ~ '^\d{4}-\d{2}-01$' then
      v_month := v_month_input::date;
    else
      raise exception 'bad_month';
    end if;
  exception when others then raise exception 'bad_month';
  end;
  if v_period_key ~ '^\d{4}-\d{2}$' and v_period_key <> to_char(v_month, 'YYYY-MM') then
    raise exception 'period_month_mismatch';
  end if;
  if coalesce(jsonb_typeof(p_payload->'unresolved_rows'),'null') <> 'array' then raise exception 'unresolved_rows_must_be_array'; end if;
  if nullif(v_run_id,'') is null then raise exception 'run_id_required'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'unresolved_rows') e
    where coalesce(e->>'ticker','') !~ '^[0-9]{6}$'
       or coalesce(e->>'sector_source','') not in ('override','mapper','unresolved')
  ) then raise exception 'unresolved_row_invalid'; end if;

  delete from public.tier0_shadow_unresolved_issues where period_key = v_period_key and run_id = v_run_id;   -- idempotent per period/run
  insert into public.tier0_shadow_unresolved_issues (period_key, month, run_id, ticker, name, induty_code, sector_source)
  select v_period_key, v_month, v_run_id, e->>'ticker', e->>'name', e->>'induty_code', e->>'sector_source'
  from jsonb_array_elements(p_payload->'unresolved_rows') e;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

-- ===========================================================================
-- (4) SINGLE ATOMIC FINALIZE RPC — the only candidate/snapshot write deliverable.
--   one transaction, one shared run_id: hypothesis check → snapshot_rows → ALL active arms → unresolved_rows.
--   service_role EXECUTE는 이 RPC + register_shadow_hypothesis 에만 부여(3 helper는 un-granted).
-- ===========================================================================
create or replace function public.upsert_tier0_shadow_run(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role text;
  v_period_key text;
  v_run_id text;
  v_hypothesis_id uuid;
  v_hypothesis_id_input text;
  v_universe_size int;
  v_universe_size_input text;
  v_sector_source text;
  v_hypothesis record;
  v_registered_sector_view jsonb;
  v_snap_count int;
  v_cand_count int := 0;
  v_one_count int;
  v_unres_count int;
  v_arm jsonb;
  v_arm_payload jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload_must_be_object'; end if;
  v_role := coalesce((select auth.role()), '');
  if v_role <> 'service_role' then
    if auth.uid() is null then raise exception 'auth_unavailable'; end if;
    if not public.is_admin() then raise exception 'admin_required'; end if;
  end if;

  v_period_key := coalesce(nullif(p_payload->>'period_key',''), p_payload->>'month');
  v_run_id := p_payload->>'run_id';
  v_hypothesis_id_input := nullif(p_payload->>'hypothesis_id','');
  v_universe_size_input := nullif(p_payload->>'universe_size','');
  v_sector_source := coalesce(p_payload#>>'{sector_view,source}', 'absent');
  if nullif(v_run_id,'') is null then raise exception 'run_id_required'; end if;
  if v_hypothesis_id_input is null then raise exception 'hypothesis_id_required'; end if;
  if v_hypothesis_id_input !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'bad_hypothesis_id';
  end if;
  if v_universe_size_input is null or v_universe_size_input !~ '^[0-9]+$' or length(v_universe_size_input) > 10 then
    raise exception 'bad_universe_size';
  end if;
  if v_universe_size_input::numeric > 2147483647 then raise exception 'bad_universe_size'; end if;
  v_hypothesis_id := v_hypothesis_id_input::uuid;
  v_universe_size := v_universe_size_input::int;
  if coalesce(jsonb_typeof(p_payload->'snapshot_rows'),'null') <> 'array' then raise exception 'snapshot_rows_required'; end if;
  if coalesce(jsonb_typeof(p_payload->'arms'),'null') <> 'array' then raise exception 'arms_required'; end if;
  if jsonb_array_length(p_payload->'arms') < 1 or jsonb_array_length(p_payload->'arms') > 3 then raise exception 'bad_arm_count'; end if;
  if coalesce(jsonb_typeof(p_payload->'unresolved_rows'),'null') <> 'array' then raise exception 'unresolved_rows_required'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'arms') a
    where coalesce(a->>'arm','') not in ('production-mirror','sector-soft-tilt','sector-hard-gate')
  ) then raise exception 'bad_arm'; end if;
  if (select count(*) from jsonb_array_elements(p_payload->'arms')) <>
     (select count(distinct a->>'arm') from jsonb_array_elements(p_payload->'arms') a) then
    raise exception 'duplicate_arm';
  end if;
  if exists (select 1 from jsonb_array_elements(p_payload->'arms') a where a->>'arm' <> 'production-mirror')
     and not exists (select 1 from jsonb_array_elements(p_payload->'arms') a where a->>'arm' = 'production-mirror') then
    raise exception 'production_mirror_required_for_paired_run';
  end if;

  -- (0) hypothesis existence + immutable content binding.
  select h.* into v_hypothesis
  from public.tier0_shadow_sector_hypothesis h
  where h.id = v_hypothesis_id and h.period_key = v_period_key;
  if not found then raise exception 'hypothesis_not_registered'; end if;
  if v_hypothesis.source <> v_sector_source then raise exception 'hypothesis_source_mismatch'; end if;
  if v_hypothesis.source = 'absent' then
    if v_hypothesis.leading_sectors <> '[]'::jsonb or v_hypothesis.params <> '{}'::jsonb or v_hypothesis.as_of is not null then
      raise exception 'bad_absent_hypothesis';
    end if;
  end if;
  -- Derive persisted metadata from the registered hypothesis row, not from caller-provided copies. This closes the
  -- p-hack hole where a caller references a valid manual hypothesis id but sends different sectors/asOf/params.
  v_registered_sector_view := jsonb_build_object(
    'source', v_hypothesis.source,
    'leadingSectors', v_hypothesis.leading_sectors,
    'asOf', v_hypothesis.as_of,
    'selectionAsOf', v_hypothesis.selection_as_of,
    'params', v_hypothesis.params,
    'hypothesisHash', v_hypothesis.hypothesis_hash
  );
  -- F5: caller가 sector_view를 보냈으면 row-derived view와 대조한다. caller payload는 identity SUBSET일 수
  --     있으므로(PR-B3는 source/leadingSectors/hypothesisHash만 전송) **present 필드만** 검증한다 —
  --     이는 spec §5.4 exact-equality 의도를 partial-payload 프로토콜에 맞춰 정합화한 것이다(저장값은 항상
  --     row-derived이므로 absent 필드는 p-hack 불가). present일 때는 params(jsonb canonical 비교)와
  --     asOf/selectionAsOf(timestamptz INSTANT 비교 — 텍스트 렌더 foot-gun 회피)까지 전부 대조한다.
  if (p_payload ? 'sector_view') then
    if (p_payload#>>'{sector_view,source}') is distinct from v_hypothesis.source then
      raise exception 'hypothesis_source_mismatch';
    end if;
    if (p_payload#>'{sector_view}' ? 'leadingSectors')
       and coalesce(p_payload#>'{sector_view,leadingSectors}', '[]'::jsonb) <> v_hypothesis.leading_sectors then
      raise exception 'hypothesis_content_mismatch';
    end if;
    if (p_payload#>'{sector_view}' ? 'hypothesisHash')
       and (p_payload#>>'{sector_view,hypothesisHash}') is distinct from v_hypothesis.hypothesis_hash then
      raise exception 'hypothesis_content_mismatch';
    end if;
    -- F5(restore §5.4): params(canonical jsonb)·asOf·selectionAsOf도 present일 때 대조.
    if (p_payload#>'{sector_view}' ? 'params')
       and coalesce(p_payload#>'{sector_view,params}', '{}'::jsonb) <> v_hypothesis.params then
      raise exception 'hypothesis_content_mismatch';
    end if;
    if (p_payload#>'{sector_view}' ? 'asOf') then
      begin
        if (nullif(p_payload#>>'{sector_view,asOf}','')::timestamptz is distinct from v_hypothesis.as_of) then
          raise exception 'hypothesis_content_mismatch';
        end if;
      exception when others then raise exception 'hypothesis_content_mismatch';
      end;
    end if;
    if (p_payload#>'{sector_view}' ? 'selectionAsOf') then
      begin
        if (nullif(p_payload#>>'{sector_view,selectionAsOf}','')::timestamptz is distinct from v_hypothesis.selection_as_of) then
          raise exception 'hypothesis_content_mismatch';
        end if;
      exception when others then raise exception 'hypothesis_content_mismatch';
      end;
    end if;
  end if;
  -- authoritative sector_view = row-derived (caller copy는 위에서 identity 검증만; 저장은 항상 derived).
  p_payload := jsonb_set(p_payload, '{sector_view}', v_registered_sector_view, true);

  -- (1) universe snapshot first → (2) ALL active arms candidates → (3) unresolved.
  -- All writes occur in this one transaction and share (period_key, run_id). Arm omission is authoritative: delete
  -- stale period-level candidates before reinserting active arms, so old arm rows cannot be accidentally paired.
  -- F2: period-level stale SNAPSHOT도 정리한다 — 같은 period의 과거 run_id snapshot이 남아
  --     evaluator의 (period_key,run_id) join에 foreign run이 섞이지 않도록(replay history 불필요한 stage 0 정책).
  delete from public.tier0_candidates_150_shadow where period_key = v_period_key;
  delete from public.tier0_shadow_universe_snapshot where period_key = v_period_key and run_id <> v_run_id;
  delete from public.tier0_shadow_unresolved_issues where period_key = v_period_key and run_id <> v_run_id;

  v_snap_count := public._shadow_write_universe_snapshot(p_payload);          -- uses p_payload.snapshot_rows
  -- F2: run-level snapshot 완전성 단언 — candidates 전에 current run snapshot이 universe_size만큼 완전한지 확인.
  --     (helper는 payload array를 검증; 여기선 post-insert table state를 단언해 candidate 게이트 전제를 봉인.)
  -- `is distinct from` (NOT `<>`): if universe_size were ever NULL, `count <> NULL` = NULL = false would
  --   silently skip this defense-in-depth assertion (3-valued-logic trap). is distinct from raises correctly.
  if (select count(distinct ticker)
        from public.tier0_shadow_universe_snapshot
       where period_key = v_period_key and run_id = v_run_id)
     is distinct from v_universe_size then
    raise exception 'snapshot_incomplete_after_write';
  end if;

  for v_arm in select value from jsonb_array_elements(p_payload->'arms') loop
    -- SECURITY (run-level authority): run-level keys MUST win over any same-named key an arm object injects.
    --   `arm_obj || run_level` (run-level on the right) overrides arm-injected period_key/month/run_id/
    --   hypothesis_id/universe_hash/universe_size/sector_view/run_date. Otherwise a malicious/buggy arm could
    --   dodge universe_size>=150, break candidates.run_id==snapshot.run_id pairing, or forge sector_view past
    --   content-binding. Per-arm keys (arm/status/rows/counterfactual_cut/sector_distribution/gate_eligible_size/
    --   error) are disjoint from run-level keys, so they survive the merge from the arm object.
    v_arm_payload := v_arm || (p_payload - 'arms' - 'snapshot_rows' - 'unresolved_rows');
    v_one_count := public._shadow_write_candidates(v_arm_payload);            -- uses this arm's rows
    v_cand_count := v_cand_count + v_one_count;
  end loop;
  v_unres_count := public._shadow_write_unresolved(p_payload);                -- uses p_payload.unresolved_rows

  return jsonb_build_object('run_id', v_run_id, 'snapshot', v_snap_count,
                            'candidates', v_cand_count, 'unresolved', v_unres_count,
                            'arms', jsonb_array_length(p_payload->'arms'));
end; $$;

-- ===========================================================================
-- function grants:
--   register_shadow_hypothesis + upsert_tier0_shadow_run = service_role(+authenticated for register) EXECUTE.
--   3 per-table writers(_shadow_write_*) = un-granted(어떤 role에도 grant 없음; finalize RPC 내부에서만 호출).
-- ===========================================================================
revoke all on function public.register_shadow_hypothesis(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.register_shadow_hypothesis(jsonb) to authenticated;
grant execute on function public.register_shadow_hypothesis(jsonb) to service_role;

revoke all on function public.upsert_tier0_shadow_run(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.upsert_tier0_shadow_run(jsonb) to service_role;

revoke all on function public._shadow_write_universe_snapshot(jsonb) from public, anon, authenticated, service_role;
revoke all on function public._shadow_write_candidates(jsonb) from public, anon, authenticated, service_role;
revoke all on function public._shadow_write_unresolved(jsonb) from public, anon, authenticated, service_role;

-- table/column documentation
comment on table public.tier0_candidates_150_shadow is
  'Track 2 generator-shadow: sector-aware shadow 150 후보(arm별). production tier0_candidates_150 무변경(T2-I-2). latest-only per (period_key,arm). evaluator는 candidates.run_id로 snapshot/unresolved를 (period_key,run_id) join.';
comment on table public.tier0_shadow_universe_snapshot is
  'Track 2: full-universe ranked snapshot(ticker,bucket당 1행, N→최대 3N행). recall 분모 universe-wide + hard-gate counterfactual 입력(§3.7). forward 수익률 미저장.';
comment on table public.tier0_shadow_sector_hypothesis is
  'Track 2: immutable append-only pre-registration(주도섹터 가설 + tilt params). register_shadow_hypothesis로만 write. forward 무결성(asOf<selectionAsOf) + p-hack 차단.';
comment on column public.tier0_candidates_150_shadow.tier0_score is
  'shadow score numeric(12,2). production 0028은 not-null; shadow nullable(incomplete_run/invalid_input row는 score 없을 수 있음). SECONDARY parity는 round(_,2) ε=0(F10).';
comment on column public.tier0_candidates_150_shadow.gate_eligible_size is
  'hard-gate arm only(non-null). 섹터 멤버십 distinct ticker 수(유동성 플로어 적용 전). logged면 >=150 강제(F3, gate_underfill_must_be_incomplete).';

commit;
