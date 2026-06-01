---
title: shortlist 30종목 + 풀 리포트 흐름 정정 design spec
date: 2026-05-21
session: 53차 §5 (HANDOFF 박제 정정) — **55차 §2 amendment 적용 (2026-05-23, omxy R9 B-R9-1)**
status: SUPERSEDED-IN-PART by 55차 §2 (PR3b scope 분리: writer-only + PR3c 신설)

> **⚠️ 55차 §2 amendment (2026-05-23, omxy R6~R9 catch B-R9-1 — 운영 SoT defer)**:
> 본 spec doc의 canonical PR 순서 (PR2 → PR3a → PR1 → PR3b → PR4) + §4 PR3b row (writer + 4-step + sector_reference_backlog 통합) + §3.5 Group G 매핑은 53차 §5 시점 박제.
> 55차 §2 PR3b 진행 중 scope 정정: **PR3b = writer/RPC/zod commit only (Group E만 해소)**, document-specialist + analyst + critic 4-step + sector_reference_backlog 마이그 + Group G Sector reference 3-level 분류는 **PR3c (신설)** 로 defer (omxy R1 Q3 + R6~R9 4 rounds CONVERGED-track + 28 BLOCKERS catch & fix).
> **수정된 canonical 순서**: PR2 ✅ → PR3a ✅ → PR1 ✅ MERGED `4aa3130` → PR3b (OPEN PR #14, writer Section 0~7 only) → **PR3c (신설, document-specialist + analyst + critic + sector_reference_backlog)** → PR4 (UI caller wire).
> 본 spec doc은 historical reference. 현 운영 SoT = `Document/Process/HANDOFF.md` 55차 §2.


authors: yong + Claude
related:
  - Document/Process/HANDOFF.md
  - Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19·D21·D22
  - Document/Service/Report/ReportFramework.md §8
  - Document/Build/ProgressDashboard.md
  - Document/Process/CodebaseStatus.md
  - Document/Build/Slices/S7-RealData.md
  - tudal/src/lib/screening/persona-eval.ts
  - tudal/src/lib/report/writer.ts
  - tudal/src/lib/ai/prompts/kevin-v31-rubric.ts (53차 §3 박제)
  - docs/superpowers/specs/2026-05-21-step3c-caller-wiring.md
  - docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md
---

# Shortlist 30 + Full Report 흐름 정정 — Design Spec

> 본 문서는 53차 §5 정정 박제용 design spec이다. 후속 implementation PR scope는 §4에 분리. 사용자 final intent는 §1, 박제 vs 코드 mismatch는 §2, 문서별 정정 spec은 §3.

---

## 1. 사용자 final intent (lock-in)

본 8 항목은 사용자가 직접 lock-in 한 정정 기준점이다. 본 spec doc 어디서도 재해석·변경 금지.

### 1.1 30종목 선정 흐름 (2 Tier AI 파이프라인)

```
Tier 0 (인디케이터 + DART numeric narrow)
  ├ 단기 후보 50
  ├ 중기 후보 50
  └ 장기 후보 50
        ↓ (총 150)
Tier 1 (Core 11 AI 평가 + 시간대별 페르소나 가중치)
  ├ 단기 페르소나 가중치: Druckenmiller · Burry
  ├ 중기 페르소나 가중치: Lynch
  └ 장기 페르소나 가중치: Buffett · Munger · Fisher · Pabrai
        ↓
Tier 1 합의 + AI가 단/중/장 분류 결정에 직접 영향
        ↓
단기 top 10 + 중기 top 10 + 장기 top 10 = 30
```

**핵심**: AI(Tier 1)가 단/중/장 분류 결정에 직접 영향을 미친다. Tier 0 단독은 fallback이지 메인 path가 아니다.

### 1.2 풀 리포트 흐름 (단일 산출물)

- writer가 **Section 0~7 통합 작성** + Tier 2 sector 14 페르소나 **Section 8 partA/partD** = **단일 산출물**.
- 선정(shortlist 30) = 풀 리포트 30. 둘은 분리되지 않는다. 30종목 선정과 동시에 30 풀 리포트가 함께 생성된다.
- Kevin v3.1 reference 자료를 톤·구조·깊이의 기준으로 사용.
- Kevin v3.1 rubric (M1~M8 markers) inject — 이미 53차 §3 PR #8로 207 페르소나 prompt에 박제 완료 (1656 marker assertions).

### 1.3 AI 호출 트리거 (3 path)

| Path | 설명 | 빈도 | 현 코드 상태 |
|---|---|---|---|
| (a) cron 매월 자동 | 30종목 미리 선정 + 30 풀 리포트 미리 생성 | 매월 1회 (vercel.json monthly-batch) | **미구현** (Task 12: mock dry-run only) — PR1 wire 필요 |
| (b) 사용자 reject 후 trigger 버튼 | 새 30 선정 + 새 풀 리포트 | 수동 종목당 월 2회 (D8 박제) | **미구현** (trigger 버튼 UI 0, server action `triggerMonthlyPersonaEvalAction` dangling) — PR4 wire |
| (c) 종목별 'Regen' 버튼 | 단일 종목 풀 리포트 재생성 | 종목당 월 2회 quota 공유 | **UI 부분 존재 + quota counter 박제 OK, 실 AI 재생성 호출 0** (OMXY R1 BLOCKER 6 정정) — PR4 wire |

### 1.4 UI 흐름

```
/admin 홈 또는 /admin/portfolio
  ↓ 30종목 리스트 (ShortlistRow 컴포넌트, <details> accordion native)
  ↓ 종목 클릭
  ↓ details 펼침
  ↓ "풀 리포트" 버튼 클릭
  ↓ <Link href={/admin/report/[ticker]}>
  ↓
/admin/report/[ticker] (Section 0~8 + Appendix)
```

### 1.5 Track Record 의미 재정의

- **현재 코드**: `/admin/track-record/page.tsx` = 누적 성과 대시보드만.
- **정정 후**: 누적 성과 + 과거 월별 리포트 아카이브를 **한 페이지에 둘 다** (탭 분리).

### 1.6 Kevin v3.1 quality target

207 페르소나 (Core 11 + Tier 2 sector 196) prompt에 Kevin v3.1 rubric inject:

| Marker | 항목 |
|---|---|
| M1 | 4 axes (안정성·수익성·성장성·밸류) |
| M2 | financial cite (회계 수치 출처) |
| M3 | no-fabrication |
| M4 | peer 3+ (동종 비교 3사 이상) |
| M5 | valuation trial (PER/PBR/EV/EBITDA 등) |
| M6 | BUY/HOLD/SELL 명시 |
| M7 | 일상 비유 (Kevin 톤) |
| M8 | 200자 cap (페르소나 발언) |

1656 marker assertions 통과 (PR #8 머지).

### 1.7 Sector reference 자료 — 3-level 분류 (OMXY R1 BLOCKER 3 + R3 BLOCKER 3 정정)

| Level | 대상 | 보유 | 부족 |
|---|---|---|---|
| **Level A** — 풀 리포트 본문 reference (실 작성된 본문 .md/.html) | `Document/Outputs/Report-Alteogen_*` + `Report-Samchundang_000250` + `BioSectorReport-Alteogen` + `Samsung_005930_v2` + `Samsung Section5-8 ExecSummary` | **2 sectors** (바이오·반도체) | **12 sectors** |
| **Level B** — `ReportFramework.md §9.2` 섹터별 추가 체크리스트 | 바이오·반도체·건설·금융 | **4 sectors** | **10 sectors** |
| **Level C** — `sector-persona-builder.ts SECTOR_PHILOSOPHIES` | 14 canonical sectors 모두 (53차 §3 PR #8 박제) | **14 sectors** | **0** |

→ "12 sectors 부족"이라 함은 **Level A 본문 reference 부족 12 sectors**를 가리킴. Level B 체크리스트는 10 sectors 부족이고, Level C philosophies는 부족 0.

### 1.8 API 금액 무관

사용자 명시: 토론 진행 + 정정 진행 비용 제약 없음. Tier 1 호출 범위(60/90/150) 등 비용 결정은 후속 PR로 미룬다.

---

## 2. 박제 vs 코드 mismatch (Group A-H)

각 Group은 (1) 박제된 어휘 (2) 실제 코드 상태 (3) mismatch 이유 (4) 정정 필요 file을 박제한다.

### Group A — track-record가 trigger 위치 박제

| 항목 | 내용 |
|---|---|
| 박제된 어휘 | "track-record 페이지에서 trigger 버튼" / "Track Record 클릭이 monthly-batch 발화" |
| 실제 코드 | `/admin/track-record/page.tsx` = 누적 성과 대시보드 read-only. trigger 액션 없음. |
| mismatch 이유 | track-record는 누적 성과 + 과거 아카이브용. trigger 버튼 위치는 `/admin/portfolio` 또는 `/admin` 홈이 자연스러움. |
| 정정 file | `Document/Process/HANDOFF.md` 다수 위치, `Document/Service/Planning/ServicePlan-Admin.md §3`, `docs/superpowers/specs+plans` |

### Group B — 30종목 선정 AI 부재

| 항목 | 내용 |
|---|---|
| 박제된 어휘 | ServicePlan-Admin §1A.5 D19 "AI 키 미발급 fallback = Tier 0 단독" / S7-RealData T7e.8 "DART 기반 30 rows production" |
| 실제 코드 | `short_list_30` 30 rows = Tier 0 단독 30 직선정. Tier 1 AI 0 호출. fallback path가 메인 path로 굳어진 상태. |
| mismatch 이유 | "AI 키 미발급 fallback" 어휘가 메인 path로 오해될 여지. 메인 path는 Tier 0 → Tier 1 AI 합의 → 30 선정이어야 함. |
| 정정 file | `CLAUDE.md` 상단 시퀀스, `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19`, `Document/Service/Report/ReportFramework.md §8`, `Document/Build/Slices/S7-RealData.md T7e.8`, `Document/Service/Planning/ServicePlan.md §3`, `Document/Process/CodebaseStatus.md` |

### Group C — cron monthly-batch mock dry-run only

| 항목 | 내용 |
|---|---|
| 박제된 어휘 | HANDOFF.md Task 12 "cron monthly-batch 활성", S7a spec+plan "월간 일괄 자동" |
| 실제 코드 | `tudal/src/app/api/cron/monthly-batch/route.ts` = mock dry-run only. 실 AI 호출 없음. |
| mismatch 이유 | cron 자동 path (a)가 박제로는 활성으로 보이나 실 호출 없음. PR1 후속 implementation으로 enable 필요. |
| 정정 file | `Document/Process/HANDOFF.md` Task 12, `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md`, cron route 코멘트 (구현 시 별도 PR) |

### Group D — Step 3c "DONE / IMPLEMENTED" 박제

| 항목 | 내용 |
|---|---|
| 박제된 어휘 | HANDOFF.md §1 표 + §2.1 Step matrix + §6 53차 §4·§4+·§4++ entry / ProgressDashboard Step 3c "DONE" |
| 실제 코드 | Step 3c caller wiring = **PARTIAL — dangling server action** (server action `triggerMonthlyPersonaEvalAction` export OK / page render·import 0 / cron real 0 / UI caller 0). OMXY R1 BLOCKER 4 + R2 BLOCKER 1로 정정. |
| mismatch 이유 | server action 정의는 존재하나 어떠한 caller path (UI / cron real / 다른 server file)도 호출하지 않음. 사용자가 admin UI에서 발화할 entry point 0. PARTIAL — dangling server action 상태로 정정 필수. |
| 정정 file | `Document/Process/HANDOFF.md` §1·§2.1·§6, `Document/Build/ProgressDashboard.md`, `Document/Build/Slices/S7-RealData.md`, `Document/Process/CodebaseStatus.md` |

### Group E (신규) — writer Section 0~7 본문 미구현 박제 누락

| 항목 | 내용 |
|---|---|
| 박제된 어휘 | ReportFramework.md §8 Step 1~4 "writer가 Section 0~8 통합 작성" 박제 OK |
| 실제 코드 | `tudal/src/lib/report/writer.ts` = `section_8` jsonb commit만 가능. Section 0~7 본문 작성 path 미구현. |
| mismatch 이유 | writer가 Section 8만 작성 중인 사실이 박제되지 않음. 후속 PR로 Section 0~7 본문 구현 필요. |
| 정정 file | `Document/Service/Report/ReportFramework.md §8`, `Document/Process/CodebaseStatus.md` (writer.ts 상태) |

### Group F — Track Record 의미 박제 (누적 성과 vs 과거 아카이브)

| 항목 | 내용 |
|---|---|
| 박제된 어휘 | ServicePlan-Admin §3 "track-record = 누적 성과" (아카이브 어휘 부재) |
| 실제 코드 | `/admin/track-record/page.tsx` = 누적 성과 대시보드만. 과거 월별 아카이브 0. |
| mismatch 이유 | 사용자 final intent = 누적 성과 + 월별 아카이브 한 페이지 탭 분리. 박제·코드 모두 누락. |
| 정정 file | `Document/Service/Planning/ServicePlan-Admin.md §3`, `tudal/src/app/(admin)/admin/track-record/page.tsx` 코멘트, `Document/Process/HANDOFF.md` |

### Group G — Sector reference 3-level 분류 (OMXY R1 BLOCKER 3 정정)

| 항목 | 내용 |
|---|---|
| Level A (풀 리포트 본문 reference) | 바이오 (Alteogen·Samchundang·BioSector) + 반도체 (Samsung_005930_v2 + Section5-8 ExecSummary) = **2 sectors**. 본문 부족 = **12 sectors** |
| Level B (§9.2 추가 체크리스트) | 바이오·반도체·건설·금융 = **4 sectors**. 체크리스트 부족 = **10 sectors** |
| Level C (SECTOR_PHILOSOPHIES, sector-persona-builder.ts) | **14 sectors 모두 박제 완료** (53차 §3). philosophies 부족 = **0** |
| mismatch 이유 | 박제 어휘가 "본문 / 체크리스트 / philosophies" 3-level 미분리. "12 부족"이 어떤 level 부족인지 불명확. |
| 정정 file | `Document/Service/Report/ReportFramework.md §9.2`, `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D22` |

### Group H (OMXY R1 BLOCKER 5 신규, R2 BLOCKER 3 상세화) — stock_reports schema drift + report page crash 위험

**Critical level — PR1 cron 가동 전 schema drift fix (PR3a) 선행 필수**

| 항목 | 내용 |
|---|---|
| 박제된 어휘 | `commit_persona_eval` RPC = section_8 jsonb INSERT만 + consensus_badge 추가. `/admin/report/[ticker]/page.tsx`는 section_0~7 + 다수 nested field dereference. |
| 실제 코드 상세 (R2 BLOCKER 3 grep 결과) | (1) `tudal/src/lib/data/admin-reports.ts` `getReportByTicker` + `transformStockReportRow` = **mapping/validation 0**, DB jsonb를 raw unknown 그대로 반환. (2) `page.tsx`는 header에서 `section0.conviction` early deref (page 진입 직후 crash 위험 첫 지점). (3) Section 0~7 전체가 `data.headline`, `data.technicals.map`, `data.dataSources.map` 등 nested array/string deref. (4) Section 8 신규 writer schema는 `partA/partB/partC/partD`, page는 old `conclusion/recommendation/keyQuotes` shape dereference (shape mismatch). (5) DB 0003: `stock_reports.section_0~8` 컬럼 모두 nullable. (6) 0017 `commit_persona_eval`: `section_8` jsonb만 INSERT/UPDATE + `consensus_badge` ADD. section_0~7은 다른 RPC 또는 path로 채워져야 하나 코드 path 0. |
| mismatch 이유 | **schema drift Critical**: PR1 cron 가동 시 commit_persona_eval 호출 → row INSERT 시 section_0~7 null + section_8 partA/partB/partC/partD shape (writer 신규) → page.tsx old conclusion/recommendation/keyQuotes shape deref 시도 → **early crash at section0.conviction header**. 사용자가 admin UI에서 종목 클릭 시 발화. |
| 정정 file (spec doc 단계) | (a) `Document/Service/Report/ReportFramework.md §8 Step 2` (schema drift + 신규 partA~D shape 박제) (b) `Document/Process/CodebaseStatus.md` (admin-reports validation 0 + page.tsx deref list 박제) (c) HANDOFF.md §0 5줄 + §3 사용자 액션 큐 (PR3a 선행 필수 박제) |
| 정정 file (PR3a implementation scope — 후속 별도) | (a) `tudal/src/lib/data/admin-reports.ts` (transformStockReportRow validation + Section type guard) (b) `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` (early null guard at section0.conviction + Section 0~7 fallback UI + Section 8 신규 shape 처리) (c) section_8 jsonb shape migration RPC 또는 page mapping helper |
| Critical 박제 | **PR1 cron 가동 = PR3a schema drift fix 선행 필수 (Hard gate)**. 위반 시 사용자 종목 클릭 시 page crash 발생. |

---

## 3. 정정 방향 spec (문서별)

각 파일별 정정 spec을 박제한다. 본 §3은 구현(편집) 단계가 아닌 spec 단계 — 실제 편집은 OMXY 적대적 검토 후 별도 작업.

### 3.1 HANDOFF.md

**§0 5줄 요약 재작성**: 다음 세션 진입자가 "보고 이어서 해줘"만으로 진행 가능하도록 핵심만 박제.

```
1. 53차 §5 정정 박제 완료 (본 spec doc + Group A-H 정정 — 대상 file 목록은 Appendix A matrix 참조).
2. 메인 path = Tier 0 → Tier 1 AI 합의 → 30 선정 + 30 풀 리포트 단일 산출물.
3. 현재 코드 상태 = Tier 0 단독 30 직선정 / writer Section 8 jsonb만 commit / Section 0~7 미구현 / caller UI 0 / cron mock dry-run / Regen 버튼 quota만 (실 호출 0) / report page schema drift crash 위험 (Group H Critical).
4. 다음 진입자 후속 implementation 순서 (canonical, OMXY R2 BLOCKER 2 + R3 BLOCKER 1 정정) = **PR2 (Tier 1 AI 30 선정 screening) → PR3a (Group H schema drift fix Hard gate) → PR1 (cron monthly-batch real path, server-side only) → PR3b (writer Section 0~7 본문 구현) → PR4 (UI trigger 버튼 + Track Record 탭 + Regen 실 호출 wire)**. PR1 cron 가동 ⊥ PR3a 미선행 = page crash inevitable.
5. OMXY 적대적 검토 R1~R7 7 rounds CONVERGED-track. 누적 BLOCKERS catch & fix = R1 6 + R2 4 + R3 6 + R4 5 + R5 0 + R6 5 + R7 6 = **32 BLOCKERS** (Phase 1 spec doc CONVERGED at R5, Phase 3+4 결과 R6+R7 추가 fix iteration 포함).
```

**§2.1 Step matrix 재작성**:

| Step | 박제 전 | 박제 후 |
|---|---|---|
| Step 3c caller wiring | DONE | **PARTIAL — dangling server action** (server action export 존재 / page import·render 0 / cron real 0 / UI caller 0 — OMXY R1 BLOCKER 4 + R2 BLOCKER 1) |
| Step 4 Reflection | 대기 | 진입 가능 (단, PR2 후 더 의미있음) |
| Step 5 USER billing | 충전 대기 | 무관 (이미 충전) |
| Step 6 caller UI 신설 | (없음) | **신설 task (canonical 순서)**: PR2 Tier 1 AI 30 선정 → PR3a Group H schema drift fix (Hard gate) → PR1 cron real path (server-side only) → PR3b writer Section 0~7 본문 → PR4 UI trigger 버튼 + Track Record 탭 + Regen 실 호출 |

**§3 사용자 액션 대기 큐**: PHASE C 박제 제거. track-record click이 trigger가 아님을 명시.

**§6 53차 §4++ entry 보강**: 본 세션 §5 정정 박제 entry 신설. Group A-H mismatch + Group H Critical Hard gate (PR1 ⊥ PR3a 미선행 = page crash) + 정정 spec doc path link + omxy 32 BLOCKERS catch & fix (R1~R7) 박제.

### 3.2 ServicePlan-Admin.md

**§1A.5 D19 Tier 0 fallback 어휘 정정**:

```diff
- AI 키 미발급 fallback = Tier 0 단독으로 실 코스피·코스닥 30종목 + 실 가격·재무·뉴스.
- AI 키 발급 시 Tier 1·2 plug-in.
+ 메인 path = Tier 0 인디케이터·DART numeric narrow (단/중/장 후보 50씩 = 150) → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 단/중/장 top 10 = 30 선정.
+ AI 키 미발급 시 fallback = Tier 0 단독 30 직선정 (현 production 상태).
+ AI 키 발급 후 Tier 1 AI 30 선정 enable + Tier 2 sector 14 페르소나 Section 8 partA/partD plug-in.
```

**§3 페이지 IA**:
- `/admin/track-record` = "누적 성과 + 월별 리포트 아카이브 한 페이지 탭 분리" 명시.
- `/admin/report/[ticker]` = "30종목 클릭 시 풀 리포트 페이지 (Section 0~8 + Appendix)" 명시.
- `/admin/portfolio` = "30종목 리스트 (`ShortlistRow` accordion) + trigger 버튼 (사용자 reject 후 신규 30 + 종목별 Regen)" 명시.

**§4 E1 short_list_30 현재 상태 박제**:
- 현재 = Tier 0 단독 30 직선정 (Tier 1 AI 0 호출).
- 정정 후 = Tier 1 AI 30 선정 (메인 path).

**§8 v1.9 changelog 추가** (OMXY R3 BLOCKER 6 정정 — 기존 v1.8 = 52차 D21·D22, 신규 v1.9 = 53차 §5 정정): 53차 §5 정정 박제. Group A-H mismatch catch + spec doc path + Hard gate (PR1 ⊥ PR3a 미선행).

### 3.3 ReportFramework.md

**§8 Step 1~4 정정**:
- writer Section 0~7 본문 작성 path = **미구현** 박제 추가.
- 현재 writer = `section_8` jsonb commit만 가능 (`commitTickerReport` + `commitSectorReport`).
- 후속 **PR3a** (Group H schema drift fix only) — admin-reports.ts type guard + report/[ticker]/page.tsx null guard + section_8 shape 호환 (신규 partA/partB/partC/partD vs 기존 conclusion/recommendation/keyQuotes).
- 후속 **PR3b** (writer Section 0~7 본문 구현) — document-specialist + analyst + writer + critic 4-step.
- **Critical 박제**: PR1 cron 가동 시 PR3a 미선행 → 사용자 종목 클릭 시 page crash (PR3b는 별개로 PR1 후 가능).

**§8 Step 0 AI 호출 트리거 3 path 박제**:
- (a) cron 매월 자동 (vercel.json monthly-batch).
- (b) 사용자 reject 후 trigger 버튼 (수동 종목당 월 2회).
- (c) 종목별 'Regen' 버튼 (단일 종목 풀 리포트 재생성).

**§9.2 sector reference 3-level 분류 박제 (OMXY R1 BLOCKER 3 + R3 BLOCKER 3 정정)**:
- **Level A** 풀 리포트 본문 reference 보유 = 바이오·반도체 (2 sectors), 부족 12 sectors.
- **Level B** §9.2 추가 체크리스트 보유 = 바이오·반도체·건설·금융 (4 sectors), 부족 10 sectors.
- **Level C** SECTOR_PHILOSOPHIES 보유 = 14 canonical sectors 모두, 부족 0.
- 운용 방향: Level A 12 sectors 부족 → 운용 중 lazy 추가 (eager pre-fill 금지). Level B 10 sectors 부족 → 첫 보고서 작성 시 추가. Level C 완전 박제이므로 어느 sector 종목 클릭해도 페르소나 prompt 동작.

### 3.4 ProgressDashboard.md

| Step | 박제 전 | 박제 후 |
|---|---|---|
| Step 3c caller wiring | DONE | **PARTIAL — dangling server action** (server action export OK / page render·import 0 / cron real 0 / UI caller 0 — OMXY R1 BLOCKER 4 + R2 BLOCKER 1) |
| 잔여 task (canonical) | (없음) | (1) PR2 Tier 1 AI 30 선정 (2) PR3a Group H schema drift fix Hard gate (3) PR1 cron real path (server-side only) (4) PR3b writer Section 0~7 본문 구현 (5) PR4 UI trigger 버튼 + Track Record 탭 + Regen 실 호출 |

### 3.5 CodebaseStatus.md

**writer.ts 현재 상태 박제**:
- `tudal/src/lib/report/writer.ts` = `commitTickerReport` + `commitSectorReport` 함수로 `section_8` jsonb commit만 가능.
- Section 0~7 본문 작성 path 미구현.
- `parseSectorContentStrict`는 Section 8 parser only.

**dangling server action 박제** (OMXY R1 BLOCKER 4):
- `triggerMonthlyPersonaEvalAction` = **dangling server action** (export 존재 / page import·render 0 / cron real 0 / UI caller 0). UI wiring PR4 + cron wiring PR1에서 해소.

**short_list_30 박제**:
- 현재 = Tier 0 단독 30 rows (Tier 1 AI 0 호출).
- 정정 후 = Tier 1 AI 30 선정 (PR2 후속).

**Group H schema drift 박제 (OMXY R1 BLOCKER 5 신규)**:
- `tudal/src/lib/data/admin-reports.ts` `getReportByTicker`는 section_0~7 + section_8.recommendation/keyQuotes shape dereference.
- `tudal/src/lib/report/writer.ts` `commitTickerReport`는 신규 section_8 jsonb만 INSERT (section_0~7 null + recommendation/keyQuotes 부재).
- PHASE C 실행 시 사용자가 종목 클릭 → page render 시 null dereference crash 위험. **Critical — PR3a schema drift fix만이 PR1 cron 가동 전 선행 필수 (PR3b writer Section 0~7 본문 구현은 별개 — PR1 후 가능)**.

**Regen path 박제 (OMXY R1 BLOCKER 6)**:
- 종목별 'Regen' 버튼 UI + quota counter 박제 존재.
- 실 AI 재생성 호출 = **0** (PR4에서 wire).

### 3.6 CLAUDE.md

**상단 시퀀스 v3.2 (또는 v3.3) 정정**:
- D19 "Tier 0 fallback" 어휘 정정.
- D19 시퀀스 메인 path = Tier 0 + Tier 1 AI 합의 → 30 명확화.
- "AI 키 미발급 fallback = Tier 0 단독" 어휘는 fallback 명시 (메인 path가 아님).

```diff
- AI 키 미발급 fallback = Tier 0 단독으로 실 코스피·코스닥 30종목
+ 메인 path = Tier 0 → Tier 1 AI 합의 → 단/중/장 top 10 = 30 선정 + 30 풀 리포트
+ fallback = AI 키 미발급 시 Tier 0 단독 30 직선정 (현 production 상태)
```

### 3.7 S7-RealData.md

**T7e.8 박제 보강**:
- Tier 0 단독 30 rows = **fallback 상태** (메인 path 아님).
- 메인 path = Tier 1 AI 30 선정 (후속 implementation PR2).
- 30 직선정 → AI 30 선정 전환은 PR2에서 진행.

---

## 4. 후속 implementation PR scope (별도 — 본 task scope 밖)

본 task는 **docs 정정 spec까지**. 실제 코드 변경은 아래 PR로 분리. **OMXY R2 BLOCKER 2 정정**: canonical PR 순서 = **PR2 → PR3a → PR1 → PR3b → PR4** (PR3a Group H schema drift fix가 PR1 cron 가동 전 선행 필수).

| PR | 범위 | 의존성 |
|---|---|---|
| **PR2** (선행) | Tier 1 AI 30 선정 screening 로직 — Tier 0 50씩 후보 → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 단/중/장 top 10 = 30 선정. persona-eval.ts 확장. | 의존 0 (independent) |
| **PR3a** (Critical 선행) | **Group H schema drift fix only** — admin-reports.ts transformStockReportRow validation + Section type guard / report/[ticker]/page.tsx early null guard + Section 0~7 fallback UI / section_8 jsonb shape 호환 (old conclusion·recommendation·keyQuotes 잔존 path → 신규 partA/partB/partC/partD path). writer Section 0~7 본문 구현 X (PR3b). | PR2 후. **PR1 cron 가동 전 Hard gate 선행 필수**. |
| **PR1** | cron `monthly-batch` real path enable + server-callable trigger function — Task 12 박제 "mock dry-run only" 폐기. cron이 PR2 함수 (`runTier1Screening` 또는 동일) 호출. **UI 버튼은 PR4 scope** (OMXY R3 BLOCKER 2 정정: admin trigger UI는 PR4로 분리). 또는 first-iteration을 "real cron disabled behind flag"로 낮춰 PR3b 후 enable 옵션. | **PR3a 선행 필수**. PR2 후. |
| **PR3b** | writer Section 0~7 본문 구현 (document-specialist + analyst + writer + critic 4 step). | PR1 후 (또는 PR1과 병렬 — writer는 cron 트리거 외에도 호출 가능) |
| **PR4** | UI 신설 — (a) admin manual trigger 버튼 (1개 즉석 quality 생성/재생성/실패 복구) (b) 종목별 Regen 실 호출 wire (orchestrate quality, 현재 quota counter만 동작) (c) Track Record 탭 분리: 누적 성과 + 월별 아카이브 (d) PR3a OOS 3종 (partA 14 rows / aggregateVotes layer 2 guard + getVotesByReportId wrapper / LLM string·array max bound top 5) (e) B18 CRON_SECRET 401 test 4종 (f) Task 8 W7 only (defer 나머지는 source review docs 링크 박제). caller path = admin manual + Regen 모두 `orchestrateFullReport` (quality, Kevin v3.1 target 정합). | PR1~PR3c 완료 후 |
| **PR5** (분리, 56차 §3 T11 결정) | **cron 30 자동 리포트 + 큐 인프라** — cron `monthly-batch` route에 30 종목 풀 리포트 자동 호출 추가. caller path = `orchestrateFullReport` (quality, 30 × 535원 ≈ 16,050원/월 hardcap 4%). timeout 처리 = (β1) Vercel Queues 신설 OR (β2′) 자체 DB job queue resumable worker (PR5 plan 시점 R-debate 결정). fail = γ1 allSettled + γ3 retry N + summary alert. cost = δ1 기존 40만원 hardcap + batch preflight (`ORCHESTRATE_TOTAL × pendingCount`). admin_id = 'cron-system'. service-role client DI + cost_log e2e test. **사용자 직접 catch — omxy R1~R7 7 rounds CONVERGED + plan v7 lock-in 후에도 plan에 누락이었음** (omxy scope guard "spec 재해석 금지"로 catch 안 됨). | PR4 머지 후 |

**Hard gate 박제 (OMXY R1 BLOCKER 5 + R2 BLOCKER 2)**: **PR1 (real cron 가동) ⊥ PR3a 미선행** = page crash inevitable. 따라서 PR1 머지 전 PR3a 머지 + verification 통과 필수. 대안 = PR1 first-iteration을 `cron disabled behind flag`로 낮춤 (Tier 1 함수만 동작, INSERT 미발생). **(54차 §4 PR1 ✅ MERGED `4aa3130` + 55차 §3 PR3b ✅ MERGED `cf68731` + 55차 §4 PR3c ✅ MERGED `b2a902a` 후 해소.)**

**PR5 후속 트랙 박제 (56차 §3 T11 결정, 사용자 catch + omxy R1~R2 CONVERGED)**:
- (α) caller path = α2 quality (orchestrateFullReport, ~16,000원/월). 사용자 lock-in §1.6 Kevin v3.1 quality target 정합. fast path α1 폐기 — Kevin v3.1 미달.
- (β) timeout 처리 = β1 Vercel Queues OR β2′ 자체 DB job queue resumable worker. Vercel function duration 300s/800s 내 30 × ~50s = 25분 처리 불가. waitUntil/after 우회 불가. **PR5 plan 시점에 (β1) vs (β2′) R-debate 후 결정**.
- (γ) fail handling = γ1 allSettled + γ3 retry N회 + summary alert. abort-first 부적합 (30 batch).
- (δ) cost preflight = δ1 기존 40만원 hardcap 유지 + batch preflight 추가 (`ORCHESTRATE_TOTAL × pendingCount`). δ2 100만원 hardcap 신설 = scope creep (사용자 lock-in §1.8 "API 금액 무관" 과해석 — 폐기).
- (ζ) admin trigger 의미 = ζ1 "특정 1개 즉석 quality 생성/재생성/실패 복구" (PR4 plan v7 정합). batch 수동 재실행 버튼은 PR5 scope 밖 또는 별도 토론.
- 비용 산술 정정 (omxy R1 catch): 30 × 535원 = **16,050원/월** (이전 박제 "48만원" 곱셈 오류).
- 첫 달 운영 = PR4 머지 ~ PR5 머지 사이, 어드민 3인이 30 종목 manual click 분담 (1인당 10번). 사용자 lock-in §1.3 "3 trigger path" 정합 유지.

---

## 5. Open questions (OMXY 토론 결정)

본 spec doc 단계에서 결정 불가 — OMXY 적대적 검토에서 최종 결정. **사용자 lock-in 8 항목은 절대 우선 — Open question 아님** (OMXY R1 BLOCKER 1 정정으로 Track Record row 제거).

| 질문 | 후보 |
|---|---|
| Tier 1 AI 호출 범위 | (i) 150 후보 전체 / (ii) 60 narrow (단/중/장 20씩) / (iii) 30 narrow |
| 12 sectors reference 자료 처리 | (i) lazy (운용 중 1 sector씩 추가) / (ii) eager (먼저 12 sector reference 전부 수집 후 PR3 진입) |
| writer Section 0~7 호출 구조 | (i) single LLM call (Section 0~7 통합) / (ii) 8 LLM calls (Section 별) / (iii) hybrid (논리 결합도에 따라 grouping) |
| ~~Track Record 탭 vs 별도 페이지~~ | **사용자 lock-in 1.5 확정 = 한 페이지 탭 분리** (OMXY R1 BLOCKER 1 정정 — Open question 아님) |

---

## 6. OMXY 적대적 검토 요청 항목

OMXY 검토자는 아래 6 항목을 적대적으로 검증:

1. **사용자 lock-in 8 항목과 정정 spec의 1:1 일치 검증**: §1의 각 항목이 §3 정정 spec에 mapping 되는가? 누락된 항목이 있는가?
2. **Group A-H mismatch 완전 catch 검증**: 박제 vs 코드 mismatch 중 본 spec이 놓친 Group이 있는가? (예: 환경변수, 권한, RLS, cost guard 등) — Group H 신규 = stock_reports schema drift + report page crash (OMXY R1 BLOCKER 5).
3. **정정 spec과 코드 호환성**: 정정 후 박제가 실 구현 가능한가? Tier 1 AI 30 선정이 현 Tier 0 logic 위에 plug-in 가능한가?
4. **후속 implementation PR scope 분리 적절성**: canonical 5-PR 분할 (PR2 → PR3a → PR1 → PR3b → PR4)이 atomic 한가? 의존 cycle 있는가? rollback 가능한가? Hard gate (PR1 ⊥ PR3a 미선행) 명확한가?
5. **"다음 세션 진입자가 HANDOFF만으로 진행 가능"한 박제 완성도**: §3.1 HANDOFF.md §0 5줄 요약이 다음 진입자에게 충분한가? **OMXY R2 BLOCKER 4 박제: 본 spec doc CONVERGED ≠ HANDOFF "이어서 진행" 조건 충족**. 조건 충족은 Phase 3 정정 subagent가 실 HANDOFF.md 갱신 + Phase 4 verification 통과 후. 본 spec doc은 정정 spec까지이며 실 파일 갱신은 후속 phase.
6. **Out of scope 경계**: §7 out of scope 항목이 실제로 본 task와 분리 가능한가? scope creep 위험 있는가?

---

## 7. Out of scope (이번 task)

본 task = docs 정정 spec까지. 아래 항목은 본 spec 적용 대상 아님:

- 후속 implementation PR (canonical PR2 → PR3a → PR1 → PR3b → PR4 코드 변경) — 별도 세션.
- DQ-7 Smoke #4/#5, KIS 발급, Binance 테스트넷, S8 자동매매 — 별도 트랙 (S7c → S7d → S9 운용 → 🎉 출시 → S8 순; **S8 자동매매는 출시 후** — 2026-06-01 재배치).
- 멤버 페이지 (Deferred-D 트랙).
- 비용 최적화 (Tier 1 호출 범위는 후속 PR2에서 결정 — §5 open question (i) 참조).
- 12 sectors reference 자료 수집 (lazy 결정 시 운용 중 추가 — §5 open question (ii) 참조).
- writer Section 0~7 호출 구조 결정 (PR3b 입찰 시 결정 — §5 open question (iii) 참조).

---

## Appendix A — 정정 대상 file × loci matrix

| 파일 | locus | 정정 내용 요약 |
|---|---|---|
| `Document/Process/HANDOFF.md` | §0, §1, §2.1, §3, §6 | 5줄 요약 재작성 (canonical PR2→PR3a→PR1→PR3b→PR4 + Hard gate) / **§0 세션 시작 루틴 PR #8/Step 3b 분기 폐기 + PR2 진입 분기로 재작성** / Step 3c PARTIAL (dangling server action) / Step 6 신설 / track-record trigger 박제 제거 / 53차 §5 entry (Group A-H + 32 BLOCKERS) / §4++ historical "다음 1순위 PHASE C continuation" bullet에 폐기 주석 동반 |
| `Document/Service/Planning/ServicePlan-Admin.md` | §1A.5 D19, §3, §4 E1, §8 changelog | Tier 0 fallback 정정 (메인 path = Tier 0 + Tier 1 AI 합의) / 페이지 IA 명시 (track-record 탭 분리 + report/[ticker] 풀 리포트) / short_list_30 상태 박제 (현재 Tier 0 단독) / **v1.9** changelog |
| `Document/Service/Report/ReportFramework.md` | §8 Step 0·1~4, §9.2 | 3 trigger path 박제 (현 코드 상태 컬럼) / writer Section 0~7 미구현 (Group E) / Group H schema drift 박제 / 3-level sector reference (Level A 2/12 · Level B 4/10 · Level C 14/0) |
| `Document/Build/ProgressDashboard.md` | Step 3c 행, 잔여 task | DONE → **PARTIAL — dangling server action** / 잔여 5 task (PR2 → PR3a → PR1 → PR3b → PR4 canonical) |
| `Document/Process/CodebaseStatus.md` | writer.ts, dangling exports, short_list_30, Group H schema drift, Regen 미구현 | writer Section 8 jsonb only / triggerMonthlyPersonaEvalAction dangling / Tier 0 단독 30 / **Group H Critical (admin-reports validation 0 + page section0.conviction early deref + Section 0~7 nested deref + Section 8 shape mismatch)** / Regen UI+quota 박제만 실 호출 0 |
| `Document/Build/Slices/S7-RealData.md` | T7e.8 | Tier 0 단독 = fallback 명시 / 메인 path = Tier 1 AI (PR2 후속) |
| `CLAUDE.md` | 상단 시퀀스 (v3.2 → **v3.3**), D19 시퀀스 | 메인 path = Tier 0 + Tier 1 AI 합의 명확화 / "AI 키 미발급 fallback" 어휘 분리 |
| `Document/Service/Planning/ServicePlan.md` | §3 공통 원칙 (해당 시) | "30 직선정" 어휘 없으면 skip |

---

## Appendix B — 코드 reference 정확도 박제

본 spec에서 인용한 코드 path는 OMXY 검토 시 실재 확인 필요:

| reference | 실재 path | 확인 상태 |
|---|---|---|
| persona-eval.ts | `tudal/src/lib/screening/persona-eval.ts` | 실재 확인 (53차 §4 박제) |
| writer.ts | `tudal/src/lib/report/writer.ts` | 실재 확인 (53차 §3·§4 박제) |
| Kevin v3.1 rubric | `tudal/src/lib/ai/prompts/kevin-v31-rubric.ts` | 실재 확인 (53차 §3 PR #8) |
| Step 3c caller wiring spec | `docs/superpowers/specs/2026-05-21-step3c-caller-wiring.md` | 실재 확인 (53차 §4) |
| Kevin v3.1 rubric spec | `docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md` | 실재 확인 (53차 §3) |
| cron monthly-batch | `tudal/src/app/api/cron/monthly-batch/route.ts` | mock dry-run only (Group C) |
| short_list_30 | Supabase `short_list_30` 테이블 (마이그 **0002** 신설 / **0012** name·sector 추가 / **0018** sub_tags jsonb 추가). DART cache는 마이그 **0014** (별도). 30 rows = Tier 0 단독 직선정 (Group B). (OMXY R3 BLOCKER 5 정정) |
| ShortlistRow | `tudal/src/components/admin/shortlist/shortlist-row.tsx` | 실재 확인 — `<details>` accordion + 풀 리포트 Link. (OMXY R3 BLOCKER 5 정정 — 이전 spec doc의 `ShortlistRow.tsx` 캐피탈 오류) |
| admin-reports.ts | `tudal/src/lib/data/admin-reports.ts` | `getReportByTicker` + `transformStockReportRow` — mapping/validation 0 (Group H Critical) |
| report/[ticker]/page.tsx | `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` | section0.conviction header early deref + Section 0~7 entire nested deref + Section 8 old shape (conclusion/recommendation/keyQuotes) — Group H Critical |
| track-record/page.tsx | `tudal/src/app/(admin)/admin/track-record/page.tsx` | 누적 성과 대시보드 (5 summary cards + 월별 + 버킷별 + Counterfactual). trigger button 0. Track Record 의미 박제 = Group F |
| track-record/actions.ts | `tudal/src/app/(admin)/admin/track-record/actions.ts` | `triggerMonthlyPersonaEvalAction` server action export — dangling (caller 0, Group D) |

---

**End of Spec — OMXY 적대적 검토 대기**
