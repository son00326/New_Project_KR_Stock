# S1 Short List 30 홈 + 분석엔진 출력

> originally architect ID: S1 (`.omc/research/must-19-slice-mapping.md` §5 S1 블록)

---

```
slice_id: S1
slice_name: Short List 30 홈 + 분석엔진 출력
architect_id: S1
status: 🟢 진행 중 (T1.2 완료 · T1.3 대기)
expected_sessions: 4
current_progress: 33%
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

- [x] **T1.1** E1 ShortList30 Supabase 스키마 생성 + mock fixture 30종 (단10·중10·장10, `delta_status`, `summary_3line`, Composite·3축 포함) — 2026-04-17 완료. `supabase/migrations/0002_s1_shortlist30.sql` + `src/lib/data/mock-admin-shortlist.ts` (30 + REMOVED 3 = 33행)
- [x] **T1.2** `/admin` 페이지 — 3섹션 세로 스택 레이아웃 (단기·중기·장기 버킷 헤더 + 종목 행 리스트) — 2026-04-17 완료. `src/app/(admin)/admin/page.tsx` 재작성 + `src/components/admin/shortlist/bucket-section.tsx` 분리 (T1.3 종목 카드에서 행 교체 예정). Delta 집계 요약·30종 미달 경고 placeholder 포함.
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

- **BL-3** ✅ 해소 (2026-04-17): **옵션 C 확정** — `backtest/full_system_backtest_v6.py` 로직 **관점에서** Claude가 2026-04 스냅샷 30종 정성 생성 (실 KOSPI/KOSDAQ ticker · v6 출력 shape 모방). 실제 pykrx + v6 실행은 **S5 M10 스케줄러 연결 시점**에 자연 수행되어 이 mock을 대체. **30종 의미 재정의**: 단기 상승 예상 10 · 중기 상승 예상 10 · 장기 상승 예상 10 (bucket = 상승 예상 기간). Composite·3축·Crisis·Delta 점수는 Claude의 정성 판단 (v6 로직 참조).

---

## 리스크

- **E1 Writer는 M10(S5)이 유일** (architect §3 핵심 관찰): S1은 전 기간 mock fixture에 의존. S5 완료 전까지는 홈 데이터가 mock. 이 사실을 DoD에 명시해 실데이터 연결 시점 혼선 방지.
- **LR-S1-1**: E1 mock fixture 분포가 BL-3 결정 없이 확정되면 S4 Sharpe/alpha 계산이 mock 기반이라는 사실을 망각하고 실측 품질로 오해할 위험. DoD에 "mock 기반임을 화면 상단 배너 또는 log에 명시" 추가 권장. / architect R1~R8 직접 발현 없음.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. S0 완료 후 착수 예정. BL-3 해소 후 T1.1 mock fixture 작성.
- 2026-04-17 (T1.2 실행): `/admin` 페이지 3섹션 세로 스택 완성 (short→mid→long 순, bucket header 메타 · Delta 집계 pill · 30종 미달 경고 placeholder). `BucketSection` 컴포넌트 분리, DeltaBadge(NEW/HOLD/REMOVED) 간이 배지 포함. 종목 카드 상세(Composite·3축·Crisis·스파크라인)는 T1.3에서 row 교체. npm run build 17 routes 통과.
- 2026-04-17 (T1.1 실행): **30종 fixture + REMOVED 3 확정**. 장10(L1~L10: 005930/000660/207940/373220/005380/035420/005490/012330/055550/033780) + 중10(M1~M10: 012450/329180/042660/034020/267260/028260/068270/006400/064350/010140) + 단10(S1~S10: 196170/247540/079550/352820/035900/058470/214150/278280/278470/251270) + REMOVED 3(035720/011200/105560). Delta 집계: **편입 5·유지 25·제외 3**. 가중치 합: 1.00 (long 0.30 + mid 0.40 + short 0.30).
- 2026-04-17 (Deferred-Y 박제): 사용자 v2 AI agent 선정엔진 고도화 의향 표명 → `Document/Build/Slices/Deferred-AIAgent-Selection.md` 별도 트랙으로 박제. S1은 v0 mock으로 계속 진행.
- 2026-04-17: **BL-3 해소 — 옵션 C 확정**.
  - **의미 재정의**: 30종 = 단기 상승 예상 10 + 중기 10 + 장기 10 (bucket = **상승 예상 기간**, 변동성·시총 크기 아님)
  - **실 ticker**: KOSPI/KOSDAQ 실제 종목 사용 (2026-04 기준 공개 정보)
  - **점수 산출**: Claude가 `backtest/full_system_backtest_v6.py` v6 FINAL 알고리즘 로직 관점에서 정성 생성 (Composite 0~100·3축 추세/모멘텀/변동성·Crisis·NEW/HOLD/REMOVED)
  - **알고리즘 자산**: Outputs/ 11개 리포트 + backtest/v6 (CAGR 20.3%·Sharpe 0.99·3축 분화 + Early Warning + 부분 리밸런싱)
  - **실시간 전환 없음**: ServicePlan §4.4 M10 월 1회 배치 원칙 유지. 실시간 상태 변화는 S5 M13(장중 알림)·M15(Exit)로 처리. 월 중 재분석은 S4 M9 cap(auto ≤1·manual ≤2).
  - **실데이터 전환 시점**: S5에서 M10이 pykrx·DART 연결 후 실 배치로 본 mock 대체.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S1 블록 기반. Must M1·M4·M5·M6 매핑 확정. |
| 2026-04-17 | **BL-3 해소** (옵션 C). 30종 의미 재정의(상승 예상 기간 bucket). backtest/v6 로직 관점에서 2026-04 스냅샷 정성 생성 방침 확정. 다음 세션 T1.1 첫 행동: 30종 + 점수 생성 → 사용자 검수 → Supabase E1 마이그레이션. |
