# HANDOFF — 주픽 (JooPick)

Last updated: 2026-06-19 (**Tier0 스코어링 캠페인 완결 + B++ production 적용 결정 — 다음 세션 #1 = "B++을 production Tier0 150-scorer로 적용(150→Tier1 AI 30)", 범위 Claude↔omxy CONVERGED, §"다음 할 일" ★ 블록이 self-contained 실행 가이드**. 캠페인 전체(전부 CONVERGED·frozen 무손상·production 미접촉·AI 0·`--apply` 0): ① frozen 4-config×3-regime = NO-CONFIG-PASSES · ② **tradable-winner-denominator(공정 분모) = ALL-12-FAIL — 분모는 장벽 아님**(`docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md`) · ③ **combination 캠페인(P0 kill-switch + P1 차트-reserve + P3 regime-horizon + P5 regime-earnings + B++ ref) = 전부 FAIL, 어떤 조합도 B++ 미개선**(`docs/superpowers/2026-06-18-tier0-combination-campaign.md`). **결론: B++(trend+size)이 최선의 진단 funnel — 무료 데이터로는 게이트 통과 예측 스킬 부재, 재조합/직교/조건부/공정분모 무엇도 미개선.** USER 결정 = B++을 production funnel로 적용(예측 claim 아님, funnel 업그레이드). 남은 예측-맥락 후보 = 무료 애널리스트 컨센서스→AI 입력(BACKLOG A, `docs/superpowers/2026-06-19-free-analyst-consensus-ai-input.md`). 직전 77차 — **Tier0 B++ step-2 삼중 게이트 harvest 실행 완료 → triple-gate FAIL → Claude↔omxy CONVERGED → harness MERGED(PR #122, main `285339a`)**: 실 19개월 PIT(순수 trend+size, 비용 0) = Gate A FAIL(recall 0.108<0.20 단 **B++>baseline + largemid 0.431 + leaders 7/11**[73차 1/11]) · Gate B ADJUDICATE(IC IR 0.26<0.30, large-IC +0.08) · Gate C PASS. **B++ = 대형 retrieval 개선 실증 + baseline 상회하나 절대 예측 임계 미달 → diagnostic leader-inclusive generator(이 77차 시점의 --apply/Tier1/"상승 예측" 금지·미실행 및 full-factor-vs-diagnostic 선택은 이후 full-factor+tradable+combination 캠페인 종합 후 USER B++ funnel 적용 결정으로 SUPERSEDED; "상승 예측" claim 금지는 유지).** 직전 — **Accept go-live ✅ DONE(MVP② 완료, 2026-06-12 10:11 KST: approval accept·is_final + snapshot 14행 실 entry_price)** ← **Accept-gate 내부도구 완화 D31 ✅ MERGED(PR #120)·production 배포**(D+4 Hold·2인 열람 면제, 24h hold만; env `PORTFOLIO_ACCEPT_GATE_STRICT`로 strict opt-in; relaxed면 viewer/auto-relief DB 조회 skip; omxy R1~R2 CONVERGED)로 버튼 활성 → USER 클릭 영속 + **B-SEL-CRON fix ✅ MERGED(PR #118)** + **Accept-gate de-mock fix ✅ MERGED(PR #119)**(viewer 게이트 legacy mock 5종 하드코딩 제거→active 전종목 공유모듈 단일화 + page/action anchor 통일 + 2026 달력 근로자의날·제헌절 + UX) + **shortlist 재시드 진행 중**(DART quarterly 캐시 5482 무효화 + 16 sector override commit `2a66a95` + Tier0 dry-run b89통과 150후보 검증; 삼성전자 미진입) + **스코어링 방법론 2차 토론 CONVERGED → B++**(실증: production 150 대형 주도주 10/11 누락 → B+ 단독 REJECT. Claude 퀀트 + omxy 2 독립 수렴, main Opus 종합. 근본원인=구조적 retrieval 실패[지속추세 시그널 부재+소형주 편향]). **Tier0 스코어링 B++ 1차 구현 + 삼중 게이트 harness ✅ MERGED(PR #121 code-merge `8110e8c`)** — Claude 1차+self-review → omxy review/fix(R1·R2) → Claude 적대 review(R1·R2) cross-model 수렴(양쪽 CONVERGED), python unittest 115→225, survivorship probe PASS, **코드만(`--apply` hard-block·legacy default·AI 비용 0)**. **step-2 harvest 실행 완료 → triple-gate FAIL(상단 박제) → 이 시점의 다음 선택(full-factor rerun vs keep-diagnostic)·--apply/Tier1 보류는 이후 캠페인 종합 후 USER B++ funnel 적용 결정으로 SUPERSEDED(예측 claim 금지는 유지).** (Gate C smoke ✅ PASS[실 KRX 2197 dry-run·비용 0: 60/60/30·Small 20%·11-leader 5/11 incl 삼성전자, 73차 1/11 대비] — §6.) Accept go-live(USER #1) = ✅ DONE(MVP②)). 직전 76차 — shortlist 정확성 fix ✅ MERGED(PR #114).

> **이 파일 하나로 다음 세션이 진입 가능하도록 작성됨.** SHA·라운드 수·commit 체인은 self-drift 위험이 크므로 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify. 완료된 차수의 상세 박제·배선 교차감사 기록은 **git log + PR body + memory**에 위임하고 본 파일엔 남기지 않는다.

---

## 🎯 다음 할 일 (출시까지 남은 작업 — 순서대로)

> "HANDOFF.md 보고 이어서 진행" = 아래 1번부터 순서대로. 각 항목 옆 [SoT]가 상세 위치. USER 게이트는 §3, 출시 Runbook 상세는 §2.2.
>
> **▶ 지금 당장 (owner별):**
> - **★ [다음 세션 #1 · CLAUDE 코드 + USER 게이트] B++을 production Tier0 150-scorer로 적용 (150 → Tier1 AI 30) — Claude↔omxy 범위 CONVERGED(2026-06-19)**:
>   - **프레이밍(load-bearing, 정확히 이 문구)**: B++는 **현재 가용한 최선의 retrieval/운영 funnel**이며 **73차 incumbent 대비 관측 진단/leader 포착 개선**(harvest leaders 7/11 vs 73차 1/11(Gate C smoke 5/11) · largemid recall 0.43 · recall 0.108 > baseline_equal 0.107[관측] · large-IC +0.08). **단 frozen 예측 게이트는 미통과**(NO-CONFIG-PASSES; tradable-denominator ALL-12-FAIL; combination 캠페인 P0/P1/P3/P5 전부 FAIL·어떤 조합도 B++ 미개선). → **B++ 적용 = funnel 업그레이드(73차→B++)지 "예측" 검증/claim 아님.** AI 위원회 + 사람이 실제 선정. "상승 예측"·decision-grade claim 금지 유지.
>   - **production scorer = cfg1 = trend+size, foreign/DART OFF** (검증된 config; cfg3/cfg4식 입력 금지 — 데이터품질 리스크 재개 방지. Gate C smoke foreign fail-soft도 trend+size 단독이 의도).
>   - **G1 [CLAUDE 코드 + USER --apply]**: `scripts/screen_shortlist_tier0.py`의 `run_bpp_candidates()` 내 `if args.apply:` HARD-BLOCK(`--scoring bpp + --apply` abort, ~line 1338 — **line drift 가능, 실행 시 `grep -n "ABORT.*--scoring bpp\|삼중 게이트" scripts/screen_shortlist_tier0.py`로 정확 위치 재확인**)을 **"USER 운영 funnel 승인"** 근거로 완화 — `approval_basis=USER_PRODUCTION_FUNNEL_DIAGNOSTIC` provenance 필드 추가 + 출력에 **"predictive gate NOT passed (NO-CONFIG-PASSES); B++ applied as diagnostic operations funnel by USER product decision"** 명시 + 그 hard-block 주석을 "block until triple-gate ALL PASS"에서 USER-funnel-승인 근거로 갱신. **rollback 선행 필수**: --apply 전 현 `tier0_candidates_150`(2026-06) + `short_list_30`(2026-06-01, 73차 선정)을 CSV/SQL 백업(파티션: tier0_candidates_150=month키, short_list_30=month+is_latest). → 그 뒤 USER가 `--scoring bpp --apply`로 tier0_candidates_150[B++] write.
>   - **STOP. G2 확정 전 Tier1 실행 금지.** G1 후 반드시 검수: 150 counts/provenance(approval_basis)/diagnostic 라벨/leader 포착 확인.
>   - **G2 [USER 별도 승인]**: 위와 **별개 명령**으로 Tier1 AI 재선정(150[B++] → 30, ~₩25k) → `short_list_30` 갱신. (G1 DB write와 G2 유료 AI를 한 번에 묶지 말 것.)
>   - **SoT**: B++ 설계/게이트 = `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` §6 + 캠페인 결과 = `docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md` §8 + `docs/superpowers/2026-06-18-tier0-combination-campaign.md` §7. B++ 코드 = `scripts/tier0_factors.py`·`screen_shortlist_tier0.py --scoring bpp`(`run_bpp_candidates` line 1324~). 적용 = §2.0a Claude↔omxy 루프 + 게이트(build/lint/test:ci/tsc).
> - **[BACKLOG (A) · 출시 후/S7b 인근 · 비용 0]** 무료 애널리스트 컨센서스(네이버·한경) → W1 AI 토론/30 리포트 *컨텍스트 입력*(정량 funnel 팩터 아님). 유료 PIT는 권장 안 함(3인 도구 과투자). SoT = `docs/superpowers/2026-06-19-free-analyst-consensus-ai-input.md`. **놓치지 말 것** — 무료 데이터 정량 영역 소진 후 남은 유일한 예측-맥락 후보.
> - **[✅ DONE · CLAUDE 자율 · 비용 0] B+C full-factor 다중장세 4-config 검증 완료 → VERDICT: NO-CONFIG-PASSES (Claude↔omxy CONVERGED)**: DART PIT 백필 **44,300/44,300 완료**(ok 37,761/no_data 6,530/schema_empty 9, 로컬 `scripts/out/dart_backfill.jsonl`, production 미접촉) → 4 config(①추세+크기 ②+외국인 ③+실적 ④+전부) × 3 장세(2022 약세·2023 회복·2024-25 강세) = **12 harvest 실행** → 동결 결정규칙(`tier0-multiregime-freeze`) 적용 = **전 12셀 Gate A FAIL → NO-CONFIG-PASSES**. **핵심 발견**: (a) Gate A recall이 binding 실패(max 0.112 « floor 0.20, 구조적 44% 미달; 추가 팩터가 recall 오히려 ↓) (b) **earnings가 IC 레이어 최강 신호**(recovery IC mean 음→양 flip, bull cfg1 +0.386→cfg4 +0.716) 지만 retrieval floor 못 넘김 (c) IC 장세의존=momentum 베타지 robust alpha 아님 (d) size-neutral skill CI 0/36 → **"Tier0 = leader-inclusive 깔때기, 예측 스킬 미검증" 확정, --apply/Tier1/'상승 예측' 전부 금지(no-apply, D30 재확인)**. data-quality VALID(earnings ~44% 실주입·foreign 0% fail → 4-config 진짜 차별화, step-2 reduced-feature 한계 해소 = 깨끗한 full-factor verdict). **워크플로**(사용자 지정 루프): Claude dynamic-workflow 1차 → omxy 스킬무장 검토+fix(5) → Claude 적대 재검토+fix(HIGH cross-validation fail-open) → omxy step-6 hardening(winner→ADJUDICATE fail-closed·provenance stamp·core/wrapper 분리) → Claude round-2 무결성 게이트 0-finding → **양쪽 CONVERGED**. frozen 파일/임계 미변경(p-hacking 0)·production 미접촉·AI 비용 0. **SoT** = `docs/superpowers/reviews/2026-06-17-tier0-4config-multiregime-verdict.md` + `scripts/adjudicate_4config{,_core}.py` + `scripts/test_adjudicate_4config.py` + `scripts/out/bc/` (branch `tier0-bpp-multiregime`). **→ SUPERSEDED**: 이 verdict + 후속 캠페인(tradable-winner ALL-12-FAIL + combination 전부 FAIL) 종합 후 **USER 결정 = B++을 production funnel로 적용**(위 ★ #1). 본 bullet은 역사 컨텍스트. (Gate A recall floor 0.20 적정성 재검토는 별도 정당화 + 재freeze 필요 — post-hoc 금지.)
> - **[박제/참고]** **Tier0 스코어링 B++ step-2 harvest = ✅ 실행 완료 → triple-gate FAIL → Claude↔omxy CONVERGED → harness MERGED(PR #122, main `285339a`).** 실 19개월 PIT run(2024-06~2025-12, 순수 trend+size, 비용 0): **Gate A FAIL**(overall recall 0.108<0.20 · 단 **B++ 0.108>baseline 0.107**[복잡도 정당화] · largemid **0.431** · leaders **138/209≈7/11/mo**[73차 1/11]) · **Gate B ADJUDICATE**(IC IR 0.260<0.30 · large-IC **+0.08** · B++≫baseline −0.05) · **Gate C PASS**(60/60/30 19개월). **결론(합의)**: B++는 대형 주도주 retrieval 개선 실증 + naive baseline 상회하나, earnings/foreign 부재(순수 trend+size) + 절대 임계 미달 → **full 예측 thesis 미검증 = "leader-inclusive diagnostic candidate generator"까지만.** (← 역사: 이 시점 "--apply/Tier1 금지"는 이후 full-factor + tradable + combination 캠페인 종합 후 **USER 결정 = B++을 진단 funnel로 production 적용[★ #1]**으로 supersede; "예측 claim" 금지는 유지.) [SoT: spec §5/§6 + review doc] — §6 상세.
> - ~~**[USER]** `/admin/portfolio` **Accept 클릭** → MVP② 닫힘~~ ✅ **DONE (2026-06-12 10:11 KST)** — `portfolio_approval` 2026-06-01 accept·is_final=true + `portfolio_snapshot` 14행(종목 12 + 현금 7% + aggregate, 실 entry_price). **MVP ② 완료.** (D31 게이트 완화 PR #120 배포로 버튼 활성 → 클릭 영속 확인. 멤버 공개 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true` strict 복원.)
> - **[CLAUDE, 비용 0·병행]** 토스 D0 디자인 시스템 정의(spec-only) — 여유 시.
> - 트랙: 메인 런북 #1~4 · **shortlist 정확성(현재 = 스코어링 캠페인 완결 → B++이 최선 진단 funnel → USER 결정 = B++ production 적용[위 ★ #1], Claude↔omxy CONVERGED)** · 토스 D0~D4. 메인 런북이 출시 critical path.

1. ✅ **Accept go-live — DONE (2026-06-12 10:11 KST, MVP ② 완료).** USER가 `/admin/portfolio`에서 Accept 클릭 → production 영속 확인(MCP 직접 쿼리): `portfolio_approval` 2026-06-01 = **accept·is_final=true** + `portfolio_snapshot` 2026-06 = **14행**(종목 12 + 현금 7% + aggregate, 실 entry_price[SK하이닉스 ₩2,101,000 등 W3a 실 KRX 종가] 채워짐). 확정 포트 = 화면 AI 제안(12종목 93% + 현금 7%)과 정확히 일치. **77차 D31: Accept 게이트 내부도구 완화(PR #120·배포)로 버튼 활성 → 클릭 영속.** 멤버 공개(Deferred-D) 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true` strict 복원 + 마이그 0034/0035 재실행 금지(verify만). **MVP 3대 산출물 ①30리스트·②포트폴리오·③30리포트 전부 완료.** [SoT: §3]
2. **[CLAUDE]** ~~**B-SEL-CRON fix**~~ ✅ **DONE (PR #118 MERGED)** — period-scoped due-gate + `SELECTION_CRON_SELF_CONTINUE` opt-out 기본 ON(load-bearing) + orphan/stall/track-throw alert + panel cost-month 배선 + finalize stale-guard. workflow 27 findings→11 fix + omxy 3 fix + Claude 최종검토 0-new로 3-pass 수렴. 코드만(production 행동 변화 0 — flag dormant). **남은 건 USER 게이트**(§3 매달 자동화: flag enable + `SELECTION_CRON_SELF_CONTINUE` env 삭제 + 주간 tier0 producer + 비용 승인).
3. **[USER 키 + CLAUDE]** **S7b** 뉴스 자동제외(M12a) + 모닝 브리핑(M11) — Naver(B-8)+Telegram(B-9)+AI 키. shadow/alert-only(`M12A_AUTO_REMOVE_ENABLED` default false)부터. 이메일/Resend 전역 미사용. [SoT: ServicePlan-Admin §3.10 M12a · §2.2 Step 7]
4. **[USER 운용 + CLAUDE]** **D11 운용 검증 → S7c → S7d → S9 → 🎉 출시** — §2.2 후속 PR/운영 Runbook 그대로. 출시 = 자동매매 제외("AI 추천+가상 포트+알림" 내부 도구), S8 자동매매는 출시 후.

**[병행/선택 트랙] shortlist 정확성 — "순차적 C" 5단계 (1·2 ✅ / 3 부분완료 / 4 B++ step-2 harvest 실행 완료 → triple-gate FAIL → Claude↔omxy CONVERGED → MERGED PR #122 / 5 후속 자동화):**
> 사용자 발견(SK하이닉스 리스트 누락처럼 보임 / 삼성전자 부재) → 14-agent 감사(wq0gi0va0) → "순차적 C"(전부 한 방에 묶지 말고 단계 검증). Accept go-live(위 #1)와 **독립** 트랙.
> - **1단계 — UI 버그(track_pending + stale 카피)**: ✅ **DONE (76차, PR #114)**.
> - **2단계 — DART 분기누적 파싱 버그**: ✅ **DONE (76차, PR #114)**. 코드/테스트만 — production 리스트는 3단계 재시드 전까지 옛 데이터.
> - **3단계 — 재시드 검증**: ✅ **부분 완료(77차)**: ① DART quarterly 캐시 5,482행 무효화 ✅ → fixed 파서 재populate → ② Tier0 dry-run(sector override 16 commit `2a66a95` → b89 통과) 150 후보 검증 ✅. **결과: 대형 주도주 10/11 누락 확정**(실증) → 4단계 B++ 필요. ③ **이 dry-run 150은 구 스코어링이라 B++로 supersede**(폐기 대상). **Tier1 재선정 = B++ 예측게이트는 미통과지만 USER가 진단 funnel로 B++ 적용 승인(★ #1) → G2(Tier1 ₩25k)는 G1(--apply 150) 후 별도 승인**(구 "게이트 통과 후 보류"는 supersede).
> - **4단계 — 스코어링 보정 B++ [✅ harness + 실 harvest 실행 완료 → triple-gate FAIL → Claude↔omxy CONVERGED → MERGED(PR #122, main `285339a`)]**: B++ 설계(size sleeve L/M/S-liquid 20/20/10 + 유동성 플로어 + 모멘텀 재설계[risk-adj 20/60/126/252D trend + 52주 고가] + winsorize+percentile rank·결측 tiering·sector-relative quality·rank ensemble) 1차 구현(PR #121) 위에 **step-2 삼중 게이트 harvest 실행**(본 세션). **실 19개월 PIT(2024-06~2025-12, 순수 trend+size, 비용 0) 결과**: Gate A FAIL(recall 0.108<0.20, **B++>baseline**, largemid 0.431, leaders 7/11) · Gate B ADJUDICATE(IC IR 0.26<0.30, large-IC +0.08, B++≫baseline) · Gate C PASS. **B++ = 대형 retrieval 개선 실증 + baseline 상회(복잡도 정당화) 하나 절대 예측 임계 미달 + earnings/foreign 부재 → diagnostic leader-inclusive generator.** (이 시점 "--apply/Tier1 금지" → 캠페인 종합 후 **USER가 B++ funnel 적용 승인[★ #1]**으로 supersede; "예측 claim" 금지만 유지.) Claude(impl+4-lens+PIT-001) → omxy R1(3 harness fix) → Claude R2(Finding-1 fix) → omxy R2 CONVERGED. 207 python tests. [SoT: spec §5/§6 + review doc]
> - **4단계-후속(USER-gated) — full-factor 재검증**: 깨끗한 verdict = DART rcept_dt 스키마/backfill(현 캐시 rcept_dt 無 → harvest DART 100% fail-closed) + foreign backfill(현 OFF) → unchanged 게이트 rerun(leader-specific gate 추가 시 ex-ante 정의·post-hoc 재튜닝 §8 금지). **→ SUPERSEDED**: 캠페인 종합(tradable ALL-12-FAIL + combination 전부 FAIL) 후 USER 결정 = B++을 production funnel로 적용(★ #1); full-factor 재검증/diagnostic-유지 양자택일은 역사.
> - **5단계 — 주간 자동화(진짜 지속성)**: 주간 tier0 producer(Python→외부 스케줄, pykrx) + B-SEL-CRON fix(✅ PR#118) + `SELECTION_CRON_AUTO_ENABLED`. 1회 재시드는 그 주만 fresh. [SoT: §3 + 14-agent 감사 wq0gi0va0]

**[병행 트랙] 토스 스타일 리디자인 Toss-D0~D4 (시점 결정, runbook 순서 불변):**
> **토스 스타일 전체 리디자인(폰트 포함) — 마일스톤 결합 5-슬롯 (Claude↔omxy 토론 CONVERGED, 시점 결정. 스코프 C 전체·스킬 파이프라인은 확정분):**
> - **namespace guard**: 이 블록의 D0~D4는 디자인 전용 `Toss-D0~D4`이며, ServicePlan의 포트폴리오 D1~D4 의미와 별개다.
> - **D0 디자인 시스템 정의 [Accept와 병행 허용 — 단 산출물(스펙/문서)만, 코드·런타임·폰트패키지·globals.css·shadcn 토큰·layout primitive 변경 0; 그 변경은 D1]**: `/gstack-design-consultation` → 토스 원칙 + 폰트 후보/라이선스/한글 렌더링/성능 조건 + 토큰 방향 + primitive 목록. 별도 브랜치/문서 산출이면 Accept 리스크 0.
> - **D1 쉘 리테마 [Accept 완료 후 merge; S7b UI 착수 전 필수; B-SEL-CRON과 병렬 가능하나 충돌 시 D1이 UI 선행조건]**: `vercel:shadcn` 토큰+폰트+공통 primitive(nav/header/card/table/form) 전역 리테마 + `npx impeccable` slop 가드. 전역 회귀면적 크므로 Accept 완료 전 merge 금지.
> - **D2 기존 핵심 플로우 정밀 [D11 진입 전 필수]**: 홈/리스트/리포트/포트폴리오/승인 = `ce-frontend-design` + `ce-design-iterator`. D11은 짧아도 실 운용검증이라 핵심 플로우가 final-ish여야 피드백 유효(토큰만으론 부족).
> - **D3 신규 화면 final-style 동시구현 [기능 PR 내장]**: S7b 화면 = S7b 구현과 함께 / S7c 화면 = S7c 구현과 함께. 별도 후행 리디자인 금지.
> - **D4 freeze [S7d 후 · S9 직전]**: 풀 리디자인 아님 — `/gstack-design-review` QA + polish + 회귀 차단만.
> - 전 디자인 PR: §2.0a Claude↔omxy 루프 + `/gstack-design-review` QA + `vercel:react-best-practices`. **AI 비용 0(디자인 작업; 제품/운영 AI spend 없음).**
> - **critical path guard**: Accept go-live(MVP②)가 여전히 #1 critical path — 리디자인이 막지 않는다. 기존 출시 runbook 순서(Accept→B-SEL-CRON→S7b→D11→S7c→S7d→S9→출시)는 변경하지 않고, 디자인은 위 runbook에 결합되는 병행 트랙이다.

**MVP 엔진(W0~W3b)·P1/P2/P3/P2b·P4(30 리포트)·canonical 5-PR·B65/B66 = 전부 ✅.** MVP 산출물: ① 30 리스트 ✅(73차, 정확성 fix 76차) · ③ 30 리포트 ✅(75차) · ② 포트폴리오 ✅ **Accept 확정 완료(2026-06-12, MVP② DONE)**. **MVP 3대 산출물 전부 완료.** 결정 SoT = memory `project_mvp_engine_4workstreams_2026_06_04` + CLAUDE.md ⭐ 헤더(LOCKED 9 — 변경 금지). 구현 상세 = git log + PR body.

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
cd /Users/yong/New_Project_KR_Stock && git fetch origin
# ⚠️ 2026-06-19: Tier0 스코어링 캠페인 + B++ 적용 준비 작업은 branch `tier0-bpp-multiregime`의
#    **미커밋 working-tree**에 있음(combo scripts·캠페인 docs·HANDOFF/spec 편집 + Obsidian). main HEAD는
#    여전히 PR #122 merge `285339a`(campaign 미머지·production 변화 0). **main checkout 전 이 브랜치 작업
#    보존 확인**(필요 시 stash/commit). ★ #1(B++ 적용)은 이 브랜치에서 진행.
git status --short                  # tier0-bpp-multiregime working-tree (scripts/.venv·scripts/out gitignored)
git rev-parse --short HEAD          # main merge-base = PR #122 `285339a` (runtime verify; 캠페인은 미머지)
git status --short                  # clean (scripts/.venv·scripts/out gitignored)
gh pr list --state open --json number,title,headRefName,mergeable   # 기대 0 (없으면 우선 처리)

cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   기대: build OK / lint 0 err 0 warn / test:ci 1989 PASS + 4 skipped / tsc clean (77차 Accept-gate de-mock)
```

**production audit (Supabase MCP execute_sql) — drift 감지 기준(현재 정상 상태):**
```sql
select count(*), round(coalesce(sum(cost_krw),0)::numeric,2) from cost_log where month='2026-06';
  -- 기대 3033 / ₩41,368.84 (73차 풀 P3 2611 + 74차 P2b 42 + 75차 P4 378 + 76차 W3 proposal 1 + 77차 proposal regen 1 ₩26.91). 초과 증가 = 추가 실 AI 진행분.
select status, count(*) from report_batch_job where month='2026-06' group by status;  -- 기대 done 30 (75차 P4 완주)
select count(*) from stock_reports where month='2026-06-01'
  and section_0 is not null and section_7 is not null and section_8 is not null and appendix is not null;
  -- 기대 30 (section_0~8+appendix 완결 — 0/7/8+appendix가 완결성 대표 게이트)
select count(*) from committee_votes;  -- 기대 330 (30 reports × 11)
select month::text, count(*), count(consensus_badge) from short_list_30 group by month order by month;
  -- 기대 2026-05-01=30/0(Tier0 incumbents 보존) + 2026-06-01=30/30(AI 선정)
select count(*) from tier0_candidates_150;  -- 기대 150 (2026-06, 73차 선정 — B++ 재screen 전까지 갱신 안 됨)
select count(*) from portfolio_proposal where month='2026-06-01';  -- 기대 1 (10종목/현금15%, regen 2026-06-11)
select count(*) from portfolio_approval where month='2026-06-01';  -- 기대 1 (accept·is_final=true, 2026-06-12 10:11 KST Accept DONE)
select count(*) from portfolio_snapshot where month='2026-06-01';  -- 기대 14 (종목 12 + 현금 1 + aggregate 1, 실 entry_price)
```
> 77차 재시드: `dart_financial_cache` quarterly 무효화 후 재populate(annual 보존). `short_list_30`/`tier0_candidates_150` 2026-06은 **여전히 73차 선정**(B++ 재screen→재선정 전까지 옛 데이터 — 77차 dry-run 150도 구 스코어링이라 폐기 대상). Tier1 재선정 시 cost_log 증가 예상(~₩25k).
P1 audit 잔존: `cost_log` 2026-05 4행(₩334.71) + `stock_reports` 2026-05-01 004150 1행(section_0/7, section_8 null).

### 진입자 자동 행동 (default-progress)
1. 위 verify → 게이트·audit drift 0 확인.
2. §"다음 할 일" 1번부터 다음 unblocked CLAUDE step 식별.
3. Owner별: **[CLAUDE]** 즉시 자동(stacked 1세션+ 작업은 진입 의사 1회 확인) / **[SHARED]** "이어서 진행" 권한으로 push·PR-create·docs-sync 자동 / **[USER]** §3 게이트 — blocker 짧게 보고 + 다음 unblocked CLAUDE step 진행.
4. **§2.0a omxy 적대 검토 패턴**을 모든 신규 작업 branch에서 적용. **USER 직접 묻기**(§2.0): scope expansion / product spec / risk profile / real-money / cost burn 트리거 / 마이그 production apply / Vercel env·secrets·flag / 외부 메시지 / destructive / uncertainty ≥ medium.

---

## 1. 현재 상태 (current-only; per-PR 역사는 git log + PR body 위임)

| 영역 | 상태 |
|---|---|
| main HEAD | **runtime verify** `git rev-parse --short origin/main` (2026-06-12 77차 PR #122[B++ step-2 harvest] merge `285339a` 후 자손; 직전 PR #121[B++ 1차]). |
| OPEN PRs | **없음(0)** 기대. PR #19~#122 전부 머지(상세 git log). |
| 검증 게이트 | build OK / lint 0 err 0 warn / **test:ci 1989 PASS + 4 skipped**(77차 Accept-gate +shortlist-gate 12 + breadth/dormant) / tsc clean / DART pytest 18. |
| **MVP 엔진** | **W0~W3b 전부 ✅ MERGED**(모델/프로바이더 추상화 + 주간/월간 split + incumbent thesis + 반박 토론 loop + judge/dual-judge + entry_price + AI 자율 포트 proposal→Accept→cash row). canonical 5-PR + B65/B66 ✅. 상세 = git log + PR body. |
| **실 AI 검증** | P1(2026-05 4행 ₩334.71) + 73차 풀 P3 selection(2026-06 2611행 ₩24,655.64) + 74차 P2b live(42행 ₩1,695.83) + **75차 P4 30 리포트 완주(378행 ₩14,962.66 ≈ ₩554/ticker)** + **76차 W3 portfolio proposal 1콜(₩27.80)** + **77차 proposal regen 1콜(₩26.91, 2026-06-11T02:36Z → proposal=10종목/현금15%)**. 2026-06 월 누계 **3033행 ₩41,368.84**(hardcap 50만 내). 다음 실 AI 비용 이벤트 = shortlist 재시드+재선정(~₩25k, USER) 또는 후속 regen; Accept 자체는 AI 호출 없음. |
| **선정 흐름 (production)** | `short_list_30` 2026-06-01 = **30 AI 배지/ai_score**(🟣20/🟢7/🟡2/🔵1, 10/10/10) · 2026-05-01 = 30 Tier0 incumbents. **production 리스트는 여전히 73차 선정(2026-06-09)** — 76차 DART fix + 77차 재시드(dry-run 150은 구 스코어링)는 production 미반영. 메인 path = short 주간 + mid·long 월간 rolling. **Tier1 재선정 = USER가 B++ funnel 적용 승인(★ #1) → G1 `--scoring bpp --apply`(150 재screen)+검수 후 G2(Tier1 30, ~₩25k) 별도** (구 "게이트 통과 후 보류"는 supersede; "예측 claim" 금지는 유지). **DART quarterly 캐시는 무효화+재populate됨**(fixed 파서). |
| **스코어링 방법론** | **캠페인 완결(2026-06-19, 전부 Claude↔omxy CONVERGED)**: frozen 4-config×3-regime NO-CONFIG-PASSES + **tradable-winner-denominator(공정 분모) ALL-12-FAIL(분모 장벽 아님)** + **combination 캠페인(P0+P1+P3+P5+B++ref) 전부 FAIL·어떤 조합도 B++ 미개선**(Δ 노이즈 수준). **결론 = B++(trend+size)이 최선의 진단 funnel, 무료 데이터 게이트 통과 예측 스킬 부재.** **USER 결정 = B++을 production 150-scorer로 적용(funnel 업그레이드, "예측" claim 아님) — 다음 세션 #1**(§"다음 할 일" ★ 블록 G1/G2). production은 여전히 73차 선정(B++ --apply 전). SoT = spec §6 + `2026-06-18-tier0-tradable-winner-denominator.md §8` + `2026-06-18-tier0-combination-campaign.md §7`. |
| **풀 리포트 (production)** | `stock_reports` 2026-06 **30행 전부 section_0~8+appendix 완결**(verdict BUY 15/HOLD 7/SELL 8) + `committee_votes` **330**(30×11, parse stub 0) — **75차 P4 완주, MVP ③ 달성**. report_batch_job 30 done. 2026-05-01 004150 1행(section_0/7, section_8 null = P1 잔존). |
| Supabase | project `rbrpcynhphrpljbjirfo` · **마이그 0001~0037 production applied**(0037 = claim over-claim CTE fix, 74차 USER 승인, ledger `20260610015408`). 미적용 dormant 없음. cron RPC grants = authenticated + service_role (public/anon revoke; 0031/0027 — cron은 service_role, admin은 authenticated 경로). |
| Vercel canary | public 4/4 OK (`/`·`/login`·`/macro` 200 + `/admin` 307→login, tudal-tawny.vercel.app). cron route 5개 전부 **dormant**(flag 미설정 → spend 0). |
| Mock/슬라이스 | DQ-7 ~97%(Smoke #4/#5 + Session 4 QA 잔여) · S7e 7/8(T7e.7 RLS QA 잔여) · cron INSERT mock cleanup 완료. |

---

## 2. 출시까지 Runbook

### §2.0 Default-progress policy
- 현재 step이 USER-gated면 background blocker로 짧게 보고하고 다음 unblocked CLAUDE step으로 진행. 반복 질문 금지.
- **자동 진행 vs USER-only 정책 SoT = `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책`**:
  - **자동 허용**(권한 ON + omxy CONVERGED + 게이트 ALL GREEN): PR merge / docs-sync PR / post-merge docs-only direct commit / canary / deploy polling / branch cleanup / PR create.
  - **항상 USER-only**(CLAUDE는 가이드 + 후속 verify): Vercel env·secrets·flag / 마이그 production apply / billing / live-money / external account / cost burn 트리거 / 외부 메시지 / destructive.
- memory: [[feedback_user_action_auto_progress]] · [[feedback_omxy_debate_workflow]] · [[feedback_no_user_approval_gate]].

### §2.0a — ⭐ Claude↔omxy 작업 워크플로우 순서 (사용자 명시, 강제 적용)
**impl·fix 4-step**: ① Claude 1차 작업/수정(branch commit) → ② omxy 1차 검증(실 코드/diff 적대 검토) → ③ omxy 검증 후 수정(direct-edit, 게이트 GREEN 유지, commit은 Claude) → ④ Claude 2차 검증(코드 근거, 맹목 수용 X; 잔여 시 ③ 복귀). **plan 단계는 역할 반전**(①Claude 작성 ②omxy catch-only ③Claude fix). omxy 환경/송신 상세 = `docs/superpowers/omxy-rdebate-runbook.md`. **USER 게이트는 본 순서와 무관하게 항상 적용.**

### §2.2 ✅ 어드민 출시 게이트 (S9 1개월+ 후 7 criteria) — ⚠️ 출시 = 자동매매 제외

> **출시 범위 = "AI 추천 + 가상 포트 + 알림" 내부 도구** (어드민이 AI 추천 보고 직접 매매). 자동매매(S8)는 출시 후 어드민 3인 실운용하며 개발 — criterion #7은 "(자동매매 시)" 조건부(출시 시점 N/A).

1. 최소 1개월 운용(어드민 3인 일일) · 2. BL-KRIT open 0 · 3. 3인 핵심 플로우 일일 완료(Short List 30→풀 리포트→승인→가상 포트→알림) + disclaimer 전 화면 · 4. cron/health 안정(Silent Health red_alert 0 + success_rate ≥ 99% + canary OK) · 5. 비용 hardcap(월 **500,000 KRW** 미만 + AI 일 주문 ≤ 20 + cost_log 정확) · 6. RLS/credential smoke(advisor anon WARN 0 + Smoke #3~#6 + 평문 노출 0) · 7. **(자동매매 도입 후만)** guardrail 위반 0(레버리지 ≤ 5x · 일일 손실 -3% 정지 · AI 일 주문 ≤ 20).

#### 후속 PR + 운영 (출시까지 선형)
| Step | Owner | Trigger | Default action |
|---|---|---|---|
| **PR5** cron 30 report-only 자동(report_batch_job 큐) | CLAUDE | 코드 ✅ MERGED + 마이그 0027 applied. go-live = USER 게이트(§3 PR5 gates) | cron dormant(flag off). go-live 시 매달 자동 리포트. ⚠️ B-SEL-CRON fix와 동일 due-gate/finalize 검토. |
| **Step 7 S7b** 뉴스 자동 제외(M12a) + 모닝 브리핑(M11) | USER(Naver B-8 + Telegram B-9 + AI 키) + CLAUDE | P4 + Accept go-live(MVP② 확정) 후 | AI 페르소나(Core 11) 뉴스 평가 → per-company thesis-break → direct/material/high-conf 자동 제외(빼기만·freed→현금) + smart brake + durable ledger + 텔레그램/`/admin/alerts` 알림. **개발 순서 = base-first + shadow-first**: D11 base 운용검증(M12a 없이 Track Record 기준선) → S7b에서 M12a **shadow/alert-only**(`M12A_AUTO_REMOVE_ENABLED` default false) → 출시 → 자동 제거 ON = 출시 후 fast-follow. **M12a 자동 mutation = 출시 게이트 아님.** spec SoT = `ServicePlan-Admin §3.10 M12a`. 이메일/Resend 전역 미사용. **디자인 결합**: D3 신규 화면 final-style 동시구현(S7b 화면 = S7b 구현과 함께), D1은 S7b UI 착수 전 필수. |
| **Step 8 D11** AI 가상 포트 1차 가동 게이트 | USER 운용 + CLAUDE 모니터링 | S7b + PR-H/I/J D11 전 hard gate(manual trigger 2종 ✅ + PR5b/Section8 full path ✅ P2b + runtime mock grep 0) 완료 후, S7c 전 | KIS 0개로 어드민 3인 며칠~1주 운용 검증(의사결정 품질·승인·재생성 cap·알림 정확도). acceptance gate UI = 리포트 section_8 부재 시 '🤖 Tier 1 평가 대기' pill + Section 0 🔢🤖합의 배지 1행(✅ STEP-1). **디자인 결합**: D2 기존 핵심 플로우 정밀(홈/리스트/리포트/포트폴리오/승인)은 D11 진입 전 필수. |
| **Step 9 S7c** 장중·KIS WS + Exit 텔레그램+/admin 2-layer | USER(Telegram B-9 + KIS B-10) + CLAUDE | D11 검증 통과 후 | 실 alert_event + KIS read-only 1개 WS + Exit 텔레그램 best-effort + `/admin/alerts` durable event + 대안 3 + T+7 outcome. **디자인 결합**: D3 신규 화면 final-style 동시구현(S7c 화면 = S7c 구현과 함께). |
| **Step 10 S7d** Silent Health | CLAUDE | S7c 완료 후 | 5 파이프라인 success_rate + red_alert 0 + Exit outcome T+7 cron. (코드+테스트 완결, 실 DB/브라우저 실검증만 Docker/USER 대기.) |
| **Step 15 S9 운용 → 🎉 출시** | USER 1개월+ + CLAUDE hotfix | S7d 완료 후 | 어드민 3인 실 사용 1개월+ + 위 7 criteria 통과 = 출시. **디자인 결합**: D4 freeze(S7d 후 · S9 직전) 완료 후 진입 — 풀 리디자인 아님, `/gstack-design-review` QA + polish + 회귀 차단만. |
| **[defer] Reflection / PR-K** | CLAUDE | **출시 게이트 아님** — S9/go-live 후 | reflection_log 마이그 + Tier 1 context 주입. |
| **[출시 후] S8 자동매매** | USER(Binance B-11) + CLAUDE | 출시 후 | 주식 KIS + 바이낸스 USDT-M 선물 · Strategy drop-in + AI 어댑터 · 가드레일 + Binance Smoke #3. |

---

## 3. 사용자 액션 대기 큐 (pending only · 완료분은 git log + §6)

| 우선 | 작업 | 필요 액션 |
|---|---|---|
| ✅ **Accept go-live — DONE (MVP ② 완료)** | 2026-06-12 10:11 KST USER Accept 클릭 → `portfolio_approval` 2026-06-01 **accept·is_final=true** + `portfolio_snapshot` 14행(종목 12 + 현금 7% + aggregate, 실 entry_price). D31 게이트 완화(PR #120·배포)로 버튼 활성됐고 클릭 영속 확인. 마이그 0034/0035 재실행 금지(verify만). | (완료 — 멤버 공개 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true`) |
| ✅ **B-SEL-CRON** (PR #118 MERGED) | CLAUDE fix 완료(period-scoped due-gate + SELF_CONTINUE opt-out ON + orphan/stall/track alert + cost-month + stale-guard). 남은 건 USER flag(아래 매달 자동화 게이트로 통합). | ~~CLAUDE fix~~ → USER flag |
| ✅ **Tier0 B+C full-factor 4-config×3-regime 검증 — 완료(USER가 (a) 선택, 실행, CONVERGED)** | USER가 (a) full-factor 깨끗한 verdict 선택 → DART PIT 백필 44,300 완료 + 4 config × 3 장세 12 harvest → 동결규칙 적용 = **NO-CONFIG-PASSES**(전 12셀 Gate A FAIL; earnings IC 개선하나 recall floor 구조적 미달; size-neutral CI 0/36). data-quality VALID(earnings ~44% 실주입·foreign 0% fail). Claude dynamic-workflow ↔ omxy 스킬무장 루프(6-step) **양쪽 CONVERGED**. frozen 미변경·production 미접촉·AI 0. **결론(이 시점) = D30 no-apply 재확정**(Tier0 = diagnostic generator). **→ 이후 tradable-winner + combination 캠페인 종합 후 USER 결정 = B++을 진단 funnel로 production 적용(★ #1)** — "예측 claim" 금지는 유지. [SoT: review doc + `2026-06-18-tier0-combination-campaign.md`] | **→ ★ #1: B++ production 적용**(G1 --apply → G2 Tier1) |
| ✅ **Accept-gate de-mock** (PR #119 MERGED) | viewer 게이트 legacy mock 5종 하드코딩→active 전종목 공유모듈(shortlist-gate.ts) + page/action anchor 통일 + 2026 달력(근로자의날·제헌절) + UX. omxy R1/R2 CONVERGED. **production Accept 게이트가 active 30종 전부 2인 열람 요구로 정합화**(D+4 hold ~06-15 + 2 admin 열람 = §2.2 #3 출시 플로우). | (없음 — Accept 클릭 시 적용) |
| 🔭 WATCH (76차 omxy 비차단) | shortage-reason는 DB-level cross-track cardinality(버킷 0/10 불변식)를 코드가 강제하진 않음 — per-bucket finalize 도입 시 규칙 갱신 필요(주석 박제됨). portfolio page는 MissingCountBanner 미사용(자체 게이팅) → track_pending 인지 후속(MED). | 별도 후속 |
| **매달 자동화 게이트** | Vercel `SELECTION_CRON_AUTO_ENABLED=true` + **Vercel env에서 `SELECTION_CRON_SELF_CONTINUE` 삭제(미설정=ON, 구 .env.example가 false 박았으면 finding 27 함정)** + 주간 tier0 후보 producer(pykrx=Python → GitHub Actions 등 외부 cron, Vercel은 TS만) + 운영 비용 승인. (B-SEL-CRON fix 선행.) | USER + 외부 스케줄 |
| **PR5 gates** (별도 트랙) | Vercel `PR5_CRON_AUTO_ENABLED=true` + Task 7 비용 smoke + plan tier(OPS-1). cron-system seed ✅ / 마이그 0027 ✅. | USER |
| **B-8 Naver** | key rotate/env | S7b M12a 뉴스 수집 진입 시 |
| **B-9 Telegram** | bot token + admin 3 chat_id | S7b M12a 알림(텔레그램+`/admin` 웹) + S7c/S7d alerts |
| **B-10 KIS** (per-admin, 1/3 보유) | KIS·Binance = per-admin 키(DQ-7, 암호화 저장). 현재 3명 중 1명만(모의 키). **사용자 포함 2명 발급 필요.** S7c read-only 시세는 1개로 충분 / S8 자동매매는 3명 each. | S7c(1개) / S8(3명) |
| **B-11 Binance** | key(testnet 우선) | S8(출시 후) 진입 시 |
| **B-1~B-5 (DQ-7)** | 친구 비번 + KIS row 정리 + Smoke #4/#5 RLS + Session 4 QA | DQ-7 close 잔여 |
| **B-12 / B-13 / B-2A** | 보안 rotate(Supabase anon/service_role/DB pw/PAT/노출 키) / Vercel CLI update / HIBP leaked-password 토글(Supabase dashboard) | 권장 |

> KRX_OPENAPI_KEY 발급·8서비스 승인 완료 + `.env.local`/Vercel env 저장(✅). 해소 historical = git log + PR body.

---

## 4. 안전 규칙

- 내부 어드민 투자 운영 도구. Public signup/member/pricing 트랙은 Deferred-D 재개 전까지 만들지 않는다.
- **main 직접 commit 기본 금지**(Vercel auto-deploy). feature branch + PR. 예외: 사용자 명시 post-merge baseline docs-only direct commit(가역, 코드/DB/외부 변경 0).
- billing-on / mock→real API 전환은 USER 트리거 후에만.
- `/admin` 접근 = Supabase session refresh + `ADMIN_EMAILS` allowlist + RLS 3중 방어. `SUPABASE_SERVICE_ROLE_KEY` client-exposed 절대 금지. 어드민 추가/제거 시 Vercel env `ADMIN_EMAILS` + DB `admin_emails` 테이블 **동시 갱신**(한쪽만 = 인증 drift).
- credential plaintext/MEK/ciphertext UI·로그 노출 금지(서버 `src/lib/crypto/aes.ts`).
- UI 한국어 우선. 새 server action error code = `format-error.ts` 한국어 매핑 추가.
- Next.js 16 routing/middleware/server action 변경 전 `tudal/node_modules/next/dist/docs/` 또는 공식 문서 확인.
- 신규 SECURITY DEFINER 함수 마이그 = 3종 세트: `revoke from public` + `revoke from anon` + `grant to authenticated`(+ cron 전용은 authenticated도 revoke, service_role만). Supabase가 신규 public 함수에 authenticated EXECUTE 자동 부여 → 명시 revoke 필수.
- PostgreSQL `IF <null>`는 true 아님: RPC guard = `is null or ... is distinct from ...` + `coalesce(v->>'key','') not in ...` 명시.
- **claim/queue RPC 패턴 (74차 0037)**: `update … where id in (select … limit N for update skip locked)` **금지** — Postgres 서브쿼리 rescan으로 LIMIT 초과 over-claim(plan-dependent, prod 실증). 반드시 `with picked as materialized (select … limit N for update skip locked) update … from picked … returning j.*` 단일 평가. [[feedback_pg_skip_locked_claim_anti_pattern]]
- `section_8.partD.vote = BUY/HOLD/SELL literal 유지`(DB 저장 시 RPC가 approve/abstain/reject 매핑, writer 변환 금지). `stock_reports` = `generated_at` only + partial unique `(ticker, month) WHERE is_latest=true` 보존.
- **report 섹션 validation silent null-drop = structured log 격상 완료**(72차 PR #107, `logStructured`). 신규 validation 경로도 동일 패턴.

---

## 5. 문서 SoT

> 운영 순서: 본 HANDOFF → ServicePlan-Admin/ReportFramework → ProgressDashboard/Slices → CodebaseStatus → 실행 규칙.

| 필요 정보 | 문서 |
|---|---|
| 어드민 서비스 기획 본체 (Tier 0/1/2 + 합의 배지 + M12a 뉴스 + Section 8 contract) | `Document/Service/Planning/ServicePlan-Admin.md` (§1A.5 D19·D21·D22 / §3.10 M12a / §4.2.1 Section 8) |
| writer Section 8 작성 가이드 | `Document/Service/Report/ReportFramework.md §8` |
| 실데이터+실AI e2e ADR + 11-PR 로드맵 | `docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md` |
| **Tier0 스코어링 B++ (step-2 harvest 실행 완료 → triple-gate FAIL → 후속 캠페인 완결 → B++ diagnostic funnel 적용 결정)** | **`docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`** (B++ 설계 + recall/IC/size 삼중 게이트 + §5 step 0~3 ✅ / step 4~5는 2026-06-19 UPDATE로 SUPERSEDED / §6 verdict+적용결정 박제) · review `docs/superpowers/reviews/2026-06-12-tier0-bpp-step2-harvest-review.md` · 구현 = `scripts/tier0_factors.py`·`validate_tier0_ic.py`(harvest driver)·`dart_signals.py`(PIT)·`probe_pit_survivorship.py`·`screen --scoring bpp` |
| omxy R-debate 적대 검토 runbook | `docs/superpowers/omxy-rdebate-runbook.md` |
| Smoke/audit catalog (W-ticket) | `docs/superpowers/audit-catalog.md` |
| S7 mock→real Phase/DoD (S7a~S7d + T7e.7 RLS QA) | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷 / 실 I/O 통로 / 잔존 mock | `Document/Process/CodebaseStatus.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |
| MVP 엔진 LOCKED 9 결정 (변경 금지) | memory `project_mvp_engine_4workstreams_2026_06_04` + `CLAUDE.md ⭐ 헤더` |

---

## 6. 직전 완료 (직전 2 entry only · older = git log + PR body)

### Tier0 스코어링 캠페인 완결 — 방법론 감사 + tradable-winner-denominator + combination 캠페인 (2026-06-18~19, 전부 Claude↔omxy CONVERGED, branch `tier0-bpp-multiregime`, 코드/문서만·production 미접촉·AI 0·`--apply` 0)
- **동기**: USER "단/중/장 150 백테스트 기준이 틀린 것 아니냐" → 방법론 감사(Claude 3-agent) = harness PIT-honest·버그 없음, BUT **분모 결함 1개**(all-universe winner 분모 = 초소형주 지배 raw-return top-decile인데 funnel은 ADV≥₩2B floor → 구조적 미달). USER → (a) 공정 분모 재검증 → 이어서 "조합하면 더 낫지 않나, 테스트 가능한 건 전부".
- **① tradable-winner-denominator(`--winner-universe tradable` additive, byte-identical default)**: 승자 분모를 funnel 자체 유동성 우주(ADV≥₩2B)로 매칭 → 4-config×3-regime = **ALL-12-FAIL**. 감사 분모 비판 VINDICATED(절대 recall 0.064–0.112→**0.218–0.339** 2~3배↑) **그러나** matched random_ratio 0.94–1.27(«2.5)·lift CI lower<0 전 12셀 → **높은 recall은 작은 풀 커버리지지 스킬 아님 = 분모는 장벽이 아니었다**. omxy R1 HIGH(allow_supabase=False가 DART overlay 무음 드롭→cfg3/4 붕괴)가 실험 구함. SoT §8.
- **② combination 캠페인**: 설계 워크플로(8조합 사전등록 + Holm α=0.10/K + REFUSE[fishing] + PIT-safe regime label + 사전등록 null) → **P0 kill-switch**(chart non-B++ 픽의 B++-놓친-승자 회수 = 1.01/1.27/1.44× random, bear=랜덤) + **P1**(B++∪chart reserve-K) + **P3**(regime-adaptive horizon) + **P5**(bull/not-bull 조건부 실적) + **B++ ref** = **전부 FAIL·어떤 조합도 B++ 미개선**(Δlift ±0.003 노이즈). 유일 신호 = B++ 본래 bull 모멘텀(조합이 못 더함). P5 = "실적=IC(순위) 신호지 recall 아님" 확증(IC 0.40/0.49 통과·recall lift FAIL). omxy 6-step CONVERGED(R1 6 catch[HIGH P5 유동성미달 부활 등]→R2 3→R3). SoT §7.
- **결론**: **B++(trend+size)이 최선의 진단 funnel, 무료 데이터로는 게이트 통과 예측 스킬 부재 — 재조합/직교/조건부/공정분모 무엇도 미개선.** 무료 정량 영역 소진. **USER 결정 = B++을 production 150-scorer로 적용(funnel 업그레이드, 예측 claim 아님) = 다음 세션 #1**(§"다음 할 일" ★ G1/G2). 남은 예측-맥락 후보 = 무료 컨센서스→AI 입력(BACKLOG A). frozen tag/decision-rules/factors 무손상·byte-identical default 증명(cfg1_bull2425 float-exact 재현). [SoT: 위 2 docs + memory `project_tier0_scoring_bplus_decision_77`]

### Tier0 B+C full-factor 4-config×3-regime 다중장세 검증 → NO-CONFIG-PASSES (Claude dynamic-workflow ↔ omxy 6-step 루프 CONVERGED, branch `tier0-bpp-multiregime`)
- **산출(코드/문서만·production 미접촉·AI 0·`--apply` 미실행)**: DART PIT 백필 `scripts/out/dart_backfill.jsonl` **44,300/44,300**(1,772 corps × 25 periods; ok 37,761/no_data 6,530/schema_empty 9, rcept_dt PIT, 로컬 only) → `validate_tier0_ic.py`로 4 config × 3 regime = **12 harvest**(`scripts/out/bc/cfgN_*.json`) → deterministic adjudicator(`scripts/adjudicate_4config{,_core}.py` + `test_adjudicate_4config.py` 7 tests) → `verdict_4config.{json,md}` + review doc.
- **VERDICT = NO-CONFIG-PASSES** (동결규칙 `tier0-multiregime-freeze` 적용): 전 12셀 Gate A FAIL → triple ✗. max recall 0.112 « floor 0.20(구조적 44% 미달) · random max 1.72<2.5 · per-horizon 0.018–0.045«0.12 · **size-neutral skill CI 0/36**. config별 IC: bear(cfg1 −0.76…cfg4 −0.23) / recov(cfg1 −0.29 → cfg3 **+0.40**) / bull(cfg1 +0.39 → cfg4 **+0.72**).
- **핵심 발견**: (a) Gate A recall이 binding 실패(추가 팩터가 recall 오히려 ↓) (b) **earnings = IC 레이어 최강**(recovery 음→양 flip, bull deepening)이나 retrieval floor 못 넘김 (c) IC 장세의존 = momentum/factor 베타지 robust alpha 아님 (d) data-quality VALID(earnings ~44% 실주입·foreign 0% fail → 4-config 진짜 차별화 = step-2 reduced-feature 한계 해소, 깨끗한 full-factor verdict). **결론(이 시점) = D30 no-apply 재확정**(Tier0 = "leader-inclusive 깔때기, 예측 스킬 미검증" → diagnostic generator, --apply/Tier1/"상승 예측" 전부 금지; 다음 줄에서 후속 캠페인 종합 후 supersede).
- **워크플로(사용자 지정 루프)**: ① Claude dynamic-workflow(6-agent 적대검증) 1차 → ② omxy 스킬무장(native·superpowers 등) 검토 + 직접 fix(5: fail-open/INVALID/test/report/driver) → ④ Claude 2-agent 적대 재검토 + fix(HIGH triple↔gate cross-validation fail-open + dead-branch + positive test) → ⑥ omxy step-6 hardening(winner→ADJUDICATE fail-closed·provenance stamp+gate·core/wrapper 분리) → Claude round-2 무결성 게이트(frozen 미변경·12 JSON stamp-only metric 불변·7 tests·verdict 불변) 0-finding → **양쪽 CONVERGED**. frozen 파일/임계 미변경(p-hacking 0).
- **다음 = SUPERSEDED**: 이 시점 "추가 작업 없음(diagnostic 유지)"은 이후 tradable + combination 캠페인 종합 후 **USER 결정 = B++ production funnel 적용(★ #1)**으로 대체. (recall floor 0.20 재검토는 여전히 별도 재freeze 필요 — post-hoc 금지.) [SoT: review doc + `docs/superpowers/2026-06-18-tier0-combination-campaign.md`]

### Tier0 B++ step-2 삼중 게이트 harvest 실행 + Claude↔omxy CONVERGED (77차 후속, PR #122 MERGED, main `285339a`)
- **산출(코드만·production runtime 변화 0·tudal 0 touch·--apply hard-block 유지)**: `validate_tier0_ic.py` fail-closed main() 활성화 → 월반복 PIT harvest(disk-cached KRX panel + 선정/forward/Gate A·B·C 집계 + 3 baseline + report JSON). `dart_signals.py` PIT 강화(as_of_date + cache_only + availability fail-closed). 207 python tests.
- **실 19개월 PIT harvest(2024-06~2025-12, 순수 trend+size, 비용 0, `scripts/out/tier0_ic_report.json`)**: **Gate A FAIL**(overall recall 0.108<0.20 · random 1.66<2.5 · per-horizon ~0.04<0.12 · **largemid 0.431** · **leaders 138/209≈7/11/mo**[73차 1/11] · **B++ 0.108 > baseline_equal 0.107 = 복잡도 정당화**) · **Gate B ADJUDICATE**(IC IR 0.260<0.30 · **large-sleeve IC +0.08** · mid −0.007 · **B++ IR 0.26 ≫ baseline −0.05**) · **Gate C PASS**(60/60/30, 19개월 전부). **TRIPLE GATE ALL PASS=False.**
- **결론(이 시점 Claude↔omxy 합의)**: B++는 (a) 대형 주도주 retrieval 개선 **실증**(largemid 0.431, leaders 7/11, large-IC +0.08) + (b) naive baseline recall·IC 모두 **상회(복잡도 정당화)** 하나, (c) earnings 100%(availability fail-closed)+foreign 부재(순수 trend+size) + 절대 임계(recall 0.20·IC IR 0.30) 미달로 **full 예측 thesis 미검증** → 산출물 = **"robust, factor-informed, leader-inclusive candidate shortlist(diagnostic)"**, **--apply/Tier1/"상승 예측" claim 전부 금지·미실행**(다음 줄에서 후속 캠페인 종합 후 supersede).
- **cross-model 루프(§2.0a)**: Claude Phase1(impl + 4-lens workflow review: 3 clean + 1 HIGH PIT-001[holiday/weekday as-of] fix) → **omxy R1**(26m, native code-review lanes + Superpowers; 3 harness fix 직접: availability fail-closed/Gate C per-month/leader basket size + 적대 verdict) → **Claude R2**(omxy quarterly availability gate가 live-screen 누설[cache 무효화]되는 **Finding-1 HIGH** catch+fix[cache_only 스코프]+regression test) → re-run(post-fix 순수 trend+size) → **omxy R2 SIGNAL: CONVERGED**(harness 정확 incl Finding-1, verdict FAIL, decision). 양쪽 CONVERGED.
- **다음 = SUPERSEDED**: 이 step-2 시점의 "(a) full-factor rerun / (b) diagnostic 유지" 양자택일은, 이후 full-factor + tradable + combination 캠페인 종합 후 **USER 결정 = B++을 production funnel로 적용(★ #1)**으로 대체. **production short_list_30/tier0_candidates_150 2026-06 = 여전히 73차(B++ --apply 전).**

### Tier0 스코어링 B++ 1차 구현 + 삼중 게이트 harness + cross-model 적대 검토 루프 (77차, PR #121 MERGED, code-merge `8110e8c`)
- **산출(코드만·production 행동 변화 0)**: `scripts/tier0_factors.py`(B++ 순수 팩터/사이징/스코어링 + 공유 `score_bpp_universe` — screen·harness 단일 소스) + `scripts/validate_tier0_ic.py`(삼중 게이트 Gate A recall / Gate B scoped rank-IC PASS·FAIL·ADJUDICATE 3-state / Gate C 결정론 size + PIT 패널·forward-return[t+1 entry·gap/delisted 구분]; **CLI fail-closed** = 실 harvest는 step-2) + `scripts/probe_pit_survivorship.py`(step 0 PASS) + `screen_shortlist_tier0.py --scoring bpp`(emit-candidates 전용·`--apply` hard-block·450d lookback·ADV/52주고가 prefetch·KRX throttle 내성·Gate C smoke).
- **§5 step 0(survivorship) ✅ RESOLVED**: KRX `bydd_trd` historical = PIT universe(상폐-at-time 포함, probe 실측 2024-12-16 KOSPI 25종목 부재) → recall 검증 유효(upper-bound 아님). `ACC_TRDVAL`/`MKTCAP`/`TDD_HGPRC` 무비용 가용.
- **Claude↔omxy 루프(§2.0a, 사용자 지정 omxy-fixes 변형)**: Claude 1차 → Claude self-review(workflow 6렌즈, 2H+5M+6L 수정) → **omxy** review R1(catch-only, 4H+2M+1L)+fix `93a23d4` → **Claude** 적대 review R1(workflow 4렌즈 → 1H[long-bucket 52주고가-단독 eligibility leak]+3M omxy 누락분 발견)+omxy fix `4d497a2` → **Claude** 적대 review R2(2렌즈+**mutation testing** → ZERO findings) → **양쪽 CONVERGED**.
- **검증**: python unittest 115→**225 PASS**, compile clean, survivorship probe PASS, mutation testing(각 fix revert→해당 test FAIL=genuine guards), 임계 전부 tightening. **AI 비용 0**(전부 dry-run/순수).
- **Gate C smoke ✅ PASS (실 KRX 2197종목 dry-run·비용 0)**: 분포 **60/60/30** · Small **20%** · long-trend NaN 0 · **11-leader tripwire 5/11**(SK하이닉스·**삼성전자**·두산에너빌리티·에코프로비엠·HD현대일렉트릭 = 기존 73차 1/11 → B++ 5/11, 소형주 독식 소멸 실증). ⚠️ pykrx 외국인 fetch 다수 에러(Length mismatch)→fail-soft penalty(foreign 약화, trend/실적/퀄리티만으로 5/11; step-2 전 foreign 점검 필요·B++ 버그 아님). **11-leader는 tripwire(합격기준 아님) — 정식 합격은 Gate A/B recall(step-2).**
- **다음 = step-2 harvest 실행** (↑ 위 PR #122 entry로 supersede·완료: triple-gate FAIL → diagnostic generator/no-apply). [historical — 이 PR #121 entry의 옛 next-action은 위 step-2 entry가 대체]

> 직전(older) = git log + PR body: **Accept go-live MVP② DONE**(2026-06-12, §1 #1·§3) + Accept-gate de-mock(PR #119)·내부도구 완화 D31(PR #120) + shortlist 재시드(DART quarterly 무효화·sector override 16 `2a66a95`) + 스코어링 2차 토론 B+ REJECT→B++(production 150 대형주 10/11 누락 실증, Claude 퀀트+omxy 독립 수렴) · B-SEL-CRON fix(PR #118) · 76차 이전(PR #114, P4 75차 등).
