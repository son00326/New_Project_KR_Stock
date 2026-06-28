-- 0049 rollback — reset_sector_board_eligible_jobs 제거.
drop function if exists public.reset_sector_board_eligible_jobs(text);
