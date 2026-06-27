# 섹터 추천 비교 메뉴 (B-1) — 출시 전 read-only deliverable spec

- Date: 2026-06-28
- Branch: `tier0-bpp-multiregime`
- SoT 선행: HANDOFF "🔧 Pre-launch 섹터 비교 메뉴" + Path-A Track2 specs(`2026-06-20-pathA-track2-generator-shadow.md`, PR-B1~B5) + `2026-06-19-pathA-forward-shadow-sector-layer.md`
- 가드레일: **hard-gate live 적용 영구 금지(soft 비교만)** · 검증 전 production 자동 교체 없음 · 섹터 가설 입력=수기/별도 advisor · read-only(mutation 0) · shadow-first(데이터 부재 시 빈 상태)

---

> **2026-06-28 적대 리뷰 후속(4-lens Workflow + verify, 7 confirmed)**: (1) [process/false-green] 신규 테스트 2종이 commit a7ccb99에 미포함(untracked) → 후속 commit에 포함. (2) [MED] 실현 수익률 walk-back 사문화(`candidateBasDdsBackFrom(...)[0]`=anchor 그대로) → entry/current 모두 거래일 walk-back 루프 + per-basDd 공유 캐시로 수정(휴장/주말/pre-close 보정). (3) [LOW] 0046 search_path += pg_temp(0039/프로젝트 표준 정합). (4) [LOW] current>0 가드·default limit·매핑 테스트 보강. refuted: clamp boundary/multi-bucket smoke·created_at anchor·redundant fetch(공유 캐시로 자연 해소)·nav grep.

## 0. 핵심 개념 + 제약 (grounding)

- **비교 대상**: ① production **B++ 30** = `short_list_30`(최신 month, Tier-1 AI 선정) vs ② Track-2 **sector-soft-tilt 30** = `tier0_candidates_150_shadow` arm=`sector-soft-tilt`의 **top-30**(버킷별 rank≤10). 각 set의 **KRX 실현 수익률**(선정 시점가→현재가).
- 목적: 150단계에서 놓친 대형 리더를 주도섹터 soft re-weight가 더 잡는지 human-in-loop 눈검증.
- **핵심 제약(grounding 실측)**:
  - Track-2 shadow 테이블(0039: `tier0_candidates_150_shadow`/`tier0_shadow_*`)은 **DORMANT(미적용)** + table-level **SELECT revoke from all roles**(production 코드 오염 방지) → admin 페이지가 직접 SELECT 불가.
  - production에 Track-2 shadow run **0건**(generator 미실행) → 메뉴는 **빈 상태**가 기본.
  - "Track-2 30"은 AI 선정이 아니라 **top-30 결정론**(arm rows rank 기준) — production 30(AI)과 산출 방식 다름을 UI에 명시(혼동 금지).
  - 섹터 가설 = `tier0_shadow_sector_hypothesis`(manual_pre_registered/absent) — 수기 사전등록(forward-integrity).

## 1. 신규 마이그 0046 (dormant) — admin read RPC
- shadow 테이블 SELECT가 revoke됐으므로 **SECURITY DEFINER read RPC** `get_tier0_shadow_arm_top(p_arm text, p_period_key text, p_limit_per_bucket int)`:
  - arm/period 검증 → `tier0_candidates_150_shadow` WHERE arm=p_arm ∧ period_key=p_period_key, 버킷별 rank≤limit → jsonb 반환(ticker/name/sector/bucket/rank/tier0_score).
  - 내부 `is_admin()` self-gate(비-admin→예외). 3종 grant: revoke public/anon + grant authenticated(self-gate 안전).
  - read-only(SELECT만, write 0). `.rollback` + `pg_smoke_0046`(arm 필터·rank cut·grant matrix·is_admin gate).
- **DORMANT(USER apply-only)**: 0039+0046 미적용 시 read 경로는 빈 결과(fail-soft). 적용 = USER 게이트.

## 2. 데이터 레이어 (read-only)
- `lib/data/admin-sector-comparison.ts`:
  - `getShadowArmTop(arm, periodKey, opts)` — RPC 호출(authenticated). 부재/오류 → [](fail-soft, 메뉴는 빈 상태).
  - production 30 = 기존 `getActiveShortList`.
- `lib/screening/shortlist-returns.ts`(순수): `computeRealizedReturns(items, entryPriceMap, currentPriceMap)` → set별 평균/median 실현 수익률 + per-ticker. **KRX EOD**(`resolveEntryPricesKrw`) entry(선정월 기준일)·current(최신 거래일). 가격 누락 ticker는 제외 + 카운트.
  - cron/route 아님 — 페이지 Server Component에서 KRX 키 있을 때만 계산(키 부재 → 가격열 "—").

## 3. UI — `/admin/sector-comparison` (Server Component, read-only)
- nav 항목 추가(`(admin)/layout.tsx` ADMIN_NAV): `{ href: "/admin/sector-comparison", label: "섹터 추천 비교" }`.
- 2-컬럼: 좌 production B++ 30(AI 배지 포함) / 우 Track-2 sector-soft-tilt top-30. 각 헤더에 set별 평균 실현 수익률 + 리더 포함 수.
- 교집합/차집합 하이라이트(production에만/Track-2에만 — 어떤 리더를 tilt가 더 잡았나).
- **빈 상태**: shadow run 부재 → "Track-2 shadow 미실행(0039+0046 apply + generator 실행 필요)" 안내 카드. production 30은 항상 표시.
- **가드 카피(필수)**: "soft 비교 전용 — hard-gate live 적용 영구 금지 · 검증 전 production 자동 교체 없음 · Track-2 30은 결정론 top-30(AI 선정 아님)". 면책 Footer 유지.
- adminVerified 가드(is_admin RPC) — RLS deny 시 빈 데이터 오인 방지 배너(health/alerts 패턴).

## 4. 가드레일 체크리스트 (코드화)
- [ ] read-only: 페이지·helper·RPC 모두 SELECT만(write/mutation 0, grep gate).
- [ ] hard-gate arm(`sector-hard-gate`)은 메뉴에서 **제외**(soft만) — arm allowlist.
- [ ] shadow run 부재 → 빈 상태(throw 0, production 30은 표시).
- [ ] Track-2 30 = top-30 결정론 명시(AI 선정 아님) 카피.
- [ ] 마이그 0046 DORMANT + rollback + PG smoke + 3종 grant + is_admin self-gate.
- [ ] production short_list_30/tier0_candidates_150 무회귀(읽기만).
- [ ] KRX 키 부재 → 가격열 "—"(키=USER 게이트).

## 5. USER 게이트
- 마이그 0039(shadow 테이블) + 0046(read RPC) apply.
- Track-2 generator 실행(`shadow_gen_runner.py --shadow-sector` + 사전등록 hypothesis) → shadow run 적재.
- `KRX_OPENAPI_KEY`(실현 수익률 계산).
- (PR-A5/PR-B5 통계 verdict는 deferred/research — 본 메뉴 미사용.)
