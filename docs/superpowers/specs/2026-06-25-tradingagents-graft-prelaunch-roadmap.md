# D33 — TradingAgents graft: pre-launch roadmap (G1~G4 채택 + G5 reject) spec

- **결정일**: 2026-06-25 (USER 결정)
- **결정 라벨**: D33
- **결정자/절차**: Claude↔omxy 토론 CONVERGED → **USER 확정**. 본 세션 = **문서 최신화만(코드 빌드 0)**.
- **상태**: 로드맵 박제(planning). G1~G4 = 출시 전(pre-launch) 빌드/통합 deliverable. G5 = REJECTED(기록만). 구현은 각 항목의 후속 세션.
- **drift-proof**: main HEAD·commit 체인은 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify. (참조 시점 main = B-PARTB merge `ea27656` 이후이며 본 spec은 코드 요구사항이 없다.)
- **불변(supersede 아님)**: MVP 핵심 3종 = ① 30 리스트 ② 포트폴리오 ③ 30 리포트 정확 (65차 USER 잠금). G1~G4는 이 3종을 **대체하지 않고** 출시 전 launch-readiness/품질 레이어로 **추가**된다. §2.2 7-criteria 출시 게이트 = **미변경**(G1~G4는 빌드 deliverable이지 hard launch gate가 아님 — G1/G3 동작·품질은 soft criterion).

---

## §0 Executive summary (토론 outcome)

USER directive: TradingAgents(TauricResearch/TradingAgents) 설계 패턴 중 우리 funnel에 **접목 합의된 후보를 출시 전(pre-launch) 로드맵에 전부 추가**한다. 직전 "출시 후 강추"로 분류했던 #3(Risk 3자 토론)도 **USER가 출시 전으로 이동**시켰다.

**BIG PRINCIPLE (Claude·omxy·USER 동의)** — 채택의 전제이자 영구 가드레일:
1. **per-ticker 토론을 funnel에 직접 이식 금지.** TradingAgents의 종목별 멀티에이전트 토론을 2,500종목 → 150 funnel에 그대로 박으면 비용이 폭발한다. 우리는 **Reflection / 매니저 oversight 패턴만** quant funnel "위"의 검증·학습 레이어로 차용한다. (per-ticker discussion 금지 · manager/reflection oversight layer only.)
2. **150 문제 = retrieval/factor 실패다.** Tier0 B++/B+C 예측 검증 캠페인 = **NO-CONFIG-PASSES / research-CLOSED**. 따라서 **"상승 예측" claim 영구 금지 · production 자동 교체 없음** 원칙은 G1~G4 전부에 그대로 적용된다. B++ funnel은 retrieval 개선(diagnostic) 업그레이드지 예측 게이트 통과가 아니다.

랭크된 후보(5개) — disposition:

| # | 후보 | 귀속 | disposition | 채택 |
|---|---|---|---|---|
| **G1** | Tier0 Reflection Lab (numeric funnel 가중치용 회고 랩) | **신규 pre-launch 빌드 lane** | pre-launch 빌드 + S9 관찰 · **diagnostic only** · champion/challenger **제안만 → USER 승인** · **자동 적용/예측 claim 금지** · JooPick PR-K(D32)와 **다른 층** | ✅ |
| **G2** | Leader-miss "why-excluded" audit (대형 리더 누락 진단) | **기존 Path-A Track-2에 흡수 — 신규 빌드 금지** | pre-launch · 섹터 비교 메뉴에 진단 1줄만 얹음 · **hard-gate live 영구 금지 · forward-validate** | ✅ |
| **G3** | Risk 3자 토론(공격/보존/중립) | **TradingAgents risk_mgmt 차용 — 신규 pre-launch 빌드** | **USER가 출시 후→출시 전 이동(2026-06-25)** · portfolio Accept 전 1회 검토 layer · Q2 자율 포트와 결합 · 비용 중 | ✅ |
| **G4** | 거시/뉴스/예측시장 → AI 컨텍스트 | **S7b 결합** | pre-launch · Tier1 평가/리포트/브리핑 **컨텍스트 입력**으로만 · **Tier0 정량 factor로 직접 쓰지 않음** · forward-validate | ✅ |
| **G5** | Bull/Bear 심층 토론 확대 | 기존 JooPick Q4(실시간 반박 토론 loop)와 중복 | **REJECTED** — 검토 후 채택 안 함(Q4 중복) · 기록만 | ❌ |

