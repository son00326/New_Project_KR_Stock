-- 0025_upsert_report_sections_0_7_admin.sql
-- B65-P2 옵션 A (R8 final lock-in) — admin-only UPSERT RPC.
-- spec: docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md
-- plan: docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md §3.1
-- 본질 = admin trigger의 ad-hoc 특정 종목 본문 (section_0~7 + appendix) 생성/재생성.
-- cron path (commit_persona_eval + update_report_sections_0_7)와 분리 — 충돌 0.
--
-- versioning policy: overwrite-in-place (0017/0022 패턴 보존).
--   version/schema_version/is_latest/regen_auto_count/regen_manual_count = TDD invariant 불변.
-- section_8/consensus_badge preserve: UPDATE 시 미터치 (cron path 미경유 시 null 유지 / 경유 후 보존).
--
-- 4-grant 패턴 (0022 패턴 변형 — admin-only):
--   public/anon/service_role REVOKE + authenticated GRANT only.
--   service_role GRANT 금지 + 명시 REVOKE 강제 (cron path가 본 RPC를 우회하도록 강제 — cron은 commit_persona_eval 사용).
--   CREATE OR REPLACE FUNCTION은 과거 잘못 부여된 권한을 보존할 수 있음 (omxy R1 Kepler B2 critical).
--   따라서 미부여(grant 누락)만으로는 약함 — 명시 revoke all from service_role 필수.
-- regprocedure signature: 11 args = 2 text + 9 jsonb (omxy R1 Kepler M1).

create or replace function public.upsert_report_sections_0_7_admin(
  p_ticker text,
  p_month text,
  p_section_0 jsonb,
  p_section_1 jsonb,
  p_section_2 jsonb,
  p_section_3 jsonb,
  p_section_4 jsonb,
  p_section_5 jsonb,
  p_section_6 jsonb,
  p_section_7 jsonb,
  p_appendix jsonb
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid;
  v_report_id uuid;
begin
  -- input regex guard (0022 패턴 동일 — PostgreSQL POSIX regex portability)
  if p_ticker !~ '^[0-9]{6}$' then
    raise exception 'invalid_ticker';
  end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month';
  end if;

  -- admin-only auth (service_role bypass 분기 부재 — cron path는 별도 path 사용).
  v_caller := auth.uid();
  if v_caller is null then
    raise exception 'auth_unavailable';
  end if;
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  -- UPSERT: INSERT if missing (admin trigger button = missing-row 시나리오)
  --         UPDATE if exists  (regen page = preflight + counter 선행 → row 존재 시나리오)
  -- ON CONFLICT (ticker, month) WHERE is_latest = true:
  --   0003 line 38~40 partial unique index stock_reports_ticker_month_latest_uniq 정합.
  -- 보존 컬럼 (UPDATE 분기에서 미터치):
  --   - section_8 / consensus_badge (cron path preserve)
  --   - version / schema_version / is_latest (versioning overwrite-in-place 패턴)
  --   - regen_auto_count / regen_manual_count (incrementManualRegenCount data-layer 책임)
  insert into public.stock_reports (
    ticker, month,
    section_0, section_1, section_2, section_3,
    section_4, section_5, section_6, section_7,
    appendix, generated_at
  ) values (
    p_ticker, to_date(p_month || '-01', 'YYYY-MM-DD'),
    p_section_0, p_section_1, p_section_2, p_section_3,
    p_section_4, p_section_5, p_section_6, p_section_7,
    p_appendix, now()
  )
  on conflict (ticker, month) where is_latest = true do update
    set section_0 = excluded.section_0,
        section_1 = excluded.section_1,
        section_2 = excluded.section_2,
        section_3 = excluded.section_3,
        section_4 = excluded.section_4,
        section_5 = excluded.section_5,
        section_6 = excluded.section_6,
        section_7 = excluded.section_7,
        appendix = excluded.appendix,
        generated_at = now()
  returning id into v_report_id;

  if v_report_id is null then
    -- ON CONFLICT branch에서 unique index 정합 실패 시 (사실상 0 — 안전망)
    raise exception 'upsert_report_sections_0_7_admin_failed_no_returning';
  end if;

  return json_build_object('success', true, 'report_id', v_report_id);
end;
$$;

-- 4-grant (옵션 A admin-only — service_role 의도적 미부여 + 명시 REVOKE)
-- CREATE OR REPLACE FUNCTION은 과거 잘못 부여된 권한을 보존할 수 있음 (omxy R1 Kepler BLOCKER-2 critical).
-- 따라서 미부여(grant 누락)만으로는 약함 — 명시 REVOKE 강제.
revoke all on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from anon;
revoke all on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from service_role;  -- omxy R1 Kepler B2 fix: 명시 REVOKE
grant execute on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
-- 의도적으로 service_role GRANT 미수행 + 명시 REVOKE. cron path는 commit_persona_eval + update_report_sections_0_7 사용.

comment on function public.upsert_report_sections_0_7_admin(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'B65-P2 옵션 A (spec 2026-05-26 R8 final) — admin-only UPSERT RPC. section_0~7 + appendix only. section_8/consensus_badge/version/schema_version/regen_* 모두 preserve. service_role grant 의도적 미부여 (admin-only path 보장). cron path는 commit_persona_eval + update_report_sections_0_7 사용 — 충돌 0. PR4_TRIGGER_UPSERT_ENABLED=true feature flag 시 orchestrator가 호출.';
