# Tier 2 Sector Board — 30 리포트 작성 배선 (출시 전 deferred work 박제)

- **상태**: ✅ **PR-T2a 구현 완료 (2026-06-24, Claude↔omxy CONVERGED)** — §4 PR-T2a(섹터 보드 → live 리포트 cron seam) 빌드: 마이그 0040 `commit_sector_personas_cron`(0019의 service-role 변형, written-not-applied=USER apply 게이트) + writer `commitSectorReportCron`(composeSectorReportPayload DRY) + `runSectorEval` service-role DI(model-aware preflight, PR-T2b 흡수) + `sector-board-step.ts` commitSectorBoardStep + orchestrator `SECTOR_BOARD_ENABLED` seam(**section8 commit에 게이트** — omxy R1 HIGH fix). dormant default·production 무변경. test:ci 2064 pass·build·lint·tsc GREEN. 잔여 = **PR-T2c(Section 8 섹터 보드 FE 렌더)** + 새 30 리포트 생성(USER 마이그 0040 apply + flags + 비용). dangling triggerMonthlyPersonaEvalAction 삭제(D-1)는 후속. live SoT = `Document/Process/HANDOFF.md §9 #4`. (이하 원 스코핑 문서.)
- **작성**: 2026-06-23. **검증**: Claude 코드 정독 + omxy 교차검증 (cross-runtime adversarial).
- **SoT 연계**: parent `ServicePlan-Admin.md §1A.5 D21/D22` (Tier 2 14×14 overlay + Kevin v3.1 quality target) · `ReportFramework.md §7.2/§7.3` · `tudal/src/lib/screening/canonical-sectors.ts`.
- **경계**: 본 문서는 **scoping/plan만**. 코드·마이그·플래그·실 LLM 비용 변경 없음.

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
| **게이트 helper** | `tudal/src/lib/screening/tier2-gate.ts:15` `shouldRunTier2(badge)` = `badge ≠ '⚪'` **AND** `AI_COST_LOG_REAL_INSERT_ENABLED === 'true'` (strict literal) | ✅ — **별도 sector-board 전용 flag 없음. 이 비용 플래그는 공유**(cost-logging kill-switch 겸용) |

### ⚠️ caller가 dangling — live 경로 미배선 (= 갭의 본체)

- **섹터-매칭 caller 로직은 존재하고 정확함**: `tudal/src/app/(admin)/admin/track-record/actions.ts` `triggerMonthlyPersonaEvalAction` (line 169~205):
  - Core 11 commit 직후 → `shouldRunTier2(badge)` 게이트 → `short_list_30.sector`를 `isCanonicalSector` 가드 → `runSectorEval({sector, sub_tags})` → `available` 시 `commitSectorReport`. **반도체→반도체 14, 금융→금융 14 매칭이 정확히 구현됨** (USER가 원한 동작).
  - PR #9 (MERGED, `feat/tier2-caller-wiring`) Step 3c 산출물. `Tier2Counters` 진단 카운터 포함.
- **그러나 이 action은 deprecated dangling**: `actions.ts:81` 주석 "triggerMonthlyPersonaEvalAction은 dangling(**UI caller 0**) + **D-1 deprecate 예정**." 확인: production UI/route caller 0건 (cost-logger.ts:43 + format-error.ts:53가 "UI caller 0 + D-1 deprecate" 명시).
- **live 리포트 생성 경로는 섹터 보드를 호출하지 않음**: `tudal/src/lib/report/full-report-batch-worker.ts` → `orchestrateFullReport(callerKind:'cron')`(full-report-orchestrator.ts) → **section_0~7 + appendix + Core-11 Section 8(PR5b flag-gated)** 만 생성. `runSectorEval`/`commitSectorReport` 미호출 (grep: live caller 0).
  - `writer.ts:111` `sector_aggregate: { buy: 0, hold: 0, sell: 0 } // Tier 2 미활성` · `writer.ts:123` `partA: [] // Tier 2 deferred` — Core 11 Section 8은 섹터 보드 자리를 0/빈 배열로 둠.
  - **실증**: P4 (75차) 30 리포트 `votes 330` = 30 ticker × 11 (Core 11). 섹터 보드 14×N 없음.

---

## §3 갭 — 한 줄 정의 (정확)

> 섹터-매칭 리포트 작성 로직은 **이미 존재하고 정확하지만**, **deprecated dangling action(`triggerMonthlyPersonaEvalAction`)에 갇혀 있고**, **live 리포트 생성 경로(`orchestrateFullReport`/`full-report-batch-worker`)는 이를 우회**한다.

→ "코드가 없다"가 **아니라** "live 경로 미배선 + 기존 caller 폐기 예정". 작업 = **섹터 보드 step을 dangling action에서 live 경로로 이식**(게이트·가드·카운터 로직 재사용), dangling action 정리.

