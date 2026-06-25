# main 병합 분류 (LIVE / DORMANT / RESEARCH-CLOSED) — 2026-06-25

> **왜 이 문서**: 2026-06-25 `tier0-bpp-multiregime`(72 commits) FF-merge → main(B-PARTB stable merge point `ea27656`; 현 HEAD = runtime verify `git rev-parse --short origin/main`) + Vercel prod 배포. fast-forward라 B-PARTB뿐 아니라 캠페인 전체가 한 번에 main에 들어왔다. 이 문서는 **"main에 있는 코드 중 무엇이 실제 사용(LIVE) / 빌드됐으나 꺼짐(DORMANT) / 안 쓰기로 결정(RESEARCH-CLOSED)인가"** 를 못 박아, 테스트·연구와 실사용 결정을 명확히 구분한다.
>
> **핵심 가드 3종**: ① env 플래그(미설정=OFF) ② 마이그레이션 적용 여부 ③ 배포 경계(Python 스크립트는 Vercel 앱 미배포). dormant/research 코드는 자동 활성되지 않는다 — 누가 플래그를 명시적으로 켜야만 동작.

---

## §1. LIVE — 실제 사용 중 (production에서 지금 동작)

| 항목 | 무엇 | 근거 |
|---|---|---|
| **B-PARTB Part B 쟁점** | `writer.ts extractIssueDebates` + `page.tsx` 찬/반/중 렌더 | 리포트 페이지가 DB를 읽어 항상 렌더(플래그 없음). 30 리포트 ₩0 백필 완료(117 결함→0). 2026-06-25 배포. |
| **섹터 lens provenance (AI 섹터 관점 라벨)** | `page.tsx` Section 8 Part A 헤더 + `canonical-sectors.ts` `SECTOR_LENS_SUMMARY` | FE always-on(플래그 없음; canonical sector면 lens, off-canonical은 title만). 저장 데이터·재생성·스키마 무변경(헤더 라벨만 FE enrich). 2026-06-25 배포(feat `a2a1269`). 5 unit test. |
| **PR-T2a 섹터 보드 데이터 + 렌더** | `stock_reports` 30행에 섹터보드(420 votes + partA 14 + sector_aggregate) + `Section8ModernView` Part A/Part C 렌더 | 마이그 **0040/0041 production applied**. 데이터 생성 완료(2026-06-24). 페이지 렌더는 항상 on. |
| **B++ funnel 데이터** | `tier0_candidates_150`/`short_list_30` 2026-06 = B++ cfg1 | G1/G2로 적용(2026-06-24). **스코어링 코드는 `scripts/*.py`(Vercel 앱 미배포)** — 앱은 결과(DB)만 읽음. diagnostic funnel(예측 게이트 통과 아님, 상승예측 claim 금지). |
| MVP ①②③ + canonical 5-PR + MVP 엔진(W0~W3b) | 기존 production | 이전 세션들에서 이미 main/배포(이번 머지 이전부터 live). |

---

## §2. DORMANT — 빌드됨, env 플래그로 게이트, **현재 OFF**(자동 비활성)

코드는 main/배포돼 있으나 아래 플래그가 Vercel env에 설정돼야만 동작. 미설정=OFF=production effect 0. (이번 머지가 새로 가져온 것은 ★ 표시.)

| 플래그 | 켜면 무엇 | 기본 |
|---|---|---|
| `SELECTION_CRON_AUTO_ENABLED` | 매월 자동 종목 선정 cron 가동 | OFF |
| `PR5_CRON_AUTO_ENABLED` | 30 리포트 자동 생성 cron | OFF |
| `PR5B_SECTION8_ENABLED` | 리포트 생성 시 Section 8 위원회 평가 | OFF |
| ★ `SECTOR_BOARD_ENABLED` | 리포트 **생성** 시 섹터보드 14인 commit(생성 경로; 렌더는 §1 always-on) | OFF |
| `PR4_TRIGGER_UPSERT_ENABLED` | 리포트 trigger upsert | OFF |
| `AI_COST_LOG_REAL_INSERT_ENABLED` | 실 AI 비용 cost_log insert | OFF |
| `PORTFOLIO_AI_PROPOSAL_ENABLED` / `_PERSIST_ENABLED` / `_USE_PROPOSAL_ENABLED` / `_REAL_ENTRY_PRICE_ENABLED` / `_EXPLICIT_CASH_ROW_ENABLED` | AI 포트폴리오 제안→영속→Accept 적용→실 entry_price→명시 cash row | OFF (Accept go-live는 §1처럼 이미 일부 적용분 있음 — HANDOFF §3) |
| ★ `FORWARD_SHADOW_ENABLED` | shadow arm 로깅 활성(선정과 **무관**, 비교 로그만) | OFF → `createShadowArmLoggerFromEnv` undefined = seam no-op |

