# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-19 (21차 — S5a ✅ 완료)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🟢 현재 슬라이스

**S5b 장중·토글·Exit** → `Document/Build/Slices/S5-Automation.md` (§S5b Tasks)
상태: 🟡 **블로커 해소 필요** (S5a 완료. BL-12 SMS 벤더·BL-14 한투 WebSocket vs 폴링 미결)
포함 Must: M13·M14·M15 (3건)
라우트: `/admin/alerts/[id]` 결정 기록 UI 확장 + `/admin/settings` 모드·종목 토글 + 한투 어댑터
잔여 예상: 2세션. 실제는 S1~S5a 추세로 1세션 예상
실행 엔진: **`team` + `ralph`** (Must 3건, Playbook §2.5 결정적 규칙)

### ⏸ S5b 킥오프 시 결정 필요

- **BL-12** SMS 벤더 — M15 D10 백업 1회 재시도 경로 (Twilio / NHN Cloud SMS / Naver Cloud SENS / AWS SNS)
- **BL-14** 한투 API 연결 방식 — M13 장중 감지 (WebSocket 실시간 vs 1분 폴링)

### 🚀 다음 세션 첫 행동 (순서)

```
1. BL-12·BL-14 해소 1문 질의 (SMS 벤더·한투 연결 방식)
2. S5 슬라이스 파일 §S5b Tasks 읽기 (Document/Build/Slices/S5-Automation.md)
3. S5b 킥오프:
   - T5b.1 M13 장중 이상 감지 (±5%/거래량 3배 감지 + 홈 배지 + 텔레그램)
   - T5b.2 M14 종목별 알림 토글 (Short List 30종목 on/off · user_prefs)
   - T5b.3 M15 Exit 시그널 (3채널 + D10 catch-up + T+7 outcome 자동 적재)
4. 검증 게이트: build + lint + test:ci · architect 리뷰 · ai-slop-cleaner
5. 커밋: feat(S5b): ...
```

**S5a 이월 메모 (비블로킹, S5 실데이터 전환 시 참조)**:
- AlertType 확장(`news_warning`·`briefing_failed`) 타입 레벨만 반영. 실 Supabase `alert_event` check constraint 업데이트 필요
- pipeline_health·news_event·briefing_log·briefing_view_event 실 INSERT는 미연결 — cron 핸들러에서 `// 실 적재는 실데이터 전환 시` 주석 처리
- Vercel Cron 시간: monthly-batch가 `5 0 1 * *` UTC = 09:05 KST day 1 (목표 00:05 KST는 장기간 cron 한계로 이월). 실배포 시 `vercel.json` 조정
- `CRON_SECRET`·`RESEND_API_KEY`·`RESEND_FROM_EMAIL`·`NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`·`ADMIN_EMAILS` env 설정 필요 (배포 전)
- MOCK_ADMIN_PIPELINE_HEALTH 시드는 `2026-04-19T00:00:00+09:00` 기준 24h — health 페이지가 해당 시점을 `now`로 고정해 렌더

**S4 이월 메모 (비블로킹, S5b 또는 실데이터 전환 시 참조)**:
- `RegenCounter.manualCount` (camelCase) ↔ DB `manual_count` (snake_case) 매핑 레이어 필요
- `src/lib/data/mock-admin-snapshots.ts`는 현재 빈 배열 — Accept hook으로만 채워짐. S5에서 EOD 배치 시 seed 필요

---

## ✅ 완료 슬라이스

### S5a 스케줄러·브리핑·뉴스·헬스 ✅ (2026-04-19, 21차 · 실제 1세션)

