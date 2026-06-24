# HANDOFF — 주픽 (JooPick)

Last updated: 2026-06-24 (**⭐ B++ funnel 적용(G1/G2) + Tier2 리포트 배선(PR-T2a) + ⓐ 새 30 리포트 Tier2 생성·검증 전부 완료. production `tier0_candidates_150`/`short_list_30` 2026-06 = B++ cfg1 기준(150 리더 4/11·30 리더 2/11). `stock_reports` 2026-06 = B++ 새 30 (section_0~8+appendix + committee_votes 330 core + 420 sector = 750, partA 14·sector_aggregate, NULL-sector 0; 마이그 0040/0041 production applied — live-catch CHECK 23514 fix 포함). B++ = diagnostic funnel 업그레이드지 예측 게이트 통과 아님(NO-CONFIG-PASSES 유지). 다음 1순위 = ⓑ go-live USER 게이트 + S7b. PR-T2c 렌더·섹터 비교 메뉴·PR-K Reflection은 S9 전 pre-launch lane.**)

> **이 파일 하나로 다음 세션이 진입 가능하도록 작성됨.** SHA·라운드 수·commit 체인은 self-drift 위험이 크므로 freeze 금지 — `git rev-parse --short origin/main` + `git log` + PR body로 runtime verify. 완료된 차수의 상세 박제·배선 교차감사 기록은 **git log + PR body + memory**에 위임하고 본 파일엔 남기지 않는다.

---

## 🎯 다음 할 일 (출시까지 남은 작업 — launch-critical only)

> "HANDOFF.md 보고 이어서 진행" = 아래 launch-critical 순서대로. USER-only gate는 §3, 세부 Runbook은 §2.2. 출시 범위는 **자동매매 제외**("AI 추천 + 가상 포트 + 알림" 내부 도구)이며, 연구/shadow/stat verdict는 하단 접힘 섹션으로 분리한다.

