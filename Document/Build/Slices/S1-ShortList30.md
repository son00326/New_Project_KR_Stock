# S1 Short List 30 홈 + 분석엔진 출력

> originally architect ID: S1 (`.omc/research/must-19-slice-mapping.md` §5 S1 블록)

---

```
slice_id: S1
slice_name: Short List 30 홈 + 분석엔진 출력
architect_id: S1
status: ⚪ 대기
expected_sessions: 4
current_progress: 0%
```

---

## 목표 (Why)

어드민이 매월 선정된 30종목을 한눈에 파악하는 메인 화면을 완성한다. 5-Signal Composite·3축 분석엔진 출력·Delta 뷰·3줄 근거 카드 4개 Must를 단일 라우트(`/admin`)에서 구현. S1 완료 시 J1 월간 선정 플로우의 첫 단계가 E2E 가능해진다.

---

## 포함 요구사항

- **Must**: M1 (Short List 30 홈 표시), M4 (5-Signal Composite + 3축 분석엔진 출력), M5 (편입/유지/제외 Delta 뷰), M6 (선정 근거 요약 카드 3줄)
- **엔티티**: E1 ShortList30 (R), E2 StockReport (R · 리스트 프리뷰용)
- **라우트**: `/admin` (메인 홈)
- **근거**: ServicePlan-Admin.md §3.1 R3.1-1~5, §3.2 R3.2-1~5, §3.8 R3.8-1~7

---

## 선행 조건

- **S0 완료**: admin 라우트 그룹·디자인 토큰·mock 구조 전제
- **E1 mock seed 필수**: M10(스케줄러)은 S5에 있으므로 S1에서는 E1 mock fixture 30종으로 대체. 실데이터 전환은 S5 완료 후.

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| pykrx / 기술적 지표 | Composite·3축 점수 원천 | mock fixture만. 실연결은 슬라이스별 실데이터 연결 단계 |
| E1 ShortList30 스키마 | 홈 표시 데이터 | S1에서 Supabase 스키마 생성 + mock fixture seed |

---

## Tasks (체크리스트)

- [ ] **T1.1** E1 ShortList30 Supabase 스키마 생성 + mock fixture 30종 (단10·중10·장10, `delta_status`, `summary_3line`, Composite·3축 포함)
- [ ] **T1.2** `/admin` 페이지 — 3섹션 세로 스택 레이아웃 (단기·중기·장기 버킷 헤더 + 종목 행 리스트)
- [ ] **T1.3** 종목 카드 컴포넌트 — 티커·섹터·Composite(0~100)·3축(추세·모멘텀·변동성)·방향 지표·Crisis 배지·괴리율·7일 스파크라인·NEW/HOLD/REMOVED 배지
- [ ] **T1.4** M5 Delta 배너 — 홈 상단 "편입 N·유지 N·제외 N" + 펼침 패널 + 행 배지
- [ ] **T1.5** M6 3줄 근거 팝오버 — 종목 행 hover/펼침 시 `summary_3line` 표시 + "풀 리포트" 링크 + NEW 레이블
- [ ] **T1.6** 30종목 미달 경고 배너 — 원인 분리(스크리닝 미달 vs 스케줄러 실패) + 전월 유지 표시

> **병렬 가능**: T1.3 + T1.4 + T1.5는 독립 컴포넌트이므로 병렬 작업 가능.

---

## DoD (Definition of Done)

- [ ] `/admin` 접근 시 3섹션(단·중·장) 세로 스택 렌더링, 각 섹션 종목 수 합계 30
- [ ] 종목 카드: Composite 점수·3축·Crisis 배지·괴리율·스파크라인·Delta 배지 모두 표시
- [ ] Delta 배너: 편입/유지/제외 건수 집계 표시, 펼침 패널 동작
- [ ] 3줄 근거 팝오버: hover/클릭 시 표시, "풀 리포트" 링크 이동 (S2 이후 실제 라우트 연결)
- [ ] 30종목 미달 시 경고 배너 노출 (mock에서 강제 테스트)
- [ ] `npm run build` 오류 0, `npm run lint` 경고 0
- [ ] 커밋: `feat(S1): Short List 30 홈 — M1·M4·M5·M6`

---

## 블로커 / 사용자 결정 필요

- **BL-3** (Medium): Composite·3축 mock fixture 분포 확정 — 0~100 분포에서 Crisis 발동 비율(예: 3/30), 섹터 분포, 괴리율 범위 — ProgressDashboard §5 참조

---

## 리스크

- **E1 Writer는 M10(S5)이 유일** (architect §3 핵심 관찰): S1은 전 기간 mock fixture에 의존. S5 완료 전까지는 홈 데이터가 mock. 이 사실을 DoD에 명시해 실데이터 연결 시점 혼선 방지.
- **LR-S1-1**: E1 mock fixture 분포가 BL-3 결정 없이 확정되면 S4 Sharpe/alpha 계산이 mock 기반이라는 사실을 망각하고 실측 품질로 오해할 위험. DoD에 "mock 기반임을 화면 상단 배너 또는 log에 명시" 추가 권장. / architect R1~R8 직접 발현 없음.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. S0 완료 후 착수 예정. BL-3 해소 후 T1.1 mock fixture 작성.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S1 블록 기반. Must M1·M4·M5·M6 매핑 확정. |
