# W3b-3 — admin UI: AI 포트 제안 버튼 + 제안 표시 (프론트 슬라이스) Implementation Plan

> REQUIRED SUB-SKILLS: superpowers:test-driven-development(순수 헬퍼) · gstack 디자인/브라우저 스킬(UI 판단·연결 검증). 컴포넌트 테스트는 AGENTS.md상 USER 확인 필요 → 연결 검증은 build/lint/tsc + 헬퍼 Vitest + **gstack 브라우저 QA**로 수행(컴포넌트 유닛 테스트 추가 안 함).

**Goal:** W3b-1/2a/2b로 완성된 백엔드(생성→영속→Accept weight)를 admin이 화면에서 쓰도록 **UI를 붙인다**: ① `proposePortfolio` 트리거 버튼 ② 생성/영속된 제안 표시(종목·비중·현금·근거). **Accept 통합은 W3b-2b로 이미 완료**(flag on이면 기존 Accept 버튼이 proposal weight 자동 소비) → W3b-3은 Accept UI 무변경. **money-path 무접촉**(읽기·표시·기존 server action 호출만).

**Architecture:** W3b = W3b-1✅/2a✅/2b✅(백엔드) / **W3b-3(UI, 이 계획)** / W3b-2c(명시 cash row, 선택). page.tsx(server component)가 `getProposalByMonth`로 영속 제안 로드(모든 throw를 catch → `null`) → `PortfolioPanel`(client island)에 **직렬화 가능한 plain prop**(`PersistedPortfolioProposal | null` + ticker/name/sector view model) 주입 → 표시. 버튼은 client island에서 `proposePortfolio`(server action, 완결)를 useTransition 호출(기존 accept/reject/triggerMonthlyBatch 패턴 동형). 성공 시 action 반환 proposal을 로컬 상태로 즉시 Dialog 표시하고 `router.refresh()`로 영속 read-only 카드 갱신. **순수 헬퍼(format/enrich/summary)는 분리해 Vitest**, 컴포넌트는 build/lint/tsc + 브라우저 QA.

**Tech Stack:** Next.js 16 App Router(server/client 경계 — 기존 패턴 미러) · shadcn/ui(Dialog/Card/Badge; **Table 없음 → grid 레이아웃**) · Tailwind v4 · Vitest(순수). gstack 디자인/브라우저 스킬.

**SoT:** HANDOFF ⭐ 65차 W3(D26 Q2) + W3b-2b entry. 설계 스코프 = Workflow `wf_dc01f2b0-692`(3-dim: 진입점/표시/Accept). main `65d6a9d` 기준.

> R28 적대 검토 반영: **HIGH 1 / MED 4 / LOW 1, ESCALATE 0**. 핵심 수정 = page load catch 범위 확장(페이지 crash 금지), route-local 표시 컴포넌트(YAGNI), serializable/view-model prop, propose 성공 refresh, 브라우저 QA auth precondition, backend diff gate 구체화.

---

## 범위 (W3b-3) vs 분리
**W3b-3 (이 계획):**
1. 순수 헬퍼: `src/lib/admin/format-portfolio.ts`(formatProposalWeightPct/formatTimeframeLabel) + `src/lib/portfolio/proposal-view.ts`(enrichProposalPositions[shortlist name/sector 조인] + computeProposalSummary[positionCount/equityWeightPct/cashPct]). **Vitest.**
2. `src/app/(admin)/admin/portfolio/proposal-display.tsx`(route-local, client-compatible): PortfolioProposal + shortlist view model 받아 종목 grid(코드·이름·비중%·timeframe) + 현금% + rationale 표시. `src/components/admin/portfolio/` 새 global namespace는 만들지 않음(YAGNI; 현 repo에 해당 디렉터리 없음, live caller 1개).
3. `portfolio-panel.tsx` 수정: ModalKind `"propose"` 추가 + "🤖 AI 포트 제안 받기" 버튼 + `handlePropose`(proposePortfolio useTransition) + BannerState `propose_done`/error + 결과 Dialog(proposal-display 렌더). 성공 결과는 `generatedProposal` 로컬 상태에 보관해 즉시 표시하고, `router.refresh()`로 영속 카드 갱신.
4. `page.tsx` 수정: `getProposalByMonth({month})` 로드(try/catch — `proposal_schema_missing`, `portfolio_proposal_parse_failed:*`, `proposal_persist_failed:*`, 기타 select/lookup throw 전부 catch → `null`) → PortfolioPanel `persistedProposal` prop 주입(영속 제안 read-only 카드). raw error를 client prop/bundle에 넘기지 않음.
5. 연결 검증: build/lint/tsc + 헬퍼 Vitest + **gstack 브라우저 QA**(admin portfolio 렌더 + 버튼 존재 + flag-off=proposal_disabled 메시지). QA 전제/차단 조건: allowlisted admin 세션/환경이 없으면 browser QA를 “BLOCKED: auth/env unavailable”로 명시하고 상호작용 검증을 GREEN으로 주장하지 않음.

