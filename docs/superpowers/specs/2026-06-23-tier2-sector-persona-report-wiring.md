# Tier 2 Sector Board — 30 리포트 작성 배선 (출시 전 deferred work 박제)

- **상태**: ✅ **PR-T2a 구현 완료 (2026-06-24, Claude↔omxy CONVERGED)** — §4 PR-T2a(섹터 보드 → live 리포트 cron seam) 빌드: 마이그 0040 `commit_sector_personas_cron`(0019의 service-role 변형, written-not-applied=USER apply 게이트) + writer `commitSectorReportCron`(composeSectorReportPayload DRY) + `runSectorEval` service-role DI(model-aware preflight, PR-T2b 흡수) + `sector-board-step.ts` commitSectorBoardStep + orchestrator `SECTOR_BOARD_ENABLED` seam(**section8 commit에 게이트** — omxy R1 HIGH fix). dormant default·production 무변경. test:ci 2064 pass·build·lint·tsc GREEN. 잔여 = **PR-T2c(Section 8 섹터 보드 FE 렌더)** + 새 30 리포트 생성(USER 마이그 0040 apply + flags + 비용). dangling triggerMonthlyPersonaEvalAction 삭제(D-1)는 후속. live SoT = `Document/Process/HANDOFF.md §9 #4`. (이하 원 스코핑 문서.)
- **작성**: 2026-06-23. **검증**: Claude 코드 정독 + omxy 교차검증 (cross-runtime adversarial).
- **SoT 연계**: parent `ServicePlan-Admin.md §1A.5 D21/D22` (Tier 2 14×14 overlay + Kevin v3.1 quality target) · `ReportFramework.md §7.2/§7.3` · `tudal/src/lib/screening/canonical-sectors.ts`.
- **경계**: 상단 상태가 현재값이다. 이하 §0~§9는 2026-06-23 원 스코핑 기록이며, PR-T2a 완료 후 남은 현재 작업은 **0040 written-not-applied USER gate + dormant flags + PR-T2c 렌더(+선택 D-1 cleanup)**이다.

---

## §0 목적 & 사용자 의도 (왜 이 문서)

USER (2026-06-23) 명시:

> "Kevin 에서 만든 페르소나는 내가 지금 **선정**하는데 사용하라고 하는게 아니야. 단기 중기 장기 각 10개씩 … 총 30개가 리스팅 … 10개 기업중 반도체 섹터에 해당하는 기업도 … 금융권 섹터에 해당하는 기업도 … **그 기업에 리포트를 만드는 작업**을 우리는 진행해. 리포트를 만들때 **kevin이 만들어놓은 페르소나를 적용**하라는거지."

→ Kevin 196 섹터 페르소나(14 sectors × 14 slots)는 **선정용이 아니라 30개 선정 기업 각각의 리포트 작성용**. 반도체 기업 리포트 = 반도체 14 페르소나, 금융 기업 리포트 = 금융 14 페르소나.

USER 시퀀싱 통찰 (2026-06-23):

> "리포트는 애초에 30개가 그나마 **정확하게 나올때** 그 리포트가 의미가 있지."

→ 이 배선 작업은 **선정 정확성(Tier0 D30 + Tier1) 확보 후 / 출시 전**. 지금 당장이 아니라 "출시 전 잊지 않게 박제"가 본 문서의 목적.

---

## §1 두 페르소나 레이어 구분 (혼동 방지)

| 레이어 | 인원 | 용도 | 코드 진입점 | 산출물 |
|---|---|---|---|---|
| **Core 11** | 11 (sector-agnostic) | **선정 + 합의 배지** + Section 8 Part D(위원회 종합) | `runTier1Screening` / `runMonthlyPersonaEval` (persona-eval.ts) · `CORE_11_PERSONAS` | weighted_scores → 30 선정 · 합의 배지 · Section 8 Part D + votes |
| **Kevin Sector Board** | 196 = **14 sectors × 14 slots** (10 base + 2 primary overlay + 2 sub_tag overlay) | **선정된 30개 각 기업 리포트의 섹터 보드** (Section 8 Part A + sector_aggregate) | `runSectorEval` (persona-eval.ts) → `commitSectorReport` (writer.ts) · `sector-persona-builder.ts` | 기업의 sector에 매칭된 14 페르소나 평가 → Section 8 섹터 보드 |

**핵심**: 선정(Core 11)과 리포트 섹터 보드(Kevin 196)는 **별개 레이어**. 본 문서는 후자(리포트 작성)의 배선만 다룸. 선정 로직은 무관.

---

## §2 현 상태 — 자산 인벤토리 (코드 정독 + omxy 검증)

### ✅ 존재 + 완성 (재사용 자산)

