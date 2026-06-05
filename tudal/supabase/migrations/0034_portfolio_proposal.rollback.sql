-- 0034_portfolio_proposal.rollback.sql — W3b-2a 영속 스키마 롤백.
-- 순서: 함수 2개 drop → 테이블 drop. created_by는 plain uuid(FK 없음)이라 cascade 불필요.
-- ⚠️ drop table은 portfolio_proposal 데이터 전체를 제거한다(영속 제안 이력 소멸). rollback 전 백업 판단은 USER.

begin;

drop function if exists public.upsert_portfolio_proposal(date, jsonb, numeric, text, text);
drop function if exists public.assert_portfolio_proposal_schema();
drop table if exists public.portfolio_proposal;

commit;
