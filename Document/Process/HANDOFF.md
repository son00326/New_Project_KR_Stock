# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-17 (18차 — S2 ✅ 완료)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🟢 현재 슬라이스

**S3 승인 워크플로우 (+D15 게이팅)** → `Document/Build/Slices/S3-Approval.md`
상태: 🟢 **진행 가능** (블로커 3건 전부 해소 — 질문 없음, 바로 착수)
포함 Must: M7 승인 워크플로우 + D15 게이팅 3종 (R3.3-7 24h Hold · R3.3-8 2인 열람 · R3.3-10 이의 48h) + BL-20 자동 바이패스
라우트: `/admin/portfolio`
잔여 예상: 4세션 (최대 슬라이스. 실행 엔진 ralph 권장)
실행 엔진: **`ralph`** (Task 8개 · M7 단일이지만 게이팅 4종 + race condition + 이의 UX + 자동 바이패스 → prd.json stories 분해)

### ✅ S3 블로커 3건 해소 내역 (2026-04-17)

- **BL-7 = A** (자유 텍스트 min 20자) — 이의 제기 사유 입력. 3인 소통 체제·분류 통계 무가치. `E4.dispute_reason` 컬럼 추가.
- **BL-19 = D** (pykrx seed → Supabase 캐시) — `kr_business_days` 테이블(E11 신규). 1회성 Python 스크립트(`scripts/seed_kr_holidays.py`)로 2024~2030 생성 → 0004 마이그레이션 INSERT 블록. S5 M10 이후 월간 배치 자동 갱신.
- **BL-20 = A** (자동 바이패스 + AlertEvent 로그) — 7일 연속 단일 접속 감지 시 D15 2인 게이팅 자동 완화. `AlertEvent(type=gating_auto_relief)` 로그로 사후 감사 보장. B 옵션은 "휴가 중인 사람이 버튼 눌러야 함" 논리적 모순 회피.

### ⏸ 킥오프 시 경량 결정 (G-10)

**테스트 전략** — build+lint만으로 S3 race condition·시간 기반 게이팅·영업일 계산 검증 불가. Claude 제안: **현행 유지(build+lint) 기본 + race condition만 필요 시 Vitest 1파일 추가**. 사용자 판단 재확인 후 진행.

### 🚀 다음 세션 첫 행동 (순서)

```
1. G-10 테스트 전략 경량 확인 (사용자 1문 질의) — 현행 유지 vs Vitest 1파일
2. T3.1a scripts/seed_kr_holidays.py 작성 + local Python 실행 (pykrx 필요) → SQL INSERT 블록 수집
3. T3.1 Supabase 마이그레이션 0004 작성 — E4 PortfolioApproval (UNIQUE(month) WHERE is_final=true + dispute_reason 포함) + E11 kr_business_days (2024~2030 seed INSERT 블록) + RLS
4. T3.2~T3.8 ralph 실행 (stories 8건 분해):
   - T3.2 /admin/portfolio shell + Accept/Reject 버튼 + 확인 모달
   - T3.3 선착순 단일 확정 + 409 race-condition 처리
   - T3.4 Reject → 재분석 큐 stub
   - T3.5 D+5 영업일 카운터 (kr_business_days SELECT)
   - T3.6 D15 게이팅 3종 (24h Hold · 2인 열람 COUNT(DISTINCT admin_id) · 연휴 우회)
   - T3.7 이의 제기 (자유 텍스트 min 20자 + 48h Hold)
   - T3.8 BL-20 자동 바이패스 (7일 연속 감지 + gating_auto_relief AlertEvent + 비상 완화 배지)
5. 각 Task 완료 시 npm run build + lint 0, 슬라이스 파일 갱신
6. S3 DoD 전원 체크 시 feat(S3): 승인 워크플로우 — M7 + D15 게이팅 3종 + BL-20 자동 바이패스 커밋
```

**참고**: T3.1a는 local Python 환경(pykrx 설치) 필요. 실행 불가 시 대체: Claude가 KRX 공식 2026·2027 휴일 표를 보고 SQL INSERT 블록 수기 작성 → S5 M10 Python 배치 연결 시 2024·2025·2028~ 자동 확장.

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
- ~~**BL-7**~~ ✅ 해소 (2026-04-17, 옵션 A — 자유 텍스트 min 20자)
- ~~**BL-19**~~ ✅ 해소 (2026-04-17, 옵션 D — pykrx seed + Supabase 캐시)
- ~~**BL-20**~~ ✅ 해소 (2026-04-17, 옵션 A — 자동 바이패스 + AlertEvent 로그)
- **[G-10]** 테스트 전략 — S3 킥오프 시 경량 결정 (현행 유지 기본, Vitest 1파일 선택 옵션)
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

- **2026-04-17 (18차 후속)** **S3 블로커 3건 해소.** BL-7=A (자유 텍스트 min 20자) · BL-19=D (pykrx seed → Supabase `kr_business_days` 캐시 → Next.js SELECT) · BL-20=A (자동 바이패스 + AlertEvent gating_auto_relief). 파생: E11 KrBusinessDays 엔티티 + AlertEvent 타입 추가, Tasks T3.1a·T3.8 신설, 2인 게이팅 로직을 report_view_log DISTINCT 집계로 수정. G-10(테스트 전략)만 킥오프 시 경량 결정으로 이월.
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