| 자산 | 위치 | 상태 |
|---|---|---|
| **섹터 페르소나 프롬프트 (14×14)** | `tudal/src/lib/ai/prompts/personas/sector-persona-builder.ts` (`resolveSectorPersona`, `SECTOR_PHILOSOPHIES` 14종, Kevin v3.1 rubric) | ✅ 프롬프트 레지스트리 배선됨 — `getPersonaById`(personas/index.ts:53)가 `sector-{sector}-slot-{N}` 패턴 parse → `resolveSectorPersona`. **(주의: 196은 14×14 dynamic resolvable prompt contracts이지 196개 static 파일이 아님 — builder가 runtime 생성)** |
| **sector → 14 slot 매핑** | `tudal/src/lib/screening/canonical-sectors.ts` (`CANONICAL_SECTORS` 14, `PRIMARY_OVERLAY_BY_SECTOR`, `SUB_TAG_CROSSWALK`, `resolveSlotTemplate`, `SECTOR_PERSONA_COUNT=14`) | ✅ |
| **per-ticker 섹터 eval scaffold** | `tudal/src/lib/screening/persona-eval.ts:187` `runSectorEval` (sector+sub_tags → 14 parallel calls, `available`/`degradedCount`, `preflightHardcap`) | ✅ callable + 단위 테스트 |
| **섹터 보드 commit** | `tudal/src/lib/report/writer.ts:251` `commitSectorReport` (RPC `commit_sector_personas`, 마이그 0019) + `commit_persona_eval_cron`(마이그 0036) | ✅ production applied |
| **게이트 helper** | `tudal/src/lib/screening/tier2-gate.ts:15` `shouldRunTier2(badge)` = `badge ≠ '⚪'` **AND** `AI_COST_LOG_REAL_INSERT_ENABLED === 'true'` (strict literal) | ✅ 원 PR #9 helper는 공유 비용 플래그 기반. **PR-T2a live seam은 별도 `SECTOR_BOARD_ENABLED` dormant flag를 추가**해 활성화를 분리. |

### [HISTORICAL 2026-06-23] caller가 dangling — live 경로 미배선 (= PR-T2a 전 갭의 본체)

> **2026-06-24 현재**: PR-T2a로 live 경로 seam은 완료/CONVERGED. 아래 bullets는 PR-T2a 전 원 갭의 증거이며, 남은 현재 작업은 USER gate + PR-T2c 렌더(+선택 D-1 cleanup)다.

- **섹터-매칭 caller 로직은 존재하고 정확함**: `tudal/src/app/(admin)/admin/track-record/actions.ts` `triggerMonthlyPersonaEvalAction` (line 169~205):
  - Core 11 commit 직후 → `shouldRunTier2(badge)` 게이트 → `short_list_30.sector`를 `isCanonicalSector` 가드 → `runSectorEval({sector, sub_tags})` → `available` 시 `commitSectorReport`. **반도체→반도체 14, 금융→금융 14 매칭이 정확히 구현됨** (USER가 원한 동작).
  - PR #9 (MERGED, `feat/tier2-caller-wiring`) Step 3c 산출물. `Tier2Counters` 진단 카운터 포함.
- **그러나 이 action은 deprecated dangling**: `actions.ts:81` 주석 "triggerMonthlyPersonaEvalAction은 dangling(**UI caller 0**) + **D-1 deprecate 예정**." 확인: production UI/route caller 0건 (cost-logger.ts:43 + format-error.ts:53가 "UI caller 0 + D-1 deprecate" 명시).
- **live 리포트 생성 경로는 섹터 보드를 호출하지 않음**: `tudal/src/lib/report/full-report-batch-worker.ts` → `orchestrateFullReport(callerKind:'cron')`(full-report-orchestrator.ts) → **section_0~7 + appendix + Core-11 Section 8(PR5b flag-gated)** 만 생성. `runSectorEval`/`commitSectorReport` 미호출 (grep: live caller 0).
  - `writer.ts:111` `sector_aggregate: { buy: 0, hold: 0, sell: 0 } // Tier 2 미활성` · `writer.ts:123` `partA: [] // Tier 2 deferred` — Core 11 Section 8은 섹터 보드 자리를 0/빈 배열로 둠.
  - **실증**: P4 (75차) 30 리포트 `votes 330` = 30 ticker × 11 (Core 11). 섹터 보드 14×N 없음.

---

## §3 갭 — 한 줄 정의 (2026-06-23 원 갭; 2026-06-24 PR-T2a resolved)

> **원 갭(2026-06-23)**: 섹터-매칭 리포트 작성 로직은 이미 존재했지만 deprecated dangling action(`triggerMonthlyPersonaEvalAction`)에 갇혀 있었고, live 리포트 생성 경로(`orchestrateFullReport`/`full-report-batch-worker`)는 이를 우회했다.