**달성 Must**: M10·M11·M12·M18 (4건 · 누적 14/19 = 74%)
**주요 산출**:
- `tudal/supabase/migrations/0006_s5a_automation.sql` — pipeline_health(5 파이프라인 × 24h) + news_event(UNIQUE url) + briefing_log(UNIQUE date) + briefing_view_event(dedupe) + RLS 4종
- `tudal/vercel.json` — crons 3건(monthly-batch `5 0 1 * *` UTC · morning-briefing `0 23 * * *` UTC = 08:00 KST · news-sweep `*/15 * * * *`)
- `tudal/src/lib/scheduler/monthly-batch.ts` — runStepWithRetries(3회 재시도·지수 백오프·주입 가능 sleep) · runMonthlyBatch · toPipelineHealthRecord · buildSchedulerFailAlert + 13 Vitest
- `tudal/src/lib/briefing/compose.ts` — 3줄 요약 · email/html/text/telegram 포맷 · xss escape · toBriefingLogRecord + 8 Vitest
- `tudal/src/lib/email/resend.ts` — fetch 기반 Resend 어댑터 · mock-mode 분기 · RESEND_API_KEY 미설정 시 console 경고
- `tudal/src/lib/news/{naver-api,scraper,classifier}.ts` — 네이버 검색 API 클라이언트 + 스크래퍼 stub(S6 컴플라이언스 대기) + 규칙 기반 Critical/Warning/Info 분류 + dedupeByUrl + 12 Vitest
- `tudal/src/lib/health/pipeline-health.ts` — aggregatePipelineHealth(24h 윈도우) · severityFromRate(95%/99% 임계) · recentFailures · overallSeverity + 8 Vitest
- `tudal/src/app/api/cron/{monthly-batch, morning-briefing, news-sweep}/route.ts` — 3 Vercel Cron 핸들러 · Bearer CRON_SECRET 가드 · mock-mode fallback
- `tudal/src/app/(admin)/admin/settings/health/page.tsx` — 5 파이프라인 카드 + 24h 성공률 + 95% Critical 배너 + 실패 tail 50건
- `tudal/src/app/(admin)/admin/alerts/page.tsx` + `[id]/page.tsx` — AlertEvent 이력 + Critical/Warning 뉴스 목록 + 상세
- `tudal/src/components/admin/briefing/briefing-card.tsx` + `/admin` 상단 통합
- `tudal/src/lib/data/mock-admin-pipeline-health.ts`(272 runs · mulberry32 결정적 seed) · `mock-admin-news.ts`(4 Critical + 6 Warning + 8 Info) 신설, `mock-admin-briefings.ts`(5일 · 실패 1건 포함) · `mock-admin-alerts.ts`(6건) 확장

**Ralph 실행**: Wave 1 (마이그레이션+타입+mock) → Wave 2 병렬 3 (M10·M11·M18) → Wave 3 (M12) → Wave 4 (Vitest 4 files 41 tests 추가) → Wave 5 (검증 3게이트 + 문서 갱신)

**의사결정 (21차)**:
- BL-11 = **Resend** (Next.js 친화·React Email·무료 3K/월)
- BL-13 = **네이버 뉴스 API + 어드민 지정 매체 스크래핑 하이브리드** (컴플라이언스 정비는 S6)
- BL-15 = **Vercel Cron** (G-6 배포 플랫폼 = Vercel 부수 확정)
- S5 분할 = S5a(M10·M11·M12·M18) → S5b(M13·M14·M15) 2 wave

**비블로킹 이월 (S5b·실데이터 전환 시)**:
1. 실 Supabase INSERT(pipeline_health·news_event·briefing_log) 연결 — 현재 cron 핸들러는 mock-mode JSON 응답만
2. `alert_event` check constraint에 `news_warning`·`briefing_failed` 추가 (현재 타입 레벨만 확장)
3. monthly-batch 시간 미세 조정 (목표 00:05 KST → 현재 09:05 KST) — Vercel Cron UTC only

**검증**: lint 0 · build 20 routes · test:ci 15 files / 128 pass · 커밋 `feat(S5a): ...` (예정)

### S4 가상 포트·성과·Decision Tree ✅ (2026-04-19, 20차 · 실제 1세션)

