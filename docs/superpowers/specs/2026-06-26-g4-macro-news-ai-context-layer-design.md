# G4 — Macro/News → AI Context Layer (S7b 결합) design

- **작성일**: 2026-06-26
- **결정 라벨**: D33 §4 G4 구현 (1차)
- **상위 SoT**: `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md` §4 (G4)
- **branch**: `tier0-bpp-multiregime` (main 자손)
- **drift-proof**: main HEAD/commit 체인은 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify.

---

## §0 목표 (한 줄)

거시(FRED/macro)·뉴스를 distill한 **AI 컨텍스트 입력 레이어(G4)** 를 만들어 S7b 모닝 브리핑 + Tier1 평가 + 30-리포트 writer에 **컨텍스트로만** 주입한다 — **Tier0 정량 factor로 직접 쓰지 않고**, M12a(per-ticker 자동제외)와 **범주 분리**하며, **forward-validate(예측 claim 금지)** 한다. 동시에 S7b 모닝 브리핑 실 경로를 출시 가드레일(이메일/Resend 미사용 = Telegram + `/admin` 2-layer)에 정합화한다.

## §1 가드레일 (절대선 — 코드로 강제)

D33 §4 G4 가드레일을 코드 불변식으로 박는다:

1. **Tier0 factor 금지.** `tudal/src/lib/macro/*` 는 Tier0 스크리닝(`screen_shortlist_tier0.py`, Python — 구조적 분리)에서 **import/참조 금지**. G4 산출물은 **문자열 컨텍스트(string)** 이지 numeric factor가 아니다. 테스트로 박제: 산출 타입에 점수 가중치로 쓰일 수 있는 numeric field가 funnel에 노출되지 않으며, 렌더 문자열은 "Tier0 스크리닝 팩터 아님" 면책을 포함한다.
2. **M12a 범주 분리.** G4 = macro/market **컨텍스트 입력**(bias-correction). M12a(§3.10) = per-company 뉴스 thesis-break **자동 제외**. 별도 모듈·별도 출력 타입(`MacroContext` ≠ per-ticker action). 서로 import 안 함.
3. **forward-validate / 예측 claim 금지.** 렌더 문자열은 "AI 컨텍스트 입력 · 예측 아님" 프레이밍을 포함. "상승 예측"류 어휘 금지. 테스트로 박제.
4. **dormant-by-default.** 전 주입 경로는 단일 flag `MACRO_CONTEXT_ENABLED`(default off) 게이트. **off → 현행 동작 byte-identical**(리포트 macroSummary=`근거 부족`, 브리핑 macro 라인 없음, persona prompt 동일). 활성화(real source + flag)는 **USER-only**(Vercel env).
5. **stale-mock fail-safe.** 현 macro source = mock(`MOCK_INDICATORS`/`MOCK_VERDICT`, asOf 2026-04-11 정적). flag on이어도 source `asOf`가 `maxStaleDays`(기본 7) 초과로 오래되면 `getMacroContextString()`은 `""`(dormant) 반환 → **stale macro가 live 프롬프트로 새는 것 차단**. 렌더 문자열은 `asOf`를 명시해 staleness 가시화.
6. **₩0.** 신규 LLM 호출 0. pure distill + 기존 mock source 재사용. (실 FRED fetch는 source seam drop-in으로 후속, USER 키 게이트.)

## §2 비목표 (명시 후속)

- **M12a AI-persona per-company thesis-break 자동제외 파이프라인** — 대형·AI키 게이트·shadow-first 별도 슬라이스.
- **live FRED HTTP client / Polymarket** — source seam만 제공, 실 source drop-in은 후속(USER 키 게이트).
- **Resend 제거 — silent-health / exit-dispatch** — S7b 범위 밖(note만). 본 PR은 morning-briefing(M11)만.
- **judge 프롬프트 macro 주입** — persona(Tier1 주 평가)에 한정. judge는 후속(이미 reflectionContext 보유).
- G1/G2/G3 (별도 lane).

## §3 아키텍처 (units)

