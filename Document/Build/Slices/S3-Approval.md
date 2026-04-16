# S3 승인 워크플로우 (+D15 게이팅)

> originally architect ID: S2 (`.omc/research/must-19-slice-mapping.md` §5 S2 블록)

---

```
slice_id: S3
slice_name: 승인 워크플로우 (+D15 게이팅)
architect_id: S2
status: ⚪ 대기
expected_sessions: 4
current_progress: 0%
```

---

## 목표 (Why)

어드민 3인이 매월 Short List 30을 Accept/Reject하는 워크플로우를 구현한다. D15 결정(Holding Period 24h + 2인 열람 게이팅 + 이의 48h Hold)이 포함되어 가장 복잡한 단일 Must. race condition(E4 UNIQUE 제약) 처리가 핵심 기술 과제.

---

## 포함 요구사항

- **Must**: M7 (승인 워크플로우 + D15 24h Hold + 2인 열람 게이팅 + 이의 48h)
- **엔티티**: E4 PortfolioApproval (RW), E2 StockReport (R · `report_view_count` 캐시), E5 PortfolioSnapshot (W 트리거)
- **라우트**: `/admin/portfolio`
- **근거**: ServicePlan-Admin.md §3.3 R3.3-1~10

---

## 선행 조건

- **S1 완료**: 홈 Short List 존재 전제
- **S2 완료** (강제): M2 `report.view` 이벤트 파이프 선행 필수. 2인 열람 게이팅(D15 R3.3-8)은 `report_view_count`를 참조하므로 S2 없이 M7 구현 불가.

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| 텔레그램 Bot API | D+5 경고 알림 | S3에서는 stub 허용. 실구현은 S5 |
| E5 PortfolioSnapshot | Accept 시 트리거 | W stub만 (실 계산은 S4) |

---

## Tasks (체크리스트)

- [ ] **T3.1** E4 PortfolioApproval 스키마 — `UNIQUE (month) WHERE is_final=true` DB 제약 + `dispute_raised_at`, `resolved_at`, `report_view_count` 컬럼 포함. 낙관적 락 설계.
- [ ] **T3.2** `/admin/portfolio` 페이지 — 현재 Short List 표시 + Accept/Reject 버튼 + 확인 모달
- [ ] **T3.3** 선착순 단일 확정 로직 — 첫 Accept 후 나머지 어드민에게 "이미 승인됨" 배너. race condition: E4 UNIQUE 제약 위반 시 409 처리.
- [ ] **T3.4** Reject → 재분석 1회 큐 (M9 카운터와 별개) + 재분석본 Reject → 전월 포트 유지 + CAP Months 미포함
- [ ] **T3.5** D+5 영업일 카운터 + 장기 연휴 영업일 연장 UI (D+5 남은 일 표시)
- [ ] **T3.6** D15 게이팅 3종:
  - R3.3-7: 24h Hold 체크 (`shortlist.generated_at + 24h` 이전 disabled + 남은 시간 표시)
  - R3.3-8: 2인 열람 게이팅 ("N/2명 열람 완료" 카운터 — `report_view_count` 참조)
  - R3.3-9: 연휴 우회 (24h vs D+4 중 짧은 쪽)
- [ ] **T3.7** 이의 제기 — 이의 버튼 + 48h 추가 Hold + Hold 해제 후 재투표 (BL-7 결정 후 UX 확정)

---

## DoD (Definition of Done)

- [ ] Accept: 선착순 1회만 `is_final=true`. 동시 Accept 시도 시 두 번째는 409 처리 후 "이미 승인됨" 배너
- [ ] E4 UNIQUE(month) WHERE is_final=true DB 제약 적용 확인
- [ ] 24h Hold: `shortlist.generated_at + 24h` 미경과 시 Accept 버튼 disabled + 남은 시간 표시
- [ ] 2인 열람 게이팅: `report_view_count < 2`일 때 Accept 버튼 disabled + "N/2명 열람 완료" 표시
- [ ] 이의 제기: 버튼 클릭 시 48h Hold 진입, Hold 중 Accept 불가
- [ ] Reject 후 재분석 큐 진입 확인 (stub 수준)
- [ ] (D15 R3.3-9) 연휴 기간 Accept: 24h 대비 D+4 영업일이 짧으면 D+4 적용 확인 (mock 장기연휴 시나리오로 E2E 검증)
- [ ] `npm run build` 오류 0, `npm run lint` 경고 0
- [ ] 커밋: `feat(S3): 승인 워크플로우 — M7 + D15 게이팅 3종 (R3.3-7~10)`

---

## 블로커 / 사용자 결정 필요

- **BL-7** (Medium): 이의 제기 해결 액션 UX — 자유 텍스트 입력 vs 드롭다운 사유 선택. P7 이관 가능하나 M7 DoD에 이의 제기 버튼 존재 여부 확정 필요 — ProgressDashboard §5 참조
- **[G-4]** (Major — S3 킥오프 전 결정 필수): 한국 영업일 캘린더 데이터 소스 미결정. D+5 영업일 카운터(R3.3-5)·연휴 우회(R3.3-9)·M10 배치의 휴장일 처리에 필수. 옵션: (a) pykrx `get_market_ohlcv`에서 거래일 역산, (b) KRX 공식 휴장일 캘린더 하드코딩 + 연간 갱신, (c) 외부 API. → **BL-19** 등록.
- **[G-9]** (Minor — S3 킥오프 전 사용자 결정): R8 "1인 어드민 7일 연속 운영" 예외 룰 미등록. 2인 열람 게이팅에서 Accept 영구 차단 방지. 옵션: (a) 7일 후 자동 바이패스, (b) Settings 수동 오버라이드, (c) 예외 없음(3인 전제). → **BL-20** 등록.
- **[G-10]** (Major — S3 킥오프 전 사용자 협의): 테스트 전략 — build+lint만으로 S3 race condition(E4 UNIQUE)·시간 기반 게이팅·영업일 계산 검증 불가. 옵션: (a) Vitest 최소 설치 + 비즈니스 로직 유닛 테스트, (b) Playwright E2E 1건, (c) 현행 유지. CLAUDE.md "테스트 프레임워크 추가는 사용자 확인 후에만" 준수.

---

## 리스크

- **R3** (architect §8): 어드민 3인 동시 Accept → 중복 `is_final` 발생. **E4 UNIQUE(month) WHERE is_final=true** DB 제약 + 낙관적 락 + E2E 테스트 3세션 동시 시뮬레이션으로 완화. T3.1 스키마 설계 시 제약 명시 필수.
- **R8** (architect §8): D15 2인 열람 게이팅: 어드민 1인 연속 운영 시 Accept 영구 차단 가능. "1인 어드민 7일 연속" 예외 룰 추가 검토 필요 (신규 사용자 결정 요청).

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R2에 의해 S2(풀 리포트) 완료 후 착수 강제. D15 R3.3-7~10 전부 포함.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S2 블록 기반. D15 게이팅 3종(R3.3-7~10) 전부 열거. race condition(E4 UNIQUE) 강조. |
