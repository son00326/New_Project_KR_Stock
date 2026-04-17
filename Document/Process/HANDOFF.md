# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-17 (17차 — S1 ✅ 완료)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🟢 현재 슬라이스

**S2 풀 리포트 + 투심위** → `Document/Build/Slices/S2-FullReport.md`
상태: 🟢 **진행 가능** (S1 완료로 언블록. BL-4·BL-5·[G-5]·[G-11] 킥오프 시 결정)
포함 Must: M2 풀 리포트 렌더링 · M3 투심위 투표 요약 패널
라우트: `/admin/report/[ticker]`
잔여 예상: 3세션
실행 엔진: 직접 + `superpowers:verification-before-completion` (Task 수 7개이지만 T2.1·T2.3·T2.6은 분량 무거우므로 착수 시 ralph 승격 검토)

### 🔴 S2 킥오프 전 필수 결정 (사용자 답변 필요)

1. **BL-4** Section 0~8 mock 원고 작성 책임자 — writer 에이전트(품질↑ 세션↑) vs AI codegen 인라인(세션↓ 품질중) 중 선택
2. **BL-5** `report.view` dedupe 정책 — 동일 어드민 같은 날 재진입 시 +1 할지. 기본: "진입마다 +1"로 단순화 가능 (P7 이관 가능)
3. **[G-5]** `report_view_count` int 필드 구조 — 1인 2회 열람이 D15 2인 게이팅 통과하는 버그 방지. 옵션: (a) jsonb 배열 `report_viewers`, (b) 별도 `report_view_log` 테이블 + distinct 집계, (c) E4에 `distinct_viewer_count` 컬럼
4. **[G-11]** E4 Row 부재 문제 — S2는 +1 write하는데 E4 Row는 S3에서 최초 생성. 옵션: (a) S2에서 E4 선생성, (b) `report_view_log`로 분리 후 S3에서 집계(**권장**), (c) S1/S5 시점에 초기화

### 🚀 다음 세션 첫 행동 (순서)

```
1. 사용자에게 BL-4·BL-5·[G-5]·[G-11] 4건 결정 요청 (선택지 요약 제공)
2. 결정 박제 → S2 슬라이스 파일 "의사결정 로그" + ProgressDashboard §5 Global Blocker 갱신
3. T2.1 E2 StockReport + E3 CommitteeVote 스키마 + mock fixture 작성 (writer 또는 codegen은 BL-4 결정 후)
4. T2.2~T2.7 순차 또는 ralph 승격 실행 (Section 0~8 accordion, Sticky Side Nav, report.view 파이프)
5. 각 Task 완료 시 `npm run build` + `npm run lint` 0 통과 확인, 슬라이스 파일 체크리스트·의사결정 로그 갱신
6. S2 DoD 전원 체크 시 `feat(S2): 풀 리포트 렌더링 + 투심위 패널 — M2·M3 + report.view 파이프` 커밋
```

**참고**: S1 완료 후 `shortlist-row.tsx`의 "풀 리포트" 링크는 `/admin/report/[ticker]`로 연결되어 있으나 S2 완료 전까지는 기존 placeholder 페이지가 응답. S2 완료 시 실제 렌더 활성.

---

## ✅ 완료 슬라이스

### S1 Short List 30 홈 ✅ (2026-04-17, 16~17차 · 실제 2세션)

**달성 Must**: M1·M4·M5·M6 (4/19)
**주요 산출**:
- `supabase/migrations/0002_s1_shortlist30.sql` (admin_emails + is_admin() + E1 + RLS + 2 indexes)
- `src/lib/data/mock-admin-shortlist.ts` (33행 = 30 active + 3 REMOVED, 2026-04 v6 로직 관점 정성 생성)
- `src/app/(admin)/admin/page.tsx` (3섹션 세로 스택 + Delta 배너 + 미달 배너)
- `src/components/admin/shortlist/`:
  - `bucket-section.tsx` (섹션 shell)
  - `shortlist-row.tsx` (T1.3·T1.5 통합 — Composite·3축·Crisis·괴리율·스파크라인·NEW/HOLD + `<details>` 3줄 근거 팝오버)
  - `delta-banner.tsx` (T1.4 — 편입·유지·제외 집계 + 펼침 NEW/REMOVED 리스트)
  - `missing-count-banner.tsx` (T1.6 — 스크리닝 미달 vs 스케줄러 실패)