### 3.1 core: `tudal/src/lib/macro/context.ts` (신규, pure, ₩0)
- `type MarketRegime = MarketVerdict["overallSignal"]` (reuse `@/types/macro`).
- `interface MacroDriver { category: string; signal: "bullish"|"bearish"|"neutral"; reason: string }`
- `interface MacroContext { regime: MarketRegime; score: number; headline: string; drivers: MacroDriver[]; asOf: string; source: string }`
- `interface MacroContextSource { indicators: MacroIndicator[]; verdict: MarketVerdict; source?: string }`
- `buildMacroContext(src: MacroContextSource): MacroContext` — pure distill. drivers = verdict.details(상위 N) + 핵심 지표(금리/물가/환율/심리) 파생. headline = verdict.summary 1줄 트림. asOf = verdict.updatedAt(최신).
- `renderMacroContextString(ctx: MacroContext): string` — 결정론적 compact 한국어 문자열. **반드시 포함**: `asOf`, 면책("AI 컨텍스트 입력 · 예측 아님 · Tier0 스크리닝 팩터 아님").
- `EMPTY_MACRO_CONTEXT = ""` (no-op 기본).
- pure: env/now/I-O 0. (테스트 100% 결정론.)

### 3.2 seam: `tudal/src/lib/macro/source.ts` (신규, env + now 경계)
- `getMacroContextSource(): MacroContextSource` — default = mock(`{ indicators: MOCK_INDICATORS, verdict: MOCK_VERDICT, source: "mock" }`). **실 FRED/source drop-in 지점**(주석 박제).
- `isMacroContextEnabled(): boolean` — `process.env.MACRO_CONTEXT_ENABLED === 'true'`.
- `getMacroContextString(opts?: { now?: Date; maxStaleDays?: number; source?: MacroContextSource }): string`
  - flag off → `""`.
  - source asOf가 now 기준 `maxStaleDays`(기본 7) 초과 → `""` (stale fail-safe, §1.5).
  - else `renderMacroContextString(buildMacroContext(source))`.
- 유일한 env/now 경계 = 이 파일. (context.ts는 pure 유지.)

### 3.3 consumers (전부 additive · dormant-default · off→byte-identical)
1. **리포트 writer** — `report-input-enricher.ts`:
   - `EnrichReportInputOptions.buildMacroSummary?: () => string` DI seam 추가. default = `() => getMacroContextString() || NO_BASIS`.
   - `enrichReportInput`이 `macroSummary = buildMacroSummary()` 적용(현 `deriveEnrichFromShortlist`의 NO_BASIS override). off → `getMacroContextString()===""` → `NO_BASIS` (현행).
   - 3 caller(triggerFullReport/regenerate/batch-worker) **무변경**(default 적용).
2. **모닝 브리핑(M11)** — `briefing/compose.ts` + `cron/morning-briefing/route.ts`:
   - `BriefingInput.macroContext?: string` + `formatMacroLine` 추가 → non-empty일 때만 macro 라인 1줄 삽입(empty면 현행 라인 구성 동일).
   - cron: `macroContext: getMacroContextString()` 주입(off→"" →라인 없음).
   - **Resend 제거**: `sendEmail`/`@/lib/email/resend` import + email 분기 + `ADMIN_EMAILS` configError 삭제. 채널 = telegram(best-effort) + dashboard. `generationFailed`는 더 이상 email 실패에 의존하지 않음(telegram best-effort는 finalStatus 불반영, silent-health 정합 유지). `briefing_failed` alert은 telegram best-effort라 발생 조건 재정의(현 email-driven 제거 → dbError만 502). 테스트 갱신.
3. **Tier1 persona(주 평가)** — `screening/persona-eval.ts` + `ai/anthropic-client.ts` + persona prompt render:
   - `callPersona` input에 `macroContextString?: string` 추가. render는 **non-empty일 때만** macro 블록 조건부 삽입(empty → 프롬프트 byte-identical; `{{REFLECTION_CONTEXT}}` 토큰 패턴과 달리 토큰 미추가로 dormancy 보장).
   - `RunMonthlyPersonaEvalInput.macroContextString?: string` 추가. 모든 callPersona 호출에 전달. eval 내부 default = `input.macroContextString ?? getMacroContextString()` → off면 "" → byte-identical. **live 선정 caller 무변경**(eval이 flag를 자체 픽업 → USER flag로 활성).

