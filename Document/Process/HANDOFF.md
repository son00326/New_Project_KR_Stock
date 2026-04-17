# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-17 (16차 — S1 T1.1·T1.2 완료)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🟢 현재 슬라이스

**S1 Short List 30 홈** → `Document/Build/Slices/S1-ShortList30.md`
상태: 🟢 **진행 중** (T1.1·T1.2 완료 · 33% · T1.3 대기)
포함 Must: M1 홈(shell 완성) · M4 분석엔진 출력 · M5 Delta 뷰 · M6 3줄 근거 카드
잔여 예상: 2~3세션 (T1.3 디자인 하네스 + T1.4~T1.6 구현 + DoD 통합 검증)
실행 엔진: T1.3 = 디자인 하네스(`oh-my-claudecode:harness` 3~5 변형 탐색) · T1.4~T1.6 = 표준 executor 또는 병렬

### ✅ BL-3 결정 내역 (2026-04-17)

- **옵션 C 확정**: Claude가 `backtest/full_system_backtest_v6.py` 로직 관점에서 2026-04 스냅샷 30종 **정성 생성**
- **30종 구성**: 단기 상승 예상 10 + 중기 10 + 장기 10 (bucket = **상승 예상 기간**)
- **실 ticker**: KOSPI/KOSDAQ 실제 종목 (2026-04 기준 공개 정보)
- **점수**: Composite 0~100·3축(추세·모멘텀·변동성)·Crisis·NEW/HOLD/REMOVED — Claude v6 로직 참조 생성
- **참고 자산**: `backtest/full_system_backtest_v6.py` (CAGR 20.3·Sharpe 0.99), `Document/Outputs/` 리포트 11개
- **실데이터 전환**: S5 M10 스케줄러 연결 시 자연 수행하여 본 mock 대체

### 🚀 다음 세션 첫 행동 (순서)

```
1. 디자인 하네스 호출 — `oh-my-claudecode:harness` 스킬로 T1.3 종목 카드 3~5 변형 탐색
   요소: Composite 0~100 시각화·3축 게이지·Crisis 배지·괴리율·7일 스파크라인·NEW/HOLD 배지·ticker 섹터
   참고: `src/components/admin/shortlist/bucket-section.tsx` 현 placeholder 행을 교체할 자식 컴포넌트
2. 변형 평가·채택 → `src/components/admin/shortlist/shortlist-row.tsx` (또는 `stock-card.tsx`) 신설
3. `bucket-section.tsx`의 `<li>` placeholder 행을 채택된 카드로 교체 → M4 DoD 충족
4. T1.4 Delta 배너 (M5 펼침 패널·REMOVED 3종 표시) → T1.5 3줄 팝오버 (M6) → T1.6 30종 미달 원인 분리 배너
     (T1.4·T1.5·T1.6은 독립 컴포넌트라 병렬 가능)
5. 각 Task 완료 시 `npm run build` + `npm run lint` 0 통과 확인, 슬라이스 파일 체크리스트·의사결정 로그 갱신
6. S1 DoD 전원 체크 시 `feat(S1): Short List 30 홈 — M1·M4·M5·M6` 커밋
```

**참고**: T1.1·T1.2 결과물(`0002_s1_shortlist30.sql` · `mock-admin-shortlist.ts` 33행 · `admin/page.tsx` · `bucket-section.tsx`)은 이미 빌드 통과 상태. T1.3은 행 교체만 하면 되는 증분 작업.

---

## ✅ S0 Foundation 완료 (2026-04-17)

**달성**:
- Legacy 전면 제거 (`pricing`·`PLANS`·`subscription-gate`·`SubscriptionTier`·`UserProfile` · `report-limit-banner` · header/footer `/pricing` 링크)
- Supabase 연결 (`fpriyjykihxhhvqudvdb`) + `.env.local` (URL·anon·service_role·ADMIN_EMAILS 3명) + `/admin/*` allowlist 미들웨어 가드
- 8계층 AGENTS.md (deepinit) + G-1 상태 관리·G-2 에러/로딩 박제
- 11 어드민 라우트 (10 IA + `/admin/settings/health` BL-6) + admin chrome layout + 면책 Footer
- 디자인 토큰 (한국 증시 market-up/down/neutral 3종 + shadcn base-nova 유지)
- `types/admin.ts` 9엔티티 + 9 `mock-admin-*.ts` shape 확정
- `supabase/migrations/0001_rls_sketch.sql` (9 엔티티 admin-only RLS + `is_admin()` 헬퍼)
- Root layout 리팩터 (Header/Footer → `(main)/layout.tsx` — 이중 chrome 제거)
- Lint baseline 46 → 0 (executor agent), build 17 routes 통과

