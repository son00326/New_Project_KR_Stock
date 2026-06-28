-- 0049 — reset_sector_board_eligible_jobs (PR-T2a 완결성 갭 fix).
--   배경: Core-11 Section 8(partD)은 commit됐으나 Tier2 섹터 보드(section_8.partA 14인 +
--   partC.sector_aggregate)가 실패(commitSectorBoardStep은 throw 없이 log만)한 리포트는 job=done으로
--   영구 skip → 섹터 보드 영구 누락. reset_section8_eligible_jobs(0036)는 "section_8 null"만 잡아 이
--   "section_8 present + 섹터 보드 누락" 케이스를 못 잡는다(완결성 게이트가 Core-only).
--   → flag-on(SECTOR_BOARD_ENABLED) enqueue 단계에서 "body complete(section_0&&7) + section_8 present +
--   섹터 보드 누락(partA <14) + canonical AI 배지"인 done 또는 deferred(sector_board_not_ready) job만
--   pending reset → worker needsSectorBoardOnly 경로로 섹터 보드만 targeted 재commit.
--   ⚠️ deferred(sector_unresolved)[비-canonical 종목, 섹터 보드 적용 불가 terminal]는 reset 제외 →
--   무한 reset 루프 차단. ⚪/null 배지 row도 reset 안 함(배지 생긴 뒤에만 eligible).
--   DORMANT: caller(worker)는 SECTOR_BOARD_ENABLED on일 때만 호출. service_role 전용(cron).
create or replace function public.reset_sector_board_eligible_jobs(p_month text)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_month_date date := to_date(p_month || '-01', 'YYYY-MM-DD');
begin
  update public.report_batch_job j
  set status = 'pending',
      attempts = 0,
      last_error = null,
      claimed_at = null,
      started_at = null,
      finished_at = null
  where j.month = p_month
    and (
      j.status = 'done'
      or (j.status = 'deferred' and j.last_error = 'sector_board_not_ready')
    )
    and exists (
      select 1 from public.stock_reports r
      where r.ticker = j.ticker
        and r.month = v_month_date
        and r.is_latest = true
        and r.section_0 is not null
        and r.section_7 is not null
        and r.section_8 is not null
        -- 섹터 보드 누락: partA가 array가 아니거나(없음) 14인 미만. jsonb_array_length는 array에만
        -- 적용(비-array면 error)하므로 CASE로 타입 가드 후 평가.
        and coalesce(
          case
            when jsonb_typeof(r.section_8 -> 'partA') = 'array'
              then jsonb_array_length(r.section_8 -> 'partA')
            else 0
          end,
          0
        ) < 14
    )
    and exists (
      select 1 from public.short_list_30 s
      where s.ticker = j.ticker
        and s.month = v_month_date
        and s.consensus_badge in ('🟢', '🔵', '🟣', '🟡')
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reset_sector_board_eligible_jobs(text) from public;
revoke all on function public.reset_sector_board_eligible_jobs(text) from anon;
-- ⚠️ Supabase default-privilege 자동 authenticated grant 명시 제거 (0036 reset_section8과 동일 이유 —
--   cron 전용 service-role RPC, RLS 우회 write이므로 authenticated/anon 노출 금지).
revoke all on function public.reset_sector_board_eligible_jobs(text) from authenticated;
grant execute on function public.reset_sector_board_eligible_jobs(text) to service_role;
