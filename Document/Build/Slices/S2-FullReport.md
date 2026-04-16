# S2 풀 리포트 + 투심위

> originally architect ID: S5 (`.omc/research/must-19-slice-mapping.md` §5 S5 블록 — **초안 S5를 앞당김**)

---

```
slice_id: S2
slice_name: 풀 리포트 + 투심위
architect_id: S5
status: ⚪ 대기
expected_sessions: 3
current_progress: 0%
```

---

## 목표 (Why)

어드민이 종목별 풀 리포트(Section 0~8)와 투심위 패널을 열람한다. **이 슬라이스가 S3(승인) 앞에 반드시 선행**되어야 하는 이유: M7(D15) 2인 게이팅은 `report.view` 이벤트가 2회 기록되었는지 확인하는 로직에 의존한다. `report.view` 파이프가 없으면 S3 승인 워크플로우의 핵심 게이팅이 성립하지 않는다 (architect R-B Critical).

---

## 포함 요구사항

- **Must**: M2 (풀 리포트 렌더링), M3 (투심위 투표 요약 패널)
- **엔티티**: E2 StockReport (R), E3 CommitteeVote (R), E4 PortfolioApproval (W only · `report_view_count` 필드 +1 hook — E4 Row 생성은 M7/S3 소관)
- **라우트**: `/admin/report/[ticker]`
- **근거**: ServicePlan-Admin.md §3.7 R3.7-1~8

---

## 선행 조건

- **S1 완료**: 종목 카드의 "풀 리포트" 링크가 이 라우트로 연결되므로 S1 완료 후 실제 내비게이션 가능
- **`report.view` 이벤트 파이프**: S2 완료 시점에 E4 `report_view_count` 증가 훅이 반드시 작동해야 함 — S3 게이팅 선행 조건

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| ReportFramework.md Section 0~8 정의 | 리포트 섹션 구조 | `Document/Service/Report/ReportFramework.md` 참조 |
| E2 StockReport mock 원고 | 8개 섹션 내용 | BL-4 해소 후 작성 (writer 에이전트 선행 또는 codegen) |
| E3 CommitteeVote mock | 투심위 투표 집계 | 11명(Core) + Sector Board mock fixture |

---

## Tasks (체크리스트)

- [ ] **T2.1** E2 StockReport + E3 CommitteeVote Supabase 스키마 생성 + mock fixture (Section 0~8 + Appendix + 투심위 투표)
- [ ] **T2.2** `/admin/report/[ticker]` 페이지 — Sticky Side Nav + 단일 스크롤 레이아웃
- [ ] **T2.3** Section 0~8 렌더러 — accordion (Section 0 펼침 디폴트), 각 섹션 컨텐츠 컴포넌트
- [ ] **T2.4** `report.view` 이벤트 파이프 — 페이지 진입 시 E4 `report_view_count` +1 (중복 카운트 정책은 BL-5 결정 후 구현)
- [ ] **T2.5** 이전/다음 종목 내비 (버킷 내 순서)
- [ ] **T2.6** Section 8 투심위 패널 — Core 11명 + Sector Board 집계 표 + 핵심 논거 3~5건 표시
- [ ] **T2.7** Section 6 M4 분석엔진 출력 인터랙티브 차트 (MVP 최소 Recharts — S1 카드 컴포넌트 재사용)

---

## DoD (Definition of Done)

- [ ] `/admin/report/[ticker]` 접근 시 Section 0~8 전부 렌더링, 오류 없음
- [ ] Sticky Side Nav: 스크롤 시 고정, 클릭 시 해당 섹션으로 스크롤
- [ ] 페이지 진입 시 E4 `report_view_count` +1 이벤트 기록 확인 (Supabase 또는 mock 로그)
- [ ] Section 8: Core 11명 투표 집계 + Sector Board 표시 + 논거 최소 3건
- [ ] "← Short List" 복귀 링크 동작 (스크롤 위치 복원)
- [ ] `npm run build` 오류 0, `npm run lint` 경고 0
- [ ] 커밋: `feat(S2): 풀 리포트 렌더링 + 투심위 패널 — M2·M3 + report.view 파이프`

---

## 블로커 / 사용자 결정 필요

- **BL-4** (Medium): Section 0~8 mock 원고 작성 책임자 — writer 에이전트 선행 vs AI codegen 중 선택. T2.1 mock fixture 품질에 직접 영향 — ProgressDashboard §5 참조
- **BL-5** (Low — P7 이관 가능): `report.view` dedupe 정책 — 동일 어드민이 같은 날 재진입 시 +1 카운트할지. 2인 게이팅(BL-7)과 연동. MVP는 "진입마다 +1"로 단순화 가능
- **[G-5]** (Major — S2 킥오프 시 설계 결정): `report_view_count` int 필드는 "유니크 어드민 수"와 "총 진입 횟수"를 구분 불가. 1인이 2번 열면 D15 2인 게이팅 통과 → 의도 무효화. 해소 옵션: (a) `report_viewers` jsonb 배열로 변경, (b) 별도 `report_view_log` 테이블 + 유니크 집계, (c) E4에 `distinct_viewer_count` 컬럼 추가.
- **[G-11]** (Minor — S2 킥오프 시 설계 결정): S2에서 E4 `report_view_count`에 +1 write하는데, E4 Row는 S3(승인)에서 최초 생성됨. S2 시점에 해당 month E4 Row 부재 시 에러 발생. 해소 옵션: (a) S2에서 E4 스키마 함께 생성(report_view_count 전용 행 선생성), (b) report_view를 별도 테이블에 기록 후 S3에서 집계(권장), (c) Short List 생성 시점(S1/S5)에 E4 Row 초기화.

---

## 리스크

- **R-B (Critical)** (architect): `report.view` 파이프 없이 S3에 진입하면 D15 2인 게이팅이 항상 0/2 → Accept 불가 상태. S2 DoD에 `report_view_count` 이벤트 확인 항목 필수.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R5·R2에 의해 초안 S5→실행 순서 S2로 앞당김. S3 선행 이유 명시.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S5 블록 기반. 실행 순서 앞당김 이유(R-B Critical) 명시. |