**분리(후속 DEFER):** W3b-2c(명시 cash row + status) · regenerate 전용 UX(현 버튼 재클릭=재생성 upsert로 충분) · Accept 모달 내 proposal 재표시(선택).

**범위 밖:** 백엔드(proposePortfolio/loadProposalForAccept/buildInitialSnapshots/format-error) 무변경 · 실 AI 가동(USER flag) · 컴포넌트 유닛 테스트(AGENTS.md USER 확인).

## 핵심 설계 결정
- **D1 단일 슬라이스(헬퍼+컴포넌트 함께).** 순수 헬퍼만 먼저 빌드 시 dead code → 컴포넌트가 즉시 소비하도록 한 슬라이스. Accept 통합은 W3b-2b 완료 → UI 변경 0.
- **D2 server/client 경계(Next.js 16, 기존 패턴 미러).** page.tsx(server) = getProposalByMonth 로드(읽기, cost 0) + 모든 throw catch 후 `persistedProposal=null`. PortfolioPanel(client island "use client") = proposePortfolio useTransition 호출(기존 accept/reject 동형) + setBanner. client prop은 `PersistedPortfolioProposal | null`의 plain object와 `{ticker,name,sector}` 배열만(함수/Date/Supabase client/Error 객체 전달 금지). **AGENTS.md: 신규 라우팅/서버액션 패턴 도입 0**(기존 검증된 패턴 재사용 — proposePortfolio는 이미 server action).
- **D3 UI 구성(gstack-design 판단).** 버튼 = admin 액션 영역(Accept/Reject 근처), 라벨 "🤖 AI 포트 제안 받기". 클릭 → pending → 결과 Dialog: 종목 grid(코드+이름+비중%+timeframe 배지) + 현금 비중 + rationale 텍스트. 영속 제안 존재 시 page.tsx가 read-only 요약 카드("현재 AI 제안: N종목 · 현금 X% · [보기]") 노출. 새 표시 컴포넌트는 route-local(`app/(admin)/admin/portfolio/proposal-display.tsx`)로 두고, shadcn Table 부재 → `<div className="grid ...">` 레이아웃.
- **D4 behavior-neutral.** 버튼/표시는 항상 렌더되나 실 동작은 **백엔드 게이트가 결정**: flag off → proposePortfolio가 `proposal_disabled` 반환 → formatErrorMessage 한국어 배너. 즉 UI 추가가 production 동작을 바꾸지 않음(버튼 눌러도 게이트 미충족 시 안내만). money-path·cost 무접촉.
- **D5 순수 헬퍼 분리(testable vs browser).** format/enrich/summary = pure → Vitest(AGENTS.md 허용). 컴포넌트 = build/lint/tsc(타입 wiring) + gstack 브라우저 QA(시각·상호작용). 컴포넌트 유닛 테스트 추가 안 함(AGENTS.md USER 확인 — 브라우저 QA로 대체). 헬퍼 live caller는 route-local `proposal-display.tsx` 1개 이상으로 확인해 dead code를 금지.
- **D6 연결 검증(필수, 사용자 명시).** ① build/lint/tsc ALL GREEN(컴파일 wiring) ② 헬퍼 Vitest ③ gstack 브라우저: `npm run dev` 또는 Vercel에서 allowlisted admin 로그인(기존 Supabase/admin env 필요) → /admin/portfolio 렌더 + 버튼 존재 + (가능 시) 클릭→Dialog + flag-off proposal_disabled 한국어 표시 확인. admin 세션/환경이 없으면 QA 결과를 BLOCKED로 기록하고 대체로 GREEN 처리하지 않음. ④ 백엔드 무변경 diff 0.
- **D7 error 표시.** format-error 이미 완결(proposal_disabled/parse_failed/unknown_ticker/shortlist_incomplete/cost_*/ai_call_failed[:transient]/proposal_schema_missing/persist_failed/stale/lookup). 신규 매핑 0. 버튼/action error는 PortfolioPanel `formatErrorMessage` 경유. page load의 `getProposalByMonth` error는 사용자 배너가 아니라 표시 생략(`null`)로 처리해 기존 화면을 보존하고 raw code를 노출하지 않음.