### §3.1 USER 질문 (2026-06-23): "이것도 오류 아냐? 수정해야 하는 거 아냐?"

**답: 코드 버그는 아니지만, 의도한 최종 제품 대비 "미완성(deferred)"이 맞다 → 출시 전 고쳐야 한다.**

- **코드 버그 아님**: live 경로의 Core-11-only Section 8은 **의도된 현 상태**. 코드가 명시적으로 `// Tier 2 미활성` / `// Tier 2 deferred`(writer.ts:111/123)로 표시 — 섹터 보드(Tier 2)는 처음부터 flag-gated 후속 레이어로 설계됨. 파이프라인이 깨졌거나 잘못 동작하는 게 아님. 30 리포트는 정상 산출됨(Core 11 위원회 + section 0~7 서사 + appendix + 합의 배지).
- **그러나 USER 의도 대비 미완성**: USER가 원한 "기업 섹터별 Kevin 페르소나로 리포트 작성"은 **현 30 리포트(P4, 75차)에 반영 안 됨**(votes 330 = Core 11만, 섹터 보드 0). 즉 리포트가 섹터 보드 깊이(Section 8 Part A + sector_aggregate)를 결여 = **의도한 제품 대비 incomplete**.
- **고쳐야 하나?** 예 — 그게 PR-T2a(§4). 단 **긴급 "당장 고칠 버그"가 아니라 "계획된 미완성 배선"**. 시퀀싱은 USER 본인 통찰대로: **선정 정확성(Gate 1) 확보 후 → 출시 전 완료**. launch hard gate는 아님(Core 11 리포트로도 출시는 가능)이나, MVP ③ "30 리포트 정확/충실"의 quality 핵심.
- **요약**: "오류"라기보다 **"의도된 deferral이 아직 실현 안 된 상태"** — 본 문서가 그 미완성을 박제해 출시 전 PR-T2a로 실현하게 한다.

---

## §4 작업 분해 (배선 PR — 각 PR은 동일 Claude↔omxy + ce-* 루프, feature-branch commit)

| PR | 내용 | 비고 |
|---|---|---|
| **PR-T2a** (핵심) | live 경로(`orchestrateFullReport` 또는 `full-report-batch-worker`)에 **섹터 보드 seam** 추가 — Core-11 Section 8 commit 직후 `shouldRunTier2(badge)` → `short_list_30.sector` 가드 → `runSectorEval(sector, sub_tags)` → `available` 시 `commitSectorReport`. **dangling action의 게이트/가드/카운터 로직 재사용**(신규 설계 아님). `triggerMonthlyPersonaEvalAction` 정리/삭제(D-1). | seam 위치 = §8 D1 결정 |
| **PR-T2b** | 비용 가드 정합 — `runSectorEval`의 14×N call을 월 hardcap(50만) reservation에 model-aware로 반영 (W0 cost guard 정합). `preflightHardcap` 이미 14 call preflight하나 reservation 일원화 확인. | |
| **PR-T2c** (선택) | Section 8 **렌더** — report page에서 sector board Part A + 실 `sector_aggregate` 표시 (현재 0/빈 fallback). FE-only. | 출시 품질 향상, 후순위 |

---

## §5 게이팅 & 시퀀싱 (USER 통찰 반영)

1. **Gate 1 (선행, 비-코드)** — **선정 정확성**: Tier0 (D30 — 현재 diagnostic generator, no-apply 재확정) + Tier1 합의가 "30개가 그나마 정확" 수준이어야 리포트가 의미. **이 게이트 충족 전 섹터 보드 활성화는 비용만 소모**.
2. **Gate 2 (USER-only, 활성화)** — 현 게이트(`shouldRunTier2`)는 `AI_COST_LOG_REAL_INSERT_ENABLED='true'`(공유 비용 플래그) + 비-⚪ 배지뿐. **별도 sector-board 토글은 미존재** → PR-T2a에서 (a) 독립 flag(예 `SECTOR_BOARD_ENABLED`) 신규 추가 또는 (b) 공유 비용 플래그 재사용 중 택1(§8 D2-b). 비용 승인 = ~420 calls/batch(§7).
3. **시점** — 출시 **전** 완료 목표 (MVP ③ "30 리포트 정확"의 quality 상향). **launch hard gate는 아님** — Core 11 Section 8로도 리포트는 산출됨(P4 완주). 섹터 보드는 리포트 깊이/정확성 강화.

---

## §6 stale 브랜치 / PR 처리

