-- 0022_update_report_sections_0_7.sql
-- PR3b: writer Section 0~7 본문 commit RPC.
-- commit_persona_eval (0017)가 row 먼저 INSERT 후 본 RPC가 Section 0~7 + Appendix UPDATE.
-- omxy R1+R2+R3+R4+R5 24 BLOCKERS CONVERGED:
--   R1 P0 #1: stock_reports.month=date → to_date(p_month || '-01', 'YYYY-MM-DD')
--   R1 P0 #2: SECURITY DEFINER + auth.uid + is_admin guard (0017 commit_persona_eval 패턴)
--   R1 P0 #3 / R2 B12: PR1 cron actual path = createServiceRoleClient → 4-grant 필요 (service_role bypass)
--   R2 B13: search_path = public, pg_temp (0017/0021 패턴 정합)
--   R2 B14: input regex guard (p_ticker '^[0-9]{6}$' + p_month '^[0-9]{4}-[0-9]{2}$', PostgreSQL POSIX regex portability)

create or replace function public.update_report_sections_0_7(
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
  v_role text;
  v_report_id uuid;
begin
  -- B14 input regex guard (R3 [0-9] portability — PostgreSQL POSIX regex)
  if p_ticker !~ '^[0-9]{6}$' then
    raise exception 'invalid_ticker';
  end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'invalid_month';
  end if;

  -- B12 caller guard: service_role direct call (PR4 cron) OR authenticated admin
  -- (0017 패턴: auth.uid null guard + is_admin check; 0021 패턴: service_role bypass)
  -- 3-track W7 fix: coalesce defensive — auth.role() null edge case (JWT decode failure) 안전.
  v_role := coalesce((select auth.role()), '');
  if v_role = 'service_role' then
    -- cron path: service_role direct. PR4 route layer가 CRON_SECRET 검증 후 진입 (B18 contract).
    null;
  else
    v_caller := auth.uid();
    if v_caller is null then
      raise exception 'auth_unavailable';
    end if;
    if not public.is_admin() then
      raise exception 'admin_required';
    end if;
  end if;

  -- R1 P0 #1 fix: month = to_date(...)
  -- 3-track CR-1 fix (Track 2 I3 + Track 3 Angle 3 CONFIRMED): generated_at = now() bump.
  -- Regen 시 UI 일자 표시 + 캐시/staleness check + Track Record analytics가 신선한 본문을 stale로
  -- 잘못 인식하는 위험 차단. 본 PR3b는 UPDATE-only (versioning history 보존은 PR4 wire에서 결정).
  update public.stock_reports
  set
    section_0 = p_section_0,
    section_1 = p_section_1,
    section_2 = p_section_2,
    section_3 = p_section_3,
    section_4 = p_section_4,
    section_5 = p_section_5,
    section_6 = p_section_6,
    section_7 = p_section_7,
    appendix = p_appendix,
    generated_at = now()
  where ticker = p_ticker
    and month = to_date(p_month || '-01', 'YYYY-MM-DD')
    and is_latest = true
  returning id into v_report_id;

  if v_report_id is null then
    raise exception 'report_not_found_for_section_0_7_update' using errcode = 'P0002';
  end if;

  return json_build_object('success', true, 'report_id', v_report_id);
end;
$$;

-- B12 4-grant (0021 패턴): public/anon revoke + authenticated + service_role grant.
revoke all on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

comment on function public.update_report_sections_0_7(text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) is
  'PR3b — writer Section 0~7 + Appendix UPDATE. commit_persona_eval가 row 먼저 INSERT 후 본 RPC 호출. service_role direct (PR4 cron, CRON_SECRET route guard) OR authenticated admin (PR4 UI). month=date cast (R1 P0 #1). search_path public,pg_temp (R2 B13). input regex guard (R2 B14 + R3 [0-9] portability). row 부재 시 report_not_found_for_section_0_7_update raise (errcode P0002).';
