# G1 Tier0 Reflection Lab (B-2) — 계측 scaffold spec (D33)

- Date: 2026-06-28
- Branch: `tier0-bpp-multiregime`
- SoT 선행: `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md` G1 · HANDOFF §"다음 할 일" 6/9 + §2.2 runbook
- 범주 분리(혼동 금지): **G1 = numeric funnel 가중치 회고**(B++ Tier0 funnel) ≠ **PR-K(D32) = prompt 주입 회고**(선정 패널). 별도 타입·별도 출력.

## 0. 범위 (HANDOFF: "최소 빌드 — 로그·제안만 · 계측 먼저·완성 늦게")
- 과거 150/30 + 실현 수익률 postmortem → 다음 달 B++ funnel 가중치 **champion/challenger 제안만 → USER 승인**.
- **diagnostic only · 자동 적용 영구 금지 · NO-CONFIG-PASSES/예측 claim 금지 · forward-validate(예측 아님)**.
- 본 PR = **계측 scaffold**(로그 스키마 + 결정론 제안 생성 + 제안 적재 entry + USER 표시/승인 surface). 깊은 분석(factor-return 정밀 attribution)은 S9 관찰 중 완성("완성 늦게").

## 1. 마이그 0047 (dormant) — `tier0_funnel_reflection`
- 컬럼: `id`, `period_key`(YYYY-MM[-Wnn]), `created_at`, `reflection_kind text CHECK = 'funnel_weight_retro'`(예측 방지 — retro만), `champion_config jsonb`(현 B++ 가중치 스냅샷), `challenger_config jsonb`(제안 가중치), `rationale text`, `evidence jsonb`(150 recall·factor-return 상관·size/leader 커버 등 진단치), `status text CHECK in('proposed','approved','rejected') default 'proposed'`, `decided_by uuid`, `decided_at timestamptz`, UNIQUE(period_key) (월 1 제안).
- RLS admin all. `.rollback` + `pg_smoke_0047`(CHECK·unique·status enum·reflection_kind retro-only·RLS).
- **DORMANT(USER apply-only)**.

## 2. 순수 로직 `lib/reflection/funnel-reflection.ts` (G1 — PR-K reflection과 별 디렉토리 항목)
- `buildFunnelReflection(input)` 순수: input = { periodKey, championConfig, candidates(150 + bucket/factor exposures), realizedReturns(per-ticker) } → `{ evidence(recall@k·factor↔return rank상관·size/leader 커버), challengerConfig(가중치 delta 제안), rationale }`.
- **결정론·diagnostic**: factor-return 순위상관 부호로 challenger 가중치를 작게 nudge(예: trend↔return 양상관↑면 trend weight +δ). **예측 claim 0**(rationale에 "진단·forward-validate 필요·자동 적용 금지" 박제). δ는 작고 bounded(과적합 방지).
- forward-validate seam: challenger는 "다음 기간 forward 적용 후 평가" 대상(즉시 채택 아님).

## 3. 데이터 레이어 `data/admin-funnel-reflection.ts`
- `insertFunnelReflectionProposal(row, {client})` (status='proposed', dormant) · `getFunnelReflectionProposals({client})` (admin read) · `decideFunnelReflection(id, 'approved'|'rejected')` (RPC 또는 owner UPDATE — **승인=기록만, 적용 아님**).

## 4. 진입 (계측, dormant)
- `lib/reflection/funnel-reflection-job.ts` orchestrator(게이트 `FUNNEL_REFLECTION_ENABLED` default off → no-op) — 과거 period의 candidates + realized returns 로드(KRX·무비용) → buildFunnelReflection → insert proposal. cron route는 reflection-job 패턴(미스케줄, USER go-live) 또는 admin manual trigger. **mutation 0(short_list_30/funnel config 무변경) — 제안 로그만**.
- 계측 먼저: 스키마+로그+제안 적재가 S9 첫날부터 데이터 축적(HANDOFF "D11 직후 병렬 착수").

## 5. UI (최소) — `/admin/track-record` 또는 신규 카드
- funnel reflection 제안 목록(champion vs challenger + evidence + rationale) + **승인/거절 버튼(기록만, 자동 적용 아님)** + "diagnostic·자동 적용 금지·예측 아님" 가드 카피. 빈 상태(제안 부재).

## 6. 가드레일 (코드화)
- [ ] 자동 적용 0: 승인해도 funnel config/production 무변경(approve=status 기록만). grep: funnel config write 0.
- [ ] reflection_kind='funnel_weight_retro' CHECK(예측 kind 금지) + rationale 예측어휘 0 + "자동 적용 금지" 박제.
- [ ] PR-K(reflectionLearningContext/reflection_log)와 별 테이블·별 타입(혼동 금지 테스트).
- [ ] 게이트 off → no-op·mutation 0. challenger δ bounded(과적합 방지).
- [ ] 마이그 0047 DORMANT + rollback + PG smoke + RLS.
- [ ] forward-validate(즉시 채택 아님) 박제.

## 7. USER 게이트
- 마이그 0047 apply · `FUNNEL_REFLECTION_ENABLED=true` · `KRX_OPENAPI_KEY`(realized returns) · funnel reflection job schedule/manual trigger. challenger 채택은 **USER 승인 + 별도 forward-validate 후에만**(자동 0).