sequencing: 기존 pre-launch 순서(S7b→D11→S7c→S7d→[pre-launch 섹터 비교/Tier2 렌더/PR-K Reflection/D4 freeze]→S9→🎉출시)를 **바꾸지 않고** D33 배치를 추가한다: G1/G3 = pre-launch 빌드 lane, G2 = 섹터 비교 메뉴(Path-A Track-2), G4 = S7b lane(§7).

---

## §1 G1 — Tier0 Reflection Lab (1순위, 신규 pre-launch 빌드)

**무엇**: 매달, 과거 `tier0_candidates_150` / `short_list_30` + 실현 수익률을 postmortem 한다 — "어떤 factor·regime이 실현 수익률과 후행적으로 연관됐나 / 대형 리더는 왜 누락됐나"를 분석 → 다음 달 B++ funnel 가중치를 **champion/challenger 후보로 제안**한다.

**가드레일 (4종, 전부 필수)**:
1. **자동 적용 절대 금지 → USER 승인.** 산출 = `champion_config`(대안 가중치) + `challenger_config`(현행 incumbent 가중치) **제안 후보**일 뿐. production B++는 미변경. 채택 = S9 관찰 후 USER 승인(off-cycle), **절대 자동 아님**.
2. **diagnostic only.** "이 가중치가 향후 상승을 예측한다"는 claim 금지. NO-CONFIG-PASSES / research-CLOSED verdict가 상위 제약. 산출/로그에 "예측 게이트 미통과(diagnostic funnel)" 명시.
3. **PR-K Reflection(D32)과 다른 층.** PR-K = Tier1 선정 **prompt**에 직전 학습 주입(페르소나 가중치 자가조정). G1 = numeric **funnel(Tier0 B++) 가중치** 회고. seam은 공유하지 않으며(PR-K=`reflectionContext` prompt seam / G1=별도 funnel-config 회고), 보완 관계다.
4. **B++ production decision logic 불변.** G1은 B++ "위"의 관찰/제안 레이어지 대체 구현이 아니다.

**비용**: 낮음(필요 데이터 — 과거 150/30 + 실현 수익률 — 이미 DB에 있음. 신규 AI inference 최소).

**의존/fail-soft**: 실 선정이 production에서 돌아야 함(USER 게이트 = `SELECTION_CRON_AUTO_ENABLED` + B++ funnel 적용 + 주간 tier0 producer + KRX EOD/`portfolio_snapshot` 실현 수익률). reflection 항목 부재 시 다음 선정은 default(미변경) — no-op fail-soft, 비용/게이트 영향 0.

**timeline**: 출시 전(S7d 이후 ~ S9 진입 전) 빌드 + **S9 운용 검증 기간 중 관찰**. G1 빌드 완료 = sequencing 권장이며, G1 동작·품질 = soft criterion(§2.2 7-criteria 불변).

---

## §2 G2 — Leader-miss "why-excluded" audit (2순위, 기존 Path-A 흡수 · 신규 빌드 금지)

**무엇**: 대형·고유동·섹터 리더 watchlist 종목이 150에서 빠지면 "왜 제외됐나"를 진단하는 리포트(₩0).

**핵심 — 신규 빌드 금지, 기존 자산 흡수**:
- "rescue(구제 주입)"는 **이미 빌드된 Path-A Track-2(`sector-soft-tilt`) + 섹터 추천 비교 메뉴**가 담당한다. G2는 거기에 **why-excluded 진단 한 줄만 얹는다**(UI 표현 추가).
- why-excluded coverage 진단의 데이터 백본 = **이미 구현된 PR-B4 `shadow_reconcile.py`**(`classify_coverage_row` → complete | missing | anomaly coverage REPORT, owner-psql read, ₩0, forward-only·report-only). G2는 이 reconcile 산출 위에 리더 누락 사유 1줄을 표면화하는 보조 표현이지, 별도 새 코드/스키마가 아니다.

**가드레일 (3종, 전부 필수)**:
1. **신규 빌드 금지** — Path-A Track-2 + 섹터 비교 메뉴 흡수. why-excluded는 별도 새 산출물이 아니라 UI 표현 1줄.
2. **hard-gate live 영구 금지** — 진단은 production funnel을 hard-gate로 자동 교체/구제하지 않는다(soft only, 섹터 비교 메뉴와 동일 제약).
3. **forward-validate** — 백테스트 불가(look-ahead), forward-only.

**비용**: ₩0(기존 shadow/reconcile 산출 재사용 + 메뉴 UI 1줄).

**timeline**: 기존 "Pre-launch 섹터 비교 메뉴" deliverable(S7d 완료 후, S9 진입 전)에 포함.

