# S3 승인 워크플로우 (+D15 게이팅)

> originally architect ID: S2 (`.omc/research/must-19-slice-mapping.md` §5 S2 블록)

---

```
slice_id: S3
slice_name: 승인 워크플로우 (+D15 게이팅)
architect_id: S2
status: 🟢 진행 가능 (2026-04-17 — BL-7·BL-19·BL-20 3건 해소. G-10 테스트 전략은 킥오프 시 경량 결정)
expected_sessions: 4
current_progress: 0%
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

- [ ] **T3.1** 마이그레이션 0004 — E4 PortfolioApproval 스키마 (`UNIQUE (month) WHERE is_final=true` + `dispute_raised_at`, `dispute_resolved_at`, `shortlist_generated_at`. **`report_view_count` 컬럼 없음** — v1.2 제거됨) + **E11 `kr_business_days` 테이블** (`date PK`, `is_business_day bool`, `holiday_name text NULL`) + RLS. 낙관적 락 설계.
- [ ] **T3.1a** `scripts/seed_kr_holidays.py` 1회성 Python 스크립트 (pykrx 호출) → 2024~2030 영업일 SQL INSERT 블록 생성 → 0004 마이그레이션에 포함. BL-19 D 옵션 반영.
- [ ] **T3.2** `/admin/portfolio` 페이지 — 현재 Short List 표시 + Accept/Reject 버튼 + 확인 모달
- [ ] **T3.3** 선착순 단일 확정 로직 — 첫 Accept 후 나머지 어드민에게 "이미 승인됨" 배너. race condition: E4 UNIQUE 제약 위반 시 409 처리.
- [ ] **T3.4** Reject → 재분석 1회 큐 (M9 카운터와 별개) + 재분석본 Reject → 전월 포트 유지 + CAP Months 미포함
- [ ] **T3.5** D+5 영업일 카운터 + 장기 연휴 영업일 연장 UI — `kr_business_days` 테이블 SELECT로 영업일 계산. D+5 남은 일 표시.
- [ ] **T3.6** D15 게이팅 3종:
  - R3.3-7: 24h Hold 체크 (`shortlist.generated_at + 24h` 이전 disabled + 남은 시간 표시)
  - R3.3-8: 2인 열람 게이팅 ("N/2명 열람 완료" 카운터 — `SELECT COUNT(DISTINCT admin_id) FROM report_view_log WHERE report_id = ?` 집계. G-5 B 반영).
  - R3.3-9: 연휴 우회 (24h vs D+4 영업일 중 짧은 쪽 — `kr_business_days` 기반)
- [ ] **T3.7** 이의 제기 (BL-7 A 반영) — 이의 버튼 + **자유 텍스트 사유 입력 (min 20자 클라/서버 검증)** + 48h 추가 Hold + Hold 해제 후 재투표. 사유는 `E4.dispute_reason` 컬럼 추가(T3.1 포함).
- [ ] **T3.8** BL-20 A 자동 바이패스 — `/admin` 진입 감지 로직에 "최근 7일 연속 단일 admin_id만 접속" 체크. 조건 만족 시 D15 2인 게이팅을 1인 허용으로 완화 + `AlertEvent(type=gating_auto_relief, triggerReason=단일 어드민 7일 연속 접속)` 자동 로그. 바이패스 활성 시 UI에 "비상 완화 모드" 배지.

---

## DoD (Definition of Done)

- [ ] Accept: 선착순 1회만 `is_final=true`. 동시 Accept 시도 시 두 번째는 409 처리 후 "이미 승인됨" 배너
- [ ] E4 UNIQUE(month) WHERE is_final=true DB 제약 적용 확인
- [ ] `kr_business_days` 테이블 2024~2030 시드 확인 (pykrx seed)
- [ ] 24h Hold: `shortlist.generated_at + 24h` 미경과 시 Accept 버튼 disabled + 남은 시간 표시
- [ ] 2인 열람 게이팅: `COUNT(DISTINCT admin_id) FROM report_view_log < 2`일 때 Accept 버튼 disabled + "N/2명 열람 완료" 표시
- [ ] 이의 제기: 이의 버튼 클릭 → 자유 텍스트 입력(min 20자 검증) + 48h Hold 진입, Hold 중 Accept 불가
- [ ] Reject 후 재분석 큐 진입 확인 (stub 수준)
- [ ] (D15 R3.3-9) 연휴 기간 Accept: 24h 대비 D+4 영업일이 짧으면 D+4 적용 확인 (mock 장기연휴 시나리오로 E2E 검증, `kr_business_days` 기반)
- [ ] (BL-20 A) 7일 연속 단일 접속 감지 시 2인 게이팅 자동 바이패스 + AlertEvent(type=gating_auto_relief) 로그 기록 확인 + UI 비상 완화 배지 표시
- [ ] `npm run build` 오류 0, `npm run lint` 경고 0
- [ ] 커밋: `feat(S3): 승인 워크플로우 — M7 + D15 게이팅 3종 + BL-20 자동 바이패스`

---

## 블로커 / 사용자 결정 필요

- ~~**BL-7**~~ ✅ 해소 (2026-04-17) — **옵션 A 채택**: 이의 제기 사유는 자유 텍스트 입력 (min 20자 검증). 이유: 3인 어드민은 서로 직접 소통·이의는 드문 이벤트라 분류 통계 무가치·구체 맥락이 중요.
- ~~**[G-4]/BL-19**~~ ✅ 해소 (2026-04-17) — **옵션 D (하이브리드) 채택**: pykrx seed → Supabase `kr_business_days` 테이블 → Next.js UI SELECT. 최초 seed는 1회성 Python 스크립트(`scripts/seed_kr_holidays.py`)로 2024~2030 생성 후 0004 마이그레이션 INSERT 블록에 포함. S5 M10 이후 월간 배치가 자동 갱신(임시공휴일 대응).
- ~~**[G-9]/BL-20**~~ ✅ 해소 (2026-04-17) — **옵션 A 채택**: 7일 연속 단일 접속 감지 시 자동 바이패스 + `AlertEvent(type=gating_auto_relief)` 로그. 이유: 옵션 B(수동 오버라이드)는 휴가 중인 사람이 버튼 눌러야 하는 논리적 모순. 3인 중 2인 7일 연속 부재 = 분명한 정황 증거.
- **[G-10]** (Minor — S3 킥오프 시 경량 결정): 테스트 전략. **킥오프 시 간단히 (c) 현행 유지(build+lint) 기본 + race condition만 필요 시 Vitest 1파일 추가** 제안 예정. 사용자 의견 재확인 필요.

---

## 리스크

- **R3** (architect §8): 어드민 3인 동시 Accept → 중복 `is_final` 발생. **E4 UNIQUE(month) WHERE is_final=true** DB 제약 + 낙관적 락 + E2E 테스트 3세션 동시 시뮬레이션으로 완화. T3.1 스키마 설계 시 제약 명시 필수.
- **R8** (architect §8): D15 2인 열람 게이팅: 어드민 1인 연속 운영 시 Accept 영구 차단 가능. "1인 어드민 7일 연속" 예외 룰 추가 검토 필요 (신규 사용자 결정 요청).

---

## 의사결정 로그

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
