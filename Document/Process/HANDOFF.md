# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-17 (18차 — S2 ✅ 완료)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🟢 현재 슬라이스

**S3 승인 워크플로우 (+D15 게이팅)** → `Document/Build/Slices/S3-Approval.md`
상태: 🟢 **진행 가능** (S1·S2 완료로 언블록. BL-7·BL-19·BL-20 3건 킥오프 시 결정)
포함 Must: M7 승인 워크플로우 + D15 게이팅 3종 (R3.3-7 24h Hold · R3.3-8 2인 열람 · R3.3-10 이의 48h)
라우트: `/admin/portfolio`
잔여 예상: 4세션 (최대 슬라이스. 실행 엔진 ralph 권장)
실행 엔진: **`ralph`** (Task 7개 · M7 단일이지만 게이팅 4종 + race condition + 이의 UX → prd.json stories 분해)

### 🔴 S3 킥오프 전 필수 결정 (사용자 답변 필요)

1. **BL-7 (Medium)**: 이의 제기 해결 액션 UX — 자유 텍스트 입력 vs 드롭다운 사유 선택
2. **BL-19 (Major)**: 한국 영업일 캘린더 데이터 소스 — (a) pykrx 역산(BL-15 배치 환경 의존), (b) KRX 공식 휴일 하드코딩(연 1회 갱신), (c) 외부 캘린더 API
3. **BL-20 (Major)**: R8 "1인 어드민 7일 연속" 2인 게이팅 예외 룰 — (a) 자동 바이패스(7일 연속 단일 접속 감지 시 1인 Accept 허용), (b) 수동 오버라이드(관리자 설정에서 temp-disable), (c) 예외 없음(휴가 시 대리인 지정 강제)

### ⚙️ S3 킥오프 시 자동 병합 작업 (코드 정합성)

S3 슬라이스 파일 Tasks·DoD에 아직 `report_view_count` 용어가 남아있음 (G-5 B 결정 이전 작성). 킥오프 시 아래 3곳 용어 치환 필요:

- **T3.1**: `report_view_count` 컬럼 포함 → **삭제**. E4 스키마는 §4.2 최신 정의 참조.
- **T3.6 R3.3-8**: "`report_view_count` 참조" → "`SELECT COUNT(DISTINCT admin_id) FROM report_view_log WHERE report_id = ?`".
- **DoD 2인 열람 게이팅**: 동일 치환.

### 🚀 다음 세션 첫 행동 (순서)

```
1. 사용자에게 BL-7·BL-19·BL-20 3건 결정 요청 (선택지 요약 제공)
2. 결정 박제 → S3 슬라이스 파일 "의사결정 로그" + ProgressDashboard §5 Global Blocker 갱신
3. S3 슬라이스 파일 용어 정합성 병합 (위 "자동 병합 작업" 3곳)
4. T3.1 E4 PortfolioApproval 마이그레이션 0004 — UNIQUE(month) WHERE is_final=true + dispute_raised_at/resolved_at
   (report_view_count 컬럼은 없음 — G-5 B에 따라 E10 report_view_log는 이미 0003에 존재)
5. T3.2~T3.7 ralph 실행 (stories 분해: Accept 선착순·24h Hold·2인 게이팅·연휴 우회·이의 48h·재분석 큐·D+5 카운터)
6. 각 Task 완료 시 npm run build + lint 0, 슬라이스 파일 갱신
7. S3 DoD 전원 체크 시 feat(S3): 승인 워크플로우 — M7 + D15 게이팅 3종 커밋
```

**참고**: S2 완료 후 S3가 언블록된 핵심 사유 — D15 R3.3-8 2인 열람 게이팅이 `report_view_log` 소스에 의존. 본 테이블은 S2에서 이미 스키마+mock seed 완료. S3에서는 Server Action에서 DISTINCT 집계 쿼리만 추가.

---

## ✅ 완료 슬라이스

### S2 풀 리포트 + 투심위 ✅ (2026-04-17, 18차 · 실제 1세션)