**달성 Must**: M8·M9·M16 (3건 · 누적 10/19 = 53%)
**주요 산출**:
- `tudal/supabase/migrations/0005_s4_performance.sql` — E5 portfolio_snapshot (partial UNIQUE on ticker NULL/NOT NULL) + E8 regen_counter (UNIQUE ticker+month · auto≤1·manual≤2) + cost_log stub (R5 pre-wire) + RLS 3종
- `tudal/src/lib/performance/` 6 파일 — sharpe·mdd·alpha·judge(복합 AND)·cap-months·regen-cap. 41 + 12 Vitest 테스트(부분).
- `tudal/src/app/(admin)/admin/track-record/page.tsx` — 5 카드(누적·KOSPI·Alpha·Sharpe·MDD) + 월별 테이블 + 버킷별 + Counterfactual + CAP Months 참조
- `tudal/src/app/(admin)/admin/decision-tree/page.tsx` + `trend-chart.tsx`(Client island) — 게이지 3종 + ○/△/✕ 배지 + Recharts 추이 + Y1 요약
- `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/` — page·regenerate-panel·actions (서브라우트 BL-9 A) + cost_log stub 훅 주석
- `tudal/src/lib/data/mock-admin-performance.ts` · `mock-admin-decision-tree.ts` · `mock-admin-regen-counters.ts` 시드 보강
- `tudal/src/app/(admin)/admin/portfolio/actions.ts` — resolveAdminId + try/catch + E5 snapshot INSERT hook + S3 hardening 3종 (adminId 세션 · trim · isUniqueViolation 패턴)
- `tudal/src/lib/portfolio/dispute.ts` — DisputeReasonValidation trim 정규화

**Ralph 실행**: T4.1 선행 → T4.2+T4.5 병렬 → T4.3+T4.4 병렬 → T4.6 순차 + architect APPROVED + ai-slop-cleaner(`manualRemaining` 미사용 prop · await resolveAdminId 무의미 호출 · `For now` 반복 주석 삭제)

**의사결정 (20차)**:
- BL-8 = A (복합 AND: alpha≥0 AND Sharpe≥0.5 AND MDD≥-15%)
- BL-9 = A (서브라우트 /admin/report/[ticker]/regenerate)
- S3 hardening = B (S4 T4.6 병행)

**architect 비블로킹 권고 (S5 이월)**:
1. RegenCounter camelCase ↔ snake_case 매핑 — S5 실 Supabase 연결 시
2. CSS 변수 `--market-up/-down` vs `--color-market-up/-down` — 본 세션에서 정규화 완료

**검증**: lint 0 · build 17 routes · test:ci 87 pass · 커밋 `feat(S4): ...`

### S3 승인 워크플로우 (+D15) ✅ (2026-04-17, 19차 · 실제 1세션)

**달성 Must**: M7 (1건 · 누적 7/19 = 37%)
**주요 산출**:
- `tudal/supabase/migrations/0004_s3_approval.sql` — E4 portfolio_approval 실 생성(v1.3: dispute_reason ≥20자 체크·dispute_raised_by·gating_auto_relief_active·reanalysis_count) + E11 kr_business_days 2024~2030 seed + alert_event 'gating_auto_relief' 타입 + RLS
- `scripts/seed_kr_holidays.py` — S5 M10 pykrx 월간 배치 참조 스크립트 (Homebrew Python 3.14 PEP 668 → venv 가이드)
- `tudal/vitest.config.ts` + `package.json` test scripts — Vitest 4 셋업(G-10 옵션 b)
- `tudal/src/lib/portfolio/` 6개 파일 — 순수 로직 5(approval-logic·business-days·gating·auto-relief·dispute) + calendar helper
- `tudal/src/lib/portfolio/__tests__/` 5 테스트 파일 — 43 tests(10·7·6·7·13)
- `tudal/src/app/(admin)/admin/portfolio/` 3 파일 — page.tsx(Server Component 통합본) · portfolio-panel.tsx(Client island Base UI Dialog) · actions.ts(4 Server Actions mock)
- `tudal/src/lib/data/mock-admin-access-logs.ts` · `mock-admin-approvals.ts` fixture 보강
- `tudal/src/types/admin.ts` v1.3 + `kr-business-days.ts` 신설

**Ralph 실행**: 5 wave(Wave 1 병렬 3 → Wave 2 → Wave 3 → Wave 4 → Wave 5) + architect APPROVED + ai-slop-cleaner(console.log 4건 + alt fixture 14줄 삭제)

