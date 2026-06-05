-- migration: 0035_snapshot_cash_row_index
-- purpose: W3b-2c — portfolio_snapshot 명시 cash 행(ticker=NULL, is_cash=true) 허용.
--   기존 (date) where ticker is null 부분 unique(0005:41-43)는 날짜당 ticker=NULL 행 1개만 허용 →
--   aggregate(is_cash=false)와 cash(is_cash=true) 공존 불가. is_cash 분기 2개로 분할한다.
-- 성격: additive · behavior-preserving.
--   - 기존 ticker=NULL 행은 전부 is_cash=false → 새 aggregate 인덱스가 동일하게 날짜당 1개 강제(제약 불변).
--   - cash 인덱스는 신규 허용분(dormant) — cash 행 emission은 W3b flag 경로(buildSnapshotRowsFromProposal)에서만.
-- RLS/grant 무변경(index-only). 선행: 0005(portfolio_snapshot) 적용 상태.
-- ref: docs/superpowers/plans/2026-06-05-w3b2c-explicit-cash-row.md §2

begin;

-- (R33 MED1) Option B invariant DB 강제: is_cash=true 행은 반드시 ticker IS NULL.
--   이게 없으면 미래 writer/수동 INSERT가 ticker='CASH', is_cash=true 행을 넣어 per-ticker
--   consumer(fetchTickerRows: ticker IS NOT NULL)로 cash가 종목처럼 유입될 수 있다.
--   기존 데이터는 전부 is_cash=false → `not false = true` → 전수 통과(behavior-preserving).
alter table public.portfolio_snapshot
  add constraint portfolio_snapshot_cash_ticker_null_chk
  check (not is_cash or ticker is null);

-- 기존 (date) where ticker is null 단일 인덱스 제거.
drop index if exists public.portfolio_snapshot_date_portfolio_uniq;

-- ① aggregate 행(ticker NULL, is_cash=false): 날짜당 1개 (기존 데이터·코드와 동일 제약).
create unique index if not exists portfolio_snapshot_date_agg_uniq
  on public.portfolio_snapshot (date)
  where ticker is null and is_cash is false;

-- ② cash 행(ticker NULL, is_cash=true): 날짜당 1개 (신규 허용분).
create unique index if not exists portfolio_snapshot_date_cash_uniq
  on public.portfolio_snapshot (date)
  where ticker is null and is_cash is true;

commit;