→ **현재값(2026-06-24)**: PR-T2a가 섹터 보드 step을 live 경로로 이식 완료(`SECTOR_BOARD_ENABLED` dormant seam + 0040 written-not-applied). 남은 것은 USER gate + **PR-T2c 렌더**(+선택 D-1 cleanup)다.

### §3.1 USER 질문 (2026-06-23): "이것도 오류 아냐? 수정해야 하는 거 아냐?"

**답: 코드 버그는 아니지만, 의도한 최종 제품 대비 "미완성(deferred)"이 맞다 → 출시 전 고쳐야 한다.**

- **코드 버그 아님**: live 경로의 Core-11-only Section 8은 **의도된 현 상태**. 코드가 명시적으로 `// Tier 2 미활성` / `// Tier 2 deferred`(writer.ts:111/123)로 표시 — 섹터 보드(Tier 2)는 처음부터 flag-gated 후속 레이어로 설계됨. 파이프라인이 깨졌거나 잘못 동작하는 게 아님. 30 리포트는 정상 산출됨(Core 11 위원회 + section 0~7 서사 + appendix + 합의 배지).
- **그러나 USER 의도 대비 미완성**: USER가 원한 "기업 섹터별 Kevin 페르소나로 리포트 작성"은 **현 30 리포트(P4, 75차)에 반영 안 됨**(votes 330 = Core 11만, 섹터 보드 0). 즉 리포트가 섹터 보드 깊이(Section 8 Part A + sector_aggregate)를 결여 = **의도한 제품 대비 incomplete**.
- **고쳐야 하나?** 예 — **PR-T2a로 live 경로 배선은 완료/CONVERGED(2026-06-24)**. 단 활성화는 USER 마이그 0040 apply + flags + 비용 게이트 뒤이며, 기본은 dormant다. launch hard gate는 아님(Core 11 리포트로도 출시는 가능)이나, MVP ③ "30 리포트 정확/충실"의 quality 핵심이다.
- **요약(현재값)**: "오류"라기보다 의도된 deferral이었고, **PR-T2a로 생성 seam은 실현됨**. 남은 것은 새 B++ 30 리포트에 Tier2를 켜는 USER gate와 **PR-T2c 렌더**(+선택 D-1 cleanup)다.

---

## §4 [HISTORICAL 2026-06-23] 작업 분해 (PR-T2a 완료 전 원 계획)

| PR | 내용 | 비고 |
|---|---|---|
| ✅ **PR-T2a** (완료) | live 경로(`orchestrateFullReport`/sector-board-step)에 **섹터 보드 seam** 추가 완료 — Core-11 Section 8 commit 직후 `SECTOR_BOARD_ENABLED` + badge/sector guard → `runSectorEval` service-role DI → `commitSectorReportCron`. 마이그 0040은 written-not-applied(USER gate), default dormant. | 2026-06-24 CONVERGED |
| ✅ **PR-T2b** | 비용 가드/모델 preflight 정합 — `runSectorEval` service-role DI와 model-aware preflight로 PR-T2a에 흡수. | 완료/흡수 |
| **PR-T2c** (잔여) | Section 8 **렌더** — report page에서 sector board Part A + 실 `sector_aggregate` 표시 (현재 0/빈 fallback). FE-only. | 남은 구현 |

---

## §5 게이팅 & 시퀀싱 (USER 통찰 반영)

1. **Gate 1 (선행, 비-코드)** — **선정 정확성**: B++ G1/G2 적용으로 production 150/30이 교체됨(2026-06-24). 새 B++ 30 기준 리포트에 Tier2를 포함하는 것이 현재 경로다.
2. **Gate 2 (USER-only, 활성화)** — PR-T2a에서 독립 `SECTOR_BOARD_ENABLED` seam을 추가했고 default dormant. 새 30 리포트 생성 시 USER가 **마이그 0040 apply + `SECTOR_BOARD_ENABLED`/`PR5B_SECTION8_ENABLED`/`AI_COST_LOG_REAL_INSERT_ENABLED` + 비용 승인(~₩15-20k)**을 열어야 한다.
3. **시점** — 출시 **전** 완료 목표 (MVP ③ "30 리포트 정확"의 quality 상향). **launch hard gate는 아님** — Core 11 Section 8로도 리포트는 산출됨(P4 완주). 섹터 보드는 리포트 깊이/정확성 강화.

---

## §6 stale 브랜치 / PR 처리

