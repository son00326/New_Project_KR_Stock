# D32 — Reflection / PR-K (AI 자가 학습) 출시 전 승격 spec

- **결정일**: 2026-06-24 (USER 결정)
- **결정 라벨**: D32
- **상태**: 결정 박제 완료 (① Claude docs draft). 이후 = ② omxy catch-only 검토 → ③ Claude 적대적 재검토 (HANDOFF §2.0a plan-stage 워크플로). 구현 = 후속 세션.
- **supersede 대상**: 62차(2026-06-02) Claude 문서정합 분류 "Reflection/PR-K = 출시 게이트 아님 / S9·go-live 후 defer" + 65차(2026-06-04) item-8(Q5) 꼬리문장 "PR-K Reflection은 별도 defer 유지".
- **불변(supersede 아님)**: MVP 핵심 3종 = ① 30 리스트 ② 포트폴리오 ③ 30 리포트 정확 (65차 USER 잠금). Reflection은 이 3종을 **대체하지 않고** 출시 전 launch-readiness 항목으로 **추가**된다.

---

## 1. 결정 (What)

AI 자가 학습 = **Reflection / PR-K**(매 선정 사이클의 실현 성과 → 다음 선정 prompt 주입 → 페르소나 가중치 자가조정, TauricResearch/TradingAgents `trading_memory.md` 패턴)을 **"출시 후 defer" → "출시 전 빌드 + S9 운용 검증 기간 중 실가동·검증"** 으로 승격한다.

- **빌드**: 메커니즘(reflection_log 영속 + track별 회고 job + 다음 선정 prompt 주입)을 **출시 전**(S7d 이후 ~ S9 진입 전)에 구현한다.
- **가동·검증**: **S9 운용 검증 기간(어드민 3인 1개월+)** 동안 실제로 돌려 학습 루프가 작동하는지 검증한다. 출시 시점엔 "이미 작동하는 자가학습"이 된다.

## 2. 근거 (Why)

1. **"출시 후" 라벨의 출처가 USER 명시 결정이 아님.** git 추적 결과 "출시 게이트 아님 / S9·go-live 후 defer" 문구는 **62차(2026-06-02) Claude 문서정합(docs sync) 커밋** `8fc91d4`·`2809f0e`에서 처음 등장했고, omxy 교차검증을 거친 **문서 분류**였지 USER가 "출시 후로 미루자"고 명시 결정한 기록이 아니다. 65차(2026-06-04) MVP 잠금 때 부속 문장으로 딸려 굳어졌다. (도입 시점 2026-05-08 D19/35차엔 "S7a 후속 PR"로, 당시 슬라이스 순서 S7a→…→S9→출시에서 후속 PR은 자연히 **출시 전 구간**에 위치했다 → USER 기억과 일치.)
2. **데이터 의존성은 S9 창이 충족한다.** Reflection의 가치는 "직전 기간 실현 수익률 → 다음 기간 prompt"라서 실 운용 데이터가 누적돼야 의미가 생긴다. 출시 직전 **S9 운용 검증(1개월+ 실 선정 운용)** 이 바로 그 데이터 창을 제공한다 → 출시 시점엔 이미 1+ 사이클 회고가 검증된 상태.
3. **안전성**: 공개 출시 후 급조하는 것보다, S9 검증 기간에 학습 루프의 동작·비용·품질 영향을 관찰하고 출시하는 편이 안전하다.

## 3. 범위 경계 — Q5 incumbent thesis(D27)와 여전히 별개