**data dependency (maintenance debt note)**: PR-B 계열 shadow 산출(마이그 0039, dormant) + `shadow_reconcile.py`가 유지돼야 G2 진단이 동작. shadow 테이블 폐기 시 G2 capability 손실 — audit-catalog W-ticket로 보존 권장.

---

## §3 G3 — Risk 3자 토론(공격/보존/중립) (3순위, **USER가 출시 후→출시 전 이동**)

**무엇**: portfolio Accept 전, 30 선정 + 포트폴리오(Q2 AI 자율 구성, 주식 ~12-15종)를 **공격/보존/중립 risk agent**가 검토하는 layer. TradingAgents `risk_mgmt` 3-debator 패턴 차용.

**provenance (drift 방지)**: 직전 분류에서 Claude가 "출시 후 강추"라 했던 항목을 **USER가 2026-06-25 출시 전 lane으로 이동**시켰다(본 D33 결정). 후속 세션에서 "왜 출시 전인가" 재논의 방지용으로 명시 박제.

**범위 경계 (per-ticker 토론 금지 원칙 준수)**:
- TradingAgents risk_mgmt는 매 주문(거래별)마다 평가하지만, **G3는 거래별이 아니라 포트폴리오 구성별 1회**다.
- 적용 지점 = **Tier1 선정 후 portfolio proposal 구성 단계 ~ Accept 전**. 30 후보 중 AI 선택 N≤30 포트를 3자(attack/defend/neutral) risk 토론으로 재평가 → 위험도 재판정(통과/조건부/거절)을 **추가 컨텍스트 layer**로 제공.
- **기존 Accept 게이트(D15·D31)를 대체/오버라이드하지 않는다.** risk 토론 = 부가 컨텍스트지 게이트 substitute가 아니다.

**가드레일**: 예측 claim 금지(NO-CONFIG-PASSES 상위 제약 동일) · Accept 게이트 substitute 아님 · Q2 자율 포트와 결합하되 자동 집행 아님(가상 포트·성능 측정).

**비용**: 중(risk agent 3-debator = 신규 inference, 포트 구성당 1회). USER 비용 승인 게이트.

**데이터 성숙 의존**: 라이브 포트 데이터(D11 첫 Accept 이후) 필요. S9 진입 전 빌드 + 데이터 부족 시 shadow-only 관찰(예측 disabled) fallback.

**timeline**: 출시 전 pre-launch 빌드 lane(D11 이후 ~ S9 진입 전).

---

## §4 G4 — 거시/뉴스/예측시장 → AI 컨텍스트 (4순위, S7b 결합)

**무엇**: FRED 거시 regime + 뉴스 + (선택)Polymarket 예측시장을 Tier1 평가/리포트/모닝 브리핑의 **컨텍스트 입력**으로 사용. S7b(M12a 뉴스 + M11 브리핑)에 묶는다.

**가드레일 (절대선)**:
1. **Tier0 정량 factor로 직접 쓰지 않는다.** FRED/뉴스/Polymarket = **AI 브리핑/평가 context input only**, Tier0/Tier1 screening funnel(B++ cfg)에 **factor injection 금지**. (NO-CONFIG-PASSES 상위 제약 — quant factor로 끌어들이면 research-CLOSED verdict 위반.)
2. **M12a와 범주 분리.** M12a(72차) = per-ticker **자동 제외** 로직(company thesis-break ← per-company 뉴스). G4 = Tier1 평가 **context**(macro/sector 뉴스/regime → bias correction 입력으로만, 자동 제외 트리거 아님). 두 layer는 충돌하지 않는다.
3. **forward-validate** — 예측시장 신호의 적중 claim 금지.
4. S7b 기존 행동 보존 — M12a shadow-first(`M12A_AUTO_REMOVE_ENABLED=false`) + 이메일/Resend 전역 미사용 유지.

**비용**: ₩0(FRED/뉴스/Polymarket = S7b 워크플로 입력 레이어; 별도 standalone LLM agent 추가 시에만 소액).

**timeline**: S7b lane(go-live USER gates 완료 후 S7b 착수 시).

---

## §5 G5 — Bull/Bear 심층 토론 확대 (5순위, REJECTED)

**무엇(검토 대상)**: TradingAgents의 Bull/Bear researcher 심층 대립 토론을 확대 적용하는 안.

**판정 = REJECTED — 채택 안 함.** 사유: JooPick **Q4 실시간 멀티라운드 반박 토론 loop**(D26 Q4, W1a/W1b로 구현됨 — Core 11 병렬 채점 → 실시간 반박 라운드 → judge/dual-judge)와 **중복**. Bull/Bear 심층 대립은 이미 Q4 토론 loop가 커버하므로 별도 빌드 불필요.

