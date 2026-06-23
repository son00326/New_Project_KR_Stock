begin;
-- rollback: 0038_shadow_arm_log — Track 1 shadow 관측 전부 삭제(USER 수용 사항). Production tables 무변경.
drop function if exists public.upsert_shadow_arm_log(jsonb);
drop table if exists public.shadow_arm_log cascade;
commit;
