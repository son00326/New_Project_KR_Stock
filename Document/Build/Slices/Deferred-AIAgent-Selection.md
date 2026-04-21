# Deferred-Y — **S8 AI 어댑터에 흡수 예정 (2026-04-21)**

> **이 파일은 포인터만 유지**. AI Agent 기반 선정엔진 v2 구상은 **`S8-AutoTrading.md`의 AI 어댑터 embed 경로**로 흡수됨.
>
> 편집·참조는 `Document/Build/Slices/S8-AutoTrading.md`로 진행 (§AI 어댑터 인터페이스 파트).

---

## 흡수 사유 (2026-04-21, D16)

원래 Deferred-Y는 v0(Claude mock) → v1(pykrx+v6 알고리즘) → v2(AI agent 멀티 페르소나)로 Short List 30 **선정엔진**을 고도화하는 트랙이었음. 2026-04-21 D16에서 자동매매(S8)가 Strategy drop-in + AI 어댑터 embed 이중 경로로 확정되면서, "AI agent·skill 본체는 어드민이 추후 drop-in" 원칙이 선정엔진·자동매매 어댑터 **양쪽에 공통 적용**되는 구조가 됨.

즉 v2 AI agent 구현은 별도 슬라이스로 남기지 않고:
- **자동매매 의사결정** → `src/lib/trading/ai/decide-order.ts` 어댑터 (S8에서 인터페이스만)
- **Short List 선정 고도화** → `src/lib/shortlist/ai/select.ts` 어댑터 (S7 이후 동일 패턴 적용 예정)
둘 다 **동일 어댑터 패턴**을 쓰며, 어드민이 각 훅에 agent/skill 파일 drop-in.

---

## 구 Deferred-Y 내용 요약 (이력 보존)

| 단계 | 시점 | 엔진 | 현 상태 |
|---|---|---|---|
| v0 (mock) | S1 | Claude 정성 생성 (v6 로직 관점 30종 fixture) | ✅ 완료 |
| v1 (실데이터) | S5 M10 스케줄러 | pykrx + DART + `backtest/full_system_backtest_v6.py` 알고리즘 실 배치 | ⚪ S7 실데이터 전환 단계에서 처리 |
| v2 (AI agent) | 구 Deferred-Y | LLM 기반 멀티 페르소나·추론 엔진 | ⚪ **S8 AI 어댑터 패턴으로 통일 + 어드민 drop-in** |

**핵심 유지 원칙**: E1 ShortList30 스키마는 엔진 독립적. 엔진 교체에도 UI·DB는 무변경.

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-17 | 초기 생성. Must 19 밖 엔진 고도화 트랙. |
| **2026-04-21** | **S8 AI 어댑터에 흡수 예정**. 별도 슬라이스로 유지하지 않음. 이 파일은 포인터만. |