## File Structure
**신규:** `src/lib/admin/format-portfolio.ts`(+`__tests__`) · `src/lib/portfolio/proposal-view.ts`(+`__tests__`) · `src/app/(admin)/admin/portfolio/proposal-display.tsx`.
**수정:** `src/app/(admin)/admin/portfolio/portfolio-panel.tsx`(버튼+모달+handler+generatedProposal state) · `src/app/(admin)/admin/portfolio/page.tsx`(safe getProposalByMonth 로드+serializable prop).
**무변경:** actions.ts · format-error.ts · admin-proposals.ts · 백엔드 전부 · 0016 RPC · 마이그.

## Tasks
- **T0 가드**: branch + portfolio-panel.tsx 버튼/모달 패턴 + page.tsx PortfolioPanel props + getProposalByMonth 시그니처 확인. `PortfolioProposal` import 경로는 `@/lib/ai/portfolio-proposal-client`, `PersistedPortfolioProposal`은 `@/lib/data/admin-proposals`. `src/components/admin/portfolio/` 부재 확인 후 route-local component 선택 유지.
- **T1 (TDD) 순수 헬퍼**: format-portfolio(weight 0.3→"30.0%", timeframe short/mid/long→"단기/중기/장기") + proposal-view(enrichProposalPositions: positions+`{ticker,name,sector}` shortlist view model→name/sector 조인, 미존재 name=ticker fallback / computeProposalSummary: count·equityPct·cashPct; 0.99~1.01 tolerance 표시 안정성). Vitest red→green→tsc. commit.
- **T2 컴포넌트 + wiring**: route-local proposal-display.tsx(grid 렌더) + portfolio-panel.tsx(ModalKind propose + 버튼 + handlePropose + Dialog + `generatedProposal` state + success 후 `router.refresh()`) + page.tsx(`loadPersistedProposalSafe` 또는 동등 try/catch로 getProposalByMonth all-error catch + persistedProposal prop + active `thisMonthItems`에서 `{ticker,name,sector}` view model prop). build/lint/tsc. commit.
- **T3 연결 검증 + DoD**: build/lint/test:ci/tsc ALL GREEN + 백엔드 무변경 diff 0(`git diff --exit-code -- 'tudal/src/app/(admin)/admin/portfolio/actions.ts' tudal/src/lib/admin/format-error.ts tudal/src/lib/data/admin-proposals.ts tudal/supabase/migrations`) + **gstack 브라우저 QA**(admin /admin/portfolio 렌더 + 버튼 + flag-off 안내; auth/env 없으면 BLOCKED로 기록) + 헬퍼 live caller(`rg "enrichProposalPositions|computeProposalSummary|formatProposalWeightPct" 'tudal/src/app/(admin)/admin/portfolio/proposal-display.tsx'`) ≥1. commit.

## 검증 게이트 (DoD)
- ALL GREEN(build 26+ routes/lint 0·0/test:ci +헬퍼/tsc) + 백엔드 diff 0(위 T3 command) + 헬퍼 live caller ≥1.
- `getProposalByMonth` page load 안전: schema_missing/parse_failed/persist_failed/lookup 계열 throw가 있어도 /admin/portfolio Server Component crash 0, persisted card만 미표시.
- client boundary 안전: Error/Supabase client/Date 인스턴스 없이 plain persisted proposal + `{ticker,name,sector}` 배열만 PortfolioPanel에 전달.
- **연결 검증(사용자 명시)**: gstack 브라우저로 admin portfolio 화면 + 버튼 렌더 + flag-off=proposal_disabled 한국어 + (실 AI는 USER flag/키 후 별도). admin auth/env unavailable이면 QA BLOCKED로 보고하고 연결 검증 GREEN 주장 금지. 컴포넌트 유닛 테스트는 AGENTS.md상 추가 안 함(브라우저 QA 대체).
- 실 AI 0 · cost 0(UI는 읽기/표시 + 기존 게이트된 server action 호출).

## Execution Handoff
§2.0a + 사용자 명시: plan ①Claude→②omxy 검토→③omxy direct-edit→④Claude 검증 → impl(프론트 스킬 적용) → 배선 교차감사(Claude Workflow + omxy blind) → **연결 검증(gstack 브라우저)** → 머지 → docs-sync. omxy 변경분 전부 커밋·푸시. 프론트 = gstack 디자인/브라우저 스킬 each 판단 적용.