- `feat/tier2-caller-wiring` (PR #9 **MERGED**) — Step 3c 내용(shouldRunTier2 + caller wiring + 8 tests)은 **이미 main에 반영됨**(track-record/actions.ts + tier2-gate.ts). 브랜치 tip이 옛 main 기반이라 `git diff origin/main`이 마이그 0034~0037 삭제로 보일 뿐 — **PR 자체는 머지 완료**. 추가 액션 불필요(브랜치 cleanup만 선택).
- 신규 배선(PR-T2a)은 **이 머지된 로직을 live 경로로 이식 완료(2026-06-24)**. 남은 정리는 선택 D-1 dangling action cleanup.

---

## §7 비용 (활성화 시)

- 14 sector personas × (badge ≠ ⚪ + tier1 available 한 ticker 수, ≤30) = **≤420 LLM calls/batch**.
- 단가 = W0 model-registry (D28 역할별 차등). `runSectorEval` service-role DI/model-aware preflight는 PR-T2a에서 반영됐고, PR-T2b는 흡수 완료.
- 활성화 = USER 비용 승인(1회) + `SECTOR_BOARD_ENABLED=true` + `PR5B_SECTION8_ENABLED=true` + `AI_COST_LOG_REAL_INSERT_ENABLED=true` + 마이그 0040 apply. 기본은 dormant라 spend/production 변화 없음.

---

## §8 [HISTORICAL 2026-06-23] Open decisions (PR-T2a에서 수렴 완료)

- **D1**: 섹터 보드 seam 위치 — `orchestrateFullReport`(narrative 끝, Section 8 처리 지점) vs 별도 step. **권장**: Core-11 Section 8 commit 직후(dangling action과 동일 위상) → orchestrateFullReport의 Section 8 처리 지점에 seam.
- **D2-a (badge 범위)**: `shouldRunTier2` badge 조건 유지? 현재 비-⚪ 배지만 통과(⚪ = Core 11 미진입이라 무의미). 30개 중 ⚪ 외 전부 섹터 보드 — 일반적으로 충분. 30개 100% 강제면 ⚪ 처리 정책 재검토.
- ✅ **D2-b (활성화 flag)**: PR-T2a에서 전용 `SECTOR_BOARD_ENABLED` seam 추가 완료. 활성화는 USER flags + 비용 + 0040 apply 게이트.
- ✅ **D3**: Gate 1은 B++ G1/G2 production 적용(2026-06-24)으로 수렴. 단 예측 게이트는 NO-CONFIG-PASSES이며 상승 예측 claim 금지 유지.

---

## §9 [HISTORICAL 2026-06-23] 검증 (배선 PR DoD)

- `npm run build` + `lint` + `test:ci` + `tsc` 4 게이트.
- 섹터 eval seam 단위 테스트 (sector 가드 / sub_tags filter / available 게이트 / 카운터).
- docker-free PG smoke — RPC `commit_sector_personas`(0019) end-to-end (sector board commit → row 검증).
- 비용 reservation 테스트 (14×N model-aware).
- Claude↔omxy 교차검증 CONVERGED + ce-* 적대 패널.

---

## §10 [HISTORICAL 2026-06-23] omxy 교차검증 결과 (CONVERGED)

cross-runtime adversarial (omxy / Codex gpt-5.5 xhigh, catch-only). **2 rounds → CONVERGED.**

**omxy 독립 검증 (코드 대조)**:
- ✅ **당시 중심 갭 claim 검증(2026-06-23)**: non-test `runSectorEval`/`commitSectorReport` 호출은 dangling `track-record/actions.ts`(184/197)에만 국한했고, live 리포트 경로는 sector RPC 미호출이었다. **2026-06-24 PR-T2a 이후 live seam 완료.**
- ✅ `runSectorEval`는 mock-only 아님 — 14 call preflight + 실 `callPersona`, degraded는 key/billing/AI/unknown-persona 케이스만.
- ✅ P4 330 votes = Core-11만 정합.
- ✅ PR #9 MERGED 검증 (`gh pr view 9`: MERGED, head `feat/tier2-caller-wiring`, merged 2026-05-21, mergeCommit `131ac38`).

**omxy 2 catch (모두 수정 반영)**:
- **MED** — 게이트 문구(당시): `shouldRunTier2`는 비-⚪ 배지 + 공유 `AI_COST_LOG_REAL_INSERT_ENABLED='true'`만(별도 sector-board flag 없음). → §2/§5/§7/§8 D2-b 정정. **2026-06-24 PR-T2a에서 `SECTOR_BOARD_ENABLED` seam 추가로 superseded.**
- **LOW** — "196 prompts": 14×14 dynamic resolvable contracts(static 파일 아님). → §2 정정.

**process note (non-blocking)**: 문서가 untracked일 때 `git diff --check -- <file>`는 exit 0이나 실제 검사 안 함 → commit 전 staged whitespace 체크 수행(반영).

**결론**: 문서는 정확·완전하며 USER 의도(섹터 페르소나=리포트 작성용, 선정 정확성 후 시퀀싱)에 충실. §3.1이 USER의 "이것도 오류인가" 질문에 직접 답함.