> 대부분의 go-live 플래그는 **이번 머지 이전부터 존재**(기존 캠페인 빌드). 이번 머지가 새로 추가한 dormant = ★ 섹터보드 생성 경로 + shadow 로깅 seam(`FORWARD_SHADOW_ENABLED`).
>
> **별도 noted (OFF-게이트 아님)**: `MONTHLY_BATCH_CRON_AI_ENABLED` = **deprecated no-op** — `monthly-batch/route.ts`가 플래그 무관하게 `{skipped, reason:"monthly_batch_single_shot_deprecated"}` 반환(실 AI 안 돔). `SHADOW_LOG_FAILURE_ALERT_ENABLED` = **default-ON 억제 플래그**(`!== "false"`) — shadow logger가 `FORWARD_SHADOW_ENABLED`로 주입돼 **실패할 때만** 도달(평시 무관). 둘 다 "현재 OFF인 dormant 기능"이 아니므로 위 표에서 제외.

---

## §3. RESEARCH-CLOSED — "사용 안 함"이 결론 (연구/기록용)

| 항목 | 무엇 | 상태 |
|---|---|---|
| **B++/B+C 예측 검증 캠페인** | `scripts/adjudicate_4config*.py`, harvest, 4-config×3-regime 등 + specs | **NO-CONFIG-PASSES / research-CLOSED**. 상승 예측 claim 영구 금지. **Vercel 앱 미배포(Python)**. (B++ funnel "적용"[§1]과 별개 — funnel은 diagnostic 적용, 예측 검증은 CLOSED.) |
| **Path-A shadow 레이어 (PR-A1~A5 / PR-B1~B5)** | `shadow-harness-arms.ts`, `shadow-arm-logger.ts`, `tier1-selection-batch-worker.ts` + `scripts/shadow_*.py` + 마이그 **0038/0039(미적용)** | **dormant + forward-only 연구**. "섹터 비교 메뉴"에서 forward 검증 후에만 채택 후보. **hard-gate live 적용 영구 금지**. 통계 verdict RUN = deferred/연구. |

> §3은 §2의 dormant 가드(플래그 OFF)에 더해 **마이그 미적용**으로 이중 봉쇄. **0038**(forward-shadow logger RPC `upsert_shadow_arm_log`) 미적용이면 logger가 throw하나, **호출부(tier1-selection-batch-worker)가 catch 후 흡수 → 본 selection/finalize는 계속, shadow rows만 0**(fail-closed 대상 = shadow persistence뿐, selection 실행 아님). **0039**(Track2 shadow 테이블)는 Track2/Python 스크립트 DB 경로로 분리 — 앱 런타임 무관. 즉 shadow는 켜도 실 선정/포트/주문에 영향 0(비교 로그만).

---

## §4. USER 확인 체크리스트 (Claude 미확인 — Vercel env는 USER-only)

Claude는 Vercel env 플래그 값을 읽을 수 없다. 아래는 **USER가 Vercel 대시보드에서 OFF 확인** 권장:
- [ ] §2의 모든 플래그가 Vercel Production env에 **미설정 또는 ≠ 'true'** (특히 ★ `SECTOR_BOARD_ENABLED`, `FORWARD_SHADOW_ENABLED`).
- [ ] 마이그 **0038/0039 미적용** 확인 (Supabase `list_migrations`에 없어야 함).
- [ ] (canary 기준) cron route 5종 dormant — 본 세션 canary 4/4 200, spend 0.

---

## §5. "실수로 켜면" 위험 노트

- dormant/research 코드는 자동 활성 안 됨. 단 누가 §2 플래그를 켜면 해당 기능이 동작(자동 비용 트리거 가능 — go-live USER 게이트로 관리).
- shadow(§3)는 플래그(`FORWARD_SHADOW_ENABLED`)를 켜도, 마이그 **0038 미적용이면 shadow logging만 throw→호출부 catch 흡수(shadow rows 0), 본 selection/finalize는 계속**(fail-closed 대상 = shadow persistence뿐, selection 아님). 그리고 켜져도 "shadow"라 실 선정/포트/주문에 영향 0(비교 로그만).
- **rollback**: `git revert`(머지 되돌리기) 또는 Vercel 이전 배포 promote. B-PARTB 백업 = `scripts/out/b-partb-backfill-backup-2026-06-01.json`.

---

## §6. 후속 (선택)

- broader 캠페인 문서('main 미머지' 표기 다수 stale)를 merged 상태로 일괄 정합하는 sweep — 본 문서가 그 권위 분류 기준.
- shadow/research 코드를 **물리적으로** 분리하고 싶으면(main에서 제외) revert + 별도 연구 브랜치 격리 가능(이번엔 명시 분류표로 대체).

SoT 연계: `Document/Process/HANDOFF.md`(현재 상태) · `docs/superpowers/specs/2026-06-25-section8-partB-issue-extraction.md`(B-PARTB) · `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`(B++) · Path-A specs(shadow).
