-- rollback: 0039_tier0_candidates_150_shadow
-- Track 2 generator-shadow artifact 전부 drop. PRODUCTION 무변경:
--   tier0_candidates_150 / short_list_30 / 그 외 모든 production table/RPC는 본 파일에서 참조하지 않는다.
-- 주의: 본 rollback은 shadow 관측 데이터를 전부 삭제한다(USER 수용 사항, T2-I-10 USER-only).
-- begin/commit으로 원자화(부분 rollback 방지).

begin;

-- functions (finalize RPC + register RPC + 3 internal helper)
drop function if exists public.upsert_tier0_shadow_run(jsonb);
drop function if exists public.register_shadow_hypothesis(jsonb);
drop function if exists public._shadow_write_candidates(jsonb);
drop function if exists public._shadow_write_universe_snapshot(jsonb);
drop function if exists public._shadow_write_unresolved(jsonb);

-- tables (cascade로 자체 index/policy/FK 정리; production 객체는 drop 대상 아님)
drop table if exists public.tier0_candidates_150_shadow cascade;
drop table if exists public.tier0_shadow_universe_snapshot cascade;
drop table if exists public.tier0_shadow_unresolved_issues cascade;
drop table if exists public.tier0_shadow_sector_hypothesis cascade;

commit;