**의사결정 (T0.6a)**: 레퍼런스 Linear+Stripe+Bloomberg · 라이트만(v1) · 빨강=상승/파랑=하락 · Voice/Tone 3줄 · shadcn CSS 변수 override만 · Lucide 단독 · `<768px` 단일 컬럼.

---

## 📊 전체 진행 상황

→ `Document/Build/ProgressDashboard.md` (주간 뷰)

| 슬라이스 | 상태 | 예상 세션 |
|---|---|---|
| S0 Foundation | ✅ 완료 | 2 (실제 1) |
| S1 Short List 30 홈 | 🟢 진행 가능 | 4 |
| S2 풀 리포트·투심위 | ⚪ 대기 | 3 |
| S3 승인 워크플로우 | ⚪ 대기 | 4 |
| S4 성과·Decision Tree | ⚪ 대기 | 4 |
| S5 스케줄러·알림 +M18 | ⚪ 대기 | 5 |
| S6 Hardening | ⚪ 대기 | 3 |
| **잔여** | | **23세션** |

---

## 🟡 보류 / 사용자 답변 필요

- ~~**BL-3**~~ ✅ 해소 (2026-04-17, 옵션 C)
- **BL-4** Mock 원고 책임자 — S2 킥오프 전 (풀 리포트 텍스트 누가 작성?)
- **BL-5** dedupe 정책 — S2 킥오프 전
- **BL-7** 이의 제기 UX — S3 킥오프 전
- **BL-19**·**BL-20** — S3 킥오프 전 ([G-4 한국 영업일 캘린더], [G-9 1인 어드민 7일 예외 룰])
- **Q16** 법무 자문 (S3 완료 이후)
- **Q17** 이용약관·면책 (S6 이전)
- **Q-OP3·Q-OP4** 재질문 금지 (개발 완료 전)

## 🧭 보류 트랙 (Must 19 밖 로드맵)

- **Deferred-X** 증권사 API + 매뉴얼/자동매매 UI → `Document/Build/Slices/Deferred-Brokerage.md`
- **Deferred-Y** AI Agent 기반 선정엔진 v2 (2026-04-17 박제) → `Document/Build/Slices/Deferred-AIAgent-Selection.md`
  - v0 (mock, S1 지금) → v1 (pykrx+v6 실데이터, S5 M10) → **v2 (AI agent, 본 트랙)**
  - 재활성: Must 19 완료 + v1 2~3개월 운용 + AI 비용 예산 확정 + 평가 프레임워크 합의

---

## 🔎 S0 E2E 수동 재검증 (선택)

S0 커밋 전 또는 S1 킥오프 시 원한다면:
```bash
# macOS EMFILE 방지
ulimit -n 65535
cd tudal && npm run dev
# 브라우저 또는 curl:
curl -I http://localhost:3000/admin           # 기대: 307 → /login?next=/admin
curl -I http://localhost:3000/admin/portfolio # 기대: 307 → /login?next=/admin/portfolio
```
현재 세션에서는 `EMFILE: too many open files` 때문에 dev server가 404를 반환하여 E2E 보류. `npm run build`는 17 라우트를 전원 생성 확인.

---

## 📝 최근 세션 (이전은 `git log`)

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
| 현재 슬라이스 상세 | `Document/Build/Slices/S1-ShortList30.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT | `Document/Service/Planning/ServicePlan-Admin.md` v1.1 |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

**단일 진입 규칙**: HANDOFF + 현재 슬라이스 파일 읽으면 즉시 착수. 배경은 ServicePlan-Admin.md 참조.