| | **PR-K Reflection (D32, 출시 전 빌드+S9 검증)** | **Q5 incumbent thesis 재점검 (D27, MVP·구현됨 PR #91)** |
|---|---|---|
| 시점 | 전체 회고 — track별 주기(주1/월1, 65차 Q1 반영), 선정 사이클 종료 후 | 선정 시점 per-incumbent (재선정 직전) |
| 대상 | 페르소나 가중치 자가조정(누적 실현 성과 → prompt context) | 기존 보유 종목의 논거 유효성 재점검(유지=top10 경쟁) |
| 산출물 | reflection_log(월/주별 페르소나별 적중률·평균 실현 수익률·prompt context 스냅샷) | W2 후보풀 fresh∪incumbents + W1 토론 주입 |
| 코드 | `reflectionContext` seam **+ 별도 reflection_log + 회고 job** | `reflectionContext` seam 재사용(명칭=incumbent thesis context) |

⚠️ 두 항목은 `reflectionContext` 코드 seam을 **공유**하나 별개다. 코드에 reflectionContext가 보인다고 PR-K가 구현된 것이 아니다(현재 빈 문자열 주입 + Q5만 사용). 혼동 금지.

## 4. 빌드 아웃라인 (구현 세부는 ② omxy + ③ Claude 검토 후 확정)

- **신규 영속**: `reflection_log` 테이블 — 월/주별, 페르소나별 적중률·평균 실현 수익률·주입한 prompt context 스냅샷. M17 비용 추적(cost_log)과 분리. 마이그 번호는 현재 최신 0037 다음(0038~). dormant default-OFF flag(예: `REFLECTION_ENABLED`) 권장.
- **회고 job**: track별 주기(단기 주1회 / 중·장기 월1회, 65차 Q1) — 직전 사이클 추천 종목의 실현 수익률(KRX 실데이터) 산출 → 페르소나별 적중·실패 케이스 추출.
- **주입**: 다음 선정 토론(W1 경로) prompt에 "직전 학습" 컨텍스트 주입 — `reflectionContext` seam 재사용. Q5 incumbent context와 충돌하지 않게 명칭/슬롯 분리.
- **의존**: 실 선정이 production에서 돌아야 함(USER 게이트 = `SELECTION_CRON_AUTO_ENABLED` + AI 키 + B++ funnel 적용 + 주간 tier0 producer + KRX EOD/`portfolio_snapshot` 실현 수익률 소스). 첫 의미있는 회고 = 직전 사이클 종료 후.
- **트랙별 회고 타이밍 (omxy R1 catch — S9 길이 의존성)**: 단기(주1회)는 S9 내 여러 회고 사이클이 빠르게 생김 → S9 중 검증 용이. 중·장기(월1회)는 S9 시작일·첫 선정 기준일에 따라 S9가 ~2개월 미만이면 회고 사이클이 1회도 안 생길 수 있음 → 중장기 Reflection "출시 시 작동" 보장은 S9 기간 길이·첫 선정일에 의존. **약식**: 단기 트랙 회고를 S9 중 우선 검증(최소 1사이클), 중장기는 데이터 누적 시점을 빌드 시 job 스케줄 + 첫 선정 기준일로 못박는다. cron-live/KRX/snapshot 미가동 시 회고는 빈 입력(no-op)으로 fail-soft.

## 5. 시퀀스 상 위치

```
… S7c → S7d → (Pre-launch 섹터 비교 메뉴 + Tier2 배선 + D4 freeze)
       → [신규] PR-K Reflection 빌드 (S9 진입 전)
       → S9 운용 검증 (어드민 3인 1개월+ · §2.2 7 criteria · ★ S9 중 Reflection 실가동·검증)
       → 🎉 출시 (이미 작동하는 자가학습 포함)
       → [출시 후] S8 자동매매
```

## 6. ② omxy / ③ Claude 검토용 Open questions

1. **게이트 강도 (omxy R1 정합 — 분리 확정)**: **(a) PR-K *빌드 완료* = S9 진입 sequencing 선행조건** — S9 전에 메커니즘이 준비돼 있어야 S9 중 가동 가능(hard sequencing prereq). **(b) Reflection *동작·품질* = soft launch criterion** — §2.2 7-criteria 잠금 미변경, Reflection 버그/미성숙이 출시를 hard-block 하지 않음(S9 중 가동·관찰이 목표). 즉 "빌드는 S9 entry gate, 작동 검증은 soft evidence"로 분리. 단기 트랙 회고가 S9 내 최소 1사이클 도는 것을 soft 목표로 둔다. (잔여 open = §2.2에 명시적 soft 항목 텍스트를 넣을지 여부 — USER 선택, 본 draft는 미삽입.)
2. **빌드 시점 정밀화**: "S7d 이후 ~ S9 진입 전" 한 슬롯이 적절한가, 아니면 D11(첫 가동) 직후 선행 빌드해 D11~S9 데이터까지 누적할지.
3. **주기**: 65차 Q1 track 분리(주1/월1) 하에서 Reflection 주기의 최종값(short=주1 회고? mid·long=월1 회고?).
4. **reflection_log 스키마 확정 컬럼** + RLS/grant(신규 SECURITY DEFINER 시 revoke public/anon + grant authenticated/service_role 패턴, [[feedback_supabase_security_definer_pattern]]).
5. **비용**: 회고 job의 LLM 호출 비용(실현 수익률 산출은 무비용 KRX, 페르소나 케이스 추출·요약은 LLM) → hardcap 50만 reservation 산식 반영 여부.

## 7. 영향 파일 (docs draft 단계)

- `CLAUDE.md` — 상단 header chain D32 마커 + line 44 현재-상태 + line 52 출시 시퀀스 + D32 불릿.
- `Document/Process/HANDOFF.md` — §2 Runbook 표(line 159 [defer] 행 → 출시 전 빌드 행 재배치).
- `Document/Service/Report/ReportFramework.md` — §8 Step 4 후속 defer 노트(line 793).
- `Document/Service/Planning/ServicePlan-Admin.md` — Status(v2.8) + §1A.5 D32 신규 행 + D27 행 "defer 유지" 클로즈 정정 + §8 v2.8 changelog.
- `Document/Build/Slices/S7-RealData.md` — T7a.10(line 125) defer→출시 전.
- (역사적 baseline은 보존: ProgressDashboard 62/64차 baseline·"이전 갱신"·v3.1 박제, ReportFramework v2.2 changelog, ServicePlan-Admin D19/v1.8/v2.2 changelog 등 — 날짜 스냅샷이라 미수정.)
