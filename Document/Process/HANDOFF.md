# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-17 (15차 — S0 Foundation 완료)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🟢 현재 슬라이스

**S1 Short List 30 홈** → `Document/Build/Slices/S1-ShortList30.md`
상태: 🟢 진행 가능 (BL-3 mock fixture 분포 확정 필요)
포함 Must: M1 홈 · M4 분석엔진 출력 · M5 Delta 뷰 · M6 3줄 근거 카드
예상: 4세션
실행 엔진: `ralph` (4 Must → prd.json stories)

### 🔴 S1 착수 전 필수
1. **BL-3**: Mock fixture 분포 확정 (어떤 분기 기준 데이터? 실 ticker 30개 샘플 합의) — ⏳ 사용자 결정 대기
2. S1 킥오프 시 **디자인 하네스 평가** (`ExecutionPlaybook.md` §2.5): S0 deepinit + 표준 executor로 UI 품질 충분한가? 불충분 시 harness 구축.

### 🚀 S1 착수 시 첫 행동
```
S1-ShortList30.md Tasks 확인 + BL-3 해소 → 디자인 하네스 평가 → ralph prd.json 작성
  Story 1: 홈 레이아웃 + Short List 30 카드 그리드 (M1)
  Story 2: 5-Signal Composite 스파크라인 + 3축 점수 뱃지 (M4)
  Story 3: new/hold/removed Delta 뷰 (M5)
  Story 4: 3줄 근거 팝오버 카드 (M6)
  Story 5: mock 데이터 fixture 30종 (BL-3 해소 후)
```

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

- **BL-3** Mock fixture 분포 — S1 킥오프 전 필수 (종목 30개 샘플 + 분포 기준)
- **BL-4** Mock 원고 책임자 — S2 킥오프 전 (풀 리포트 텍스트 누가 작성?)
- **BL-5** dedupe 정책 — S2 킥오프 전
- **BL-7** 이의 제기 UX — S3 킥오프 전
- **BL-19**·**BL-20** — S3 킥오프 전 ([G-4 한국 영업일 캘린더], [G-9 1인 어드민 7일 예외 룰])
- **Q16** 법무 자문 (S3 완료 이후)
- **Q17** 이용약관·면책 (S6 이전)
- **Q-OP3·Q-OP4** 재질문 금지 (개발 완료 전)

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
