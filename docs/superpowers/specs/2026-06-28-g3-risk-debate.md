# G3 Risk 3자 토론 (B-3) — advisory/shadow layer spec (D33)

- Date: 2026-06-28
- Branch: `tier0-bpp-multiregime`
- SoT 선행: `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md` G3 · HANDOFF §2.2 runbook
- 범주 분리: G3 = **포트 구성당 1회 위험 재판정**(공격/보존/중립 3-debator) advisory layer ≠ M12a(뉴스 thesis-break) ≠ G1(funnel 회고) ≠ D19 합의 배지(선정).

## 0. 범위 (HANDOFF)
- portfolio Accept 전 **포트 구성당 1회**(거래별 아님 = cost cap), 30선정+포트(Q2 자율)를 risk 3-debator(공격/보존/중립)로 위험도 재판정 → 통과/조건부/거절.
- **advisory/shadow layer (비강제)** — Accept 게이트 substitute 아님(USER가 무시 가능, Accept 차단 안 함). 정보 제공만.
- shadow-first: 게이트 `RISK_DEBATE_ENABLED` off(default) → no-op·AI 0·비용 0. 실 AI=USER 키/비용 게이트(테스트 mock).
- 비용 중(3 debator LLM) → **포트 구성당 1회 + hardcap reservation** 준수.

## 1. 순수 로직 `lib/risk/risk-debate.ts`
- 3 stance(`aggressive`/`conservative`/`neutral`) 각: 포트(종목·비중·현금·섹터집중·단중장 분배) 위험 평가 → 구조화 판정 `{ stance, concern_level('low'|'medium'|'high'), key_risks[], verdict_vote('pass'|'conditional'|'reject') }`.
- `aggregateRiskVerdict(votes)` 결정론: 3표 → 최종 `pass`(과반 pass) / `conditional`(혼합/1+ conditional) / `reject`(2+ reject). **advisory** = Accept 비차단(결과는 표시만).
- LLM 호출은 DI(`callRiskDebator`) — 순수 aggregation은 env/AI 미접근(테스트 친화).

## 2. 마이그 0048 (dormant) — `risk_debate_assessment`
- 컬럼: `id`, `month`(YYYY-MM-01), `created_at`, `portfolio_proposal_id uuid`(평가 대상 포트, nullable), `final_verdict CHECK in('pass','conditional','reject')`, `votes jsonb`(3 stance 판정), `summary text`, `is_advisory boolean NOT NULL default true CHECK(is_advisory)`(비강제 박제 — 항상 advisory), UNIQUE(month) (포트 구성당 1회). RLS admin all.
- **DORMANT(USER apply-only)** + `.rollback` + `pg_smoke_0048`(CHECK·unique·is_advisory always-true·RLS).

## 3. orchestrator `lib/risk/risk-debate-orchestrator.ts`
- `runRiskDebate(portfolio, deps)` 게이트(`RISK_DEBATE_ENABLED` off→skip) → 3 stance 병렬 callRiskDebator(LLM, W0 provider 추상화 + hardcap reservation/cost-log fail-closed 재사용) → aggregateRiskVerdict → insert risk_debate_assessment(advisory). **mutation 0**(portfolio_proposal/approval/snapshot 무변경 — Accept 비차단). cost: 포트당 1회(month UNIQUE로 재실행 idempotent skip).
- 비용 가드: W0 preflight reservation + AI_COST_LOG fail-closed(M12a/PR-K 패턴 재사용).

## 4. UI (advisory 표시) — `/admin/portfolio` Accept 영역
- 최신 risk_debate_assessment 있으면: 최종 verdict 배지(통과/조건부/거절) + 3 stance 요약 + key_risks + **"advisory — Accept 차단 아님, 참고용"** 가드 카피. 부재 → 미표시(또는 "위험 재판정 미실행"). **Accept 버튼 동작 무변경**(verdict가 reject여도 Accept 가능).

## 5. 가드레일 (코드화)
- [ ] advisory 비강제: Accept 경로(portfolio/actions.ts acceptShortList) **무변경**(grep: risk_debate가 accept 차단/게이트에 개입 0). is_advisory always true CHECK.
- [ ] 포트 구성당 1회: month UNIQUE → 재실행 idempotent(비용 cap). 거래별 호출 0.
- [ ] shadow-first: RISK_DEBATE_ENABLED off → no-op·AI 0·비용 0·mutation 0.
- [ ] 실 AI는 테스트 mock(₩0) + W0 hardcap reservation/cost-log fail-closed.
- [ ] 범주 분리: risk_debate ≠ M12a ≠ G1 ≠ 합의배지(별 테이블·타입).
- [ ] 마이그 0048 DORMANT + rollback + PG smoke + RLS.

## 6. USER 게이트
- 마이그 0048 apply · `RISK_DEBATE_ENABLED=true` · `AI_COST_LOG_REAL_INSERT_ENABLED` + AI 키 + 비용 승인 · (포트 구성 시 1회 트리거).
