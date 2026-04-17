# S3 승인 워크플로우 (+D15 게이팅)

> originally architect ID: S2 (`.omc/research/must-19-slice-mapping.md` §5 S2 블록)

---

```
slice_id: S3
slice_name: 승인 워크플로우 (+D15 게이팅)
architect_id: S2
status: ✅ 완료 (2026-04-17 19차 — 1세션, 예상 4세션 대비 25%)
expected_sessions: 4
current_progress: 100%
```

---

## 목표 (Why)

어드민 3인이 매월 Short List 30을 Accept/Reject하는 워크플로우를 구현한다. D15 결정(Holding Period 24h + 2인 열람 게이팅 + 이의 48h Hold)이 포함되어 가장 복잡한 단일 Must. race condition(E4 UNIQUE 제약) 처리가 핵심 기술 과제.

---

## 포함 요구사항

- **Must**: M7 (승인 워크플로우 + D15 24h Hold + 2인 열람 게이팅 + 이의 48h)
- **엔티티**:
  - E4 PortfolioApproval (RW) — **v1.2 `report_view_count` 제거됨**, S2에서 이미 반영
  - E10 ReportViewLog (R) — S2에서 이미 스키마 + mock seed 완료. 본 슬라이스에서 `SELECT COUNT(DISTINCT admin_id)` 집계 추가
  - **신규 E11 KrBusinessDays (R)** — 한국 영업일 캘린더 (BL-19 옵션 D). pykrx seed → Supabase 캐시 → UI SELECT
  - E5 PortfolioSnapshot (W 트리거 stub — 실 계산은 S4)
  - **신규 AlertEvent type `gating_auto_relief`** (BL-20 옵션 A) — 7일 연속 단일 접속 감지 시 자동 바이패스 로그
- **라우트**: `/admin/portfolio`
- **근거**: ServicePlan-Admin.md §3.3 R3.3-1~10

---

## 선행 조건

- **S1 완료** ✅ (2026-04-17): 홈 Short List 존재 전제
- **S2 완료** ✅ (2026-04-17): M2 `report_view_log` 파이프 선행 완료. 2인 열람 게이팅(D15 R3.3-8)은 S2에서 이미 스키마·mock seed 완료된 `report_view_log`를 `COUNT(DISTINCT admin_id)`로 집계.

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| 텔레그램 Bot API | D+5 경고 알림 | S3에서는 stub 허용. 실구현은 S5 |
| E5 PortfolioSnapshot | Accept 시 트리거 | W stub만 (실 계산은 S4) |

---

## Tasks (체크리스트)

