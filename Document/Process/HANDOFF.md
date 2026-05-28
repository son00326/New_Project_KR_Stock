# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-28 (60차 §4 post-PR-#56 HANDOFF sync `22ceb6f` — code baseline `058a372`, PR #56 impl MERGED `058a372` Task 5 B66 C 하이브리드 sector mapper + 마이그 0026 + B89 strict block. plan PR #55 plan SoT `bbf102d`. 마이그 0026 production apply는 USER 잔여. 60차 §3 modified workflow [Claude 1차 / OMXY 1차 검증 + 직접 fix / Claude verify] PR #55 plan(R1+R2 10 catches) + PR #56 impl(R1 5 BLOCKERS) 모두 CONVERGED. 다음 세션 = USER production apply (마이그 0026 + --backfill-induty + screen --apply) OR Task 7 Smoke Stage 2 USER 비용 승인.)

## 현재 baseline

- **main/docs-sync HEAD** = `22ceb6f` (docs-only post-PR-#56 HANDOFF sync; runtime은 `22ceb6f` 또는 자손 기대). **Code/deploy baseline** = `058a372` (post-PR-#56 impl, 마이그 0026 dart_corp_codes.induty_code 컬럼 추가 + scripts/canonical_sector_mapper.py + override + --backfill-induty + B89 strict block — production apply는 USER 잔여). **PR #55 plan SoT** = `bbf102d`. 다음 세션은 `git rev-parse --short origin/main`으로 runtime verify.
- **OPEN PRs**: **#2** (format-error, CONFLICTING 보류) only.
- **검증 게이트**: main 기준 build 25 routes / lint 0 err 5 warn (pre-existing) / **test:ci 1325 PASS** / 118 files / tsc clean / **Python 69 tests PASS** (canonical_sector_mapper 29 + sector_override 9 + screen_shortlist_tier0 17 + seed_dart_corp_codes 14).
- **Vercel Production env truth**: `PR4_TRIGGER_UPSERT_ENABLED="true"` ✅ + `AI_COST_LOG_REAL_INSERT_ENABLED="true"` ✅.
- **Vercel canary** (post-HANDOFF sync): public 3/3 OK on tudal.vercel.app (`/` 200 / `/login` 200 / `/macro` 200). Prior post-PR-#54 `/admin` 200 기록은 유지하되, 인증 세션 canary는 여전히 권장.
- **Production functional truth**: PR4 + B65-P1/P3 + 마이그 0025 + env=true. cron INSERT path 전면 가동: silent-health (heartbeat_log + heartbeat_missing alert) + news-sweep (news_event + news_critical alert) + morning-briefing (briefing_log + briefing_failed alert). Task 7 Smoke Stage 2 PASS는 아직 아님.
- **Production audit baseline (60차 §1 측정, post-PR-#54 재측정 필요)**: `cost_log=0 / stock_reports=0 / committee_votes=0 / alert_event=0 / pipeline_health=0 / heartbeat_log=0 / news_event=0 / briefing_log=0 / short_list_30=30`. cron 다음 실행 후 heartbeat_log/news_event/briefing_log/alert_event 적재 검증.
- **§5.3 schema preflight (PR #54)** — USER Supabase re-auth 후 검증 권장 (omxy R6 caution): alert_event_alert_type_check 12종 + alert_event_severity_check 3종 + briefing_log_date_uniq + RLS. schema 0006/0010 long-applied (구조 변경 0) → drift 위험 매우 낮음. (PR #53 §5.3는 ALL PASS drift 0 완료.)
- **W- defer 상태**: `W-cost-log-env-gate` ✅ / `W-news-cron-service-role-read` ✅ / `W-pipeline-health-admin-assertion` ✅ / `W-cron-alert-event-insert` ✅ **resolved** (PR #54 3-source 통합) / `W-briefing-log-insert` ✅ **resolved** (PR #54). 잔존 W-defer: `W-alert-event-dedup` (다음 마이그 슬롯 0027+ partial unique index — 마이그 0026은 PR #56이 dart_corp_codes.induty_code로 차지) + `W-portfolio-snapshot-real` (S7b morning-briefing portfolioSnapshot 실 SELECT).

## 다음 1순위

**남은 USER gate (Task 5 production backfill)**:
1. **(USER, Task 5)** 마이그 `tudal/supabase/migrations/0026_dart_corp_codes_induty_code.sql` production apply (Supabase MCP `apply_migration` 또는 dashboard) — dart_corp_codes.induty_code/last_status/last_seen_at 컬럼 추가 + `^[0-9]{3,5}$` CHECK constraint.
2. **(USER, Task 5)** `DART_API_KEY` 환경변수 로드 후 `scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty` 실행 (DART API key + ~46분 소요, fail_fast 시 즉시 중단). 2,766 corp_code에 induty 백필.
3. **(USER, Task 5)** `scripts/.venv/bin/python scripts/screen_shortlist_tier0.py --month 2026-05-01 --as-of 2026-05-11 --apply --csv-backup scripts/out/short_list_30_2026-05_C-hybrid.csv` (B89 strict block 통과 후) — B93 PASS 확인 (`select sector, count(*) from short_list_30 group by sector` → canonical 14만, placeholder/unknown_pending 0).
4. **(USER, 비차단)** §5.3 PR #54 preflight (Supabase re-auth) + 인증 세션 canary.
5. **(USER+CLAUDE)** Task 7 Smoke Stage 2 — 환경 준비 완료; USER 1회 비용 승인 후 실 AI smoke (~5,000~6,000원/회).
6. **(CLAUDE)** 이후 Task 8 audit + PR5 cron 30 자동 plan SoT. (cron mock cleanup Step 2 전체 완료 — 모든 cron INSERT 실 path 가동.)

**실 AI trigger 클릭은 Task 7 승인 전 절대 금지** (~5,000~6,000원/회 burn).

**운영 원칙**: 본 HANDOFF는 다음 세션 행동에 필요한 최소 current state만 inline. 직전 2 code/history entry만 §6에 유지하고, older detail/round count/commit chain은 git log + PR body + spec/plan docs에 위임. self-referential drift 위험이 큰 commit count/SHA chain/round count는 runtime verify 우선.

---

## 0. 세션 시작 루틴 (verify + auto-progress)

```bash
# 60차 §4 baseline — docs-sync HEAD `22ceb6f` 또는 자손 / code baseline `058a372` post-PR-#56 Task 5 impl MERGED / PR #55 plan SoT `bbf102d`.
# 60차 누적: PR #53 (heartbeat_log + news_event) + PR #54 (alert_event 3-source + briefing_log) + PR #55 (Task 5 B66 plan SoT) + PR #56 (Task 5 B66 impl).
# 59차 누적 MERGED: PR #39~#51 — Mock cleanup Step 2.3~2.7b.1 + docs sync.
# 58차 누적 MERGED: PR #30~#34 + 마이그 0025 production applied.
# OPEN: #2 only (format-error, CONFLICTING 보류).
# main/docs-sync HEAD = `22ceb6f` 또는 자손. code baseline = `058a372` post-PR-#56 Task 5 impl MERGED. PR #55 plan SoT = `bbf102d`. 마이그 0026 = dart_corp_codes.induty_code (USER production apply 잔여).
cd /Users/yong/New_Project_KR_Stock

# 1. main branch state runtime 확인 (B75 fixed SHA 박제 금지 — post-PR-#56 descendant 자손 기대)
git checkout main && git pull origin main
git rev-parse --abbrev-ref HEAD                   # main
git rev-parse --short HEAD                        # 기대: `22ceb6f` 또는 자손 (docs-sync); code baseline은 `058a372`
git status --short                                # clean

# 2. OPEN PRs (60차 §4 PR #56 종료 post-merge baseline: #2 only — PR #39~#56 MERGED, feature/docs branches deleted)
gh pr list --state open --json number,title,headRefName,mergeable
#   #2   fix/s7a-format-error-inventory (format-error, CONFLICTING 보류)

# 3. 60차 누적 MERGED + canonical 5-PR + B65 3-phase + Task 5 B66 확인
git log --oneline | head -10
#   기대: HEAD `22ceb6f` 또는 자손 (docs-sync), code baseline `058a372` (post-PR-#56 Task 5 impl MERGED), PR #55 plan SoT `bbf102d`
#   상세 commit 체인 = git log + PR body 위임

# 4. 검증 게이트 (code/deploy baseline `058a372`; docs-sync 자손 허용 — 매 세션 진입 시 1회)
#    - test:ci 실측 = 1325 PASS / 118 files (60차 §4 PR #56 baseline; +8 drift detect vs PR #54 baseline 1317)
#    - build 25 routes (cron routes 정상) / lint 0 err 5 warn (pre-existing) / tsc clean / Python 69 tests PASS / 마이그 0026 SQL committed (production apply USER 잔여)
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit && cd ..

# 5. production audit 재확인 (§2.1 active 8-row matrix Task 1 = entry routine, 매 세션 1순위)
#    Supabase MCP `mcp__supabase__execute_sql` 또는 dashboard로 실행:
#      select count(*) from cost_log;                                         -- 기대 0 (아직 실 trigger/PR5 cron 실행 기록 없음)
#      select count(*) from stock_reports;                                    -- 기대 0 (Task 7 Smoke Stage 2 또는 PR5 실행 후 1+)
#      select count(*) from committee_votes;                                  -- 기대 0
#      select count(*) from short_list_30;                                    -- 기대 30
#      select sector, count(*) from short_list_30 group by sector order by 2 desc;
#                                                                              -- 기대: ('코스닥', '코스피') placeholder 잔존 (B66 C 하이브리드 적용 전), Task 5 PASS 후 canonical 14
#      select column_name from information_schema.columns
#        where table_schema='public' and table_name='dart_corp_codes'
#          and column_name in ('induty_code','induty_last_status','induty_last_seen_at');
#                                                                              -- 마이그 0026 apply 전 0 rows, apply 후 3 rows
#      select conname from pg_constraint where conname='dart_corp_codes_induty_code_format_check';
#                                                                              -- 마이그 0026 apply 후 1 row
#    drift (cost_log > 0 등) 시 누군가 trigger를 눌렀거나 Smoke/cron이 실행된 것 — §1 ground truth 갱신.

# 6. Vercel/authenticated canary (권장)
#    Vercel env=true 완료. /admin/settings/cost + /admin/report/[ticker]/regenerate + /admin/portfolio 버튼 노출/경고 확인.
#    실 trigger click은 Task 7 비용 승인 후만 실행.
```

### 진입자 자동 행동 (§2.0 default-progress policy, 60차 §4 종료 갱신)

1. **§0 verify 실행** → branch state + PR state (**#2 CONFLICTING 보류 only** — PR #39~#56 MERGED) + 검증 게이트 + **production audit 재확인** (PR #53 §5.3 완료 / PR #54 §5.3 권장 잔여 + Supabase rows + **마이그 0026 production apply 상태 확인**).
2. **§9 박제 확인** — PR4 + B65-P1/P3 MERGED + 마이그 0025 applied + Vercel env=true + **PR #53 + PR #54 cron INSERT 실 path 전면 가동** + **PR #55 Task 5 plan SoT CONVERGED + PR #56 Task 5 impl MERGED `058a372`** (60차 §3 modified workflow Claude+OMXY+Claude). Smoke Stage 2 PASS 전이며 trigger 클릭은 실 AI 비용 burn이므로 USER 승인 전 금지. **마이그 0026 production apply는 USER 잔여 (Supabase re-auth 필요).**
3. **§2.1 active matrix 다음 unblocked step 식별**:
   - Task 1 ✅ (57차 §1) / Task 2 ✅ `5b99e03` / Task 3 ✅ (57차 §2) / Task 4 ✅ `3c09d6e` + 마이그 0025
   - B-trackrecord-rls ✅ `838386e` / Mock cleanup Step 1 ✅ `1d2db08` / Step 2.1 ✅ `e6be73f` / Step 2.2 ✅ `2dca060`
   - Step 2.3 ✅ `e273cc2` / Step 2.4 ✅ `4e15176` / Step 2.5 ✅ `6c5ce2c` / Step 2.6 ✅ `845b9ca`
   - Step 2.7a ✅ `6c85f13` / Step 2.7b.1 ✅ (PR #50) / Step 2.7b.2 ✅ `a351033` (60차 PR #53) / Step 2.7b.3 ✅ `50cb94a` (60차 §2 PR #54)
   - Task 5 plan SoT ✅ `bbf102d` (60차 §3 PR #55, OMXY R1+R2 10 catches direct-edit CONVERGED) / **Task 5 impl ✅ `058a372` (60차 §4 PR #56, OMXY R1 5 BLOCKERS direct-edit CONVERGED + Python 69 tests + 마이그 0026 SQL ready + production apply USER 잔여)**
   - **다음 1순위**: (USER, 필수) Task 5 production backfill 3-step → 마이그 0026 apply → --backfill-induty → screen --apply with B89 strict block / (USER, 비차단) PR #54 §5.3 preflight/인증 canary / (USER, 필수) Task 7 Smoke Stage 2 비용 승인 / (CLAUDE) USER apply 완료 후 Task 8 audit + PR5 cron plan SoT 진입.
4. **Owner 별 행동**:
   - **[CLAUDE]** → 즉시 자동 시작 (stacked 1세션+ 작업은 진입 의사 1회 확인).
   - **[SHARED]** → "이어서 진행" 권한으로 prepare/commit/push/PR-create 자동; post-merge baseline docs-sync direct commit은 사용자 명시 + docs-only + reversible일 때 CLAUDE.md 자동 허용 범위 안.
   - **[USER]** → (권장) 인증 세션 production canary verify + Smoke Stage 2 시점 1회 비용 승인 (Task 7). Vercel env=true 완료 상태.
5. **§2.0 명시 USER 승인 게이트 (좁힘, 60차 R7 fix)** 도달 시만 USER 직접 묻기 — scope expansion / product spec / risk profile / real-money / cost burn 트리거 / 마이그 production apply / **Vercel env / secrets / flag 토글** / external account / 외부 메시지 / destructive (force push to main, DB drop) / uncertainty ≥ medium. **자동 진행 허용** (PR merge rebase FF + delete-branch / docs-sync PR create+merge / 사용자 명시 post-merge baseline docs-only direct commit / public canary curl + authenticated browser canary / non-destructive deploy status polling / PR create+comment+body 갱신 / branch cleanup) — omxy R-debate CONVERGED + 검증 게이트 ALL GREEN = 사용자 승인 등가 (CLAUDE.md ⚙️ 자동 진행 허용 범위 한정).
6. **§7 omxy 적대적 검토 패턴**은 모든 신규 작업 branch에서 강제 적용. 최신 상세 round/catch/fix chain은 git log + PR body + debate transcript에 위임하고, HANDOFF에는 scope guard + 결론 + 잔여 W-ticket만 유지.

---

## 1. 현재 상태 (docs-sync HEAD `22ceb6f` 또는 자손 / code baseline `058a372` post-PR-#56 Task 5 impl MERGED / PR #55 plan SoT `bbf102d` / Vercel canary public 3/3 OK, 2026-05-28)

| 영역 | 상태 |
|---|---|
| main/docs-sync HEAD | **`22ceb6f`** (docs-only post-PR-#56 HANDOFF sync; runtime은 `22ceb6f` 또는 자손 기대). **Code baseline `058a372`** = PR #56 Task 5 B66 C 하이브리드 impl MERGED. **PR #55 plan SoT `bbf102d`** + **PR #56 impl `058a372`** (11 files / +1846 lines, 마이그 0026 dart_corp_codes.induty_code + scripts/canonical_sector_mapper.py + override + --backfill-induty + B89 strict block — 마이그 production apply는 USER 잔여). **다음 세션 진입 시 `git rev-parse --short origin/main`으로 runtime verify**. |
| **PR #56 (60차 §4 Task 5 B66 impl)** | ✅ MERGED `058a372` — 11 files / +1846 lines, Python 69 tests + Vitest +8 drift detect (test:ci 1317 → 1325). 60차 §3 modified workflow OMXY R1 **5 BLOCKERS direct-edit** (HIGH: B89 dry-run fail-closed exit 2 + --backfill-induty fail_fast return 1 / MED: KSIC 282/2820/28202 exact prefix + T5/T7/T8 coverage gap + 322000/226330 override seed). 신규 SoT code: `scripts/canonical_sector_mapper.py` (longest-prefix mapper + override loader + resolve_sector + explain) + `scripts/sector_override.json` (4 entries) + `scripts/screen_shortlist_tier0.py::resolve_sectors_for_universe + enforce_b89_strict_block` + `scripts/seed_dart_corp_codes.py --backfill-induty + DART status matrix + crtfc_key redaction` + 마이그 0026 (dart_corp_codes induty_code + last_status + last_seen_at + `^[0-9]{3,5}$` CHECK) + TS drift detect (canonical-sectors.ts 수정 0). **USER 잔여 액션 (Task 5 production backfill 3-step)**: 마이그 0026 apply → `DART_API_KEY` 로드 후 venv seed `--backfill-induty` → venv screen `--apply --csv-backup` (B89 strict block). |
| **PR #55 (60차 §3 Task 5 B66 plan SoT)** | ✅ MERGED `bbf102d` — plan-only PR (PR #28 Task 4 plan SoT 패턴), 1 file +494 lines, 코드 변경 0. **60차 §3 modified workflow (사용자 명시)**: 1차 진행 Claude / 1차 검증 + 직접 fix OMXY / fix verify Claude. OMXY R1+R2 누적 **10 catches direct-edit**. plan §부록 A 산출물 catalog → PR #56 1:1 구현 완료. plan SoT path: `docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md`. |
| **PR #54 (60차 §2 Mock cleanup Step 2.7b.3)** | ✅ MERGED `50cb94a` — 3 cron route alert_event INSERT (heartbeat_missing + news_critical + briefing_failed) + morning-briefing briefing_log INSERT. 통합 `insertAlertEvents` (append, ALERT_TYPE_SET+SEVERITY_SET guard) + `insertBriefingLog` (date upsert). independent best-effort (각 독립 try/catch, dbError ??=, skip 0). omxy R-debate **5 rounds CONVERGED** (R1~R4 plan + R6 impl, native critic subagents 동원, 누적 15 plan catches + impl 0). 7 commits FF / +21 net tests (1296→1317) / 회귀 0. **W-cron-alert-event-insert + W-briefing-log-insert resolved**. PR #54 §5.3 production schema preflight는 USER re-auth 후 권장 잔여. |
| **PR #53 (60차 Mock cleanup Step 2.7b.2)** | ✅ MERGED `a351033` — silent-health heartbeat_log + news-sweep news_event INSERT. omxy 6 rounds CONVERGED. 상세 = git log + PR #53 body. |
| **PR #50 (59차 Mock cleanup Step 2.7b.1)** | ✅ MERGED — news cron service-role wiring + 4-way auth hardening. W-news-cron-service-role-read fully resolved. Historical; PR #53/#54가 INSERT path까지 완료. |
| **PR #48 (59차 Mock cleanup Step 2.7a)** | ✅ MERGED `6c85f13` — silent-health 실 SELECT via service-role DI + 3 mock 삭제 + 4-way auth hardening + W-pipeline-health-admin-assertion READ side fully resolved. |
| **PR #46 (59차 Mock cleanup Step 2.6)** | ✅ MERGED `845b9ca` — news cron routes MOCK_ADMIN_NEWS → 기존 `admin-news.ts::getRecentNewsEvents` 재사용 + format-error mapping + 2 mock 삭제 + W-news-cron-service-role-read defer 박제. |
| **PR #44 (59차 Mock cleanup Step 2.5)** | ✅ MERGED `6c5ce2c` — health page MOCK_ADMIN_PIPELINE_HEALTH → 실 pipeline_health SELECT (신규 helper `admin-pipeline-health.ts::getRecentPipelineHealth` + Step 2.3/2.4 ASC pagination 정합 + schema fail-closed enum + non-finite/negative latency guard + Server Component async + format-error mapping), omxy patch-suggest 2 rounds CONVERGED 4 catches + omxy 직접 fix commit `fd2d4e8` + 2 W-pipeline-health-* defer. |
| **PR #42 (59차 Mock cleanup Step 2.4)** | ✅ MERGED `4e15176` — cost page MOCK_ADMIN_COST_LOG 3 fixture → 실 cost_log SELECT (신규 helper `admin-cost-log.ts::getMonthlyCostLog` + CORE_11 11 production persona.id Set + Server Component async + 시연 section 삭제 + mock 파일 삭제 consumer 0), omxy patch-suggest 2 rounds CONVERGED 1 BLOCKER catch + omxy 직접 fix commit `c2897b4` + 1 W-cost-log-core11-drift defer. |
| **PR #40 (59차 docs sync)** | ✅ MERGED `d052aa7` — HANDOFF.md post-PR-#39 docs sync only. |
| **PR #39 (59차 Mock cleanup Step 2.3)** | ✅ MERGED `e273cc2` — regenerate `MOCK_ADMIN_COST_LOG` → 실 `cost_log` SELECT pagination loop, omxy 6 rounds CONVERGED 12 catches → 10 fix + 2 W- defer (W-cost-log-admin-assertion + W-cost-log-pagination-snapshot) |
| **PR #21 (B65-P1)** | ✅ MERGED `5b99e03` (57차 §1) — Task 2 production active |
| **PR #20+#22+#24+#25 (docs chain, 57차 §1 lifecycle)** | ✅ MERGED in main (branches deleted, PR #23 CLOSED 운영 원칙 반려) |
| **PR #26 (57차 §2 — B65-P2 spec doc + HANDOFF sweep + cleanup, docs-only, 3 commits)** | ✅ **MERGED in main `33098e0`** (rebase FF, --delete-branch, 2026-05-26, Vercel deploy SUCCESS E41zxrqAeRGfB7E99h82hXpZkAd2) |
| **Vercel last verified production deploy/canary** | ✅ code baseline `058a372` (docs-sync `22ceb6f` code delta 0); post-HANDOFF sync public canary 3/3 OK on `tudal.vercel.app` (`/` 200 + `/login` 200 + `/macro` 200). Prior post-PR-#54 `/admin` 200 기록 유지. cron route 검증: silent-health 15:00 UTC (heartbeat_log + heartbeat_missing alert) + news-sweep 00:00 UTC (news_event + news_critical alert) + morning-briefing 23:00 UTC (briefing_log + briefing_failed alert) — 전면 INSERT 실 path. 인증 세션 canary 권장: `/admin/settings/health` + `/admin/settings/cost` + `/admin/alerts` empty state. |
| **PR4 (canonical 5-PR 마지막)** | ✅ MERGED `7de9696` (PR #19, 56차 §5) — 상세 = §6 56차 §5 entry + PR #19 body |
| canonical 5-PR MERGED (전체 완료) | PR2 `f85fb69` / PR3a `0813a41` / PR1 `4aa3130` / PR3b `cf68731` / PR3c `b2a902a` / PR4 `7de9696` |
| **57차 §1 Task 1 (production audit)** | ✅ COMPLETED — drift 0 (57차 §2 entry routine 재실행 시점에도 동일 ground truth) |
| **57차 §1 Task 2 (B65-P1 immediate guard) ✅ MERGED** | PR #21 MERGED `5b99e03`. P1 guard production active. |
| **57차 §2 Task 3 (B65-P2 RPC R-debate spec doc) ✅ CONVERGED R8 final** | spec doc = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` (DRAFT R1 → R8 final). 결정 lock-in: **옵션 A** `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + section_0~7 + appendix only + axis (i)A admin trigger 책임 = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 cron path 충돌 없음. spec doc only (no impl code, 0 migrations). |
| **PR #21 OMXY (57차 §1, 4 rounds CONVERGED)** | R1+R2+R3+R4 — 모두 **BLOCKERS 0** · WATCH (비차단): P3 도입 시 feature flag toggle (`PR4_TRIGGER_UPSERT_ENABLED`, B98 default) |
| **57차 §2 Task 3 OMXY (8 rounds, SIGNAL=ESCALATE max-8-rounds 정합 §7.5)** | R1 6 BLOCKERS + R2 5 + R3 5 + R4 3 + R5 2 + R6 1+2 minor + R7 2 + R8 ESCALATE max-8 + 3 mechanical fix. native critic subagent 6명 (Godel R1 5 BLOCKERS + 4 WATCH / Feynman R2 / Planck R3 / Schrodinger R4 / Franklin R5 / Hypatia R6). **누적 catch 30+ 모두 fix 반영**. |
| ✅ **PR4 + B65-P1/P3 + Mock cleanup Step 1~2.7b.3 + 마이그 0025 + Vercel env=true** | production functional 가능 상태. cron INSERT mock cleanup Step 2 전체 완료. 단 `cost_log=0 / stock_reports=0` last-known audit상 아직 실 AI trigger/PR5 cron 실행 기록 0건. trigger 클릭은 실 AI 비용 burn(~5,000~6,000원/회)이므로 Task 7 USER 승인 전 금지. §9는 Smoke/B66/PR5 readiness catalog로 유지. |
| **B66 quality/trust blocker** | `short_list_30` 30 rows sector="코스닥"/"코스피" placeholder는 아직 production data에 잔존. **Approach lock-in = C 하이브리드**: PR #55 plan SoT `bbf102d` + PR #56 impl `058a372` 모두 MERGED. mapper/override/마이그 0026/--backfill-induty/B89 strict block 코드는 준비 완료이며, 실제 `short_list_30` backfill write는 USER Supabase re-auth/write gate 잔여. |
| **B67~B98 + 9 신규 audit (57차 §2 + 58차 Step 2.x)** | 56차 §5 omxy 11+ 항목 + 57차 §2 R-debate 6 신규 (B79 / B-versioning / W-tier1pill / W-grant-smoke ✅ RESOLVED / W-sectionfallback-text / W-cost-log-env-gate) + 58차 Step 2.x 3 신규 (W-mock2-rls-drift / W-s5b-admin-assertion / W-ticker-re-kr-only). Smoke Stage 2 PASS 후 audit (§9 + Task 8). |
| **58차 Task 4 B65-P3 impl ✅ MERGED `3c09d6e` + 마이그 0025 production applied** | PR #30 7 commits FF, omxy R1~R3 CONVERGED. 마이그 0025 = `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + 4-grant matrix + SECURITY DEFINER + search_path. 옵션 A lock-in 정합. |
| **다음 세션 1순위** | ⭐ USER 작업 = **Task 5 production backfill 3-step** (마이그 0026 apply → `DART_API_KEY` 로드 후 `scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty` → `scripts/.venv/bin/python scripts/screen_shortlist_tier0.py --month 2026-05-01 --as-of 2026-05-11 --apply --csv-backup scripts/out/short_list_30_2026-05_C-hybrid.csv`). PR #54 §5.3/canary는 USER 권장 잔여(비차단), Task 7 Smoke Stage 2 비용 승인은 필수 USER gate. |
| Mock Skeleton + DQ-7 + S7e + S7a + Tier 2 | ✅ Mock 완료 / 🟢 DQ-7 ~97% (Smoke #4/#5 + Session 4 QA 잔여) / 🟢 S7e 7/8 (T7e.7 RLS QA 잔여) / ✅ S7a MERGED (51차) / ✅ Tier 2 D21 (52차+53차) |
| 선정 흐름 메인 path | 🟢 spec lock-in: Tier 0 150 → Tier 1 Core 11 AI 평가 → 단/중/장 top 10 = 30. 현재 production = Tier 0 단독 30 직선정 (fallback). **PR5 cron 가동 시 메인 path 활성 (Mock cleanup Step 2 완료 + B66 C 하이브리드 backfill + Smoke Stage 1+2 PASS 후만 진입)**. |
| 풀 리포트 흐름 | 🟢 PR3b writer Section 0~7 + Section 8 partA/partD + PR3c 3-step orchestration + PR4 admin caller wired + B65-P3 admin-only UPSERT RPC + 마이그 0025 production applied + Vercel env=true. **production functional 가능 상태이나 last-known audit상 cost_log=0 / stock_reports=0 — 아직 성공/기록된 AI 호출 및 리포트 0건**. trigger 클릭은 비용 burn이므로 Task 7 승인 하에 Smoke Stage 2에서 검증. |
| OPEN PRs | **#2** (format-error, CONFLICTING 보류) only — PR #56 impl `058a372` + HANDOFF sync `22ceb6f` 완료; PR #55 plan SoT `bbf102d`; PR #54 Step 2.7b.3 `50cb94a`; PR #53 `a351033`; 59차 PR #39~#51 + 58차 PR #30~#34 MERGED. |
| 실 AI 호출 | **현재 0건** (last-known production audit: cost_log=0). Vercel env `PR4_TRIGGER_UPSERT_ENABLED=true` + `AI_COST_LOG_REAL_INSERT_ENABLED=true` 완료, 충전 완료. 첫 실 AI smoke는 지금 가능하지만 비용 burn(~5,000~6,000원/회)이므로 Task 7 USER 승인 후 실행. |
| Production deploy/canary | Vercel code baseline `058a372` (docs-sync `22ceb6f`는 code delta 0); post-HANDOFF sync public canary 3/3 OK (`/` + `/login` + `/macro`) ✓ public 회귀 0. Prior post-PR-#54 `/admin` 200 기록 유지. 인증 세션 canary 권장: `/admin/settings/health` + `/admin/settings/cost` + `/admin/report/[ticker]/regenerate` + `/admin/alerts` + `/admin/settings` empty state. cron route 검증: silent-health 15:00 UTC (heartbeat_log+alert) + news-sweep 00:00 UTC (news_event+alert) + morning-briefing 23:00 UTC (briefing_log+alert). |
| Supabase | project `rbrpcynhphrpljbjirfo` · **0001~0025 production 적용 완료** (0025 = 58차 Task 4 `upsert_report_sections_0_7_admin` admin-only UPSERT RPC). **0026 SQL committed in PR #56 but production apply USER 잔여** (dart_corp_codes.induty_code). SECURITY DEFINER 4-grant 패턴 유지. |
| 검증 게이트 (code baseline `058a372`; docs-sync 자손 허용) | build 25 routes / lint 0 err 5 warn (pre-existing) / **test:ci 1325 PASS / 118 files** / tsc clean / **Python 69 tests PASS**. |
| omxy debate 상태 | 최신 PR #55 plan + PR #56 impl 모두 CONVERGED (60차 §3 modified workflow, PR #55 OMXY R1+R2 10 catches, PR #56 OMXY R1 5 BLOCKERS direct-edit). HANDOFF에는 current 결론/W-ticket만 유지하고, 라운드 수·catch 수·fix commit 세부 chain은 git log + PR body + cmux transcript 위임. |

---

## 2. 출시까지 선형 Runbook

### §2.0 Default-progress policy

**"이어서 진행해줘" 받았을 때 Claude의 행동 규칙**:

- If current step is USER-gated, report it briefly as background blocker and proceed to the next unblocked CLAUDE step.
- Do not repeatedly ask which option to choose when the runbook already defines the next CLAUDE step.
- Stop only at explicit USER-gated operations or the exception list below.

**자동 진행 허용 vs 항상 USER-only 정책은 본 프로젝트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책` 섹션이 SoT** (58차 종료 omxy R1~R4 CONVERGED 박제). 본 §2.0에서는 high-level 요약만:

- **자동 진행 허용** (사용자 명시 권한 ON + omxy CONVERGED + 검증 게이트 ALL GREEN): PR merge / docs-sync PR / 사용자 명시 post-merge baseline docs-only direct commit / canary / deploy polling / branch cleanup / PR create.
- **항상 USER-only** (CLAUDE는 가이드 + 후속 verify, 실 실행 X): Vercel env / secrets / flag 토글 / 마이그 production apply / billing / live-money / external account / cost burn 트리거 / 외부 메시지 발송 / destructive (force push to main, DB drop).
- **uncertainty ≥ medium** + **product spec changes** + **scope expansion** + **new risk profile**: 사용자 묻기 강제.

상세 분류 + Output Modes + Context Packet 표준 + Native Critic Role Taxonomy + 단계별 subagent/skill 매핑 = CLAUDE.md 참조. memory: [[feedback_user_action_auto_progress]] + [[feedback_omxy_debate_workflow]] + [[feedback_no_user_approval_gate]].

### §2.1 Step matrix (main docs-sync `22ceb6f` post-PR-#56 HANDOFF sync; PR #56 impl `058a372`; PR #55 plan SoT `bbf102d` — **PR5 진입 = Task 5 production backfill + Smoke Stage 1~2 PASS 후**)

**현재 위치 = 60차 §4 post-PR-#56 HANDOFF sync baseline (Task 5 impl PR #56 ✅ + plan SoT PR #55 ✅ + cron INSERT mock cleanup Step 2 전체 완료)**:
- **PR #53** Step 2.7b.2 heartbeat_log + news_event INSERT 완료 (`a351033`).
- **PR #54** Step 2.7b.3 alert_event 3-source + briefing_log INSERT 완료 (`50cb94a`). 세부 catch/fix chain은 PR #53/#54 body + git log 위임.
- **PR #55** Task 5 B66 C 하이브리드 plan SoT 완료 (`bbf102d`, plan-only/code 0, OMXY R1+R2 10 catches direct-edit CONVERGED).
- **PR #56** Task 5 B66 C 하이브리드 impl 완료 (`058a372`, 11 files/+1846, OMXY R1 5 BLOCKERS direct-edit CONVERGED, production apply USER 잔여).

**누적 박제**: 58차 PR #30~#34 + 마이그 0025 + 59차 PR #39~#51 + 60차 PR #53/#54/#55/#56 모두 MERGED, main docs-sync `22ceb6f`. 라운드/commit 상세는 git log + PR body 위임.

**다음 1순위** = **(USER) Task 5 production backfill 3-step**: 마이그 0026 production apply → `DART_API_KEY` 로드 후 `scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty` → `scripts/.venv/bin/python scripts/screen_shortlist_tier0.py --month 2026-05-01 --as-of 2026-05-11 --apply --csv-backup scripts/out/short_list_30_2026-05_C-hybrid.csv` (B89 strict block). **(USER 권장)** PR #54 §5.3 production schema preflight + 인증 세션 canary. **(USER 필수)** Task 7 Smoke Stage 2 비용 승인. B66 production write는 USER Supabase re-auth/write gate. Vercel env는 이미 true; 실 AI trigger는 Task 7 승인 전 금지.

Owner 의미: **USER** (사용자만) · **CLAUDE** (자동) · **SHARED** ("이어서 진행" 권한으로 push/PR-create 자동; docs-sync PR/direct post-merge baseline commit은 사용자 명시+docs-only 범위에서 허용, deploy/migration은 USER).

#### 다음 세션 active matrix — 8-row sequence (Task 1~4 ✅ 완료, Task 5~8 잔여)

| # | Task | Owner | 상태 | 박제 |
|---|---|---|---|---|
| 1 | **현행 audit 재확인** (Supabase 직접 query: `cost_log` / `stock_reports` / `committee_votes` / `short_list_30` sector quality) | CLAUDE | ✅ COMPLETED (57차 §1) — drift 0 확인 | 매 세션 entry routine 1순위로 재실행 (drift detect). 본 §1 ground truth와 동일한 결과 확인. drift (cost_log > 0 등) 시 PR #21 머지 효과 또는 Smoke Stage 2 결과 반영 가능. |
| 2 | **B65-P1 immediate guard (Phase 1) + B86 month format** | CLAUDE | ✅ **MERGED in main `5b99e03`** (57차 §1, PR #21, Vercel deploy SUCCESS) | `triggerFullReport`에 `reportExistsForMonth(input.ticker, ${month}-01)` preflight 추가. false → `report_not_found` / throws → `report_lookup_failed`. **historical**: P2/P3 미완료 시 cost-burn fail-fast. 현재는 P3 + env=true 완료로 real path 가능. |
| 3 | **B65-P2 real enablement (Phase 2) + B88 RPC R-debate spec doc** | CLAUDE | ✅ **COMPLETED in 57차 §2 (spec doc CONVERGED R8 final)** | spec doc = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md`. omxy R-debate 8 rounds (R8 ESCALATE max-8 정합 §7.5) + native critic subagent 6명 + 누적 catch 30+ 모두 fix. **결정 lock-in: 옵션 A** `upsert_report_sections_0_7_admin` admin-only UPSERT RPC + section_0~7 + appendix only + axis (i)A admin trigger 책임 = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 cron path 충돌 없음. spec doc only (no impl code, 0 migrations). **Task 4에서 마이그 0025 + feature flag impl 완료**. 신규 6 audit ticket 박제 (B79 / B-versioning / W-tier1pill / W-grant-smoke / W-sectionfallback-text / W-cost-log-env-gate). |
| 4 | **B65-P3 P1/P2 호환 (Phase 3) + B98 default policy (feature flag) + 마이그 0025 impl** | CLAUDE | ✅ **impl MERGED in main `3c09d6e`** (58차, PR #30 rebase FF + delete-branch, omxy R-debate 3 rounds CONVERGED). ✅ 마이그 0025 production apply + Vercel env=true 완료 → production functional 가능; Task 7 Smoke Stage 2는 USER 비용 승인 후 | **plan SoT** = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` (929 lines, MERGED). omxy R-debate R1~R5 누적 23 BLOCKERS catch & fix (Schop 8 + Kepler 3 + Plato 3 + Sartre 2 + Aristotle 1 = 17 unique + 6 dup recall) — Ramanujan R5 CATCH 0 CONVERGED + HANDOFF sweep R1~R2 Descartes CATCH 0. **impl scope**: (i) feature flag `PR4_TRIGGER_UPSERT_ENABLED` (.env.example=`false` safe default, Production Vercel env=`true` 적용 완료, B98 lock-in) + (ii) 마이그 0025 `upsert_report_sections_0_7_admin.sql` + rollback (admin-only, service_role 명시 REVOKE — Kepler B2 critical) + (iii) orchestrator 분기 + rpcName-guarded error 분리 + (iv) actions B65-P1 guard flag toggle + (v) format-error 2 keys + 1 prefix handler = 3 entries + (vi) TDD invariants 8종 (Test 1 action seam + Test 4b 2-phase DB integration + Test 7 SQLSTATE matrix + Test 8 env cleanup). **smoke는 P3 후만 가능** (B94). impl PR #30 MERGED, branch deleted; 상세 = PR #30 body + git log. |
| 5 | **B66 C 하이브리드 + B84 backfill + B89 unknown policy + B93 PASS criteria** | CLAUDE ✅ → USER(production apply) | ✅ **impl PR MERGED `058a372`** (60차 §4 PR #56, OMXY R1 5 BLOCKERS CONVERGED). plan SoT `bbf102d` PR #55. **USER 잔여 = production backfill 3-step** | **plan SoT** = `docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md` (494 lines, MERGED). **60차 §3 modified workflow (사용자 명시)**: 1차 진행 Claude / 1차 검증 + 직접 fix OMXY / fix verify Claude. **R1 lock-ins (PR #55)**: longest-prefix `^[0-9]{3,5}$` mapper (5-digit 가정 폐기), KSIC coverage = mapper rule + mandatory override fixture, **B89 strict block** (unresolved 1+ → `--apply` 전면 거부, `unknown_pending` production 저장 금지 = B93 위반), override 최소화 (mapper가 틀리는 ticker만), dart_corp_codes consumer matrix (`seed_dart_corp_codes.py` + `screen_shortlist_tier0.py` + `dart_signals.py::_lookup_corp_code`), Python↔TS drift = TS SoT 유지 + drift test가 TS 읽기. **impl complete (PR #56, plan §부록 A 1:1)**: (i) `scripts/canonical_sector_mapper.py` ✅ + `sector_override.json` ✅ 4 entries (254490/452200/322000/226330) (ii) 마이그 0026 ✅ (iii) `seed_dart_corp_codes.py --backfill-induty` ✅ + fail_fast return 1 (iv) `screen_shortlist_tier0.py` placeholder 제거 ✅ + enforce_b89_strict_block dry-run/apply exit 2 (v) TDD: Python 69 + TS 드리프트 8 = 1325 PASS. **Production write gate (USER 잔여 액션 3-step)**: (1) 마이그 0026 production apply (Supabase MCP) (2) `DART_API_KEY` 환경변수 로드 후 `scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty` (~46분, fail_fast 즉시 중단) (3) `scripts/.venv/bin/python scripts/screen_shortlist_tier0.py --month 2026-05-01 --as-of 2026-05-11 --apply --csv-backup scripts/out/short_list_30_2026-05_C-hybrid.csv` (B89 strict block 통과 후). **B93 PASS**: (1) 30 rows all sector ∈ `CANONICAL_SECTORS` (2) sector ∉ ('코스피','코스닥') (3) sub_tags jsonb null OR string[]. |
| 6 | **Smoke Stage 1 — non-AI dry-run (B97 fix)** | CLAUDE | 🔴 PR5 entry blocker 4순위 (Task 4 후 진입) | `triggerFullReport`에 mock `orchestrateFullReport` 주입 (vi.doMock). **P1+P2+P3 호환 invariant test**: P3 호환 완료 시 P2 path 진입 (mock called) / 비호환 시 P1 fail-fast (mock not called). cost=0. **B96 target**: short_list_30 존재 + stock_reports 부재 ticker. TDD 단위 테스트. |
| 7 | **Smoke Stage 2 — single real AI (B97 fix + B85 + B87)** | CLAUDE+USER | 🔴 PR5 entry blocker 5순위 (Task 6 후 진입) | **Stage 1 PASS 후만 진입**. USER 승인 + B85 model id 1 token verify 선행. **Core smoke (필수)**: criteria 1 `cost_log` row + 2 `stock_reports` row sections + 3 `report_critic_findings` + 5 UI render. **Full-path (옵션 B만)**: criteria 4 `committee_votes`. real cost = `cost_log` 기준 확정 (token usage 기반). |
| 8 | **B67~B98 audit + PR5 진입** | CLAUDE | 🟢→⭐ (Task 7 후 진입) | Smoke Stage 2 PASS 후: B67~B98 catalog 11+ 항목 audit (cron / cost_log retry / RPC 책임 / hardcap mock 등). 모든 priority audit clear 후 **PR5 cron 30 자동 + 큐 인프라** plan SoT 작성 진입 (T11 분할 결정 보존, 16,050원/월 hardcap 4%; B65-P2 RPC 선택이 PR5 cron path와 호환 시만). |

> **§9 참조**: production functional은 가능 상태지만 B66/Smoke Stage 1+2/Task 8 audit PASS 전까지 §9 + 본 8-row matrix를 유지. 모두 PASS 시 PR5 active submatrix로 교체.

#### PR4 historical submatrix (PR #19 MERGED `7de9696`) — historical, PR body 위임

PR4 lifecycle (Task 1.0 ~ Task 9 모두 ✅ MERGED, 50 BLOCKERS catch & fix, 3-track Fix-First) 상세 = **PR #19 body + git log + spec/plan/REVIEW docs** 위임. 본 §2.1 active matrix는 후속 작업 (Task 4 onwards)만 표시.

#### 후속 PR + 운영 (PR5 + S7b~S9)

| Step | Owner | Trigger | Default action | Verification |
|---|---|---|---|---|
| **PR5** cron 30 자동 + 큐 인프라 (T11 분할 결정 보존) | CLAUDE | **§2.1 active 8-row matrix Task 1~7 모두 PASS 후** (B65-P1/P2/P3 + B66 C 하이브리드 backfill + Smoke Stage 1+2 PASS) | cron monthly-batch route에 30 종목 풀 리포트 자동 호출. caller path = `orchestrateFullReport` (quality, Kevin v3.1 target). timeout 처리 = (β1) Vercel Queues OR (β2′) 자체 DB job queue resumable worker — PR5 plan 시점 R-debate. fail = γ1 allSettled + γ3 retry N + summary alert. cost = δ1 + batch preflight. admin_id = 'cron-system'. service-role client DI + cost_log e2e test. **30 × 535원 ≈ 16,050원/월 (hardcap 4%)**. **D4 박제 (AI 비중 % production active 시점, omxy R3 B1 + PR #24 R1 B1 fix)**: PR5 cron 가동 시 AI 종목별 비중 + 현금 0~30% 제안 production 활성. **저장 SoT** = `short_list_30.suggested_weight` (per-stock weight) + `portfolio_snapshot.weight` / `is_cash` (승인 시 종가 100% 가정 daily snapshot) + `portfolio_approval` event. **section_8.partD ≠ 비중** — partD는 Core 11 위원별 vote rows × 11 (찬반 의사결정, schema = `section-8-schema.ts`). **admin Accept/Reject 모델 (수동 비중 편집 X)**. Reject 후 재분석/hold 정책 SoT = `ServicePlan-Admin §1.3 J1 + §3.3 R3.3-1/R3.3-8 (2인 풀 리포트 열람 게이팅 D15) + §3.4 R3.4-2 + §4.2 E1/E4/E5 + §1A.0 D11`. **호환성 게이트 (57차 §2 R8 final lock-in 정정)**: 옵션 A 채택은 PR5 cron path와 **충돌 없음**. PR5 cron 30 자동 path quality는 commit_persona_eval (full path) + service-role caller wire + B79 RPC 통합을 PR5 plan에서 별도 소유. 본 옵션 A는 admin path를 좁게 처리 + cron path readiness는 PR5에서 독립 확보 (axis iii no-conflict). | omxy + 3-track deep review |
| **Step 4 Reflection** | CLAUDE | **PR5 cron 30 자동 가동 + 실 Tier 1 결과 누적 후** (R9 non-blocker watch 정정) | reflection_log 마이그 + Tier 1 context 주입 + tests. PR5 cron 가동되어야 매월 실 결과 → 다음달 prompt 주입 의미 발생. | omxy + 3-track deep review |
| **Step 7 S7b** 뉴스+브리핑 mock→real | USER 트리거 (B-7 Resend + B-8 Naver) + CLAUDE 구현 | PR5 cron 가동 후 | mock news_event → 실 Naver news sweep + Resend 도메인 인증 + 모닝 브리핑 일 23:00 UTC cron 가동 | S7-RealData.md S7b DoD |
| **Step 8 D11 AI 가상 포트 1차 가동 게이트 (omxy R3 B3 fix)** | USER 운용 + CLAUDE 모니터링 | S7b 완료 후, S7c 진입 전 | **KIS 0개로 어드민 3인 며칠~1주 운용 검증 — 가상 포트 의사결정 품질·승인 워크플로우·재생성 cap·뉴스 분류 등 검증** (D18 박제). AI 비중 % + 현금 0~30% 제안 + Accept/Reject 흐름이 실제 사용 환경에서 만족스러운지 확인. **S7c/S8 진입 게이트**. 만족 시 → S7c. 불만족 시 → S7b/PR5 retro + 조정. | 어드민 3인 만족도 + Track Record 일별 snapshot 정상 적재 |
| **Step 9 S7c** 장중·KIS WS + Exit 2채널 실 연결 (omxy R3 B2 + PR #24 R1 B2 fix) | USER 트리거 (B-9 Telegram + B-10 KIS) + CLAUDE 구현 | D11 운용 검증 통과 후 | mock alert_event → 실 alert_event SELECT + KIS 본인 1개 WS read-only 시세 + **J3 Exit real path**: target/momentum/bad-news 3 트리거 감지 → Telegram + 이메일 + `/admin/alerts` 배지 3채널 발송 → 대안 시나리오 3개 (전량/분할/홀딩) + 어드민 결정 기록 + `alert_event(exit_signal)` 적재 → **T+7일 outcome 자동 적재 (IM-3 Exit 신뢰도 65%+ 목표)** | S7-RealData.md S7c DoD + ServicePlan-Admin §3.10 **R3.10-11 (트리거/3채널 요구)** + R3.10-12~14 (이벤트 + 대안 + outcome) |
| **Step 10 S7d** Silent Health | CLAUDE | S7c 완료 후 | 5 파이프라인 success_rate 모니터링 + red_alert 0건 + Exit outcome T+7 자동 적재 cron | S7-RealData.md S7d DoD |
| **Step 11~14 S8** 자동매매 (분리 단독 진입) | USER 트리거 (B-11 Binance) + CLAUDE 구현 | S7d 완료 후 (단독 진입) | 주식 KIS (모의→실계좌) + 바이낸스 USDT-M 선물 (testnet→mainnet) · Strategy drop-in + AI 어댑터 embed · 가드레일: 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회 · Binance Smoke #3 | `Slices/S8-AutoTrading.md` DoD |
| **Step 15** S9 운용 | USER 1개월+ 운용 + CLAUDE 모니터링 hotfix | S8 머지 후 | 어드민 3인 실 사용 + hotfix branch | §2.2 7 criteria |

### §2.2 ✅ 어드민 내부 도구 출시 게이트 (S9 1개월+ 후 7 criteria)

1. **최소 1개월 운용** (어드민 3인 일일 사용 + 운영 로그)
2. **BL-KRIT open 0개**
3. **3인 admin 핵심 플로우 일일 완료**: Short List 30 → 풀 리포트 → 승인 → 가상 포트 추가 → 알림 발송. disclaimer 모든 화면 visible.
4. **cron / health 안정**: Silent Health red_alert 0건 + 5 파이프라인 success_rate ≥ 99% + Vercel production canary OK
5. **비용 hardcap 정상**: 월 400,000 KRW 미만 + AI 일 주문 ≤ 20회 + `cost_log` 정확 적재
6. **RLS / credential smoke 통과**: advisor anon WARN 0 + Smoke #3/#4/#5/#6 통과 + credential 평문 노출 0건
7. **(자동매매 가동 시) guardrail 위반 0**: 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회 운영 1개월 위반 0

---

## 3. 사용자 액션 대기 큐

| 우선 | 작업 | 필요한 사용자 액션 |
|---|---|---|
| ~~B-11pr-merge~~ ✅ DONE | ~~PR #11 (PR2) 머지~~ MERGED in 54차 §2 (`f85fb69`, 7 commits FF + canary 검증) | ✅ |
| ~~B-12pr-merge~~ ✅ DONE | ~~PR #12 (PR3a Group H schema drift fix) 머지~~ MERGED in 54차 §3 (`0813a41`, 11 commits FF + canary 검증) | ✅ |
| B-1 ~ B-5 (DQ-7) | 친구 비번 + KIS row 정리 + Smoke #4/#5 RLS + Session 4 QA | DQ-7 close 잔여 |
| B-7 | Resend 도메인 인증 | S7b briefing 진입 시 |
| B-8 | Naver key rotate/env | S7b news 진입 시 |
| B-9 | Telegram bot token + admin 3 chat_id | S7c alerts |
| B-10 | KIS 본인 1개 OpenAPI key/account | S7c WS read-only |
| B-11 | Binance key (testnet 우선) | S8 진입 시 |
| **B-D11 (omxy R3 B3 fix)** | **D11 AI 가상 포트 1차 가동 며칠~1주 운용 검증** (어드민 3인 만족도 확인 후 S7c 진입 승인) | S7b 완료 후, S7c 진입 전 |
| **W-tier1pill (57차 §2 omxy R1 h + R2 e' + R3 ε + native critic W3)** | Section 8 absent 리포트 = **Tier 1 평가 대기 pill UI 추가** (D11 운용 검증 acceptance gate). PR4 14 defer follow-up tickets와 별개 신규 ticket. Step 8 (D11 게이트) 본문도 acceptance gate 명시로 갱신. | B65-P2 마이그 0025 impl PR + Smoke Stage 2 통과 후, D11 운용 검증 진입 전 |
| B-12 | 보안 rotate | Supabase anon/service_role/DB password/PAT, 노출 키 rotate |
| B-13 | Vercel CLI v52→v54 update | 향후 deploy 권장 |
| B-stash | `.gitignore` stash 결정 (`phase0-cleanup-gitignore`) | `git stash list` 후 pop 또는 drop |
| B-2A | HIBP leaked-password protection 토글 | Supabase dashboard → Auth → Policies |

해소 historical (B-17, B-17b~g, B-6, B-6a, B-6c) = git log + §6 entries.

---

## 4. 안전 규칙

- 이 제품은 내부 어드민 투자 운영 도구다. Public signup/member/pricing 트랙은 Deferred-D 재개 전까지 만들지 않는다.
- main 직접 commit은 기본 금지 (Vercel auto-deploy 영향). feature branch + PR. 예외: 사용자 명시 post-merge baseline docs-only direct commit(가역, 코드/DB/외부 시스템 변경 0)만 허용.
- S7a 완료 후 billing 충전 전까지 mock import를 real API로 몰래 바꾸지 않는다. billing-on은 USER 트리거 후에만 (53차 §4++ 완료).
- `/admin` 접근 = Supabase session refresh + `ADMIN_EMAILS` allowlist + RLS 3중 방어.
- `SUPABASE_SERVICE_ROLE_KEY` client-exposed 코드 절대 금지.
- credential plaintext/MEK/ciphertext UI/로그 노출 금지. credential secret = `src/lib/crypto/aes.ts` 서버 측 암호화.
- UI 문구 한국어 우선. 새 server action error code = `format-error.ts` 한국어 매핑 추가.
- Next.js 16 routing/middleware/server action 관련 변경 전 `tudal/node_modules/next/dist/docs/` 또는 공식 문서 확인.
- 신규 SECURITY DEFINER 함수 마이그는 반드시 3종 세트: `revoke from public` + `revoke from anon` + `grant to authenticated` (48차 lesson).
- PostgreSQL `IF <null>`는 true 아님 (49차 omxy R1 lesson): RPC guard 작성 시 `is null or ... is distinct from ...` + `coalesce(v->>'key', '') not in ...` 명시.
- `section_8.partD.vote = BUY/HOLD/SELL literal 유지`. DB 저장 시 RPC가 case 매핑 (BUY→approve / HOLD→abstain / SELL→reject). writer가 변환 금지 (49차 omxy R2 BLOCKER).
- `stock_reports` schema 호환 (49차 omxy final lesson): `generated_at` only (created_at/updated_at 없음), partial unique index `(ticker, month) WHERE is_latest = true` 보존.
- ~~PR1 cron 가동 ⊥ PR3a schema drift fix 미선행 = page crash inevitable~~ ✅ **해소** (54차 §3 PR3a MERGED — zod validation + null guard + dual-shape renderer).
- **canonical 5-PR 순서 절대 보존** (55차 §4 갱신): PR2 ✅ → PR3a ✅ → PR1 ✅ → PR3b ✅ → **PR3c ✅ MERGED `b2a902a` (PR #15)** → PR4. Group G ✅ 해소 (PR3c MERGED + 마이그 0023/0024 production applied + canary 4/4 PASS). PR3c scope = **3-step (analyst pure-code → writer → critic) + conditional revise (1회 hard cap)** — **Q7 invariant: document-specialist 0**. 재해석 금지.
- **silent null drop metric/log 격상** (PR3a P2 / red-team RT#2 / gsd CR-01): 현재 `parseSectionSafe` + `parseReportSection8` onError 콜백이 console.warn으로 위임. PR1 cron 가동 시점에 metric/structured log로 격상해서 production blind spot 차단.

---

## 5. 문서 SoT

> 운영 순서: 본 HANDOFF → spec/plan → Slice/ProgressDashboard → ServicePlan-Admin/ReportFramework → CodebaseStatus → 실행 규칙.

| 필요 정보 | 문서 |
|---|---|
| **53차 §5 정정 spec (canonical 5-PR + Group A-H + Hard gate 해소)** | `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` |
| **PR2 plan + REVIEW.md** | `docs/superpowers/plans/2026-05-21-pr2-tier1-screening.md` + `docs/superpowers/reviews/2026-05-21-pr2-tier1-screening-review.md` |
| **PR3a plan + REVIEW.md (54차 §3)** | `docs/superpowers/plans/2026-05-22-pr3a-group-h-schema-drift.md` + `docs/superpowers/reviews/2026-05-22-pr3a-group-h-schema-drift-review.md` |
| Step 3c caller wiring spec | `docs/superpowers/specs/2026-05-21-step3c-caller-wiring.md` (PARTIAL 박제) |
| S7a Anthropic spec + plan | `docs/superpowers/specs/2026-05-19-s7a-anthropic-wrapper-design.md` + `docs/superpowers/plans/2026-05-19-s7a-anthropic-wrapper.md` |
| Kevin v3.1 rubric spec | `docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md` |
| Tier 0/1/2 + 합의 배지 + Reflection 본문 | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19·D21·D22` |
| Section 8 jsonb canonical contract | `ServicePlan-Admin.md §4.2.1` |
| writer Section 8 작성 가이드 | `Document/Service/Report/ReportFramework.md §8` |
| **PR2 코드 SoT (54차 §1)** | `tudal/src/lib/screening/tier1-schema.ts` (zod 13 refinements + PersonaPanelSchema + assertPanelMatchesCore11) + `persona-eval.ts::runTier1Screening` (in-memory 150-call screening) |
| **PR3a 코드 SoT (54차 §3)** | `tudal/src/lib/data/report-section-schemas.ts` (Section 0~7 + Appendix zod with bounds + Section 8 dual-shape import + `parseSectionSafe`/`parseReportSection8` onError 콜백 + `partCToCommitteeAgg` helper) + `admin-reports.ts::transformStockReportRow` (ValidatedStockReport + per-section safeParse + ticker/section context warn) + `page.tsx` (null guards + SectionFallback + Section8ModernView/LegacyView dual renderer) |
| Tier 2 D21 코드 SoT | `tudal/src/lib/screening/canonical-sectors.ts` + `report/writer.ts` (commitSectorReport) + `screening/persona-eval.ts` (runSectorEval) + `data/mock-admin-committee-personas.ts` + 마이그 0018/0019 |
| Kevin reference (Tier 2 production prompts quality target, main 보존) | `Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html}` + `Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md` + `ReaderAnalogyCards-ConstructionToBio.md` + Samchundang. Step 3a SKIPPED (53차 §0) — IMVCOM 4 commits 모두 main ancestor 확인. |
| **S7 mock→real 전체 Phase/DoD SoT (omxy R3 B4 fix)** — S7a Anthropic / S7e Supabase / S7b 뉴스+브리핑 / S7c 장중·Exit / S7d Silent Health · 각 Phase Tasks / DoD / mock-to-real 전환 작업 분해 + T7e.7 RLS QA 결과 | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷 / 실 I/O 통로 / 잔존 mock | `Document/Process/CodebaseStatus.md` |
| 어드민 서비스 기획 본체 | `Document/Service/Planning/ServicePlan-Admin.md` |
| 슬라이스 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |

---

## 6. 완료/active 이력 (직전 2 §6 inline entry · older + parallel OPEN PR은 git log + PR body 위임)

상세는 git log + spec/plan/Slice/PR body + REVIEW.md. 본 §6은 직전 2 entry만 inline.

### 60차 §4 Task 5 B66 C 하이브리드 impl ✅ MERGED in main `058a372` (PR #56 rebase FF + --delete-branch + --admin, 60차 §3 modified workflow Claude+OMXY+Claude R1 5 BLOCKERS direct-edit CONVERGED, 2026-05-28)

- **사용자 명시 modified workflow (60차 §3, PR #55 plan + PR #56 impl 두 PR 모두 적용)**: (a) 1차 진행 = Claude (impl 11 files / +1846 lines / 8 신규) (b) 1차 검증 + 직접 fix = OMXY (agent + skill 자율 사용, working tree 직접 Edit/Write 권한) (c) fix verify = Claude (verification gates ALL GREEN + scope guard intact).
- **scope**: Task 5 B66 C 하이브리드 impl PR. plan PR #55 `bbf102d` §부록 A 산출물 catalog 1:1 구현. plan-only/code 0이 아닌 production code + 마이그 SQL 파일 추가 (apply는 USER 잔여).
- **code commit** (branch `feat/b66-c-hybrid-sector-mapper-impl`, deleted post-merge): 1 commit FF `058a372`.
- **신규 SoT code (8 files)**: 
  - `scripts/canonical_sector_mapper.py` (423 lines) — KSIC longest-prefix mapper (282/2820/28202 exact + 261/2611/2612 + 264 broad 통신 + 27 broad 바이오 + 14 canonical coverage) + `OverrideSchemaError` + `load_override` (6-digit ticker + canonical 14 enum + reason non-empty 검증) + `resolve_sector` (override → mapper → unresolved priority) + `explain` (review CSV용 trace).
  - `scripts/sector_override.json` (4 entries) — `254490` (반도체, induty=467 도매), `452200` (2차전지, induty=27212 측정장비), `322000` (에너지, induty=2612 반도체), `226330` (바이오, induty=582 SW). plan §4.2 R1 evidence + OMXY R1 catch 5 추가.
  - `tudal/supabase/migrations/0026_dart_corp_codes_induty_code.sql` — `add column induty_code text + induty_last_status text + induty_last_seen_at timestamptz` + `^[0-9]{3,5}$` CHECK constraint. RLS/grant 변경 0 (0013 dart_corp_codes 정책 그대로 적용). short_list_30 alter 0.
  - `tudal/supabase/migrations/0026_dart_corp_codes_induty_code.rollback.sql` — 3 컬럼 + CHECK constraint drop.
  - `scripts/test_canonical_sector_mapper.py` (29 tests) — T1 induty normalization 3~5자리 / T2 override priority / T4 unknown 처리 / T10 idempotency + longest-prefix wins + canonical 14 coverage.
  - `scripts/test_sector_override.py` (9 tests) — T3 schema validity: JSON parse fail / canonical 14 enum / 6-digit ticker / reason non-empty / tickers not dict.
  - `tudal/src/lib/screening/__tests__/canonical-sectors-drift.test.ts` (8 tests) — T6 Python ↔ TS drift detect (production TS SoT 직접 fs read + regex extract Python CANONICAL_SECTORS) + T7 SUB_TAG_CROSSWALK TS SoT only + Python에 SUB_TAG_CROSSWALK leak 0.
- **수정 SoT code (4 files)**:
  - `scripts/screen_shortlist_tier0.py` — placeholder `sector = "코스피" if market == "KOSPI" else "코스닥"` 제거 → `resolve_sectors_for_universe`로 mapper wire + `write_sector_review_csv` (unresolved/override trace, 7 컬럼) + `enforce_b89_strict_block` (dry-run/apply 모두 unresolved 1+ 시 exit 2 fail-closed) + main() integration.
  - `scripts/seed_dart_corp_codes.py` — `--backfill-induty` flag 신규 (default seed 영향 0) + `fetch_induty` (DART company.json status matrix 000/013/010/011/012/020/800/900/901 처리) + `backfill_induty` (counts.fail_fast > 0 → return 1) + `_redact_key` (crtfc_key 로그 redaction) + rate-limit baseline (0.2s/req, retry 3 with backoff 1→2→4s).
  - `scripts/test_screen_shortlist_tier0.py` — `FetchUniverseSectorTest` (placeholder 잔존 0 grep) + `ResolveSectorsForUniverseTest` (priority chain) + `WriteSectorReviewCsvTest` (unresolved + override only) + B89 strict block + mock 30 ticker integration.
  - `scripts/test_seed_dart_corp_codes.py` — `TestFetchInduty` (status matrix 10 tests: 000 3/5-digit success / 000 non-numeric induty → None / 013 no_data / 010/011/012/901 fail_fast no retry / 020 retry exhausted / network timeout / recovery 020→000 success).
- **OMXY R1 CONVERGED (5 BLOCKERS direct-edit, native critic + agent/skill 자율 사용)**:
  - HIGH #1: B89 dry-run unresolved가 exit 0 가능 → `enforce_b89_strict_block` 분리 + dry-run/apply 모두 `sys.exit(EXIT_CODE_UNRESOLVED=2)` fail-closed
  - HIGH #2: --backfill-induty fail_fast 후 shell exit 0 → `counts.fail_fast > 0` 시 `return 1` + CLI test 추가
  - MED #3: KSIC 282 exact-prefix trace 불명확 → `_PREFIX_RULES`에 282/2820/28202 명시 + longest-prefix test
  - MED #4: T5/T7/T8 coverage gap → mock 30 ticker seed pipeline integration test + SUB_TAG_CROSSWALK TS SoT drift guard + 0026에 short_list_30/RLS DDL 0 test
  - MED #5: 322000/226330 override seed 누락 → plan §4.2 R1 evidence 정합 추가
  - **SIGNAL: FIXED → Claude verify PASS → CONVERGED**
- **검증 게이트 ALL GREEN**:
  - build 25 routes / lint 0 err 5 pre-existing warn / **test:ci 1317 → 1325 PASS (+8)** / 117 → 118 files (+1 drift detect) / tsc clean
  - **Python 69 tests PASS** (canonical_sector_mapper 29 + sector_override 9 + screen_shortlist_tier0 17 + seed_dart_corp_codes 14)
  - scope grep ALL PASS: placeholder `sector = "코스피/코스닥"` 잔존 0 / mapper import 정합 / production credential leak 0 / SUB_TAG_CROSSWALK Python leak 0 / 0026에 short_list_30 alter/grant/policy 0
- **post-merge canary**: public 3/3 OK on tudal.vercel.app (`/` 200 + `/login` 200 + `/macro` 200). 코드 변경 사항은 모두 Python script + 마이그 SQL 파일 (Next.js 영향 0).
- **USER 잔여 액션 (Task 5 production backfill 3-step, USER-gated)**: 
  1. Supabase MCP `apply_migration` 또는 dashboard로 `tudal/supabase/migrations/0026_dart_corp_codes_induty_code.sql` production apply
  2. `DART_API_KEY` 환경변수 로드 후 `scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty` (DART API key + ~46분 소요, fail_fast 시 즉시 중단)
  3. `scripts/.venv/bin/python scripts/screen_shortlist_tier0.py --month 2026-05-01 --as-of 2026-05-11 --apply --csv-backup scripts/out/short_list_30_2026-05_C-hybrid.csv` (B89 strict block 통과 후)
  4. Supabase MCP `select sector, count(*) from short_list_30 group by sector` → B93 PASS 검증 (canonical 14만, placeholder/unknown_pending 0)
- **W-defer 업데이트**: 신규 추가 없음. `W-alert-event-dedup` 다음 마이그 슬롯 0027+로 갱신 (PR #56이 0026 차지).

### 60차 §3 Task 5 B66 C 하이브리드 plan SoT ✅ MERGED in main `bbf102d` (PR #55 rebase FF + --delete-branch + --admin, plan-only PR, 60차 §3 modified workflow Claude+OMXY+Claude R1+R2 누적 10 catches direct-edit CONVERGED, 2026-05-28)

- **사용자 명시 modified workflow (60차 §3)**: 본 plan PR 한정 — (a) 1차 진행 = Claude (DRAFT R0) (b) 1차 검증 + 직접 fix = OMXY (agent + skill 자율 사용, plan 파일 직접 Edit/Write 권한) (c) fix verify = Claude (post-CONVERGED status sync). 기존 catch-only/patch-suggest 패턴과의 차이 = OMXY가 catch뿐 아니라 direct-edit까지 (사용자 명시 예외).
- **scope**: Task 5 B66 C 하이브리드 (DART `induty_code` KSIC → canonical 14 mapper + seed pipeline 영구 심기 + override fallback) impl planning SoT. plan-only PR (PR #28 Task 4 plan SoT 패턴, 코드 변경 0).
- **code commit** (branch `feat/task5-b66-c-hybrid-plan`, deleted post-merge): 1 commit FF — `fbfad05` plan SoT 494 lines.
- **신규 SoT plan**: `docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md` (§0 scope guard + §1 SoT linkage 9 rows + §2 sequence 12 steps + §3 마이그 0026 옵션 A lock-in + SQL sketch + rollback + §4 KSIC longest-prefix mapping + override 최소화 + B89 strict block lock-in + §5 override file 운영 정책 + §6 TDD 10 invariants + §7 DART company.json API integration + §8 검증 게이트 + OMXY R-debate plan + §9 risks + 부록 A 산출물 + 부록 B R-debate 라운드 기록).
- **OMXY R-debate 누적 10 catches direct-edit CONVERGED**:
  - R1 (6 BLOCKERS direct-edit): (1) DART `induty_code` 자리수 5-digit 가정 폐기 → `^[0-9]{3,5}$` + longest-prefix match (실측 264/2612/29272/70113 혼재) (2) KSIC `canonical 14 전수 매핑` prefix-only 가정 폐기 → mapper rule 또는 mandatory override/test fixture coverage (3) R0 override 18 catalog → regression fixture 강등 (mapper가 이미 맞히는 금융/보험/자동차는 override 금지) (4) B89 lock-in 변경 → `unknown_pending` production 저장 폐기 (B93 위반) → strict block + lightweight manual review (5) 마이그 옵션 A 영향 분석 보정 → `dart_signals.py::_lookup_corp_code` consumer matrix 추가 + regression gate (6) Python↔TS drift 방식 정리 → TS SoT (`canonical-sectors.ts`) 유지 + drift test가 TS 읽어 Python list와 비교
  - R2 (4 minor direct-edit): C1 §0 B89 stale wording → R1 lock-in 반영 / C2 §9.3 direct-fix scope catalog "부록 B 라운드 기록 추가" 복원 / C3 §0 `--backfill-induty` flag 분리 명시 (default 영향 0) / C4 §4.1 line 239 `701/7011/70113 R&D` → unresolved + override-required 강등 (mapper-deterministic leak 제거)
  - **SIGNAL: CONVERGED** (Claude verify R2 PASS, 부록 B R2 행 SIGNAL CONVERGED 박제)
- **검증**: code 변경 0이므로 build 25 routes / lint 0 err 5 warn (pre-existing) / test:ci 1317 PASS / tsc clean baseline 변경 없음.
- **post-merge canary**: code 변경 0 → Vercel preview build SUCCESS (Vercel Preview Comments check PASS), production canary 영향 0 (post-PR-#54 baseline 유지).
- **후속 구현 상태**: PR #56 impl `058a372`에서 plan §부록 A 산출물 catalog 1:1 구현 완료. 남은 production backfill apply는 USER Supabase re-auth/write gate.

**Demoted to historical (60차 §4 PR #56 sweep — strict 직전 2 §6 inline entry는 PR #56/PR #55, PR #54 이하는 historical)**:
- **60차 §2 Mock cleanup Step 2.7b.3 ✅ MERGED in main `50cb94a`** (PR #54 rebase FF, 3 cron route alert_event 3-source + briefing_log INSERT, omxy R-debate 5 rounds CONVERGED 누적 15 plan catches + impl BLOCKERS 0, W-cron-alert-event-insert + W-briefing-log-insert resolved) = git log + PR #54 body 위임.
- **60차 Mock cleanup Step 2.7b.2 ✅ MERGED in main `a351033`** (PR #53 rebase FF, silent-health heartbeat_log + news-sweep news_event INSERT 실 path, omxy R-debate 6 rounds CONVERGED 13 catches, W-pipeline-health-admin-assertion INSERT side fully resolved + W-cron-alert-event-insert/W-briefing-log-insert defer 박제) = git log + PR #53 body 위임.
- **59차 Mock cleanup Step 2.7b.1 ✅ MERGED in main (PR #50)** (rebase FF, news-sweep + morning-briefing cron service-role wiring + 4-way auth hardening, W-news-cron-service-role-read 완전 해소, omxy patch-suggest 2 rounds CONVERGED 3 catches → omxy 직접 fix `63b2888`) = git log + PR #50 body 위임.
- **59차 Mock cleanup Step 2.7a ✅ MERGED in main `6c85f13`** (PR #48 rebase FF, silent-health 실 SELECT via service-role DI + 3 mock 삭제 + 4-way auth hardening, omxy patch-suggest 2 rounds CONVERGED 4 catches → omxy 직접 fix `4f55548`) = git log + PR #48 body 위임.
- **59차 Mock cleanup Step 2.6 ✅ MERGED in main `845b9ca`** (PR #46 rebase FF, news cron MOCK_ADMIN_NEWS → 실 news_event SELECT + 2 dead mock 삭제, omxy patch-suggest 2 rounds CONVERGED 2 catches → 1 LOW fix `1860a16` + 1 HIGH defer W-news-cron-service-role-read [본 PR Step 2.7b.1에서 완전 해소]) = git log + PR #46 body 위임.
- **59차 Mock cleanup Step 2.5 ✅ MERGED in main `6c5ce2c`** (PR #44 rebase FF, health page MOCK_ADMIN_PIPELINE_HEALTH → 실 pipeline_health SELECT + ASC pagination hardening, omxy patch-suggest 2 rounds CONVERGED 4 catches + omxy 직접 fix `fd2d4e8` + 2 W- defer) = git log + PR #44 body 위임.
- **59차 Mock cleanup Step 2.4 ✅ MERGED in main `4e15176`** (PR #42 rebase FF, cost page MOCK 3 fixture → 실 cost_log SELECT, omxy patch-suggest 2 rounds CONVERGED 1 BLOCKER catch + omxy 직접 fix commit `c2897b4` + 1 W-cost-log-core11-drift defer) = git log + PR #42 body 위임.
- **59차 Mock cleanup Step 2.3 ✅ MERGED in main `e273cc2`** (PR #39 rebase FF, regenerate cost_log mock → 실 SELECT pagination loop, omxy R-debate 6 rounds CONVERGED 12 catches → 10 fix + 2 W- defer) = git log + PR #39 body 위임.
- **58차 Mock cleanup Step 2.2 ✅ MERGED in main `2dca060`** (PR #34 rebase FF, admin settings READ 실 SELECT + WRITE boundary, omxy R1 CONVERGED) = git log + PR #34 body 위임.
- **58차 Mock cleanup Step 2.1 ✅ MERGED in main `e6be73f`** (PR #33 rebase FF, admin alerts 3 routes `MOCK_ADMIN_ALERTS` + `MOCK_ADMIN_NEWS` → `alert_event` / `news_event` 실 SELECT, omxy R-debate 2 rounds CONVERGED + docs sweep R14 + merge debate R2 A++ 정합, 신규 helper `admin-alerts.ts` + `admin-news.ts`, WATCH `W-mock2-rls-drift` defer) = git log + PR #33 body 위임.
- **58차 Mock cleanup Step 1 ✅ MERGED in main `1d2db08`** (PR #32 5 commits FF, omxy R1~R4 CONVERGED — Issue 1 RSC error + Issue 2 모닝 브리핑 4/19 stale + Issue 3 D15 가짜 열람 통과 모두 catch·fix, 신규 helper `admin-report-view-log.ts` + client wrapper `shortlist-row-action-slot.tsx` + mock 삭제 + 신규 error code `accept_gate_lookup_failed`) = git log + PR #32 body 위임.

**Demoted to historical (58차 sweep R1 — strict 직전 2 entry inline 규칙 적용)**:
- **58차 Task 4 B65-P3 impl ✅ + B-trackrecord-rls ✅ + 마이그 0025 production apply ✅** (PR #30 `3c09d6e` + PR #31 `838386e` + Supabase production apply, omxy 6 rounds CONVERGED 누적) = git log + PR #30/#31 body + REVIEW docs 위임.
- **57차 §3 Task 4 plan SoT ✅ MERGED `2859c68`** (PR #28, B65-P3 impl plan 옵션 A R8 final, omxy R-debate R1~R5 23 BLOCKERS + Ramanujan CATCH 0) = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` + git log + PR #28 body 위임.
- **57차 §2 Task 3 ✅ B65-P2 spec doc CONVERGED R8 final** (PR #26, 옵션 A lock-in, omxy R-debate 8 rounds ESCALATE max-8 + 6 신규 audit ticket B79/B-versioning/W-tier1pill/W-grant-smoke/W-sectionfallback-text/W-cost-log-env-gate) = `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md` + git log + PR #26 body 위임. W-grant-smoke는 58차 Task 4 ✅ RESOLVED.

**Older historical (49차~56차 §5 PR4 MERGED + 57차 §1 PR #21 B65-P1 MERGED `5b99e03` + 57차 §2 PR #26 spec doc + S7a/Tier 2/PR2/PR3a/PR1/PR3b/PR3c MERGED + 53차 §5 spec doc + PR4 14 defer + 56차 §5 B65~B108 catalog 34 catch + 57차 §1 omxy 4 rounds CONVERGED Hegel/Leibniz/McClintock/Hubble/Locke)** = git log + spec/plan/REVIEW docs + PR body + ProgressDashboard 위임.

---

## 7. omxy 적대적 코드 검토 패턴 — legacy / detail runbook (49차 박제, 후속 PR 재사용)

> **정책 분리** (omxy PR #37 verify R1 catch 박제): 영구 normative 워크플로우 정책 (Output Modes / Trivial vs Complex / Context Packet / Native Critic Role Taxonomy / 단계별 subagent·skill 매핑 / 자동 진행 vs USER-only) = **프로젝트 루트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책` SoT**. 본 §7.1~§7.7 = legacy detail runbook (cmux send pattern / scope guard 4종 / 결함 카탈로그 / PR-specific lessons 누적) 한정 — 정책 drift 방지.

### 7.1 왜 필요한가

49차 lesson: implementer subagent self-review (test pass + tsc clean + grep 패턴)만으로 **5 critical blockers + 2 final BLOCKERS 놓침**. omxy cmux pair-debate가 **외부 적대적 시각**으로 catch. PR2도 omxy R1~R8 8 rounds로 17 BLOCKERS catch & fix.

**규칙**: 매 task implementer 완료 → omxy 적대적 코드 검토 1~n rounds → CONVERGED 후 다음 task. 후속 PR (PR3a~PR4) 동일 패턴 강제 적용.

### 7.2 omxy 환경 (runtime discover — hardcoded surface 박제 금지)

- **cmux peer surface**: runtime 발견. 매 세션 진입 시 `cmux list-panes` + `cmux list-pane-surfaces --pane <pane>` + `cmux capture-pane --surface <surface>`로 omxy pane 식별.
- omxy 모델: gpt-5.5 high, YOLO mode (`/usr/local/bin/omxy`).
- **eligibility probe**: `test -n "${CMUX_WORKSPACE_ID:-}" && cmux identify` — Broken pipe 또는 no CMUX_WORKSPACE_ID면 orchestrate 불가, 사용자에게 보고.
- peer signature: `[OMX#...]`, `gpt-5.5`, `omx-<project>-<hash>`.

### 7.3 cmux send pattern

parry-guard hook가 bash `$(cat file)` 패턴 차단 → 두 가지 옵션:

**옵션 A — direct heredoc**:
```bash
MSG_FILE=$(mktemp /tmp/cmux-debate-msg-XXXXXX.txt)
cat > "$MSG_FILE" <<'EOF_MSG'
ROUND N — FROM: orchestrator
...
SIGNAL: CONTINUE
EOF_MSG
cmux send --surface "$PEER_SURFACE" "$(cat "$MSG_FILE")" && sleep 3 && cmux send-key --surface "$PEER_SURFACE" enter && sleep 2 && cmux send-key --surface "$PEER_SURFACE" enter
rm -f "$MSG_FILE"
```

**옵션 B — Write tool + cmux**: parry-guard 우회 — Write tool로 `/tmp/msg.txt` 작성 → bash `cmux send --surface ... "$(cat /tmp/msg.txt)" && ... && rm`.

### 7.4 적대적 검토 메시지 템플릿 (scope guard 4종 필수)

각 task implementer commit 후 omxy에 다음 패턴 송신:

```
=== NEW DEBATE — Task N 실 commit 코드 적대적 검토 (cmux pair-debate v1) ===

PROTOCOL: SIGNAL: CONTINUE/CONVERGED/ESCALATE. <500 words. Adversarial. SCOPE GUARD.

TASK: Task N (모듈명) 실 commit 코드 적대적 검수. CONVERGED 조건 = (a) plan과 1:1 일치 (b) self-review 우회 결함 0 (c) 기존 schema/모듈 호환성 (d) hardcoded constants 정확.

CONTEXT:
- Branch: <branch> at HEAD <hash>
- Spec: <path>
- Plan: <path>
- Commits to review: <hash> "<message>"
- 변경 파일: <list>

검증 요청:
(a) plan과 1:1 일치?
(b) PostgreSQL/zod/TypeScript edge case 위험?
(c) 기존 SoT 모듈과 충돌?
(d) Type 일관성?
(e) grep 패턴 (forbidden patterns) 0 매치?

SCOPE GUARD (재해석 금지):
- 사용자 lock-in (spec doc §1)
- 본 PR scope 외 (별도 PR로 분리)
- DQ-7 / S8 / 멤버 페이지

ROUND 1 — FROM: orchestrator
입장 = 결함 0 기대. 검증 후 SIGNAL: CONVERGED 또는 CONTINUE with diff.

SIGNAL: CONTINUE
```

### 7.5 fix 패턴 (BLOCKERS 발견 시)

omxy R1에서 결함 발견 시:
1. **Edit 또는 새 commit으로 정정** (amend 금지 — 사용자 명시 필수).
2. fix commit message = `fix(<scope> omxy R<N> BLOCKER[S]): <one-line>`.
3. omxy R2 송신 (변경된 commit hash 명시 + 적용 diff 요약).
4. CONVERGED 받을 때까지 R3 / R4 반복 (최대 8 rounds).

### 7.6 결함 카탈로그 (재발 방지 grep 검증)

| 결함 | grep 패턴 (코드 작성 후 0 매치 확인) |
|---|---|
| PostgreSQL `IF <null>` pass-through | `raise '` (모두 `raise exception '`) |
| RPC guard에 null 미체크 | `jsonb_typeof.*<>` (있어야 `is distinct from`) / `not in.*` (앞에 `is null or`) |
| Q3 partA `z.array()` 1~13 통과 | `partA: z.array(.*)` (있어야 `.refine(`) |
| `committee_votes.vote` enum mismatch | `(v ->> 'vote')::text` (있어야 `case (v ->> 'vote')` 매핑) |
| `p_admin_id` caller-supplied (RPC) | `p_admin_id` (있으면 안 됨) |
| `buyCount >= 6` 임시 threshold | `buyCount >= 6` (있어야 bucket rank + isTopTier) |
| writer가 vote 매핑 | writer.ts에 `'approve'\|'abstain'\|'reject'` 0 매치 (있어야 BUY/HOLD/SELL만) |
| `stock_reports.created_at/updated_at` | 마이그에 `created_at\|updated_at` (있어야 `generated_at`만) |
| **persona_id snake_case vs production kebab-case** | TIMEFRAME_HEAVY_PERSONAS · CORE_11_IDS 검증 (PR2 R5 BLOCKER) |
| **PersonaPanel 임의 ID 통과** | PersonaPanelSchema length+unique만 부족 → `assertPanelMatchesCore11` 필수 (PR2 R6 BLOCKER) |
| **30 선정 timeframe count corruption** | SelectionMeta {short,mid,long}Count === 10 each + assigned_timeframe 분포 일치 refinement (PR2 R7 BLOCKER) |
| **PR1 cron ⊥ PR3a 미선행 page crash** | 53차 §5 Group H Critical Hard gate (`/admin/report/[ticker]` deref) |

### 7.7 PR-specific lessons 누적 (54차 §1 PR2 + 54차 §4 PR1 + 56차 §4 PR4 + 57차 §1 PR #21 + 57차 §2 Task 3) — 핵심 패턴만 inline

- **persona ID production 정합** (PR2): production source에서 fixture import + drift invariant test.
- **schema length+unique 약함** (PR2): exact set equality assert helper / enum check 필수.
- **count consistency cross-refinement** (PR2): SelectionMeta {short/mid/long}Count vs selected.assigned_timeframe 분포 일치 refinement.
- **scope purity grep** (PR2): 외부 모듈 import 0 매치 + DB write keyword 0 매치 (doc comments 외).
- **Promise.allSettled** (PR2): 다수 외부 호출은 batch reject 대신 fail-fallback.
- **PostgREST filter injection 방어** (PR1 B23): raw filter string 조립 시 format regex (`/^\d{6}$/` 등) 추가, zod min(1)만으로 부족.
- **caller DI seam invariant 정밀화** (PR4 B23~B28): 결과값 assert만이 아닌 (1) createClient short-circuit (2) helper-chain 2nd arg propagation (3) payload field invariant (4) 한국어 매핑 (5) shouldRevise=true revise branch — 5중 명시 assertion 필수. `options: { client?: SupabaseClient } = {}` 2nd arg + `options.client ?? (await createClient())` fallback 패턴. forbidden grep: `await createClient\(\)` raw call / 1-arg helper call.
- **omxy 4 rounds verify cycle** (PR #21): R1 plan + R2 commit verify (2 subagent parallel = code-reviewer + architect) + R3 HANDOFF cleanup + R4 pre-merge sanity. **post-merge sequence**: `gh pr merge <N> --rebase --delete-branch` → deploy state poll → production audit re-verify → HANDOFF rebase + MERGED 박제. WATCH suffix 패턴 = 비차단 follow-up 코드 주석/PR body/HANDOFF 박제.
- **R-debate max-8 rounds 정합** (57차 §2 Task 3 §7.5): R8 SIGNAL=ESCALATE max-8 → 옵션 reversal 아닌 mechanical fix 후 final accepted로 종료. 사용자에게 commit 결정 의사 1회 확인.
- **gsd-code-reviewer 환경 부재 대체 = 3-track deep review** (PR1+): Track 1 `gstack-review` skill inline + Track 2 `general-purpose` depth=deep adversarial + Track 3 `superpowers:code-review` 5-angle scan. Fix-First adoption = cross-confirmed CRITICAL 즉시 fix / PLAUSIBLE은 사용자 판단 / defer는 follow-up ticket. **omxy R1+R2 narrow detail + 3-track broad scan = complementary** (impl PR에서 두 패턴 동시 적용).

PR-별 상세 lifecycle 사례 = git log + PR body + spec/plan/REVIEW docs 위임.

---

## 8. 사용자 운영 원칙 (프로젝트 invariant 한정 — 워크플로우 normative 정책은 `CLAUDE.md ⚙️` SoT)

> **정책 분리** (omxy PR #37 verify R1 catch 박제): 영구 워크플로우 정책 (Owner / Output modes / 자동 진행 / Trivial vs Complex / Context Packet / Native Critic / 단계별 매핑 / "이어서 진행" 자동 진입) = **프로젝트 루트 `CLAUDE.md ⚙️ Claude+omxy R-debate Workflow 정책` SoT**. 본 §8 = 프로젝트 운영 invariant (canonical 5-PR / Kevin v3.1 / DI seam / 본 차수 자동 진행 baseline) 한정.

- **omxy CONVERGED = 사용자 승인 등가 (제한)**: `CLAUDE.md ⚙️` 자동 진행 허용 범위 안에서만 (PR merge / docs-sync PR / 사용자 명시 post-merge baseline docs-only direct commit / canary / deploy polling). **Vercel env / secrets / flag 토글 / production migration apply / billing / live-money/trading / external account / key 변경은 항상 USER-only** (CLAUDE는 가이드 + 후속 verify).
- **omxy 토론 = subagent/skill + scope guard 4종 박제** (사용자 명시 + [[feedback_omxy_debate_scope_guard]]).
- **commit pattern**: 자동 commit (amend 금지 — 사용자 명시 시만). branch 분리 원칙 = main 직접 commit 금지. 예외: 사용자 명시 post-merge baseline docs-only direct commit(가역, 코드/DB/외부 시스템 변경 0).
- **Owner boundary / Default-progress policy / 자동 진행 허용 vs USER-only 상세** = `CLAUDE.md ⚙️` SoT 참조.
- **canonical 5-PR 순서 절대 보존** (53차 §5 spec doc 박제 + 55차 §2/§4 + 56차 §5 정정): PR2 ✅ → PR3a ✅ → PR1 ✅ → PR3b ✅ → PR3c ✅ → **PR4 ✅ MERGED `7de9696` (56차 §5, PR #19) — canonical 5-PR 완료**. Hard gate (PR1 cron 가동 ⊥ PR3a schema drift fix 미선행) ✅ **해소** (54차 §3). 다음 = PR5 (cron 30 자동 + 큐 인프라, T11 분할 결정 보존).
- **Kevin v3.1 quality target** (53차 §3 박제): 207 persona × 8 markers = 1656 marker assertions 전수 통과. Reference 자료 main 보존. PR3b writer 본문 + PR3c orchestrate + PR4 admin path (`orchestrateFullReport`) 모두 동일 quality target.
- **HANDOFF.md 다음 세션 자동 진행 가능 조건**: §0 + §1 + §2 + §9 모두 stale 0. 현재 baseline = main docs-sync `22ceb6f` post-PR-#56 HANDOFF sync / code baseline `058a372` PR #56 / PR #55 plan SoT `bbf102d`, OPEN PR #2 only, build/lint/test/tsc/Python green, Vercel env true 완료, last-known production audit rows 0. **USER 잔여 액션 = Task 5 production backfill 3-step(마이그 0026 apply + `DART_API_KEY` 로드 후 `scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty` + `scripts/.venv/bin/python scripts/screen_shortlist_tier0.py --month 2026-05-01 --as-of 2026-05-11 --apply --csv-backup scripts/out/short_list_30_2026-05_C-hybrid.csv`) + PR #54 §5.3 preflight(권장) + 인증 세션 canary verify(권장) + Smoke Stage 2 시점 1회 비용 승인(Task 7)**.
- **DI seam invariant 정밀화 default (§7.9 PR4 lesson)**: 모든 caller DI test는 결과값 assert만이 아닌 (1) createClient short-circuit (2) helper-chain 2nd arg propagation (3) payload field invariant (4) 한국어 매핑 (5) shouldRevise=true revise branch — 5중 명시 assertion 필수.

---

## 9. PR4 + B65-P1/P3 + 마이그 0025 + Vercel env=true 완료 — Smoke/B66/PR5 readiness catalog (W-cost-log-env-gate ✅ resolved, W-news-cron-service-role-read ✅ resolved)

> **삭제 조건**: §2.1 active 8-row matrix Task 1~7 모두 PASS (production audit + B65-P1/P2/P3 + B66 C 하이브리드 backfill + Smoke Stage 1+2 PASS) 시 본 §9 + 8-row matrix를 HISTORICAL로 강등하고 PR5 active submatrix로 교체.

### 9.1 발견 경위 (요약)

PR4 MERGED `7de9696` 직후 사용자 catch — Supabase 직접 query 결과 `cost_log=0` / `stock_reports=0` / `committee_votes=0` / `short_list_30=30` (sector placeholder) → **B65 3-phase 분리 catch**. 원인 = `cron monthly-batch` mock throw (B67) + `update_report_sections_0_7` UPDATE-only RPC (마이그 0022, row 부재 시 fail). PR4 lifecycle 테스트가 RPC를 mock하여 production-only로 잠복. 상세 forensic = 56차 §5 commit history + git log + PR #19 body 위임.

### 9.2 B65 3-phase status — production functional enabled, Smoke pending

**원인**: writer Opus + critic Haiku + 조건부 revise (1~3 LLM calls, exact cost = smoke 후 `cost_log` 기준 확정 — B91 박제) 후 `update_report_sections_0_7` RPC가 row 부재 시 fail → AI 토큰 비용 burn + UI에 기술적 에러 문구 노출 (`format-error.ts` 매핑 존재하지만 사용자 가독성 낮음 — B101 정정).

**3-phase 분리** (omxy R7 B94 lock-in):

1. **Phase 1 — P1 immediate guard**: `triggerFullReport`에 row-missing preflight 추가. historical 목적은 P2/P3 전 cost burn 차단. 현재는 Phase 3 + Vercel env=true로 real path 가능.
2. **Phase 2 — P2 real enablement ✅ spec doc CONVERGED R8 final (57차 §2)**: **옵션 A 채택 lock-in** — admin-only `upsert_report_sections_0_7_admin` RPC, UPSERT (INSERT if missing, UPDATE if exists), section_0~7 + appendix only, 4-grant 패턴 (service_role grant 금지), version/schema_version/regen_* counter 불변 invariant. axis (i)A admin trigger 책임 = section_0~7 only / axis (ii) B79 deferred → PR5 plan / axis (iii) PR5 cron path 충돌 없음. 옵션 B (`commit_persona_eval` 연계)는 admin UX 변경 + 비용 5-10x → 사용자 lock-in 도달 위험으로 reject. 옵션 C (synthetic) = Kevin v3.1 M3 no-fabrication 위반 + Track Record corruption으로 폐기. 상세 spec doc: `docs/superpowers/specs/2026-05-26-b65-p2-rpc-rdebate.md`. **Task 4 = 마이그 0025 + feature flag impl PR**.
3. **Phase 3 — P1/P2 호환 (B94 critical)** — P2 도입 시 P1 guard를 P2 path와 호환되게 수정 (영구 disabled risk 차단):
   - (i) **feature flag** (env `PR4_TRIGGER_UPSERT_ENABLED=true`) — **default recommended** (simple, deterministic, no runtime overhead). **B98 lock-in**.
   - (ii) RPC presence check (runtime DB introspection) — **비추천** (매 클릭마다 DB query + 권한/스키마 노출 risk).
   - (iii) atomic transaction prepare (P2 RPC가 AI 호출 전 placeholder row를 transaction 안에서 prepare → 실패 시 rollback, P1 guard 불필요) — **secondary** (transaction boundary 복잡도 증가).

**smoke는 Phase 3 후만 가능** (P1 + P2만으로는 trigger 영구 disabled risk).

**B86 fix (month format)**: `triggerFullReport` input `month: YYYY-MM` (e.g., `2026-06`) vs `reportExistsForMonth` DB month는 `date` (YYYY-MM-01). 미박제 시 preflight 항상 false → trigger button 영구 disabled risk.

### 9.3 B66 quality/trust blocker + B84/B89/B93 — Approach lock-in: C 하이브리드

`short_list_30` 30 rows sector="코스닥"/"코스피" placeholder (D21 canonical 14 미반영). Legacy mechanical seed 1회 데이터 — Tier 0 단독 fallback path가 정합 매핑 누락. PR5 entry blocker이며, C 하이브리드가 재발 방지용 결정이다.

**B66 결정/구현 (2026-05-28)**: **C 하이브리드**. A(매월 수동 큐레이션 맵) 단독은 PR5 cron 월간 batch마다 재발하고, B(DART 단독)는 소형주 모호/오분류 risk가 있어 채택하지 않음. PR #55 plan SoT `bbf102d`(plan-only/code 0, OMXY R1+R2 10 catches) + PR #56 impl `058a372`(11 files/+1846, OMXY R1 5 BLOCKERS) 모두 MERGED/CONVERGED. 남은 것은 USER-gated production backfill 3-step이다.

**설계**:
- **Seed pipeline 영구화**: `scripts/screen_shortlist_tier0.py::fetch_universe`의 현재 placeholder(`sector = "코스피" if market == "KOSPI" else "코스닥"`)를 canonical 14 mapper로 대체.
- **Primary**: DART `induty_code`(한국표준산업분류/KSIC) → canonical 14 crosswalk. `seed_dart_corp_codes.py`에 `--backfill-induty` flag를 신규 추가해 DART company.json API 단건 호출로 `induty_code` fetch/cache. default corp_code seed 동작 영향 0.
- **Fallback**: 수동 override map. DART 업종이 모호하거나 소형주 오분류가 의심되는 종목만 override.
- **SoT 재사용**: `tudal/src/lib/screening/canonical-sectors.ts`의 `CANONICAL_SECTORS` 14 + `LEGACY_ALIAS_MAP` + `SUB_TAG_CROSSWALK`.
- **결과 목표**: 2026-05 30개 production backfill + 미래 모든 PR5 cron monthly batch가 자동으로 canonical 14를 부여해 placeholder 재발 차단.

**B93 PASS criteria 3종** (모두 만족):
1. 30 rows all sector ∈ `CANONICAL_SECTORS` (14 enum 정합)
2. sector ∉ ('코스피', '코스닥') — placeholder 잔존 0
3. optional `sub_tags` 정합 (jsonb null OR string[], 마이그 0018 schema 정합)

**B89 unknown ticker 처리 lock-in (PR #55 R1)**:
- unresolved row가 1개라도 있으면 dry-run은 review CSV + exit 2, `--apply`는 DB write 전면 거부.
- 해결 경로는 mapper rule 보수 또는 `sector_override.json` PR이며, lightweight manual review는 override 입력으로만 반영.
- `unknown_pending`은 production `short_list_30.sector`에 저장 금지 (B93 위반).

**Production write gate**: CLAUDE는 script + crosswalk + override map + tests + impl PR review까지 수행. `short_list_30` production backfill apply는 USER Supabase re-auth + write 권한이 필요한 USER-gated 작업. PR #55 plan SoT는 결정 박제 only, 코드/script/DB 변경 0.

**박제 원칙**: sector="코스피"/"코스닥" placeholder 영구 허용 X. 모든 30 rows 시점 도달 시 canonical14만 허용하며, unresolved/unknown은 production apply 전 strict block.

### 9.4 Smoke 2-stage 분리 (B97 lock-in)

Stage 1 PASS 전 Stage 2 진입 금지.

**Stage 1 — non-AI dry-run/integration test** (real cost = 0):
- `triggerFullReport` server action에 mock `orchestrateFullReport` 주입 (vi.doMock)
- P1+P2+P3 호환 invariant test: P3 호환 완료 시 P2 path 진입 (mock called) / 비호환 시 P1 fail-fast (mock not called)
- **B96 target**: short_list_30 존재 + stock_reports 부재 ticker (production 30 rows 모두 정확히 그 상태)
- TDD 단위 테스트로 적용

**Stage 2 — single real AI smoke** (USER 승인 후 1회):
- production env에서 admin UI click OR server action 직접 호출
- **B85 model id verify 선행** (1 token test로 production env vars 정합 확인)
- **B87 PASS criteria 5종**:
  - **Core (필수, 모든 옵션)**: 1 `cost_log` row exists / 2 `stock_reports` row + section_0~7 + appendix all non-null + zod schema valid / 3 `report_critic_findings` row (critic 6-axis verdict) / 5 `/admin/report/[ticker]` UI **정상 본문 또는 의도된 SectionFallback 렌더** — raw/technical/`format-error.ts` 매핑된 에러 메시지 노출 시 모두 FAIL (B107 정정 — 매핑된 에러 메시지도 upstream issue 신호이므로 PASS 아님)
  - **Full-path (옵션 B만)**: 4 `committee_votes` row(s) — 11 core + 0~14 sector
- real cost = `cost_log` 기준 확정 (token usage 기반, production 환경별 변동 — 수치 박제 금지 B91)

### 9.5 audit catalog (B103+B106 정정 — B67~B85 항목별 1줄 + B79+B81~B85 알려진 항목 + 카테고리 buckets)

> **박제 원칙 (B106 정정)**: omxy R2 형성된 B67~B80 잠재 follow-up catalog + R3 형성된 B81~B85 알려진 항목을 항목별 1줄 박제. 본 catalog는 R10 시점 정렬 — 다음 세션 audit phase 진입 시 항목별 priority 재할당 및 신규 catch 추가.

**R2 audit catalog (B67~B80, 항목별 1줄)**:
- **B67** — cron path 자동 호출 결함 (`tudal/src/app/api/cron/monthly-batch/route.ts`의 `mockTier0Source` / `mockCallPersonaPanel` throw 패턴). PR5 진입 전 필수 해소.
- **B68** — AI key 발급/충전 완료에도 `cost_log` = 0건 (성공/기록된 호출 없음). B65 RPC 의존 + cron path mockTier0Source throw 양쪽 영향.
- **B69** — `committee_votes` = 0건. B79 RPC 책임 boundary 결정 + B65-P2 옵션 A/B 선택 결과로 결정.
- **B70** — Regen UX (`/admin/report/[ticker]/regenerate`) admin path swap 후 첫 실 호출 검증 필요. PR4 Task 2.3 Regen orchestrate wire commit `8b63e1f` MERGED.
- **B71** — `short_list_30` stale data (2026-05-12 legacy mechanical seed 1회, B66 placeholder + ~14일 stale). C 하이브리드 적용 후 PR5 cron 가동 시 신규 row INSERT도 canonical 14로 생성되는지 확인.
- **B72** — row-missing preflight 통합 (B65-P1 `reportExistsForMonth` + 향후 cron path 호환). B86 month format 박제 적용 후 helper 통일.
- **B73** — model id verify timing (B85 1-token test 시점 = Stage 2 진입 직전). production env vars 3종 정합 검증.
- **B74** — `cost_log` accounting (writer + critic + 조건부 revise 토큰 사용량 정확 적재). persist fail 시 적재 보장 + alert.
- **B75** — RPC responsibility boundary (Section 8 partA/partC/partD + committee_votes의 admin/cron path 동일 RPC 사용 여부 결정 — B79와 연계).
- **B76** — hardcap mock vs real 일관성 (16,050원/월 박제가 production cost_log 적재 시 enforce 트리거 및 alert 발송).
- **B77** — main HEAD fixed SHA 박제 금지 (R2 시점 박제 — §0 verify에 `git rev-parse --short origin/main` 동적 확인 의무화, commit `dff1cbe` §0 적용 완료).
- **B78** — silent null drop metric/log 격상 (PR3a P2 / red-team RT#2 / gsd CR-01 박제 — §4 잔여 reference). 현재 console.warn → metric/structured log.
- **B79** — Section 8 partA/partC/partD + `committee_votes` RPC 책임 boundary 결정. **57차 §2 R8 lock-in: 옵션 A 채택 ✓ → B79 deferred to PR5 plan** (commit_persona_eval + service-role caller wire + B79 RPC 통합을 PR5 plan R-debate에서 동시 결정).
- **B80** — PR4 14 defer follow-up tickets (W-1 callerKind dead code / W-2 fetchTrackRecord* in actions.ts / W-4 sub_tags / W-5 user.email / W-6 as never cast / Track 3 I1-I6). 본 audit 시점에 일괄 분류.

**R7 (57차 §2 R-debate) 신규 audit ticket 6종** (옵션 A 채택 lock-in 후속, spec doc §6):
- **B-versioning** — 옵션 A versioning policy = (1) overwrite-in-place 채택 (0017/0022 패턴 보존). version/schema_version/is_latest/regen_* counter 불변 invariant. (2) auto-flip + version bump 재설계는 PR5 plan R-debate에 deferred (cross-cutting 결정 — commit_persona_eval + update_report_sections_0_7 + admin RPC + regen 모두 영향).
- **W-tier1pill** (PR4 post-merge follow-up ticket) — Section 8 absent 리포트 = Tier 1 평가 대기 pill UI 추가. D11 운용 검증 acceptance gate. HANDOFF §2.1 Step 8 (D11 AI 가상 포트 1차 가동 게이트) 본문도 acceptance gate 명시로 갱신. omxy R1 h + critic W3 + omxy R2 e' + R3 ε 박제.
- **W-grant-smoke ✅ RESOLVED in 58차 (마이그 0025 production apply + verify)** — Layer 1 has_function_privilege 4-grant matrix verified (service_role=false / authenticated=true / public/anon=false) + Layer 2 (PostgREST permission_denied) = Smoke Stage 2 진입 시 functional canary로 검증 예정. exact 11-arg regprocedure signature 적용 + pg_get_functiondef로 body 1:1 정합 확인. omxy R1+R2 CONVERGED. **Layer 2 PostgREST smoke만 Task 7 USER 게이트로 잔여**.
- **W-sectionfallback-text** — SectionFallback 문구 "후속 PR3b (writer Section 0~7 본문 구현)에서 채워집니다"는 stale (PR3b 이미 MERGED `cf68731`). Tier 1 평가 대기 pill 도입 시 함께 정정. page.tsx line 336~346.
- ✅ **W-cost-log-env-gate** — Vercel production env `AI_COST_LOG_REAL_INSERT_ENABLED=true` 설정 완료(2026-05-28 기준 24h ago 확인). Task 7 sequence는 env값 재확인만 수행; gate 자체는 fully resolved.
- **W-pr5-readiness** — PR5 cron path quality는 **B65-P2 옵션 A와 독립**. PR5 readiness = (a) commit_persona_eval에 service_role grant 추가 (B79와 동시) + (b) service-role caller DI wire + (c) cron 30 자동 (16,050원/월 hardcap) + (d) 큐 인프라 (Vercel Queues OR 자체 DB job queue) 모두 PR5 plan에서 별도 해결.
- **W-mock2-rls-drift** (58차 Step 2.1 omxy R1 WATCH defer) — `/admin/alerts` empty state ("0건 = 실제 미발생") 문구는 env `ADMIN_EMAILS` ↔ DB `admin_emails` allowlist sync 전제. drift 시 RLS deny로 0 rows처럼 보일 가능성 있음 (blocking 아님). admin read assertion / diagnostic 검토 — 별도 hardening 트랙. Step 2.2+ (settings/health/cost/regenerate)에도 동일 패턴 잠재 → 통합 follow-up.
- **W-cost-log-admin-assertion** (58차 Step 2.3 omxy R1 HIGH-2 + R2 MEDIUM-3 defer) — `cost_log` SELECT RLS `using (is_admin())`는 non-admin 호출자에게 0 rows silent return (throw 안 함). regenerate `getMonthlyTotal`은 mock과 동일하게 silent-0 → hardcap=0 unblocked로 처리. admin path는 회귀 0이지만, audit invariant 측면에서 fail-closed 보증 부재. hardening = (a) `triggerFullReport`/`regenerateReport` 진입 시 `rpc('is_admin')` 명시 assertion (B-trackrecord-rls 58차 PR #31 패턴) 또는 (b) `get_cost_log_monthly_total_admin` SECURITY DEFINER RPC + `not is_admin() → raise` 내부. Step 2.3 mock parity 유지 → 별도 트랙. W-mock2-rls-drift / W-s5b-admin-assertion 통합 sweep 후보.
- ✅ **W-news-cron-service-role-read** (59차 Step 2.6 PR #46 omxy R1 HIGH defer → Step 2.7a PR #48 half-resolved → **Step 2.7b.1 PR #50 fully resolved**) — 3-step chain 완성: Step 2.6 helper 마이그 + Step 2.7a DI seam (`options.client?`) + Step 2.7b.1 route wiring (`createServiceRoleClient()` 주입 in news-sweep + morning-briefing). cron context RLS using(is_admin()) 우회 완료. monthly-batch (PR #30) + silent-health (PR #48) + news cron (PR #50) 모두 service-role 일관 사용. **historical 박제** (잔여 hardening 없음, INSERT path는 Step 2.7b.2 별도 scope).
- **W-pipeline-health-admin-assertion** (59차 Step 2.5 PR #44 defer / Step 2.7a PR #48 READ side resolved) — cron READ path는 `admin-pipeline-health.ts` DI seam + silent-health service-role 주입으로 RLS 우회 완료. **잔여**: (a) silent-health heartbeat_log/pipeline_health INSERT side는 Step 2.7b.2, (b) admin/settings/health session-client page의 explicit admin assertion hardening은 W-cost-log-admin-assertion / W-mock2-rls-drift 통합 sweep 후보.
- **W-pipeline-health-window-hardening** (59차 Step 2.5 PR #44 omxy R2 non-blocking WATCH defer) — 7일 window는 현재 pipeline_health=0 rows / cron 미가동에서 적절. future high-frequency telemetry (cron 가동 + 5 파이프라인 × 분 단위 run) 시 client-side fetch 비효율 (PR5 cron 가동 후 일 단위 5×60×24 = 7200 rows/day → 7일 = 50k rows pagination = 50 round trips). hardening = SECURITY DEFINER RPC `get_pipeline_health_summary_admin(p_window_hours)` (server-side aggregate + recent failures tail, transaction snapshot 내부, is_admin guard) — W-pipeline-health-admin-assertion과 통합 가능. PR5 cron 가동 + Smoke Stage 2 PASS 시점에 hardening 트랙 진입.
- **W-cost-log-core11-drift** (59차 Step 2.4 PR #42 omxy R2 non-blocking WATCH defer) — `tudal/src/lib/data/admin-cost-log.ts`의 `CORE_11_PERSONA_IDS` Set은 11 production persona.id (`tudal/src/lib/ai/prompts/personas/*.ts`)와 hardcoded 1:1 정합. future persona 추가 / 이름 변경 시 Set drift 가능 → 신규 persona가 `'committee'` 매핑되지 못하고 `'other'` fallback. Step 2.4 scope에서는 exact match가 목적이고 prompts directory import (runtime 의존성 증가)보다 surgical Set 채택이 안전 (omxy R2 lock-in). hardening 옵션 = (a) build-time grep으로 personas/*.ts에서 id 추출 후 Set 생성 / (b) `tudal/src/lib/ai/prompts/personas/index.ts`에 canonical export 추가 후 import / (c) test에 persona file count 검증 추가 (drift detect). 새 persona 추가 commit 시 함께 갱신 권장.
- **W-cost-log-pagination-snapshot** (58차 Step 2.3 omxy R5 MEDIUM defer) — `getMonthlyTotal` pagination loop의 `.order('called_at') .order('id')` deterministic ordering은 application-level monotonic 가정에만 의존. `insertCostLog`의 `CostLogRow` interface에 `called_at` 필드 부재 → TS callers는 강제 못 함 → DB default(now())로 가는 path만 보장. schema에 `CHECK (called_at >= ...)` 부재 → direct SQL / future code / manual admin INSERT가 backdated called_at으로 우회 가능. PostgreSQL now()도 transaction start time이라 parallel insert / NTP step / 동일 microsecond에 정확한 commit-order sequence 아님. 잔여 risk = 월 1000+ rows 시 backdated/parallel INSERT가 기존 page boundary 앞에 들어와 page 간 row skip/duplicate → hardcap undercount fail-open. 현재 production reality (cost_log=0 + 월 ~150 rows 추정 + 어드민 3인 manual click 동시성 거의 0)에서 실현 가능성 매우 낮지만, 월 cron 가동 + 1000+ rows 도달 시 완전 차단 필요. hardening = (a) SECURITY DEFINER RPC `get_cost_log_monthly_total_admin(p_month)` (server-side SUM, transaction snapshot 내부, is_admin() guard) — W-cost-log-admin-assertion과 함께 통합 가능 / (b) schema `ALTER TABLE cost_log ADD CONSTRAINT cost_log_called_at_no_backdate CHECK (called_at >= (now() - interval '5 minutes'))` 마이그. PR5 cron 가동 + Smoke Stage 2 PASS 시점에 hardening 트랙으로 진입.

**B-trackrecord-rls ✅ RESOLVED in PR #31 MERGED `838386e` (58차 follow-up, omxy R1 CONVERGED)** — `triggerMonthlyPersonaEvalAction`의 admin assertion이 `from('admin_emails')` 직접 SELECT (RESTRICTIVE RLS using(false)로 real admin 전원 오차단)였던 latent bug를 `rpc('is_admin')`로 교체. Task 4 R3 mechanical extension. src 전체 production action에서 `from('admin_emails')` 직접 SELECT = 0건 확인 완료.

**R3 알려진 항목 (B81~B85)**:
- **B81** — 단일 실 AI smoke 비용 분석 (per-call low / batch large). Stage 2 cost 추정 reference.
- **B82** — B65 docs-only 박제 strict (본 세션 내 코드 변경 금지). 다음 세션에서 해제.
- **B83 / B84** — `short_list_30` C 하이브리드 backfill verify command (seed pipeline DART induty mapper + override fallback 실행 후 `select sector, count(*) from short_list_30 group by sector` cross-check). B66 Task 5 PASS criteria 1~3.
- **B85** — 다음 세션 Stage 2 진입 직전 1-token model id verify (`ANTHROPIC_API_KEY` + `ANTHROPIC_OPUS_MODEL_ID` + `ANTHROPIC_HAIKU_MODEL_ID` Vercel env 정합).

**post-merge production deploy verify (추가)**: public canary는 완료. 다음 권장 = 인증 세션 canary (`/admin/settings/cost`, `/admin/report/[ticker]/regenerate`, `/admin/portfolio` 버튼 노출/경고). **실 trigger 클릭은 Task 7 비용 승인 후만**.

### 9.6 omxy lifecycle (historical — git log + PR body 위임)

56차 §5 post-merge omxy R1~R8 CONVERGED (B65~B107 catalog 형성) + 57차 §1 PR #21 R1~R4 CONVERGED + 57차 §2 Task 3 R1~R8 ESCALATE max-8 mechanical-final + **57차 §3 Task 4 plan R1~R5 CONVERGED Ramanujan R5 CATCH 0** → 누적 catch와 라운드별 lessons는 **56차 §5 docs cleanup commit + 57차 §1 commit chain + 57차 §2 spec doc §6 + 57차 §3 plan §부록 D + PR #28 body + git log + PR body**로 위임. active 박제는 §9.2~§9.5 본문에 일원화.

### 9.7 57차 §1+§2+§3 진행 — Task 1+2+3 ✅ + Task 4 plan ✅ MERGED (B65-P1 MERGED + B65-P2 spec doc CONVERGED + B65-P3 impl plan SoT MERGED in main `2859c68`)

57차 §1 진행 결과 (historical):
- **Task 1 (production audit)** ✅ COMPLETED — drift 0
- **Task 2 (B65-P1 immediate guard + B86 month format)** ✅ MERGED in main `5b99e03` (PR #21, Vercel deploy SUCCESS)
- omxy 4 rounds CONVERGED (R1 Hegel / R2 Leibniz+McClintock / R3 Hubble / R4 Locke + gstack ship sanity)

57차 §2 진행 결과 (active):
- **Task 3 (B65-P2 RPC R-debate spec doc)** ✅ COMPLETED — CONVERGED **R8 final** (옵션 A lock-in)
- **omxy R-debate 8 rounds (R8 SIGNAL=ESCALATE max-8 정합 §7.5)**:
  · R1 plan: debate-with-omx + native critic Godel (5 BLOCKERS + 4 WATCH)
  · R2 R-cycle: + native critic Feynman (5 stale/overclaim)
  · R3: + native critic Planck (5 catch β/γ/δ/ε/η)
  · R4: + native critic Schrodinger (3 catch — cost_log pre-parse / service_role exact signature / nullable)
  · R5: + native critic Franklin (2 BLOCKER — §4.4 regen + HANDOFF PR5 wording)
  · R6: + native critic Hypatia (1 BLOCKER + 2 minor)
  · R7: native critic agent thread limit (2 BLOCKER — incrementManualRegenCount RPC 오기 + global sweep)
  · R8: ESCALATE max-8 + 3 mechanical fix (§5 R8 / §6 R8 결정 / 부록 B header R1~R8)
  · **누적 catch 30+ 모두 fix 반영**
- **결정 lock-in (R8 final)**: 옵션 A `upsert_report_sections_0_7_admin` + axis (i)A admin trigger = section_0~7 only + axis (ii) B79 deferred → PR5 plan + axis (iii) PR5 no-conflict

**57차 §3 진행 결과 (active)**:
- **Task 4 plan SoT (B65-P3 P1/P2 호환 feature flag + 마이그 0025 impl plan)** ✅ COMPLETED — plan SoT MERGED in main `2859c68` (PR #28 rebase FF + delete-branch + HANDOFF sweep R1~R2 Descartes CATCH 0 CONVERGED)
- plan = `docs/superpowers/plans/2026-05-26-b65-p3-feature-flag-impl.md` (929 lines)
- **omxy R-debate R1~R5 누적 23 BLOCKERS catch & fix + native critic 6명 (Schopenhauer R1 parallel + Kepler R1 omxy + Plato R2 + Sartre R3 + Aristotle R4 + Ramanujan R5)**:
  · R1: Schop 8 BL + Kepler 3 BL + omxy 3 BL = 11 unique BLOCKERS + 9 WATCH + 7 MINOR (fix commit `98b9a18`)
  · R2: Plato 6 catch + parent 1 WATCH = 3 BLOCKERS + 4 WATCH (fix commit `8a6ffb1`)
  · R3: Sartre 6 catch = 2 BLOCKERS + 4 WATCH (schema mismatch + DB coverage 분리, fix commit `0a082c7`)
  · R4: Aristotle 2 catch = 1 BLOCKER + 1 WATCH (SET LOCAL transaction wrapper, fix commit `940d658`)
  · **R5: Ramanujan CATCH 0 — SIGNAL: CONVERGED** ✅
- **핵심 lessons (impl PR scope에 1:1 박제)**: Kepler B2 critical (service_role 명시 REVOKE) + Schop B5 critical (.env.example=false safe local) + Schop B3 (error literal rpcName guard) + Schop B7 + Sartre B2 (DB Phase A+B 분리) + Sartre B1 (schema verified) + Aristotle B1 (SET LOCAL begin/commit) + Plato B2 (grep scope impl-only)

**B65 3-phase 진행률**:
- **P1** ✅ MERGED in main `5b99e03` (57차 §1 PR #21 production active, cost burn 0)
- **P2** ✅ **spec doc CONVERGED R8 final (57차 §2 Task 3)** — 옵션 A lock-in
- **P3** ✅ **impl MERGED in main `3c09d6e` + 마이그 0025 production applied + Vercel env=true** (PR #30, 58차 Task 4)

**B66 진행률**: **impl ✅ MERGED `058a372` (60차 §4 PR #56, OMXY R1 5 BLOCKERS direct-edit CONVERGED)**. plan SoT `bbf102d` PR #55 + impl `058a372` PR #56 모두 완료. 산출물 11 files / +1846 lines / Python 69 tests + Vitest 1325 PASS. **USER 잔여 액션 (production backfill 3-step)**: (1) 마이그 0026 production apply (2) `DART_API_KEY` 로드 후 `scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty` (~46분) (3) `scripts/.venv/bin/python scripts/screen_shortlist_tier0.py --month 2026-05-01 --as-of 2026-05-11 --apply --csv-backup scripts/out/short_list_30_2026-05_C-hybrid.csv` (B89 strict block 통과 후). B93 PASS 검증은 USER apply 직후.

**Smoke 진행률**: 미진행 (Task 6 Stage 1 dry-run TDD + Task 7 Stage 2 single real AI USER 승인). Vercel env는 true 완료; Stage 2 직전 재확인만 필요.

**post-§4 commit production audit**: cost_log=0 / stock_reports=0 / committee_votes=0 / short_list_30=30 — drift 0. PR #56은 code+SQL 파일 추가만 완료했고 마이그 0026/short_list_30 backfill production apply는 USER 잔여.

**SCOPE GUARD 박제 (60차 §4 종료 시점)**: PR #55 plan-only + PR #56 impl은 완료. 여전히 USER-only: Vercel env/secrets/flag toggle, 마이그 0026 production apply, DART API key 활성/외부 account, billing/live-money/cost burn trigger. 다음 code work는 USER backfill 이후 Task 7/8 sequence만.