- `src/types/admin.ts`: `ShortListItem`에 name·sector·divergencePct·sparkline7d 추가 + `CRISIS_VOL_THRESHOLD(60)`·`SHORTLIST_TARGET_COUNT(30)`·`ShortageReason` enum

**의사결정 (T1.3~T1.6)**:
- 팝오버 = `<details>` 내장 (shadcn popover 미설치·no-JS·a11y 트리플 만족)
- hover는 배경색 힌트만, 표시는 click 통일 (touch device + a11y)
- 괴리율·스파크라인은 trend/momentum/volatility에서 결정적 유도 (S5 M10 실데이터 연결 시 자연 대체)
- Crisis 배지 기준: `volatilityScore < 60` (현 fixture 4종: 196170·247540·278280·278470)
- MissingCountBanner: mock 30종 충족 → 렌더 안 됨 (조건부)

**검증**: `npm run lint` 0 · `npm run build` 17 routes 통과.

### S0 Foundation ✅ (2026-04-17, 15차)

Legacy 전면 제거 · Supabase 연결 · 8 AGENTS.md · 11 admin 라우트 · 9엔티티 RLS sketch · 한국 증시 디자인 토큰. 상세는 slice 파일.

---

## 📊 전체 진행 상황

→ `Document/Build/ProgressDashboard.md` (주간 뷰)

| 슬라이스 | 상태 | 예상 세션 |
|---|---|---|
| S0 Foundation | ✅ 완료 | 2 (실제 1) |
| **S1 Short List 30 홈** | ✅ **완료** | 4 (실제 2) |
| **S2 풀 리포트·투심위** | 🟢 **진행 가능** | 3 |
| S3 승인 워크플로우 | ⚪ 대기 | 4 |
| S4 성과·Decision Tree | ⚪ 대기 | 4 |
| S5 스케줄러·알림 +M18 | ⚪ 대기 | 5 |
| S6 Hardening | ⚪ 대기 | 3 |
| **잔여** | | **19세션** |

Must 19 진행률: **4 / 19 (21%)** — M1·M4·M5·M6 달성.

---

## 🟡 보류 / 사용자 답변 필요

- ~~**BL-3**~~ ✅ 해소 (2026-04-17, 옵션 C)
- **BL-4** Mock 원고 책임자 — **S2 킥오프 전 (우선)**
- **BL-5** dedupe 정책 — **S2 킥오프 전 (우선)**
- **[G-5]** report_view_count 필드 구조 — **S2 킥오프 전 (우선)**
- **[G-11]** E4 Row 부재 문제 — **S2 킥오프 전 (우선)**
- **BL-7** 이의 제기 UX — S3 킥오프 전
- **BL-19**·**BL-20** — S3 킥오프 전 ([G-4 한국 영업일 캘린더], [G-9 1인 어드민 7일 예외 룰])
- **BL-11**·**BL-13**·**BL-15** — S5 진입 전
- **BL-18** — S6 진입 전
- **Q16** 법무 자문 (S3 완료 이후)
- **Q17** 이용약관·면책 (S6 이전)
- **Q-OP3·Q-OP4** 재질문 금지 (개발 완료 전)

## 🧭 보류 트랙 (Must 19 밖 로드맵)

- **Deferred-X** 증권사 API + 매뉴얼/자동매매 UI → `Document/Build/Slices/Deferred-Brokerage.md`
- **Deferred-Y** AI Agent 기반 선정엔진 v2 (2026-04-17 박제) → `Document/Build/Slices/Deferred-AIAgent-Selection.md`
  - v0 (mock, S1 완료) → v1 (pykrx+v6 실데이터, S5 M10) → **v2 (AI agent, 본 트랙)**
  - 재활성: Must 19 완료 + v1 2~3개월 운용 + AI 비용 예산 확정 + 평가 프레임워크 합의