본 reject는 audit trail로만 박제(향후 "Bull/Bear는 왜 안 했나" 재발굴 방지). 신규 코드/빌드 0.

---

## §6 가드레일 요약 (전 후보 공통 제약)

- **per-ticker 토론을 funnel에 직접 이식 금지** — Reflection/매니저 oversight 패턴만 funnel 위 레이어로 차용(BIG PRINCIPLE 1).
- **NO-CONFIG-PASSES / research-CLOSED 불변** — Tier0 예측 검증 캠페인 verdict 유지. **"상승 예측" claim 영구 금지 · production 자동 교체 없음**(BIG PRINCIPLE 2). G1 제안·G2 진단·G3 위험 판정·G4 컨텍스트 전부 diagnostic/advisory.
- **hard-gate live 영구 금지(soft only)** — G2(및 섹터 비교 메뉴)는 production funnel을 자동 교체/구제하지 않는다.
- **MVP 3종 불변** — G1~G4는 30리스트/포트/30리포트를 대체하지 않고 launch-readiness/품질 레이어로 추가.
- **§2.2 7-criteria 출시 게이트 미변경** — G1/G3 빌드 = sequencing deliverable, 동작·품질 = soft criterion(hard-block 아님).
- **forward-validate / fail-soft** — 백테스트 불가 항목은 forward-only, 데이터 미발생 시 no-op(게이트/비용 영향 0).

---

## §7 Sequencing & disposition (기존 순서 불변, 배치만)

기존 pre-launch 순서를 바꾸지 않는다:

```
go-live USER gates + S7b(여기에 G4) → D11 → S7c → S7d
  → [pre-launch lane: 섹터 비교 메뉴(여기에 G2) · PR-T2c 렌더 · G1 Reflection Lab · G3 Risk 3자 · PR-K Reflection(D32) · Toss-D4 freeze]
  → S9(1개월+ · G1/G3 동작·품질 soft 관찰) → 🎉 출시(자동매매 제외)
  → [출시 후] S8
```

| 후보 | lane 배치 | 비용 | 예측 claim | 비고 |
|---|---|---|---|---|
| G1 Reflection Lab | pre-launch 빌드(S7d 후~S9 전) + S9 관찰 | 낮음 | 금지(diagnostic) | champion/challenger 제안만→USER 승인 |
| G2 why-excluded | 섹터 비교 메뉴(Path-A Track-2) 흡수 | ₩0 | 금지 | 신규 빌드 금지·hard-gate live 영구 금지 |
| G3 Risk 3자 | pre-launch 빌드(D11 후~S9 전) | 중 | 금지 | USER 출시 후→출시 전 이동·Accept 게이트 substitute 아님 |
| G4 macro/news context | S7b 결합 | ₩0 | 금지 | Tier0 factor 아님·M12a와 범주 분리 |
| G5 Bull/Bear | — | 0 | — | REJECTED(Q4 중복) |

---

## §8 SoT cross-references

- **본 spec = D33 SoT 상세**: `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md` (이 파일).
- **결정 레코드**: `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D33`.
- **runbook 배치 + 다음 할 일**: `Document/Process/HANDOFF.md` §"🎯 다음 할 일" item 9 + §2.2 runbook 표 + §5 SoT 포인터.
- **상위 제약**:
  - D32 Reflection/PR-K: `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md` (G1 ≠ PR-K 층 분리).
  - Tier0 B++/예측 검증 research-CLOSED: `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` 2026-06-19 UPDATE + `docs/superpowers/reviews/2026-06-17-tier0-4config-multiregime-verdict.md`.
  - Path-A 섹터 레이어(G2 흡수 대상): `docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md` + Track2 `2026-06-20-pathA-track2-generator-shadow.md` + PR-B5 `2026-06-22-pathA-track2-prb5-forward-recall-evaluator.md`(PR-B4 `shadow_reconcile.py` precedent).
  - M12a 뉴스 자동 제외(G4 범주 분리 대상): `Document/Service/Planning/ServicePlan-Admin.md §3.10 M12a`.
  - Q4 실시간 반박 토론 loop(G5 reject 사유): `CLAUDE.md ⭐ 65차 D26 Q4` + W1a/W1b 구현(PR #92~#95).
- **MVP 잠금**: memory `project_mvp_engine_4workstreams_2026_06_04` + `CLAUDE.md ⭐ 헤더`.