## §4 데이터 흐름

```
[mock-macro: MOCK_INDICATORS + MOCK_VERDICT]            (실 FRED source drop-in 지점)
        │ getMacroContextSource()
        ▼
buildMacroContext() ──► MacroContext ──► renderMacroContextString() ──► string
        ▲                                          │
   (pure, ₩0)                                       │ getMacroContextString() = flag + stale 게이트
                         ┌──────────────────────────┼──────────────────────────┐
                         ▼                          ▼                          ▼
              report-input-enricher        briefing/compose            persona-eval
              (macroSummary 대체)          (macro 라인)               (callPersona context)
                         │                          │                          │
                         ▼                          ▼                          ▼
               30-리포트 writer prompt      모닝 브리핑 카드/telegram     Tier1 평가 prompt
```

flag off → 세 경로 모두 현행. flag on + fresh source → 세 경로에 동일 distill 컨텍스트.

## §5 에러/엣지

- mock source는 항상 valid → buildMacroContext throw 없음. (실 source는 seam에서 graceful fallback 책임 — 본 PR 범위 밖.)
- `getMacroContextString` 어떤 실패(flag off/stale/source 없음)에도 `""` 반환 = fail-safe dormant. caller는 "" 처리(현행 동작).
- persona render: macroContextString empty → 토큰/블록 미삽입 → 프롬프트 byte-identical (회귀 테스트로 박제).
- briefing: telegram 미설정/실패는 best-effort(현행 silent-health 정합) — finalStatus 불반영.

## §6 테스트 계획 (TDD)

- **context.test.ts**: buildMacroContext distill 정확성(regime/score/drivers/headline/asOf) · renderMacroContextString 면책 3종 포함("예측 아님"/"Tier0 스크리닝 팩터 아님"/asOf) · 결정론(동일 입력=동일 출력) · MacroContext numeric field가 funnel factor로 노출 안 됨(가드레일 박제).
- **source.test.ts**: flag off → "" · flag on + fresh → 면책 포함 문자열 · flag on + stale(asOf > maxStaleDays) → "" (fail-safe) · now/maxStaleDays/source 주입 결정론.
- **enricher**: buildMacroSummary default off → NO_BASIS(현행) · 주입 시 macroSummary 대체 · 기존 enrich 테스트 회귀 green.
- **briefing/compose**: macroContext empty → 현행 라인 동일 · non-empty → macro 라인 삽입 · Resend 제거 후 채널 telegram+dashboard.
- **morning-briefing route**: email 제거 후 configError/finalStatus 경로 재검증 · macroContext off → 라인 없음.
- **persona-eval / callPersona**: macroContextString empty → 프롬프트 byte-identical(회귀) · non-empty → macro 블록 등장 · eval default가 getMacroContextString() 픽업(off→"").
- 게이트: build + lint + test:ci + tsc.

## §7 연결포인트 검증 (success criterion)

- 리포트: enricher → orchestrator(`enriched.macroSummary` → `buildFullReportUserPrompt`) 기존 plumbing 그대로 → flag on이면 macro가 writer prompt에 도달.
- 브리핑: cron → `composeBriefing({ macroContext })` → telegram/dashboard.
- Tier1: `runMonthlyPersonaEval` → `callPersona({ macroContextString })` → render.
- 각 경로에 flag-on/off 경계 테스트로 "도달/미도달" 박제.

## §8 SoT cross-refs

- D33 G4: `docs/superpowers/specs/2026-06-25-tradingagents-graft-prelaunch-roadmap.md` §4.
- M11/M12a: `Document/Service/Planning/ServicePlan-Admin.md §3.10`.
- Runbook 배치: `Document/Process/HANDOFF.md` §"다음 할 일" item 5 + §2.2 Step 7 S7b.
- 상위 제약(NO-CONFIG-PASSES/예측 금지): `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` 2026-06-19 UPDATE.