1. ✅ **Accept go-live — DONE (2026-06-12 10:11 KST, MVP ② 완료).** `portfolio_approval` 2026-06-01 = accept·is_final=true + `portfolio_snapshot` 14행(종목 12 + 현금 7% + aggregate, 실 entry_price). 멤버 공개(Deferred-D) 재개 시에만 `PORTFOLIO_ACCEPT_GATE_STRICT=true` strict 복원.
2. ✅ **B-SEL-CRON fix — DONE (PR #118 MERGED).** period-scoped due-gate + `SELECTION_CRON_SELF_CONTINUE` opt-out 기본 ON + orphan/stall/track alert + cost-month + finalize stale-guard. 남은 것은 USER monthly automation gate(§3)로 통합.
3. ✅ **B++ diagnostic funnel 적용(G1→G2) — DONE (2026-06-24).**
   - **G1 ✅**: `screen_shortlist_tier0.py --scoring bpp --apply --apply-approval-basis USER_PRODUCTION_FUNNEL_DIAGNOSTIC`(가드 완화 코드 = afb3985/d95d708 omxy R1+R2 CONVERGED) → `tier0_candidates_150` 2026-06 = **B++ cfg1(trend+size; foreign/DART OFF)** 150. Gate C PASS(60/60/30) · 대형 리더 **4/11**(삼성전자·SK하이닉스·두산에너빌리티·HD현대일렉트릭; 73차 1/11→4/11) · unresolved sector 0(override 12 = f9a2dff, omxy CONVERGED) · rollback 백업(`scripts/out/rollback_backup/` + `scripts/out/bpp_cfg1_2026-06.prod-rollback-*.json`).
   - **G2 ✅**: P3 full-run 재선정(selection-run state reset[backup+delete s:2026-06-08 + m:2026-06] → ~₩27k 실 AI) → `short_list_30` 2026-06 = **B++ 새 30**(🟣16/🟢4/🟡9/🔵1 · 리더 **2/11** SK하이닉스·HD현대일렉트릭 — funnel이 150에 4 surface, Core-11 위원회가 2 선정). 월 cost ₩68k(hardcap 50만 내). **반도체 소부장 다수 + 전력/중공업 + 바이오** 구성.
   - **캐비엇 유지**: B++ = funnel 업그레이드(retrieval 개선), **예측 게이트 통과 아님**(NO-CONFIG-PASSES). 산출/로그/provenance sidecar에 '예측 게이트 미통과(diagnostic funnel)' 명시. hard-gate 영구 금지. [SoT: `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md`]
4. ✅ **새 30 리포트 Tier2 포함 생성 (ⓐ) — DONE (2026-06-24).** PR-T2a(Tier2 섹터 보드 → live 리포트 배선) ✅ CONVERGED + **마이그 0040/0041 production applied** + P4-style 생성으로 **`stock_reports` 2026-06 = B++ 새 30 전부 재생성·검증**(30/30 · section_0~8+appendix · committee_votes 330 core + 420 sector = 750 · partA 14 · partC.sector_aggregate · NULL-sector 0). 비용 ~₩30k(2 transient AI flake[critic·sector-writer parse]는 reset+rerun으로 회복 + 336570 섹터보드 targeted re-commit 포함; 월 누계 ≈₩98k, hardcap 50만 내). **live-catch**: `commit_sector_personas_cron`(0040)이 첫 live 실행에서 `committee_votes_sector_required` CHECK(23514) — INSERT에 sector 미설정(0019 byte-copy 잠복버그)이라 throw → 0041 corrective(admin+cron 양쪽 sector=p_sector) + `scripts/pg_smoke_0040.sh` 회귀가드, omxy R7~R9 CONVERGED. **알려진 갭(후속)**: orchestrator 완결성 체크가 Core-only(section_0~8) → 섹터보드 실패 뒤 Core만 커밋된 리포트는 reset+rerun이 ₩0 skip해 섹터보드를 복구하지 않음(336570이 그 케이스 → targeted re-commit으로 해소; 향후 worker 완결성에 섹터보드 포함 권장). USER 결정 = "Tier2로 한 번에"(이중작업 회피). [SoT: `docs/superpowers/specs/2026-06-23-tier2-sector-persona-report-wiring.md` · memory [[feedback_mocked_rpc_hides_check_violation]]]
5. ★ **다음 1순위 — go-live USER 게이트 + S7b 뉴스·브리핑.**
   - **USER**: 매달 자동화 승인/flag(`SELECTION_CRON_AUTO_ENABLED=true`, Vercel env에서 `SELECTION_CRON_SELF_CONTINUE` 삭제), 주간 tier0 producer 외부 스케줄, 운영 비용 승인, S7b용 B-8 Naver + B-9 Telegram + AI 키 확인. PR5 report cron은 별도 flag(`PR5_CRON_AUTO_ENABLED`)로 §3에서 함께 관리.
   - **CLAUDE**: **S7b** 뉴스 자동제외(M12a) + 모닝 브리핑(M11) 착수. 기본은 shadow/alert-only(`M12A_AUTO_REMOVE_ENABLED=false`)이며, 이메일/Resend 전역 미사용. [SoT: `Document/Service/Planning/ServicePlan-Admin.md §3.10 M12a`, 본문 §2.2 Step 7]
6. **D11 운용 검증.** S7b 후 KIS 0개로 어드민 3인이 며칠~1주 운용 검증(의사결정 품질·승인·재생성 cap·알림 정확도). [SoT: §2.2 Step 8]
7. **S7c 장중·Exit 알림.** KIS read-only 1개 + Telegram/`/admin` 2-layer alert + 대안 3 + T+7 outcome. [SoT: §2.2 Step 9]
8. **S7d Silent Health.** success_rate/red_alert/heartbeat/override UI 실 연결. [SoT: §2.2 Step 10]
9. **Pre-launch 섹터 비교 메뉴 + Tier2 리포트 배선 잔여(PR-T2c 렌더) + 디자인 freeze(S9/출시 전).**
   - **섹터 추천 비교 메뉴**: 출시 전 빌드 deliverable. 핵심 비교는 **production B++ 30 vs Track 2 `sector-soft-tilt`(B++ core + 주도섹터 soft re-weight) 30 + 각 수익률**이다. Track 2는 sector-aware 150 generator라 150단계에서 놓친 대형 리더를 섹터 tilt가 더 잡는지 보여준다. PR-A1 in-pool 30 재정렬은 보조 비교일 뿐 150-recall 문제의 핵심 답이 아니다. hard-gate live 적용은 영구 금지(soft 비교만)이고, 검증 전 production 자동 교체는 없다. 섹터 가설 입력은 수기 또는 별도 AI advisor다.
   - **Tier2 섹터 페르소나 → 30 리포트 배선**: **PR-T2a(생성 seam) ✅ DONE(위 #4) + 마이그 0040/0041 applied + 새 30 리포트에 섹터보드 데이터 생성 완료**(committee_votes 420 sector + partA 14 + sector_aggregate). 잔여 = **PR-T2c(Section 8 섹터 보드 FE 렌더 확인)** — 데이터는 있으니 리포트 페이지가 Part A + 실 sector_aggregate를 렌더하는지만 확인(빈 fallback이면 wire). PR-T2b(비용 reservation)는 PR-T2a에 흡수. 상세 = `🔧 Pre-launch` 섹션.
   - **Toss-D0~D4 디자인 lane**: D0 now/spec-only → D1 S7b UI 전 → D2 D11 전 → D3 S7b/S7c 동시 → D4 S7d 후·S9 직전 freeze(`/gstack-design-review`).
   - **PR-K Reflection 자가학습 빌드(D32, 출시 전 승격)**: reflection_log + track별(주1/월1) 회고 job + 다음 선정 prompt 주입(`reflectionContext` seam). **빌드 완료 = S9 진입 선행조건(sequencing)**, **동작·품질 검증 = S9 중 soft criterion**(§2.2 7-criteria 잠금 미변경). 구 "출시 후 defer"(62차 doc-class) supersede. [SoT: `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md` · 본문 §2.2 runbook 표]
10. **S9 1개월+ 운용 검증 → 🎉 출시.** 어드민 3인 실 사용 1개월+ + §2.2 7 criteria 통과 (★ S9 중 PR-K Reflection 실가동·검증, soft). 출시 = 자동매매 제외("AI 추천 + 가상 포트 + 알림" 내부 도구). S8 자동매매는 출시 후.

## 🔧 Pre-launch 섹터 비교 메뉴 + Tier2 리포트 배선 + 디자인 품질 lane (S9/출시 전)

- **섹터 추천 비교 메뉴 — 출시 전 빌드 deliverable.** **production B++ 30**과 **B++ + 섹터 tilt 조합(Track 2 PR-B1~B5로 이미 빌드된 `sector-soft-tilt`, sector-aware 150 → 30)**을 나란히 보여주고 각 수익률을 비교한다. 목적은 150단계에서 놓친 대형 리더를 주도섹터 soft re-weight가 더 잡는지 어드민 3인이 human-in-loop로 눈검증하는 것이다. **A 결정 유지**: production 적용은 B++ 단독이고, B++ + 섹터는 비교 메뉴/검증 후 채택 후보일 뿐 자동 교체가 아니다. PR-A1 Track 1 in-pool 30 재정렬은 보조 비교 가능하지만 핵심은 Track 2 generator다. **hard-gate live 적용은 영구 금지**(soft only). 섹터 가설 입력은 수기 또는 별도 AI advisor. PR-A5/PR-B5의 Bonferroni/beta 등 무거운 통계 verdict는 쓰지 않고 deferred/연구로 둔다.
- **Tier2 섹터 페르소나 → 30 리포트 배선(PR-T2a/b/c)**: Core-11 리포트만으로 MVP ③은 완료됐지만, 출시 전 리포트 품질 상향 deliverable이다. **PR-T2a ✅ 완료/CONVERGED + 적용(2026-06-24)**: live `full-report-batch-worker → orchestrateFullReport` 경로에 `SECTOR_BOARD_ENABLED` seam + cron service-role commit path 배선 + **마이그 0040/0041 production applied** + 새 30 B++ 리포트에 섹터보드 생성 완료(420 sector votes + partA 14 + sector_aggregate, NULL-sector 0). PR-T2b 비용 reservation/모델 preflight는 PR-T2a에 흡수. 잔여 = **PR-T2c Section 8/render/`committee_votes` 섹터 보드 FE 렌더 확인**(데이터는 생성됨) + 선택 후속 **D-1 dangling action cleanup** + **완결성 체크 갭 fix**(orchestrator 완결성 체크가 Core-only라 섹터보드 실패 시 reset+rerun이 섹터보드 미복구 — worker 완결성에 섹터보드 포함 권장; 이번엔 336570 targeted re-commit으로 해소). 마이그/생성/live-catch(0041 CHECK fix)·완결성 갭 상세 = memory [[feedback_mocked_rpc_hides_check_violation]]. SoT = `docs/superpowers/specs/2026-06-23-tier2-sector-persona-report-wiring.md`.
- **Toss-D0~D4 디자인 품질 lane**: **D0 = 지금 spec-only**(제품/운영 spend 0, 구현 PR 아님), **D1 = S7b UI 착수 전** IA/visual 기준 확정, **D2 = D11 전** 홈/리스트/리포트/포트폴리오/승인 핵심 플로우 정밀, **D3 = S7b·S7c 화면 구현과 동시** final-style 반영, **D4 = S7d 후·S9 직전 freeze**(`/gstack-design-review` QA + polish + 회귀 차단). §2.2 각 단계의 "디자인 결합" 메모는 이 타임라인을 따른다. SoT = `Document/Service/Planning/ServicePlan-Admin.md §1A.1 디자인 방향 · §1A.5 D29`.

<details>
<summary>Post-launch / 연구 레이어 로그 (launch checklist 밖)</summary>

### 출시 후 제품 후보

- **S8 자동매매**: 출시 후 어드민 3인이 실운용하며 별도 진입(주식 KIS + Binance USDT-M, guardrail 기본 유지).

### Backlog / research 후보 (launch checklist 밖)

- **무료 애널리스트 컨센서스 → AI 컨텍스트 입력**: 정량 funnel 팩터가 아니라 W1 AI 토론/30 리포트 입력 후보. SoT = `docs/superpowers/2026-06-19-free-analyst-consensus-ai-input.md`.

### Research / built shadow artifacts (repo SoT 포인터만; 라운드별 서사는 git log·PR body·spec에 위임)

- **Tier0 B++/B+C 예측 검증 — research/CLOSED.** B++ step-2, full-factor 4-config×3-regime, tradable-denominator, combination 캠페인은 모두 **NO-CONFIG-PASSES/FAIL**로 수렴해 예측 스킬 미검증·상승 예측 claim 금지. USER-approved diagnostic funnel로 Production `short_list_30`/`tier0_candidates_150`은 **G1/G2로 B++ cfg1 기준 교체됨(2026-06-24)**. 단 B++ = retrieval 개선용 diagnostic funnel 적용이지 예측 게이트 통과가 아니며, **NO-CONFIG-PASSES/상승 예측 claim 금지**는 유지된다. SoT = `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` 2026-06-19 UPDATE, `docs/superpowers/reviews/2026-06-17-tier0-4config-multiregime-verdict.md`, `docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md`, `docs/superpowers/2026-06-18-tier0-combination-campaign.md`.
- **Track1 PR-A1** — in-pool 30-reranking pure `computeArmSelections` ✅ feat `2e5c98c`; SoT = `docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md`.
- **Track1 PR-A2** — worker DI seam + shadow-arm-logger default OFF ✅ feat `643a8ce`; SoT = parent Path-A spec.
- **Track1 PR-A3** — migration 0038 `shadow_arm_log` + upsert RPC + smoke ✅ feat `5dca94b`; USER apply-only; SoT = parent Path-A spec.
- **Track1 PR-A4** — `shadow_arm_log` reconcile REPORT(report-only) ✅ feat `0f532ef`; SoT = parent Path-A spec.
- **Track1 PR-A5** — stage-1 in-pool forward VERDICT evaluator ✅ feat `ffd84f8`; 341 unittest + smoke PASS + frozen byte-clean; **통계 verdict RUN deferred/연구**. SoT = `docs/superpowers/specs/2026-06-23-pathA-track1-pra5-verdict-evaluator.md` §11.
- **Track2 PR-B1** — generator-shadow pure `compute_shadow_selections` ✅ feat `42f5dcc`; SoT = `docs/superpowers/specs/2026-06-20-pathA-track2-generator-shadow.md`.
- **Track2 PR-B2** — migration 0039 shadow tables + finalize RPC ✅ feat `8ac8485`; USER apply-only; SoT = Track2 spec §10/§5.
- **Track2 PR-B3** — Python `--shadow-sector` wiring default OFF ✅ feat `270c6aa`; SoT = Track2 spec §10.
- **Track2 PR-B4** — generator-shadow reconcile REPORT(report-only) ✅ feat `3d91823`; SoT = Track2 spec §10.
- **Track2 PR-B5** — stage-1 forward recall evaluator ✅ feat `d3ca1d4`; dormant default-OFF, USER-gated verdict RUN deferred/연구. SoT = `docs/superpowers/specs/2026-06-22-pathA-track2-prb5-forward-recall-evaluator.md` §14.

</details>

**MVP 엔진(W0~W3b)·P1/P2/P3/P2b·P4(30 리포트)·canonical 5-PR·B65/B66 = 전부 ✅.** MVP 산출물: ① 30 리스트 ✅(73차, 정확성 fix 76차) · ② 포트폴리오 ✅(Accept 2026-06-12) · ③ 30 리포트 ✅(75차). 결정 SoT = memory `project_mvp_engine_4workstreams_2026_06_04` + ServicePlan/ReportFramework.

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
cd /Users/yong/New_Project_KR_Stock && git fetch origin
# 2026-06-24: B++ funnel 적용(G1/G2) + PR-T2a Tier2 배선 + ⓐ 새 30 리포트 Tier2 생성·검증 전부 완료. production 150/30 = B++ cfg1, stock_reports 2026-06 = B++ 새 30(Tier2 포함). 마이그 0040/0041 production applied.
#    다음 launch next = ⓑ go-live USER gates + S7b. (PR-T2c FE 렌더 확인 + 완결성 체크 갭 = pre-launch lane.)
#    B++ = retrieval 개선 diagnostic funnel(NO-CONFIG-PASSES 유지·예측 claim 금지).
git checkout tier0-bpp-multiregime 2>/dev/null; git pull origin tier0-bpp-multiregime  # 캠페인 브랜치
git status --short                  # clean 기대 (scripts/.venv·scripts/out·/out/ gitignored)
git rev-parse --short HEAD          # tier0-bpp-multiregime e4066a7 자손 (runtime verify; main 미머지)
git status --short                  # clean (scripts/.venv·scripts/out gitignored)
gh pr list --state open --json number,title,headRefName,mergeable   # 기대 0 (없으면 우선 처리)

cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..
#   기대: build/lint/test:ci/tsc green (runtime verify; docs-only 정리는 앱 게이트 생략 가능)
```

**production audit (Supabase MCP execute_sql) — drift 감지 기준(현재 정상 상태):**
```sql
select count(*), round(coalesce(sum(cost_krw),0)::numeric,2) from cost_log where month='2026-06';
  -- 기대 ≈₩98,170 (직전 ₩68,034 + 새 30 리포트 Tier2 생성 ~₩30k[2026-06-24, retry 2 + 336570 섹터보드 repair 포함]).
select status, count(*) from report_batch_job where month='2026-06' group by status;  -- 기대 done 30 (B++ 새 30 재생성 2026-06-24)
select count(*) from stock_reports where month='2026-06-01'
  and section_0 is not null and section_7 is not null and section_8 is not null and appendix is not null;
  -- 기대 30 (B++ 새 30, section_0~8+appendix 완결 — 0/7/8+appendix가 완결성 대표 게이트)
select count(*) from committee_votes;  -- 기대 750 (30 reports × [11 core + 14 sector]; sector-layer NULL-sector 0)
select month::text, count(*), count(consensus_badge) from short_list_30 group by month order by month;
  -- 기대 2026-05-01=30/0(Tier0 incumbents 보존) + 2026-06-01=30/30(B++ AI 재선정 2026-06-24; 직전 73차 30 교체. 리더 2/11)
select count(*) from tier0_candidates_150;  -- 기대 150 (2026-06 = B++ cfg1 G1 적용 2026-06-24; 리더 4/11, unresolved sector 0)
select count(*) from portfolio_proposal where month='2026-06-01';  -- 기대 1 (10종목/현금15%, regen 2026-06-11)
select count(*) from portfolio_approval where month='2026-06-01';  -- 기대 1 (accept·is_final=true, 2026-06-12 10:11 KST Accept DONE)
select count(*) from portfolio_snapshot where month='2026-06-01';  -- 기대 14 (종목 12 + 현금 1 + aggregate 1, 실 entry_price)
```
> **2026-06-24: `short_list_30`/`tier0_candidates_150` 2026-06 = B++ cfg1 기준으로 교체됨(G1/G2 적용) + `stock_reports` 2026-06 = B++ 새 30(Tier2 포함) 재생성·검증 완료(ⓐ).** B++/B+C 예측 검증은 NO-CONFIG-PASSES로 닫혔으나(상승 예측 claim 금지), USER 결정으로 B++ diagnostic funnel을 production에 적용. 이제 `stock_reports`/`committee_votes` 30/750 audit는 새 B++ 30 리포트(section_0~8+appendix + 330 core + 420 sector, NULL-sector 0)와 **정합**. 마이그 0040/0041 production applied(live-catch CHECK 23514 fix).
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
| 검증 게이트 | build OK / lint 0 err 0 warn / **test:ci 2064 PASS + 4 skipped**(PR-T2a sector-board-step/cron writer/runSectorEval DI/seam +) / tsc clean / DART pytest 18 + screen/shadow python unittest 189(B++ apply guard +). |
| **MVP 엔진** | **W0~W3b 전부 ✅ MERGED**(모델/프로바이더 추상화 + 주간/월간 split + incumbent thesis + 반박 토론 loop + judge/dual-judge + entry_price + AI 자율 포트 proposal→Accept→cash row). canonical 5-PR + B65/B66 ✅. 상세 = git log + PR body. |
| **실 AI 검증** | P1(2026-05 ₩334.71) + 73차 풀 P3(₩24,655.64) + 74차 P2b(₩1,695.83) + 75차 P4 30 리포트(₩14,962.66) + 76/77차 proposal(₩54.71) + **2026-06-24 G2 B++ 재선정(~₩27k) + 새 30 리포트 Tier2 생성(~₩30k, retry 2 + 336570 섹터보드 repair 포함)**. 2026-06 월 누계 **≈₩98,170**(hardcap 50만 내). |
| **선정 흐름 (production)** | `short_list_30` 2026-06-01 = **B++ 새 30 AI 배지/ai_score**(🟣16/🟢4/🟡9/🔵1, 10/10/10; 리더 2/11 SK하이닉스·HD현대일렉트릭; **2026-06-24 B++ 재선정으로 73차 30 교체**) · 2026-05-01 = 30 Tier0 incumbents. 메인 path = short 주간 + mid·long 월간 rolling. **B++ funnel 적용(G1/G2) + 새 30 리포트 Tier2 생성 완료. 다음 = go-live USER 게이트 + S7b**. |
| **스코어링 방법론** | **production = B++ cfg1(trend+size; foreign/DART OFF) 적용 완료(2026-06-24, G1/G2)**. tier0_candidates_150 리더 4/11(73차 1/11). approval_basis=`USER_PRODUCTION_FUNNEL_DIAGNOSTIC`. **예측 검증 캠페인은 NO-CONFIG-PASSES/research-CLOSED — B++은 retrieval 개선 diagnostic funnel이지 예측 게이트 통과 아님(상승 예측 claim 금지).** 산출/로그/provenance sidecar에 미통과 명시. hard-gate 영구 금지. SoT = B++ spec(2026-06-19 UPDATE) + ProgressDashboard [CURRENT]. |
| **풀 리포트 (production)** | `stock_reports` 2026-06 **30행 = B++ 새 30 (Tier2 포함, 2026-06-24 재생성·검증)** — section_0~8+appendix + committee_votes 330 core + 420 sector = 750 + partA 14 + partC.sector_aggregate + NULL-sector 0. **PR-T2a(Tier2 배선) ✅ CONVERGED + 마이그 0040/0041 applied**. 잔여 = PR-T2c FE 렌더 확인 + 완결성 체크 갭(pre-launch). report_batch_job 30 done. 2026-05-01 004150 1행(P1 잔존). |
| Supabase | project `rbrpcynhphrpljbjirfo` · **마이그 0001~0037 + 0040/0041 production applied**(0040 `commit_sector_personas_cron` + 0041 `commit_sector_personas_sector_fix` = live-catch CHECK 23514 corrective: admin+cron 양쪽 INSERT에 sector=p_sector). cron RPC grants = service_role(public/anon/authenticated revoke). |
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
| ✅ **B++ funnel 적용(G1→G2)** | CLAUDE + USER 비용승인 | **DONE (2026-06-24)** | 73차 기존 funnel(소형주 편향) 150/30을 B++ diagnostic funnel로 업그레이드 완료. G1 = cfg1 trend+size·foreign/DART OFF `--apply` 150 write + rollback backup + `approval_basis=USER_PRODUCTION_FUNNEL_DIAGNOSTIC`; G2 = USER 비용 승인 후 Tier1 재선정(~₩27k) 완료. Production `tier0_candidates_150`/`short_list_30` 2026-06 = B++ cfg1 기준. 예측 검증은 NO-CONFIG-PASSES이므로 상승 예측 claim 금지·출력에 미통과 명시. SoT = B++ spec 2026-06-24 APPLIED + 2026-06-19 UPDATE §5 step5. |
| **Step 7 S7b** 뉴스 자동 제외(M12a) + 모닝 브리핑(M11) | USER(Naver B-8 + Telegram B-9 + AI 키) + CLAUDE | B++ G1/G2 + go-live USER gates 완료 후 | AI 페르소나(Core 11) 뉴스 평가 → per-company thesis-break → direct/material/high-conf 자동 제외(빼기만·freed→현금) + smart brake + durable ledger + 텔레그램/`/admin/alerts` 알림. **개발 순서 = S7b shadow-first**: S7b에서 M12a **shadow/alert-only**(`M12A_AUTO_REMOVE_ENABLED` default false)로 먼저 붙이고, D11 운용검증에서 Track Record 기준선과 함께 관찰 → 자동 제거 ON은 출시 후 fast-follow. **M12a 자동 mutation = 출시 게이트 아님.** spec SoT = `ServicePlan-Admin §3.10 M12a`. 이메일/Resend 전역 미사용. **디자인 결합**: D3 신규 화면 final-style 동시구현(S7b 화면 = S7b 구현과 함께), D1은 S7b UI 착수 전 필수. |
| **Step 8 D11** AI 가상 포트 1차 가동 게이트 | USER 운용 + CLAUDE 모니터링 | S7b + PR-H/I/J D11 전 hard gate(manual trigger 2종 ✅ + PR5b/Section8 full path ✅ P2b + runtime mock grep 0) 완료 후, S7c 전 | KIS 0개로 어드민 3인 며칠~1주 운용 검증(의사결정 품질·승인·재생성 cap·알림 정확도). acceptance gate UI = 리포트 section_8 부재 시 '🤖 Tier 1 평가 대기' pill + Section 0 🔢🤖합의 배지 1행(✅ STEP-1). **디자인 결합**: D2 기존 핵심 플로우 정밀(홈/리스트/리포트/포트폴리오/승인)은 D11 진입 전 필수. |
| **Step 9 S7c** 장중·KIS WS + Exit 텔레그램+/admin 2-layer | USER(Telegram B-9 + KIS B-10) + CLAUDE | D11 검증 통과 후 | 실 alert_event + KIS read-only 1개 WS + Exit 텔레그램 best-effort + `/admin/alerts` durable event + 대안 3 + T+7 outcome. **디자인 결합**: D3 신규 화면 final-style 동시구현(S7c 화면 = S7c 구현과 함께). |
| **Step 10 S7d** Silent Health | CLAUDE | S7c 완료 후 | 5 파이프라인 success_rate + red_alert 0 + Exit outcome T+7 cron. (코드+테스트 완결, 실 DB/브라우저 실검증만 Docker/USER 대기.) |
| **Pre-launch 섹터 비교 메뉴 + Tier2 잔여 렌더 + D4 디자인 freeze** | CLAUDE + USER 비용승인 | S7d 완료 후, S9 진입 전 | 섹터 추천 비교 메뉴 build(**production B++ 30 vs Track2 `sector-soft-tilt`(B++ + 섹터) 30 + returns**, hard-gate live 금지·검증 전 자동교체 금지) + **PR-T2a ✅ 완료/CONVERGED + 마이그 0040/0041 applied + 새 30 리포트 Tier2 생성 완료(2026-06-24)** 후 잔여 **PR-T2c Section 8 섹터 보드 FE 렌더 확인**(데이터 생성됨) + **완결성 체크 갭 fix**(Core-only completeness → 섹터보드 실패 미복구) + 선택 D-1 dangling cleanup + D4 `/gstack-design-review` QA/polish/freeze. PR-A5/PR-B5 통계 verdict는 deferred/연구. |
| **PR-K Reflection 자가학습 빌드 (D32 — 출시 전 승격)** | CLAUDE 빌드 + USER(AI 키/비용 = 활성화) | S7d 이후 ~ S9 진입 전 빌드 · S9 기간 중 실가동·검증 | reflection_log 마이그(0038~, dormant flag) + track별(주1/월1, 65차 Q1) 회고 job + 직전 사이클 실현 수익률(KRX) → 다음 선정 prompt 주입(`reflectionContext` seam 재사용). 데이터 의존 → S9 1개월+ 운용으로 (단기/주간 트랙) 첫 회고 사이클 검증 → 출시 시 작동하는 자가학습(중장기 월간은 S9 길이·첫 선정일 의존·no-op fail-soft, spec §4). **D32(2026-06-24 USER) 승격** — 구 "출시 후 defer"(62차 doc-class `8fc91d4`, USER 명시 결정 아님) supersede. Q5 incumbent thesis(D27, 선정 시점·구현됨 PR #91)와 seam 공유하나 별개(혼동 금지). **빌드 완료 = S9 진입 선행조건(sequencing); Reflection 동작·품질 = soft launch criterion(§2.2 7-criteria 미변경, hard-block 아님)**. SoT spec = `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md`. |
| **Step 15 S9 운용 → 🎉 출시** | USER 1개월+ + CLAUDE hotfix | Pre-launch 섹터 비교 메뉴 + Tier2 배선 + D4 freeze + PR-K Reflection 빌드 완료 후 | 어드민 3인 실 사용 1개월+ + 위 7 criteria 통과 = 출시 (★ S9 기간 중 PR-K Reflection 실가동·검증). **디자인 결합**: D4 freeze(S7d 후 · S9 직전) 완료 후 진입 — 풀 리디자인 아님, `/gstack-design-review` QA + polish + 회귀 차단만. |
| **[출시 후] S8 자동매매** | USER(Binance B-11) + CLAUDE | 출시 후 | 주식 KIS + 바이낸스 USDT-M 선물 · Strategy drop-in + AI 어댑터 · 가드레일 + Binance Smoke #3. |

---

## 3. 사용자 액션 대기 큐 (pending only · 완료분은 git log + §6)

| 우선 | 작업 | 필요 액션 |
|---|---|---|
| ✅ **Accept go-live — DONE (MVP ② 완료)** | 2026-06-12 10:11 KST USER Accept 클릭 → `portfolio_approval` 2026-06-01 **accept·is_final=true** + `portfolio_snapshot` 14행(종목 12 + 현금 7% + aggregate, 실 entry_price). D31 게이트 완화(PR #120·배포)로 버튼 활성됐고 클릭 영속 확인. 마이그 0034/0035 재실행 금지(verify만). | (완료 — 멤버 공개 시 `PORTFOLIO_ACCEPT_GATE_STRICT=true`) |
| ✅ **B-SEL-CRON** (PR #118 MERGED) | CLAUDE fix 완료(period-scoped due-gate + SELF_CONTINUE opt-out ON + orphan/stall/track alert + cost-month + stale-guard). 남은 건 USER flag(아래 매달 자동화 게이트로 통합). | ~~CLAUDE fix~~ → USER flag |
| ✅ **Tier0 B+C/B++ 예측 검증 캠페인 — 완료·research/CLOSED** | step-2 + full-factor 4-config×3-regime + tradable-denominator + combination 모두 **NO-CONFIG-PASSES/FAIL**. 결론 = 무료 데이터로는 예측 스킬 미검증, **상승 예측 claim 금지**. 이 closed verdict는 예측 claim에만 해당하며 B++ funnel 적용 결정을 닫지 않는다. [SoT: B++ spec 2026-06-19 UPDATE + review docs] | (완료 — research/CLOSED) |
| ✅ **B++ funnel 적용 (G1/G2) — DONE (2026-06-24)** | G1 = `tier0_candidates_150` 2026-06 B++ cfg1 적용(리더 4/11) + G2 = `short_list_30` 2026-06 재선정(리더 2/11, ~₩27k). production = B++ 기준. diagnostic funnel(예측 claim 아님). | (완료) |
| ✅ **새 30 리포트 Tier2 포함 생성 (ⓐ) — DONE (2026-06-24)** | PR-T2a ✅ CONVERGED + **마이그 0040/0041 production applied** + flags(`SECTOR_BOARD_ENABLED`/`PR5B_SECTION8_ENABLED`/`AI_COST_LOG_REAL_INSERT_ENABLED`) + CLAUDE P4-style 생성 → `stock_reports` 2026-06 = B++ 새 30(330 core + 420 sector, NULL-sector 0). 비용 ~₩30k(월 누계 ≈₩98k). live-catch CHECK 23514 → 0041 fix. | (완료) |
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
| **AI 자가 학습 Reflection / PR-K (D32, 출시 전 승격)** | `docs/superpowers/specs/2026-06-24-reflection-prk-pre-launch-promotion.md` |
| 실데이터+실AI e2e ADR + 11-PR 로드맵 (단 D-6/PR-K Reflection = D32로 출시 전 승격 → 위 D32 spec 우선) | `docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md` |
| **Tier0 B++ 검증 + funnel 적용 결정** | `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` 2026-06-19 UPDATE + `docs/superpowers/reviews/2026-06-17-tier0-4config-multiregime-verdict.md` + `docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md` + `docs/superpowers/2026-06-18-tier0-combination-campaign.md` — USER 결정으로 **B++ diagnostic funnel G1/G2 적용 완료(2026-06-24)**; prediction campaign remains **NO-CONFIG-PASSES/research-CLOSED**(상승 예측 claim 금지) |
| omxy R-debate 적대 검토 runbook | `docs/superpowers/omxy-rdebate-runbook.md` |
| Smoke/audit catalog (W-ticket) | `docs/superpowers/audit-catalog.md` |
| S7 mock→real Phase/DoD (S7a~S7d + T7e.7 RLS QA) | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷 / 실 I/O 통로 / 잔존 mock | `Document/Process/CodebaseStatus.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |
| MVP 엔진 LOCKED 9 결정 (변경 금지) | memory `project_mvp_engine_4workstreams_2026_06_04` + `CLAUDE.md ⭐ 헤더` |

---

## 6. 완료/연구 로그 (pointer-only)

> 완료 PR의 라운드별 omxy/Claude 서사·중복 snapshot은 여기서 반복하지 않는다. 원본은 git log·PR body·각 spec/review에 위임한다. 이 섹션은 다음 세션이 "이미 끝난 것/launch 밖인 것"을 착각하지 않도록 포인터만 둔다.

| 항목 | 현재 의미 | SoT 포인터 |
|---|---|---|
| MVP ①②③ 완료 | 30 AI 리스트(73차) + 포트폴리오 Accept(2026-06-12) + 30 풀 리포트(75차) 완료. Launch path는 이제 S7b 이후 운용 단계. | git log/PR #109, #118~#120, P4 harness 기록, 본 문서 §1/§3 |
| Tier0 B++/B+C 예측 검증 캠페인 | **Research/CLOSED for prediction claim only**. step-2/full-factor/tradable-denominator/combination 모두 NO-CONFIG-PASSES/FAIL이라 상승 예측 claim 금지. USER 결정으로 production 150/30은 **B++ 기준 교체됨(2026-06-24)** + `stock_reports` 2026-06 = **B++ 새 30(Tier2 포함) 재생성·검증 완료**. money-path / production effect 0 불변은 검증 캠페인에 한정. | `docs/superpowers/specs/2026-06-12-tier0-scoring-bplus-validation.md` 2026-06-19 UPDATE, `docs/superpowers/reviews/2026-06-17-tier0-4config-multiregime-verdict.md`, `docs/superpowers/2026-06-18-tier0-tradable-winner-denominator.md`, `docs/superpowers/2026-06-18-tier0-combination-campaign.md` |
| Path-A PRISM식 섹터 레이어 | Product direction is **pre-launch 섹터 추천 비교 메뉴**: production B++ 30 vs Track2 `sector-soft-tilt`(B++ + 섹터) 30 + returns. PR-A1 in-pool rerank is auxiliary only; live hard-gate remains forbidden; B++ + 섹터의 production 채택은 후속 검증 뒤에만 가능. PR-A5/PR-B5 statistical verdict runs are deferred/research. | Parent `docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md`; Track2 `2026-06-20-pathA-track2-generator-shadow.md`; PR-B5 `2026-06-22-pathA-track2-prb5-forward-recall-evaluator.md` §14; PR-A5 `2026-06-23-pathA-track1-pra5-verdict-evaluator.md` §11 |
| Tier2 섹터 페르소나 → 리포트 배선 | Pre-launch quality lane. **PR-T2a ✅ 완료/CONVERGED + 적용(2026-06-24)**: live report path `SECTOR_BOARD_ENABLED` seam + cron service-role commit + **마이그 0040/0041 applied** + 새 30 리포트 섹터보드 생성 완료(420 sector votes). 잔여 = **PR-T2c FE render 확인** + 완결성 체크 갭 fix + 선택 D-1 dangling cleanup. live-catch(0041 CHECK fix)·완결성 갭 = memory [[feedback_mocked_rpc_hides_check_violation]]. | `docs/superpowers/specs/2026-06-23-tier2-sector-persona-report-wiring.md` |
| Toss-D0~D4 디자인 | Pre-launch quality lane. D0=지금 spec-only, D1=S7b UI 전, D2=D11 전, D3=S7b·S7c 동시, D4=S7d 후·S9 전 `/gstack-design-review` freeze. | `Document/Service/Planning/ServicePlan-Admin.md §1A.1 디자인 방향 · §1A.5 D29` |

Older completed implementation history = `git log --oneline`, PR bodies, and `Document/Build/ProgressDashboard.md` historical entries.