**달성 Must**: M2·M3 (2건 · 누적 6/19 = 32%)
**주요 산출**:
- `supabase/migrations/0003_s2_reports.sql` — E2 stock_reports + E3 committee_votes + E10 report_view_log + RLS + 인덱스
- `src/lib/data/` 4개 파일:
  - `mock-admin-committee-personas.ts` (Core 11 + Sector 22섹터 × 5인 lean 로스터)
  - `mock-admin-report.ts` (30 리포트 · 대표 5종[005930·000660·012450·196170·373220] Section 0~8 상세 + 25종 템플릿)
  - `mock-admin-committee.ts` (630 votes · composite score deterministic 분포)
  - `mock-admin-report-view-log.ts` (2인·1인 열람 시드 + DISTINCT 집계 유틸)
- `src/app/(admin)/admin/report/[ticker]/page.tsx` — Sticky Side Nav + 10 섹션 accordion + Section 8 투심위 패널 + prev/next
- `src/app/(admin)/admin/report/[ticker]/record-view.ts` — server-only mock INSERT 파이프 (Supabase upsert onConflict do nothing 코드 TODO 준비)
- `src/types/admin.ts` — E4에서 `reportViewCount` 제거 + `ReportViewLog` 인터페이스 신설
- `Document/Service/Planning/ServicePlan-Admin.md` — §4.2 E4 `report_view_count` 필드 제거 + E10 신설 섹션 + §4.3 관계 다이어그램 + §3.3 R3.3-8 로직 업데이트

**의사결정 (T2.1~T2.7)**:
- Section 구조는 §4.2 E2 SoT(v1) 그대로 유지. ReportFramework.md v2.0 재정렬은 별도 슬라이스로 이월
- Section 8 디폴트 펼침 (M3 결론 강조)
- Recharts 미도입 → 정적 CSS·SVG로 충분 (인터랙티브 요구 시 S4에서 통합 검토)
- Sector Board MVP = 섹터당 5인 (기획 10인 대비 축소 · 실 엔진 연결 시 확장)
- record-view mock dedupe = process-local Set (실 Supabase는 UNIQUE 제약)

**검증**: `npm run lint` 0 · `npm run build` 17 routes 통과.

### S1 Short List 30 홈 ✅ (2026-04-17, 16~17차 · 실제 2세션)

**달성 Must**: M1·M4·M5·M6 (4건). 상세는 slice 파일.

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
| **S3 승인 워크플로우** | 🟢 **진행 가능** | 4 | — |
| S4 성과·Decision Tree | ⚪ 대기 | 4 | — |
| S5 스케줄러·알림 +M18 | ⚪ 대기 | 5 | — |
| S6 Hardening | ⚪ 대기 | 3 | — |
| **잔여** | | **16세션** | |

Must 19 진행률: **6 / 19 (32%)** — M1·M2·M3·M4·M5·M6 달성.

실제 속도 = **예상의 50%** (S0~S2에서 예상 9세션 → 실제 4세션). 잔여 16세션도 같은 속도 가정 시 **8~10세션에 MVP 완성 가능**.

---

## 🟡 보류 / 사용자 답변 필요

- ~~**BL-3**~~ ✅ 해소 (2026-04-17, 옵션 C)
- ~~**BL-4**~~ ✅ 해소 (2026-04-17, 옵션 B — codegen 인라인)
- ~~**BL-5**~~ ✅ 해소 (2026-04-17, 옵션 B — 1일 1회 dedupe)
- ~~**[G-5]**~~ ✅ 해소 (2026-04-17, 옵션 B — E10 ReportViewLog 분리)
- ~~**[G-11]**~~ ✅ 해소 (2026-04-17, G-5 B 자동 해소)
- **BL-7** 이의 제기 UX — **S3 킥오프 전 (우선)**
- **BL-19** 한국 영업일 캘린더 — **S3 킥오프 전 (우선)**
- **BL-20** 1인 어드민 7일 예외 룰 — **S3 킥오프 전 (우선)**
- **BL-11**·**BL-13**·**BL-15** — S5 진입 전
- **BL-18** — S6 진입 전
- **Q16** 법무 자문 (S3 완료 이후)
- **Q17** 이용약관·면책 (S6 이전)
- **Q-OP3·Q-OP4** 재질문 금지 (개발 완료 전)