- [x] **T3.0** ✅ Vitest 셋업 (G-10 옵션 b 반영) — `vitest@4.1.4` + `vitest.config.ts`(node·passWithNoTests·native tsconfigPaths) + `package.json` scripts(`test`·`test:ci`) + `src/lib/portfolio/__tests__/` 스켈레톤. 커밋 `9ea7c85`.
- [x] **T3.1** ✅ 마이그레이션 0004 — E4 portfolio_approval 실 생성 (v1.3: dispute_reason ≥20자 · dispute_raised_by · gating_auto_relief_active · reanalysis_count ≤1 · UNIQUE(month) WHERE is_final=true 유지) + E11 kr_business_days + alert_event check constraint 'gating_auto_relief' 추가 + RLS. types/admin.ts v1.3 · types/kr-business-days.ts 신설. 커밋 `0ba0bf2`.
- [x] **T3.1a** ✅ `scripts/seed_kr_holidays.py` — S5 M10용 참조 Python 스크립트 (Homebrew Python 3.14 PEP 668 → venv 가이드 포함). 실제 2024~2026 공휴일 seed는 0004 마이그레이션에 수기 UPDATE로 인라인 (pykrx 설치 차단 대체안). 2027~2030은 pykrx 덮어씀. 커밋 `0ba0bf2`.
- [x] **T3.2** ✅ `/admin/portfolio` 전면 재작성 — Server Component(page.tsx) + Client island(portfolio-panel.tsx Base UI Dialog) + Server Actions(actions.ts). mock-admin-approvals 2026-03·2026-04 시드.
- [x] **T3.3** ✅ 선착순 단일 확정 로직 — `approval-logic.ts` 순수 함수(isAcceptAllowed·isUniqueViolation pg 23505 가드) + 10 단위 테스트. 실 Supabase catch 통합은 S3 hardening(architect 권고 #1) 이월.
- [x] **T3.4** ✅ Reject → 재분석 큐 stub — `actions.ts` rejectShortList가 reanalysis_count 증가. 재분석본 Reject 시 portfolioHoldWarning 배너 전환.
- [x] **T3.5** ✅ D+5 영업일 카운터 — `business-days.ts`(addBusinessDays·countBusinessDaysBetween) + `calendar.ts`(MOCK_KR_BUSINESS_DAYS_2026 · loadKrBusinessDays stub). page.tsx D+5 위젯. 7 단위 테스트.
- [x] **T3.6** ✅ D15 게이팅 3종 — `gating.ts` `computeAcceptGate` 순차 판정(24h Hold → D+4 영업일 → 2인 열람 · autoReliefActive skip). 6 단위 테스트. page.tsx가 gateResult를 portfolio-panel에 gateMessage·gateReason으로 전달.
- [x] **T3.7** ✅ 이의 제기 (BL-7 A) — `dispute.ts` 4 순수 함수 + 13 테스트. raiseDispute·resolveDispute Server Actions. 모달 실시간 20자 카운터(빨강<20/초록≥20) + 48h Hold 주황 배너 + Accept/Reject disabled. DB constraint 0004 portfolio_approval_dispute_reason_min_len 이중 가드.
- [x] **T3.8** ✅ BL-20 자동 바이패스 — `auto-relief.ts` detectSingleAdminStreak + 7 테스트. mock-admin-access-logs fixture. page.tsx 감지 → 비상 완화 배지 + computeAcceptGate autoReliefActive skip. 실 AlertEvent INSERT는 S5 M10 주석 TODO.

---

## DoD (Definition of Done)

- [x] Accept: 선착순 1회만 `is_final=true`. mock에서 `monthFinalizedByOtherAdmin` 상태 판정 + `isUniqueViolation(err)` 가드 함수 준비 (실 Supabase catch 체결은 S3 hardening 이월).
- [x] E4 UNIQUE(month) WHERE is_final=true DB 제약 적용 — 0004 §1 `portfolio_approval_final_month_uniq` 부분 인덱스 생성 확인.
- [x] `kr_business_days` 테이블 2024~2030 seed — 0004 §3·§4에 generate_series + 2024·2025·2026 수기 UPDATE. 2027~2030은 pykrx 덮어씀 placeholder (S5 M10).
- [x] 24h Hold: `computeAcceptGate` 가 reason='hold_24h'·remainingMs 반환. portfolio-panel이 Accept 버튼 disabled + `title` 툴팁·내부 배너 표시.
- [x] 2인 열람 게이팅: fixture `MOCK_ADMIN_REPORT_VIEW_LOG` COUNT(DISTINCT adminId) 계산 후 `viewersRemaining` 표시. `autoReliefActive=true` 시 skip.
- [x] 이의 제기: validateDisputeReason(≥20자 trim) + canRaiseDispute(중복 가드) + isDisputeHoldExpired(48h) + isAcceptBlockedByDispute. DB constraint 0004 portfolio_approval_dispute_reason_min_len 이중 가드 (architect 권고 #2 — S3 hardening에서 btrim 보강).
- [x] Reject 후 재분석 큐 — actions.ts `rejectShortList`에서 reanalysisCount 증가 mock + 2회째 시 portfolioHoldWarning 배너 전환.
- [x] (D15 R3.3-9) 연휴 우회 — `gating.test.ts` 케이스 5: 2026-09-23 shortlist 시 D+4 영업일(추석·주말 건너뜀)이 24h보다 길어져 `business_days_bypass` 확정.
- [x] (BL-20 A) 7일 연속 단일 접속 감지 — `detectSingleAdminStreak` 7 단위 테스트. page.tsx 실시간 호출 + 비상 완화 배지. 실 AlertEvent INSERT은 S5 통합 TODO.
- [x] Vitest: 5 test files · **43 tests pass** (business-days 7 · approval-logic 10 · gating 6 · auto-relief 7 · dispute 13).
- [x] `npm run build` 17 routes 통과, `npm run lint` 0 warnings.
- [x] 커밋: `feat(S3): 승인 워크플로우 — M7 + D15 게이팅 3종 + BL-20 자동 바이패스` (Ralph + deslop 통합 커밋)

---

## 블로커 / 사용자 결정 필요

- ~~**BL-7**~~ ✅ 해소 (2026-04-17) — **옵션 A 채택**: 이의 제기 사유는 자유 텍스트 입력 (min 20자 검증). 이유: 3인 어드민은 서로 직접 소통·이의는 드문 이벤트라 분류 통계 무가치·구체 맥락이 중요.
- ~~**[G-4]/BL-19**~~ ✅ 해소 (2026-04-17) — **옵션 D (하이브리드) 채택**: pykrx seed → Supabase `kr_business_days` 테이블 → Next.js UI SELECT. 최초 seed는 1회성 Python 스크립트(`scripts/seed_kr_holidays.py`)로 2024~2030 생성 후 0004 마이그레이션 INSERT 블록에 포함. S5 M10 이후 월간 배치가 자동 갱신(임시공휴일 대응).
- ~~**[G-9]/BL-20**~~ ✅ 해소 (2026-04-17) — **옵션 A 채택**: 7일 연속 단일 접속 감지 시 자동 바이패스 + `AlertEvent(type=gating_auto_relief)` 로그. 이유: 옵션 B(수동 오버라이드)는 휴가 중인 사람이 버튼 눌러야 하는 논리적 모순. 3인 중 2인 7일 연속 부재 = 분명한 정황 증거.
- ~~**[G-10]**~~ ✅ 해소 (2026-04-17, 19차 킥오프) — **옵션 b 채택**: Vitest 1파일(+인프라). race condition·영업일 계산·7일 연속 감지 순수 로직만 유닛 테스트. 컴포넌트·RLS 테스트는 스코프 외. 이유: S3은 build+lint로 검증 불가한 런타임 로직(race·시간·영업일) 밀집 구간. 유닛 테스트 가성비 최고.

---

## 리스크

- **R3** (architect §8): 어드민 3인 동시 Accept → 중복 `is_final` 발생. **E4 UNIQUE(month) WHERE is_final=true** DB 제약 + 낙관적 락 + E2E 테스트 3세션 동시 시뮬레이션으로 완화. T3.1 스키마 설계 시 제약 명시 필수.
- **R8** (architect §8): D15 2인 열람 게이팅: 어드민 1인 연속 운영 시 Accept 영구 차단 가능. "1인 어드민 7일 연속" 예외 룰 추가 검토 필요 (신규 사용자 결정 요청).

---

## 의사결정 로그

- 2026-04-17 (19차 완료):
  - **S3 ✅ 완료**. Ralph 5 wave(T3.5·T3.3·T3.8 병렬 → T3.6 → T3.2+T3.4 → T3.5/T3.6/T3.8 UI 통합 → T3.7) + architect APPROVED + ai-slop-cleaner 패스. 최종 5 test files · 43 tests · 17 routes.
  - architect 비블로킹 권고 3건을 S3 hardening 이월: (1) adminId 세션 주입 TODO 주석 추가 ✅ 처리 (2) `gating.ts` 주석 명료화 ✅ 처리 (3) `dispute_reason` btrim DB constraint는 실 Supabase 통합 시 처리 이월.
  - ai-slop-cleaner 정리: `actions.ts` console.log 4건 제거, 주석 처리된 대안 fixture 블록(`MOCK_ADMIN_ACCESS_LOGS_SINGLE_STREAK`) 14줄 삭제.
  - 실 세션 1회(19차)에 완료. 예상 4세션 대비 25% 소요(S1·S2에 이어 속도 가속).
  - 실 Supabase 통합(actions.ts INSERT/SELECT + middleware admin 세션 주입)은 **S3 hardening 마이크로 슬라이스** 또는 S5 M10 배치와 동시 착수 권고 (architect 분석).
- 2026-04-17 (19차 킥오프):
  - **G-10 = b** (Vitest 1파일 + 인프라). race condition·영업일·7일 감지 순수 로직만 유닛 테스트. 컴포넌트·RLS는 수동 QA.
  - 파생: Tasks 맨 앞에 T3.0 Vitest 셋업 추가. DoD에 `npm run test:ci` 통과 항목 추가.
- 2026-04-17 (18차 후속 — 블로커 3건 해소, S2 완료 후 즉시 언블록):
  - **BL-7 = A** (자유 텍스트 min 20자). 3인 소통 체제·분류 통계 무가치·표현 자유도 우선.
  - **BL-19 = D** (pykrx seed → Supabase `kr_business_days` 캐시 → Next.js SELECT). 초기 seed는 1회성 Python 스크립트로 2024~2030 생성. S5 M10 이후 월간 배치 자동 갱신.
  - **BL-20 = A** (자동 바이패스 + AlertEvent 로그). B 옵션은 "휴가 중인 사람이 버튼 눌러야 함" 논리적 모순.
  - 파생: Tasks에 T3.1a(Python seed 스크립트) + T3.8(7일 연속 자동 바이패스) 추가. T3.7은 자유 텍스트 min 20자 확정. 엔티티에 E11 KrBusinessDays + AlertEvent type `gating_auto_relief` 추가.
  - G-10(테스트 전략)은 킥오프 시 경량 결정으로 이월.
- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R2에 의해 S2(풀 리포트) 완료 후 착수 강제. D15 R3.3-7~10 전부 포함.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S2 블록 기반. D15 게이팅 3종(R3.3-7~10) 전부 열거. race condition(E4 UNIQUE) 강조. |
| 2026-04-17 | **블로커 3건 해소** (BL-7 A·BL-19 D·BL-20 A). E11 KrBusinessDays 엔티티·AlertEvent gating_auto_relief 타입 추가. Tasks T3.1a(Python seed)·T3.8(자동 바이패스) 추가. T3.7 자유 텍스트 min 20자 확정. 2인 게이팅 로직을 `COUNT(DISTINCT admin_id) FROM report_view_log`로 수정. Status ⚪ → 🟢. |