**의사결정 (19차)**:
- G-10 = b (Vitest 1파일+인프라) — race/영업일/7일 감지 순수 로직 TDD
- BL-7 = A (dispute_reason 자유 텍스트 min 20자)
- BL-19 = D (pykrx seed → Supabase kr_business_days 캐시) — Homebrew PEP 668로 수기 2024·2025·2026 + S5 M10 이후 pykrx 덮어씀
- BL-20 = A (7일 연속 단일 접속 자동 바이패스 + AlertEvent gating_auto_relief)

**architect 비블로킹 권고**:
1. `actions.ts` adminId 세션 주입 TODO 주석 ✅ 처리됨
2. `gating.ts` 주석 명료화 ✅ 처리됨
3. `dispute_reason` DB constraint btrim 보강은 실 Supabase 통합 시(= S3 hardening) 처리 이월

**검증**: lint 0 · build 17 routes · test:ci 43 pass · 커밋 `feat(S3): ...`

### S2 풀 리포트 + 투심위 ✅ (2026-04-17, 18차 · 실제 1세션)

**달성 Must**: M2·M3 (2건). 상세는 slice 파일.

### S1 Short List 30 홈 ✅ (2026-04-17, 16~17차 · 실제 2세션)

**달성 Must**: M1·M4·M5·M6 (4건).

### S0 Foundation ✅ (2026-04-17, 15차)

Legacy 전면 제거 · Supabase 연결 · 8 AGENTS.md · 11 admin 라우트 · 9엔티티 RLS sketch · 한국 증시 디자인 토큰.

---

## 📊 전체 진행 상황

→ `Document/Build/ProgressDashboard.md` (주간 뷰)

| 슬라이스 | 상태 | 예상 세션 | 실제 |
|---|---|---|---|
| S0 Foundation | ✅ 완료 | 2 | 1 |
| S1 Short List 30 홈 | ✅ 완료 | 4 | 2 |
| S2 풀 리포트·투심위 | ✅ 완료 | 3 | 1 |
| S3 승인 워크플로우 | ✅ 완료 | 4 | 1 |
| S4 성과·Decision Tree | ✅ 완료 | 4 | 1 |
| S5a 스케줄러·브리핑·뉴스·헬스 | ✅ 완료 | 3 | 1 |
| **S5b 장중·토글·Exit** | 🟡 **BL-12·BL-14** | 2 | — |
| S6 Hardening | ⚪ 대기 | 3 | — |
| **잔여** | | **5세션** | |

Must 19 진행률: **14 / 19 (74%)** — M1·M2·M3·M4·M5·M6·M7·M8·M9·M10·M11·M12·M16·M18 달성.

실제 속도 = **예상의 ~33%** (S0~S5a에서 예상 20세션 → 실제 7세션). 잔여 5세션도 같은 속도 가정 시 **2세션 이내에 MVP 완성 가능**.

---

## 🟡 보류 / 사용자 답변 필요

- ~~**BL-3·BL-4·BL-5**~~ ✅ 해소
- ~~**[G-5]·[G-11]**~~ ✅ 해소
- ~~**BL-7·BL-19·BL-20**~~ ✅ 해소 (S3)
- ~~**[G-10]**~~ ✅ 해소 (S3, Vitest 1파일)
- ~~**[S3 hardening]**~~ ✅ 해소 (S4 T4.6 병행)
- ~~**BL-8·BL-9**~~ ✅ 해소 (S4 킥오프)
- ~~**BL-11·BL-13·BL-15**~~ ✅ 해소 (S5a 킥오프 · Resend · 네이버+스크래핑 · Vercel Cron)
- ~~**[G-3]·[G-6]**~~ ✅ 해소 (S5a · pipeline_health 인라인 · Vercel 확정)
- **BL-12·BL-14** — S5b 진입 전 (SMS 벤더·한투 WS vs 폴링)
- **BL-18** — S6 진입 전
- **Q16** 법무 자문 (S3 완료 이후 — 지금부터 처리 가능)
- **Q17** 이용약관·면책 (S6 이전)
- **Q-OP3·Q-OP4** 재질문 금지 (개발 완료 전)

## 🧭 보류 트랙 (Must 19 밖 로드맵)