## 🧭 보류 트랙 (Must 19 밖 로드맵)

- **Deferred-X** 증권사 API + 매뉴얼/자동매매 UI → `Document/Build/Slices/Deferred-Brokerage.md`
- **Deferred-Y** AI Agent 기반 선정엔진 v2 → `Document/Build/Slices/Deferred-AIAgent-Selection.md`
  - v0 (mock, S1·S2 완료) → v1 (pykrx+v6 실데이터, S5 M10) → **v2 (AI agent, 본 트랙)**

---

## 🔎 S2 E2E 수동 재검증 (선택)

S3 킥오프 전 브라우저 육안 확인 원할 시:
```bash
ulimit -n 65535
cd tudal && npm run dev
# 브라우저에서 http://localhost:3000/admin 로그인 후
# /admin → 종목 클릭 → /admin/report/[ticker]
# 확인 포인트:
#   1. 좌측 Sticky Side Nav 10개 섹션 + "← Short List 30" 복귀 링크 + "N/2명 열람 완료" 카운터
#   2. 헤더: 티커·종목명·섹터·bucket·rank·Composite·Conviction·Delta pill
#   3. Section 0 디폴트 펼침 — thesis 3줄 + Conviction 게이지 + Core/Sector MiniBar + 시나리오 가격대
#   4. Section 6 — 추세/모멘텀/변동성 3축 바 + 5-Signal LED 그리드 + m60 괴리율
#   5. Section 8 디폴트 펼침 — Core 11 집계 + Sector 5인 집계 + 핵심 논거 인용 + 위원별 디스클로저
#   6. 하단 prev/next 버킷 내 내비 (rank 정렬 기준)
#   7. 대표 5종(005930·000660·012450·196170·373220)은 Section 1~7 상세 / 나머지 25종은 템플릿
#   8. 서버 로그에 [report.view] 메시지 (mock console.log)
```

---

## 📝 최근 세션 (이전은 `git log`)

- **2026-04-17 (18차)** **S2 ✅ 완료.** T2.1 0003 마이그레이션(E2·E3·E10+RLS+인덱스) + 4 mock 파일(personas·report·committee·view-log · 30 리포트 + 630 votes) · T2.2 Sticky Side Nav + hash anchor · T2.3 10 섹션 `<details>` accordion · T2.4 record-view server-only 파이프 · T2.5 prev/next 버킷 내비 · T2.6 Core+Sector 집계+핵심 인용+위원별 디스클로저 · T2.7 3축+5-Signal 정적. ServicePlan-Admin SoT 갱신(E4·E10·§4.3·§3.3 R3.3-8). Must **6/19 달성**. lint 0·build 17 routes.
- **2026-04-17 (17차 후속)** **S2 블로커 4건 해소.** BL-4=B (codegen 인라인) · BL-5=B (1일 1회 dedupe UNIQUE) · G-5=B (E10 분리) · G-11=자동 해소.
- **2026-04-17 (17차)** **S1 ✅ 완료.** T1.3~T1.6 완료. Must 4/19 달성.
- **2026-04-17 (16차)** **S1 T1.1·T1.2 완료.** E1 마이그레이션 + 33행 mock + 3섹션 셸 + BucketSection.
- **2026-04-17 (15차)** **S0 Foundation 완료.**

---

## 📂 문서 가이드

| 용도 | 문서 |
|---|---|
| 전체 슬라이스 상태 | `Document/Build/ProgressDashboard.md` |
| 현재 슬라이스 상세 | `Document/Build/Slices/S3-Approval.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT | `Document/Service/Planning/ServicePlan-Admin.md` v1.2 (E4·E10 반영) |
| 리포트 방법론 | `Document/Service/Report/ReportFramework.md` |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

**단일 진입 규칙**: HANDOFF + 현재 슬라이스 파일 읽으면 즉시 착수. 배경은 ServicePlan-Admin.md 참조.