---

## 🔎 S1 E2E 수동 재검증 (선택)

S2 킥오프 전 브라우저 육안 확인 원할 시:
```bash
ulimit -n 65535
cd tudal && npm run dev
# 브라우저에서 http://localhost:3000/admin 접속 (로그인 후)
# 확인 포인트:
#   1. 상단 Delta 배너 — 편입 5·유지 25·제외 3 집계 + 펼침 시 NEW/REMOVED 리스트
#   2. 단기→중기→장기 순 3섹션, 각 10종
#   3. 종목 row 클릭 시 <details> 펼침 → 3줄 근거 + 풀 리포트 링크
#   4. Crisis 배지: 196170·247540·278280·278470 4종
#   5. 괴리율 색상: 빨강(양수)·파랑(음수)
#   6. MissingCountBanner: 30종 충족 상태에서는 렌더 안 됨
```
현 세션에서는 빌드·린트 통과만 확인. 육안 확인은 사용자 재량.

---

## 📝 최근 세션 (이전은 `git log`)

- **2026-04-17 (17차)** **S1 ✅ 완료.** T1.3 종목 카드(`shortlist-row.tsx`, Composite·3축·Crisis·괴리율·7d 스파크라인·NEW/HOLD·`<details>` 3줄 근거 팝오버 내장) + T1.4 Delta 배너(편입/유지/제외 집계+펼침 NEW·REMOVED 리스트) + T1.5 3줄 근거(row 내장 통합) + T1.6 미달 경고 배너(스크리닝 미달 vs 스케줄러 실패 원인 분리). 타입 4필드(name·sector·divergencePct·sparkline7d) + 상수 3종(CRISIS_VOL_THRESHOLD·SHORTLIST_TARGET_COUNT·ShortageReason) 추가. Must **4/19 달성**. lint 0 · build 17 routes.
- **2026-04-17 (16차)** **S1 T1.1·T1.2 완료.** E1 short_list_30 마이그레이션(`0002_s1_shortlist30.sql`: admin_emails + is_admin() + 테이블 + RLS + 2 indexes) · 33행 mock fixture(30 + REMOVED 3) · `/admin` 3섹션 세로 스택(short→mid→long, Delta 집계 pill, 30종 미달 경고 placeholder) · `BucketSection` 컴포넌트 분리. **Deferred-Y 박제**: AI Agent 기반 선정엔진 v2 트랙을 Must 19 밖 로드맵으로 신설. lint 0·build 17 routes.
- **2026-04-17 (15차)** **S0 Foundation 완료.** BL-1 해소 (Supabase env) → T0.1~T0.8 순차 + Phase ③ 병렬. 8 AGENTS.md · 11 admin 라우트 · 9엔티티 RLS sketch · mock-admin 구조 · 한국 증시 토큰. Lint 46→0 (executor). Root layout 리팩터. Build 17 routes.
- **2026-04-16 (14차)** Waterfall→Slice 전환 — Phase/BuildPhase 폐기→Archive 이관, ExecutionPlaybook·ProgressDashboard·Slice 7종 신설, CLAUDE.md Entry routine 재작성, HANDOFF 경량화. architect Must 19 감사 + critic 정합성 감사. 재활용 방식 (B) 확정.
- **2026-04-15 (13차 후속2)** Q-OP1·Q-OP2 해소 → v1.1 — D14 Must 16→19, D15 승인 Holding 24h
- **2026-04-15 (13차)** P5 검증 3병렬 → v1.0 — D10~D13 확정.

---

## 📂 문서 가이드

| 용도 | 문서 |
|---|---|
| 전체 슬라이스 상태 | `Document/Build/ProgressDashboard.md` |
| 현재 슬라이스 상세 | `Document/Build/Slices/S2-FullReport.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT | `Document/Service/Planning/ServicePlan-Admin.md` v1.1 |
| 리포트 방법론 | `Document/Service/Report/ReportFramework.md` |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

**단일 진입 규칙**: HANDOFF + 현재 슬라이스 파일 읽으면 즉시 착수. 배경은 ServicePlan-Admin.md 참조.