- **Deferred-X** 증권사 API + 매뉴얼/자동매매 UI → `Document/Build/Slices/Deferred-Brokerage.md`
- **Deferred-Y** AI Agent 기반 선정엔진 v2 → `Document/Build/Slices/Deferred-AIAgent-Selection.md`
  - v0 (mock, S1·S2·S3 완료) → v1 (pykrx+v6 실데이터, S5 M10) → **v2 (AI agent, 본 트랙)**

---

## 🔎 S3 E2E 수동 재검증 (선택)

S4 킥오프 전 브라우저 육안 확인 원할 시:
```bash
ulimit -n 65535
cd tudal && npm run dev
# 브라우저에서 http://localhost:3000/admin/portfolio 로그인 후 확인 포인트:
#   1. 상단 "이번 달 포트 확정 — 2026-04" 헤더 + 편입/유지/제외 집계
#   2. D+5 영업일 위젯 ("📅 D+5 영업일: YYYY-MM-DD (N일 남음)")
#   3. 이미 확정된 경우(2026-04 fixture) → "이의 제기" 버튼 표시
#   4. Accept 버튼 클릭 → 확인 모달 + 확정/취소
#   5. Reject 버튼 클릭 → 사유 textarea + Reject/취소
#   6. 이의 제기 클릭 → Dialog + 실시간 20자 카운터(빨강<20/초록≥20) + 제출 disabled 가드
#   7. 48h Hold 중(가상 시나리오 fixture 수정 시) → 주황 배너 + Accept/Reject disabled
#   8. BL-20 단일 접속 테스트(mock-admin-access-logs.ts에서 MOCK_ADMIN_ACCESS_LOGS_SINGLE_STREAK 활성화) → 최상단 빨강 배지
```

테스트 자동 재현:
```bash
cd tudal && npm run test:ci    # 43 tests
```

---

## 📝 최근 세션 (이전은 `git log`)

- **2026-04-19 (21차)** **S5a ✅ 완료.** BL-11 Resend · BL-13 네이버+스크래핑 · BL-15 Vercel Cron 해소. Wave 1(마이그레이션+타입+mock) → Wave 2 병렬(M10·M11·M18) → Wave 3(M12) → Wave 4(Vitest 4 files 41 tests) → Wave 5(검증). **15 test files 128 tests** · build 20 routes · lint 0. Must **14/19 (74%)** 달성. 잔여 5세션(S5b 2 + S6 3).
- **2026-04-19 (20차)** **S4 ✅ 완료.** BL-8 A + BL-9 A + S3 hardening B 해소. T4.1~T4.6 · 11 test files 87 tests · architect APPROVED + ai-slop-cleaner 패스. Must **10/19 (53%)** 달성. 잔여 8세션.
- **2026-04-17 (19차)** **S3 ✅ 완료.** Ralph 5 wave · T3.0~T3.8 · 5 test files 43 tests · architect APPROVED + ai-slop-cleaner 패스. 실 Supabase 통합은 S3 hardening 마이크로 슬라이스로 이월. Must **7/19** 달성.
- **2026-04-17 (18차 후속)** S3 블로커 3건 해소 (BL-7 A · BL-19 D · BL-20 A).
- **2026-04-17 (18차)** S2 ✅ 완료. Must 6/19 달성.
- **2026-04-17 (17차 후속)** S2 블로커 4건 해소 (BL-4 B · BL-5 B · G-5 B · G-11).
- **2026-04-17 (17차)** S1 ✅ 완료. Must 4/19 달성.
- **2026-04-17 (16차)** S1 T1.1·T1.2 완료.
- **2026-04-17 (15차)** S0 Foundation 완료.

---

## 📂 문서 가이드

| 용도 | 문서 |
|---|---|
| 전체 슬라이스 상태 | `Document/Build/ProgressDashboard.md` |
| 현재 슬라이스 상세 | `Document/Build/Slices/S5-Automation.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT | `Document/Service/Planning/ServicePlan-Admin.md` v1.3 |
| 리포트 방법론 | `Document/Service/Report/ReportFramework.md` |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

**단일 진입 규칙**: HANDOFF + 현재 슬라이스 파일 읽으면 즉시 착수. 배경은 ServicePlan-Admin.md 참조.