- `feat/tier2-caller-wiring` (PR #9 **MERGED**) — Step 3c 내용(shouldRunTier2 + caller wiring + 8 tests)은 **이미 main에 반영됨**(track-record/actions.ts + tier2-gate.ts). 브랜치 tip이 옛 main 기반이라 `git diff origin/main`이 마이그 0034~0037 삭제로 보일 뿐 — **PR 자체는 머지 완료**. 추가 액션 불필요(브랜치 cleanup만 선택).
- 신규 배선(PR-T2a)은 **이 머지된 로직을 live 경로로 이식** — 새 브랜치에서 작성.

---

## §7 비용 (활성화 시)

- 14 sector personas × (badge ≠ ⚪ + tier1 available 한 ticker 수, ≤30) = **≤420 LLM calls/batch**.
- 단가 = W0 model-registry (D28 역할별 차등). `runSectorEval`이 `preflightHardcap`로 14-call preflight 수행 — 월 hardcap 50만 reservation 정합은 PR-T2b에서 확인.
- 활성화 = USER 비용 승인(1회). 현 게이트는 공유 `AI_COST_LOG_REAL_INSERT_ENABLED='true'`(tier2-gate.ts:15) — 이 플래그를 켜면 cost-logging real insert도 함께 켜짐(공유). 독립 제어 원하면 PR-T2a에서 sector-board 전용 flag 추가(§8 D2-b).

---

## §8 Open decisions (구현 PR 진입 전 USER/설계 확정)

- **D1**: 섹터 보드 seam 위치 — `orchestrateFullReport`(narrative 끝, Section 8 처리 지점) vs 별도 step. **권장**: Core-11 Section 8 commit 직후(dangling action과 동일 위상) → orchestrateFullReport의 Section 8 처리 지점에 seam.
- **D2-a (badge 범위)**: `shouldRunTier2` badge 조건 유지? 현재 비-⚪ 배지만 통과(⚪ = Core 11 미진입이라 무의미). 30개 중 ⚪ 외 전부 섹터 보드 — 일반적으로 충분. 30개 100% 강제면 ⚪ 처리 정책 재검토.
- **D2-b (활성화 flag)**: 현 게이트는 공유 `AI_COST_LOG_REAL_INSERT_ENABLED` 1개뿐(sector board ON = cost-log real insert ON 동반). 섹터 보드를 독립 제어하려면 PR-T2a에서 전용 flag(`SECTOR_BOARD_ENABLED` 등) 추가 — **USER/설계 결정**.
- **D3**: Gate 1(선정 정확성) 충족 판정 방법 — D30 후속(full-factor verdict or diagnostic 유지)과 연계.

---

## §9 검증 (배선 PR DoD)

- `npm run build` + `lint` + `test:ci` + `tsc` 4 게이트.
- 섹터 eval seam 단위 테스트 (sector 가드 / sub_tags filter / available 게이트 / 카운터).
- docker-free PG smoke — RPC `commit_sector_personas`(0019) end-to-end (sector board commit → row 검증).
- 비용 reservation 테스트 (14×N model-aware).
- Claude↔omxy 교차검증 CONVERGED + ce-* 적대 패널.

---

## §10 omxy 교차검증 결과 (CONVERGED)

cross-runtime adversarial (omxy / Codex gpt-5.5 xhigh, catch-only). **2 rounds → CONVERGED.**

**omxy 독립 검증 (코드 대조)**:
- ✅ **중심 갭 claim 검증**: non-test `runSectorEval`/`commitSectorReport` 호출은 dangling `track-record/actions.ts`(184/197)에만 국한. live 리포트 경로는 `commitSection8Step`/`commit_persona_eval_cron` 사용, sector RPC 미호출.
- ✅ `runSectorEval`는 mock-only 아님 — 14 call preflight + 실 `callPersona`, degraded는 key/billing/AI/unknown-persona 케이스만.
- ✅ P4 330 votes = Core-11만 정합.
- ✅ PR #9 MERGED 검증 (`gh pr view 9`: MERGED, head `feat/tier2-caller-wiring`, merged 2026-05-21, mergeCommit `131ac38`).

**omxy 2 catch (모두 수정 반영)**:
- **MED** — 게이트 문구: 현 `shouldRunTier2`는 비-⚪ 배지 + 공유 `AI_COST_LOG_REAL_INSERT_ENABLED='true'`만(별도 sector-board flag 없음). → §2/§5/§7/§8 D2-b 정정.
- **LOW** — "196 prompts": 14×14 dynamic resolvable contracts(static 파일 아님). → §2 정정.

**process note (non-blocking)**: 문서가 untracked일 때 `git diff --check -- <file>`는 exit 0이나 실제 검사 안 함 → commit 전 staged whitespace 체크 수행(반영).

**결론**: 문서는 정확·완전하며 USER 의도(섹터 페르소나=리포트 작성용, 선정 정확성 후 시퀀싱)에 충실. §3.1이 USER의 "이것도 오류인가" 질문에 직접 답함.
