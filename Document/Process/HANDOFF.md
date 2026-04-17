# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-17 (19차 — S3 ✅ 완료)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🟢 현재 슬라이스

**S4 가상 포트·성과 측정 + Decision Tree** → `Document/Build/Slices/S4-Performance.md`
상태: 🟢 **진행 가능** (S3 완료, M7 Accept 파이프 구비)
포함 Must: M8 가상 포트폴리오 트래킹 엔진 + M9 리포트 재생성 cap 가드 + M16 Decision Tree 진척도 대시보드
라우트: `/admin/track-record` · `/admin/decision-tree` · `/admin/report/[ticker]/regenerate`
잔여 예상: 4세션 (실제는 S1·S2·S3 추세로 1~2세션 예상)
실행 엔진: **`ralph`** (Task 수 중간, Must 3건 병렬 가능)

### ⏸ 킥오프 시 결정 필요

- **BL-8** 판정기준 (성과 측정 KPI): Sharpe·MDD·alpha vs KOSPI 중 우선순위
- **BL-9** 재생성 UI 위치·권한 (모달 vs 별도 라우트, 재생성 버튼 노출 기준)
- **M17 hardcap stub**: S4에서 `cost_log` 테이블 pre-wire(R5 완화). 실 비용 수집은 S6.

### 🚀 다음 세션 첫 행동 (순서)

```
1. BL-8·BL-9 해소 1문 질의 (Sharpe 단일? 복합 게이지? 재생성 UI 위치?)
2. T4.1 마이그레이션 0005 — E5 PortfolioSnapshot (일별 행) + E8 RegenCounter (ticker+month UNIQUE, auto≤1 manual≤2) + 선택적 cost_log stub
3. T4.2~T4.n ralph 디스패치 (예상 5~6 스토리):
   - /admin/track-record 누적 수익률·KOSPI 대비 alpha·Sharpe·MDD
   - /admin/decision-tree 게이지 3종 (CAP Months·NSM 진척도)
   - /admin/report/[ticker]/regenerate 버튼 + cap 가드 (M9)
   - S3 acceptShortList에서 E5 snapshot INSERT hook 추가 (stub → 실 mock mutation)
4. 각 Task 완료 시 build + lint + test:ci · 슬라이스 파일 갱신
5. S4 DoD 전원 체크 시 feat(S4): 가상 포트·성과·Decision Tree 커밋
```

**참고**: S3에서 architect가 발견한 **비블로킹 권고 1건(S3 hardening 이월)** — `actions.ts` 실 Supabase catch + adminId 세션 주입 + dispute_reason btrim 통합 — S4 착수 전 또는 동시에 "S3.5 hardening 마이크로 슬라이스"로 처리 검토.

---

## ✅ 완료 슬라이스

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
| **S4 성과·Decision Tree** | 🟢 **진행 가능** | 4 | — |
| S5 스케줄러·알림 +M18 | ⚪ 대기 | 5 | — |
| S6 Hardening | ⚪ 대기 | 3 | — |
| **잔여** | | **12세션** | |

Must 19 진행률: **7 / 19 (37%)** — M1·M2·M3·M4·M5·M6·M7 달성.

실제 속도 = **예상의 ~35%** (S0~S3에서 예상 13세션 → 실제 5세션). 잔여 12세션도 같은 속도 가정 시 **4~5세션에 MVP 완성 가능**.

---

## 🟡 보류 / 사용자 답변 필요

- ~~**BL-3·BL-4·BL-5**~~ ✅ 해소
- ~~**[G-5]·[G-11]**~~ ✅ 해소
- ~~**BL-7·BL-19·BL-20**~~ ✅ 해소 (S3)
- ~~**[G-10]**~~ ✅ 해소 (S3, Vitest 1파일)
- **[S3 hardening]** — 실 Supabase actions.ts + adminId 세션 + dispute_reason btrim (architect 권고 3건). S4 착수 전 마이크로 슬라이스로 처리 검토.
- **BL-8·BL-9** — S4 킥오프
- **BL-11·BL-13·BL-15** — S5 진입 전
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
| 현재 슬라이스 상세 | `Document/Build/Slices/S4-Performance.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT | `Document/Service/Planning/ServicePlan-Admin.md` v1.3 |
| 리포트 방법론 | `Document/Service/Report/ReportFramework.md` |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

**단일 진입 규칙**: HANDOFF + 현재 슬라이스 파일 읽으면 즉시 착수. 배경은 ServicePlan-Admin.md 참조.
