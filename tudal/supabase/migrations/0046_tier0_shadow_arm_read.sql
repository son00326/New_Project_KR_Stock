-- migration: 0046_tier0_shadow_arm_read
-- purpose: B-1 섹터 비교 메뉴 — tier0_candidates_150_shadow arm top-N admin read RPC.
-- ref: docs/superpowers/specs/2026-06-28-sector-comparison-menu.md §1
-- 배경: 0039 shadow 테이블은 table-level SELECT가 모든 role에서 revoke됨(production 코드 오염 방지).
--       섹터 비교 메뉴(admin read-only)가 읽으려면 SECURITY DEFINER read RPC가 필요.
-- 가드레일: read-only(SELECT만, write 0) · sector-hard-gate arm은 영구 제외(soft only) · is_admin() self-gate.
-- 선행: 0039(shadow 테이블).
--
-- DORMANT (USER apply-only): 0039+0046 미적용 시 read 경로는 빈 결과(fail-soft). 적용 = USER 게이트.

create or replace function public.get_tier0_shadow_arm_top(
  p_arm text,
  p_period_key text,
  p_limit_per_bucket int default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
  v_limit int;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  -- soft 비교 전용 — sector-hard-gate는 영구 금지(diagnostic only, production/메뉴 노출 X).
  if p_arm not in ('production-mirror', 'sector-soft-tilt') then
    raise exception 'invalid_arm';
  end if;
  if p_period_key is null or p_period_key !~ '^\d{4}-(\d{2}|W\d{2})$' then
    raise exception 'invalid_period_key';
  end if;
  v_limit := greatest(1, least(coalesce(p_limit_per_bucket, 10), 50));

  select coalesce(jsonb_agg(r order by r.bucket, r.rank), '[]'::jsonb)
  into v_rows
  from (
    select ticker, name, sector, bucket, rank, tier0_score
    from public.tier0_candidates_150_shadow
    where arm = p_arm
      and period_key = p_period_key
      and rank <= v_limit
  ) r;

  return v_rows;
end;
$$;

-- 3종 grant 세트 (memory feedback_supabase_security_definer_pattern):
-- read-only + is_admin self-gate → authenticated grant 안전. anon/public revoke(least privilege).
revoke execute on function public.get_tier0_shadow_arm_top(text, text, int) from public;
revoke execute on function public.get_tier0_shadow_arm_top(text, text, int) from anon;
grant execute on function public.get_tier0_shadow_arm_top(text, text, int) to authenticated;
