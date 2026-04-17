# Deferred-Y AI Agent 기반 선정엔진 v2

> 2026-04-17 박제 — S1 착수 시 사용자가 "나중에 AI agent로 분석엔진을 개선하고 싶다" 의향 표명.

---

```
slice_id: Deferred-Y
slice_name: AI Agent 기반 선정엔진 v2
status: ⏸ 보류 (Must 19 범위 외 — 엔진 고도화 트랙)
expected_sessions: — (Must 19 이후 별도 로드맵)
current_progress: 0%
```

---

## 배경

Must 19 초기 범위에서 Short List 30 선정 엔진은 2단계로 진화하도록 설계됨:

| 단계 | 시점 | 엔진 | 상태 |
|---|---|---|---|
| **v0 (mock)** | S1 (2026-04) | Claude 정성 생성 (v6 로직 관점 30종 fixture) | 🟢 진행 |
| **v1 (실데이터)** | S5 M10 스케줄러 | pykrx + DART + `backtest/full_system_backtest_v6.py` 알고리즘 실 배치 | ⚪ 대기 |
| **v2 (AI agent)** | S6 이후 (본 슬라이스) | LLM 기반 멀티 페르소나·추론 엔진으로 v1 교체/보강 | ⏸ 보류 |

**핵심 관찰**: E1 ShortList30 스키마(Composite·3축·Crisis·Delta·signalLabel·summary_3line·suggestedWeight)는 **엔진 독립적**. 엔진이 v0→v1→v2 어떤 단계든 출력 shape만 맞으면 UI(M1·M4·M5·M6)는 그대로 동작.

---

## 왜 Must 19 밖으로 미뤄야 하는가

1. **범위 폭주 방지** — AI agent 엔진은 AI 비용·레이턴시·프롬프트 설계·평가 루프(백테스트·휴먼 검수)가 필요하며, S1(홈 UI)·S5(스케줄러) 슬라이스에 섞으면 Must 19 25세션 계획이 붕괴.
2. **근거 축적 선행 필요** — S4 가상 포트·S5 Exit/성과 측정이 쌓인 후에야 "v1 대비 v2가 뭘 더 잘해야 하는가"의 정량 근거가 생김. 지금 설계 시도 시 가설 기반 오버엔지니어링 위험.
3. **교체 용이** — E1 스키마 독립성 덕분에 M10 배치 로직만 교체하면 됨. 지금 아키텍처를 AI agent에 맞춰 바꿀 필요 없음.

---

## 재활성 조건

아래 조건이 모두 충족될 때 본 슬라이스 착수:

1. **Must 19 전원 가동 완료** (선행: S6 Hardening 완료)
2. **v1 실데이터 배치 2~3개월 운용** — S5 M10 결과물 누적. v1 선정 품질의 강점·약점 데이터 확보
3. **AI 비용 예산 확정** — M17 비용 모니터링 데이터 기반으로 v2 엔진이 허용 범위 내(월 40만원 hardcap 내) 운영 가능한지 사전 추정
4. **평가 프레임워크 합의** — v1 vs v2 선정 품질 비교 방법론 (백테스트 Sharpe·CAGR·DD + 휴먼 검수 rubric)

---

## 포함 예정 범위 (재활성 시)

- **멀티 페르소나 reasoning** — ReportFramework Core Committee(8) + Sector Board(10+) 페르소나 로직을 선정 단계에도 확대 적용 검토
- **LLM 기반 후보 스크리닝** — KOSPI/KOSDAQ 전종목 → 1차 기술적 필터(v1 유지) → 2차 LLM 정성 스크리닝(뉴스·공시·섹터 테마)
- **자기 비판 루프** — 선정 결과를 적대적 페르소나(예: Short-biased Analyst)가 반박 → Composite 조정
- **E1 스키마 확장 여부 결정** — `reasoning_trace`·`confidence_distribution` 등 추가 컬럼 필요성 검토 (백워드 호환 고려)
- **예상 세션**: 4~6세션 (설계 2 + 구현 2~3 + 평가 1)

---

## 관련 문서 포인터

- `Document/Service/Report/ReportFramework.md` — Core Committee + Sector Board 페르소나 원형
- `backtest/full_system_backtest_v6.py` — v1 알고리즘 기준선 (CAGR 20.3·Sharpe 0.99)
- `Document/Build/Slices/S5-Automation.md` — M10 배치 엔진 (v1 구현 위치)
- `Document/Build/Slices/S6-Hardening.md` — M17 AI 비용 cap 선행 필수

---

## 블로커

- 재활성 조건 1~4가 전원 미충족 상태. Must 19 완료 전까지 블로커 리스트업 불가.

---

## 리스크

- **비용 폭주** — 30종 × 151 페르소나 × 월 1회 배치 구조가 이미 S6에서 40만원 hardcap 걸림. v2는 여기에 선정 단계 추가 LLM 호출이 쌓이므로 예산 압박 가중. 재활성 조건 3 필수.
- **검증 공백** — LLM 선정 결과가 v1 알고리즘 대비 실제로 나은지 6~12개월 운용 전에는 판단 어려움. 병행 운용(shadow mode) 설계 고려.

---

## 의사결정 로그

- 2026-04-17: 슬라이스 파일 생성. 사용자(어드민)가 S1 착수 시점에 "v2 AI agent 고도화" 의향 표명 → Must 19 밖 보류 트랙으로 박제. S1은 v0 mock으로 계속 진행.

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-17 | 초기 생성. Must 19 밖 엔진 고도화 트랙. 재활성 조건 4가지 박제. |
