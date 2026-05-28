# Task 5 B66 C 하이브리드 sector mapper plan (DART induty_code + override fallback)

> **세션**: 60차 §3 (Task 5) — DRAFT R0 (Claude 1차)
> **상태**: PLAN CONVERGED — OMXY R1+R2 direct-fix 누적 10 catches (6 BLOCKERS + 4 minor) + Claude verify PASS (60차 §3). 다음 세션 진입 = impl PR (`feat/b66-c-hybrid-sector-mapper-impl`).
> **paired decision**: HANDOFF §9.3 (Approach lock-in = C 하이브리드)
> **선행 commit**: PR #54 `50cb94a` (Mock cleanup Step 2.7b.3 MERGED in main)
> **블록**: PR5 entry (Task 5 backfill + Task 6 Stage 1 + Task 7 Stage 2 USER 승인 모두 PASS 후 진입)
> **workflow note (사용자 명시, 60차 §3)**: 1차 진행 = Claude / 1차 검증 + 직접 fix = OMXY / fix verify = Claude. OMXY는 agent+skill을 이용해 직접 plan을 수정한다 (catch-only가 아닌 direct-edit 권한 부여).

---

## 0. Scope guard (재해석 금지)

**본 plan scope** (60차 §3, 다음 세션 impl 진입을 위한 plan SoT):

- `short_list_30` 30 rows의 `sector` 컬럼을 canonical 14 (`tudal/src/lib/screening/canonical-sectors.ts::CANONICAL_SECTORS`)로 채우는 **seed pipeline 영구 매퍼**.
- **C 하이브리드** = DART `induty_code` (KSIC) primary + 수동 override map fallback.
- 신규 KSIC → canonical 14 crosswalk (`scripts/canonical_sector_mapper.py` 신규 모듈) + TypeScript SoT 일관성 검증.
- `scripts/screen_shortlist_tier0.py::fetch_universe` 수정: 현재 placeholder (`sector = "코스피" if market == "KOSPI" else "코스닥"`, line 305)를 신규 mapper 호출로 대체.
- 마이그 0026 (선택지) — `dart_corp_codes.induty_code` 컬럼 신규 추가 + rollback. (또는 별도 `dart_corp_induty` 테이블 — §3.2 R-debate).
- `seed_dart_corp_codes.py` 수정: `--backfill-induty` flag 신규 추가 (DART `company.json` API 단건 호출로 `induty_code` fetch & cache). default corp_code seed 동작은 영향 0.
- B89 unknown policy = R1 lock-in (옵션 i + lightweight manual review / DB write block, §4.3). unresolved row가 1개라도 있으면 `--apply` 전면 거부.
- B93 PASS criteria 3종 검증 테스트 (Python pytest + TypeScript Vitest).
- override map (`scripts/sector_override.json`) — 모호한 KSIC induty_code 또는 DART 오분류 ticker 명시.
- TDD invariants 10종 (§6).
- impl PR `feat/b66-c-hybrid-sector-mapper-impl` — 다음 세션. **본 plan PR은 plan-only** (PR #28 Task 4 plan SoT 패턴).

**Out-of-scope** (별도 PR/Task):

- **production short_list_30 backfill apply** → USER Supabase re-auth + service-role write 권한 (impl PR merge 후 USER manual run).
- **PR5 cron 30 자동 + 큐 인프라** → Task 8 audit 후.
- **PR5 cron path의 induty cache invalidation** → PR5 plan R-debate (cache TTL + 신규 ticker 첫 발견 시 induty lookup batch).
- **DART company.json rate-limit / backoff 정책** → 본 plan §7.2 baseline은 implementation acceptance 기준으로 포함. 운영 튜닝(동시성/캐시 TTL 변경)은 PR5 plan으로 분리.
- **B66과 무관한 cron / RPC / report writer 변경**.
- **W-portfolio-snapshot-real / W-alert-event-dedup / Smoke Stage 1·2 / B79 / DQ-7 / S8 / 멤버 페이지**.

---

## 1. SoT linkage

| 자료 | 경로 | 본 plan에서의 역할 |
|---|---|---|
| canonical 14 TypeScript SoT | `tudal/src/lib/screening/canonical-sectors.ts` | `CANONICAL_SECTORS`, `LEGACY_ALIAS_MAP`, `SUB_TAG_CROSSWALK`, `SUB_TAG_OVERLAY_ROLES` — Python mapper가 동일 14 sector 라벨을 사용하도록 cross-language drift 0 보장. |
| Tier 0 seed pipeline | `scripts/screen_shortlist_tier0.py` line 275-317 (`fetch_universe`) | placeholder `sector = "코스피" if market == "KOSPI" else "코스닥"` (line 305)를 신규 mapper 호출로 대체. |
| DART corp_code seed | `scripts/seed_dart_corp_codes.py` | corp_code seed 2,766 corp 기반. 본 PR에서 induty_code 추가 fetch + cache. |
| DART signals helper | `scripts/dart_signals.py` | 기존 `dart_corp_codes` consumer (`select("corp_code")`). 0026 nullable column 추가가 기존 `corp_code` lookup과 tests를 깨지 않는지 확인. DART HTTP 호출 패턴 reference이기도 함. |
| 마이그 0013 (dart_corp_codes) | `tudal/supabase/migrations/0013_dart_corp_codes.sql` | 현재 schema = (ticker, corp_code, corp_name, market). induty_code 컬럼 부재 — 마이그 0026에서 추가. |
| 마이그 0014 (dart_financial_cache) | `tudal/supabase/migrations/0014_dart_financial_cache.sql` | TTL + caller_logged_at 패턴 reference (induty cache 정책 결정 시). |
| short_list_30 schema | `tudal/supabase/migrations/0012_short_list_30_name_sector.sql` (name/sector 컬럼) | sector 컬럼 type = text (현재 placeholder), 본 plan에서 canonical 14 enum 정합. DB-level CHECK는 placeholder backfill PASS 후 별도 USER-gated 마이그로만 추가. |
| ReportFramework SoT | `Document/Service/Report/ReportFramework.md §7.2 + §7.3` | canonical 14 sector + sub_tag overlay 표 — Python crosswalk가 동일 라벨 유지. |
| ServicePlan-Admin SoT | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19 + D21` | C 하이브리드 결정의 사업적 근거 (Tier 0 자동 + 30 rows 운영). |
| HANDOFF SoT | `Document/Process/HANDOFF.md §1 / §2.1 row 5 / §9.3` | B66 결정 박제 + Task 5 진행 상태. |

---

## 2. Sequence overview (12 steps)

```
Phase A — DB schema (induty cache)
  1. 마이그 0026 작성 + rollback             (CLAUDE; OMXY-fixable)
     OR 별도 테이블 dart_corp_induty 결정 (§3.2 R-debate)

Phase B — Crosswalk + override SoT
  2. canonical_sector_mapper.py (KSIC → canonical 14)  (CLAUDE; OMXY-fixable)
  3. sector_override.json (수동 override map)           (CLAUDE; OMXY-fixable)
  4. canonical-sectors.ts ↔ Python crosswalk drift 검증  (CLAUDE; OMXY-fixable)

Phase C — DART API integration
  5. seed_dart_corp_codes.py — induty_code fetch + cache (CLAUDE; OMXY-fixable)
  6. fetch_induty_for_universe.py 또는 inline fn (CLAUDE; OMXY-fixable)
     → fetch_universe에서 corp_code → induty → mapper chain

Phase D — Tier 0 pipeline wire
  7. screen_shortlist_tier0.py::fetch_universe 수정 (CLAUDE; OMXY-fixable)
  8. B89 unknown ticker 정책 lock-in = strict manual-review/block (CLAUDE; OMXY-fixable)

Phase E — TDD invariants
  9. Python pytest (mapper + override + drift) (CLAUDE; OMXY-fixable)
 10. TypeScript Vitest (canonical sector drift detect) (CLAUDE; OMXY-fixable)

Phase F — Verification + R-debate + merge
 11. 검증 게이트 + DART API rate-limit 측정      (CLAUDE)
 12. omxy R-debate (max 8 rounds, native critic subagent) → CONVERGED 후 impl PR commit + push + plan-only PR create (SHARED)
```

**Verification gate sequence (impl PR 시점)**:
- 매 step 1~10 직후 단위 검증 (해당 step의 grep + lint 부분 OK).
- step 11 = `npm run build && npm run lint && npm run test:ci && npx tsc --noEmit` 4종 PASS + Python `pytest scripts/` PASS + dry-run으로 30 ticker mapper 결과 인공 검사.
- step 12 = omxy CONVERGED 후만 impl PR merge → USER apply.

**production backfill apply (impl PR merge 후 USER manual)**:
- USER가 service-role key + DART API key + KRX 인증 활성 환경에서:
  ```bash
  set -a && eval "$(grep ... tudal/.env.local)" && set +a
  scripts/.venv/bin/python scripts/seed_dart_corp_codes.py --backfill-induty  # induty_code 누락분 백필
  scripts/.venv/bin/python scripts/screen_shortlist_tier0.py \
    --month 2026-05-01 --as-of 2026-05-11 --apply \
    --csv-backup scripts/out/short_list_30_2026-05_C-hybrid.csv
  ```
- 적용 전 `sector_review_required.csv`가 0 rows인지 확인. 적용 후 Supabase MCP `select sector, count(*) from short_list_30 group by sector` + `where sector in ('코스피','코스닥')` + `where sector not in (canonical 14)` → B93 PASS 검증.

---

## 3. DB schema 결정 (마이그 0026 vs 별도 테이블)

### 3.1 옵션 비교

| 옵션 | pros | cons |
|---|---|---|
| **A. `dart_corp_codes.induty_code` 컬럼 추가** (마이그 0026) | 단순. lookup 1 query. 기존 seed flow 그대로. 기존 `scripts/dart_signals.py::_lookup_corp_code`의 `select("corp_code")`와 양립. | dart_corp_codes 변경 영향 범위 확대 — consumer matrix(`seed_dart_corp_codes.py`, `screen_shortlist_tier0.py`, `dart_signals.py`) regression 필요. |
| **B. 별도 `dart_corp_induty` 테이블** | 분리. induty TTL/lineage 메타 컬럼 자유. dart_corp_codes 불변. | JOIN 추가. lookup 2 query (또는 view). seed 시 추가 INSERT. |
| **C. `sector_override.json` only (DB 없이)** | 가장 단순. 마이그 0건. | 매월 cron 가동 시 신규 ticker 발견하면 induty 재조회 또는 manual edit 필요. 운영 부담 ↑. |

### 3.2 R-debate 권고 (R0, OMXY R1에서 challenge)

**옵션 A 채택 권고** 사유:
- 현재 `dart_corp_codes` consumer는 `seed_dart_corp_codes.py`, `screen_shortlist_tier0.py`(신규 mapper lookup), `scripts/dart_signals.py::_lookup_corp_code` 3개다. R1 grep 증거: `dart_signals.py`는 `select("corp_code")`만 사용하므로 nullable column 추가와 충돌 없음. 그래도 `scripts/test_dart_signals.py`를 regression gate에 포함한다.
- induty는 corp_code lifecycle과 동일 (corp 단위 lookup, 폐지 시 함께 무효화).
- TTL 정책은 induty가 거의 변하지 않으므로 (KSIC 개정 5년 주기) `last_seen_at` 메타로 충분.

**옵션 B는 PR5 cron 단계에서 재고**: 만약 induty TTL/lineage 메타가 필요해지면 (예: KSIC 5차 → 6차 개정), 별도 테이블로 마이그 분리.

**옵션 C 채택 시 risk**: cron 가동 후 신규 ticker 발견 시 자동 fallback 0 → 운영 부담. **명시 reject**.

### 3.3 마이그 0026 SQL sketch (옵션 A)

```sql
-- 0026_dart_corp_codes_induty_code.sql
-- B66 C 하이브리드 sector mapper — DART induty_code cache 컬럼.
-- DART company.json API (단건 corp 조회)로 fetch, seed_dart_corp_codes.py에서 갱신.
-- spec: docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md

alter table public.dart_corp_codes
  add column if not exists induty_code text,
  add column if not exists induty_last_status text,
  add column if not exists induty_last_seen_at timestamptz;

alter table public.dart_corp_codes
  drop constraint if exists dart_corp_codes_induty_code_format_check;

alter table public.dart_corp_codes
  add constraint dart_corp_codes_induty_code_format_check
  check (induty_code is null or induty_code ~ '^[0-9]{3,5}$');

comment on column public.dart_corp_codes.induty_code is
  'DART company.json 업종코드(induty_code). 실제 응답은 3~5자리 numeric string으로 관측되므로 longest-prefix mapper 입력으로 사용.';

comment on column public.dart_corp_codes.induty_last_status is
  'DART company.json 마지막 응답 status. 000만 induty_code 신뢰, 020/800/901 등은 재시도/운영 진단용.';

comment on column public.dart_corp_codes.induty_last_seen_at is
  'induty_code 마지막 fetch timestamp. TTL/staleness 진단용 (현재는 정보 컬럼, retention 정책 없음).';

-- 4-grant 패턴 (0013 dart_corp_codes 패턴 정합):
--   service_role/authenticated SELECT/UPSERT 유지 (seed script 사용).
--   anon/public REVOKE (RLS using(is_admin())).
-- 본 ALTER TABLE는 column-level grant 자동 상속 → 신규 grant 명시 0.

-- RLS 정책 변경 0 (0013 패턴 유지: using(is_admin()) for service_role/authenticated only).
```

### 3.4 마이그 0026 rollback

```sql
-- 0026_dart_corp_codes_induty_code.rollback.sql
alter table public.dart_corp_codes
  drop constraint if exists dart_corp_codes_induty_code_format_check;

alter table public.dart_corp_codes
  drop column if exists induty_last_seen_at,
  drop column if exists induty_last_status,
  drop column if exists induty_code;
```

---

## 4. KSIC → canonical 14 crosswalk (`canonical_sector_mapper.py`)

### 4.1 핵심 매핑 표 (R1 fixed draft — Claude verify 대기)

OpenDART 공식 `company.json`은 `induty_code`를 "업종코드"로 제공하지만 자리수를 고정하지 않는다. 실측 예: 삼성전자 `005930`과 LG전자 `066570` 모두 `264`; 2026-05 B66 30종목에는 `108`, `211`, `2612`, `29272`, `70113`처럼 3~5자리 값이 섞인다. 따라서 구현은 **문자열 numeric 정규화 + longest-prefix match**로 한다.

**Normalization contract**:
- 입력 `induty_code`는 trim 후 `^[0-9]{3,5}$`만 허용. 그 외/null은 unresolved.
- mapper는 exact 5자리 → 4자리 → 3자리 → 2자리 순으로 longest-prefix match.
- broad 2자리 rule은 최후 fallback이다. 2자리로도 canonical 확신이 낮은 prefix는 unresolved로 보내고 override 요구.
- canonical sector 14개 중 prefix만으로 안정 분류가 어려운 `2차전지`/`통신`/`반도체`/`IT/SW` 경계는 3~5자리 exact rule과 ticker override를 우선한다.

**Longest-prefix mapping seed (R1 fixed draft)**:

| induty prefix | 의미 (예시) | canonical 14 / 처리 |
|---|---|---|
| 01~03 | 농업/임업/어업 | unresolved (universe filter에서 보통 컷, 상장 잔존 시 manual review) |
| 05~09 | 광업 | 에너지 |
| 10~12 | 식품/음료/담배 | 유통/소비재 |
| 13~14 | 섬유/의복 | 유통/소비재 |
| 15 | 가죽/가방/신발 | 유통/소비재 |
| 16~17 | 목재/펄프/종이 | 철강/소재 |
| 18 | 인쇄/출판 | 엔터/미디어 |
| 19 | 코크스/석유 정제 | 에너지 |
| 20 | 화학 (기초/정밀) | 철강/소재 |
| 21 | 의약품 | 바이오 |
| 22 | 고무/플라스틱 | 철강/소재 |
| 23 | 비금속 광물 | 건설 |
| 24 | 1차 금속 | 철강/소재 |
| 25 | 금속가공 | 철강/소재 |
| 261/2611/2612/262/2629 | 반도체/전자부품/디스플레이 부품 | 반도체 |
| 264 | 통신·방송 장비 broad code | 통신 기본값. 삼성전자/LG전자처럼 복합 대형주는 ticker override 필수. |
| 26 기타 | 전자부품/전자장비 broad | 반도체 기본값, 통신장비/가전 복합은 override |
| 27 | 의료/정밀/광학 | 바이오 기본값. 배터리 진단장비/산업 측정장비는 override |
| 282/2820/28202 | 일차전지·축전지 | 2차전지 |
| 281/283~285/289 | 전기장비·전력기기 | 에너지 기본값, 배터리/가전 복합은 override |
| 291/303/304 | 자동차 부품/차체/특장 | 자동차 |
| 29 기타 | 기계/특수목적장비 | unresolved 기본값. 반도체 장비/자동차 장비/산업재 경계가 커서 manual review 우선. |
| 30 | 자동차/트레일러 | 자동차 |
| 31 | 기타 운송장비 (선박/철도/항공) | 운송/물류 |
| 32 | 가구 | 유통/소비재 |
| 33 | 기타 제품 (스포츠/장난감) | 유통/소비재 |
| 35 | 전기/가스/증기 | 에너지 |
| 36 | 수도/하수/폐기물 | 에너지 |
| 41~42 | 종합건설/전문건설 | 건설 |
| 45~47 | 도매/소매 | 유통/소비재 |
| 49 | 육상운송 | 운송/물류 |
| 50 | 수상운송 (해운) | 운송/물류 |
| 51 | 항공운송 | 운송/물류 |
| 52 | 창고/운송지원 | 운송/물류 |
| 55~56 | 숙박/음식점 | 유통/소비재 |
| 582/620/631 | SW 개발·정보서비스 | IT/SW |
| 58 기타 | 출판/게임/콘텐츠 | 엔터/미디어 기본값. 게임사는 D21 sub_tag crosswalk에 따라 IT/SW override 가능. |
| 59 | 영상/오디오 (영화/음반) | 엔터/미디어 |
| 60 | 방송 | 엔터/미디어 |
| 61 | 통신 | 통신 |
| 62~63 | 컴퓨터/SW/IT 서비스 | IT/SW |
| 64 | 금융 (은행/투자/자산운용) | 금융 |
| 65 | 보험 | 보험/증권 |
| 66 | 금융보조 (증권/투자 보조) | 보험/증권 |
| 68 | 부동산 | 건설 |
| 69~75 | 전문/과학/기술 서비스 | unresolved 기본값. 지주/광고/바이오 R&D가 섞여 manual review 필요. |
| 701/7011/70113 | 자연과학·공학 R&D | unresolved (제약/바이오 R&D는 override-required, 일반 R&D는 IT/SW 등으로 override 가능) |
| 85 | 교육 | IT/SW |
| 86 | 보건 (병원/임상) | 바이오 |
| 90 | 창작/예술/여가 | 엔터/미디어 |

### 4.2 ambiguous cases — override 최소화 (R1 fixed draft)

`sector_override.json`은 **mapper가 틀리는 ticker만** 담는다. R0의 18개 대형주 catalog에는 현대차/은행/보험처럼 mapper가 이미 맞히는 항목이 섞여 있어 audit trail을 오염시킨다. R1 fix: 18개는 override 파일이 아니라 **regression fixture 후보**로 강등하고, 실제 override seed는 현재 B66 2026-05 30 rows + 매월 신규 unresolved만 대상으로 한다.

**R1 live evidence (2026-05 backfill CSV 기준)**:
- `scripts/out/tier0_2026-05_dart_apply.csv` 30 ticker를 DART `company.json`으로 spot-check한 결과 30/30 `status=000`.
- `induty_code`는 `108`, `211`, `2642`, `29272`, `70113` 등 3~5자리 혼재. 5-digit-only 테스트는 폐기.
- 최소 override 후보 예: `254490` 미래반도체(`467`, 도매) → 반도체, `452200` 민테크(`27212`, 측정장비) → 2차전지, `322000` HD현대에너지솔루션(`2612`) → 에너지, `226330` 신테카바이오(`582`) → 바이오, `100590` 머큐리(`2642`) → 통신, `036710` 심텍홀딩스(`715`) → 반도체/지주 manual review.

**override file seed rule**:
1. 현재 30 rows에 대해 `ticker,name,induty_code,mapper_sector,override_sector,reason` review CSV를 생성한다.
2. `mapper_sector != reviewer_sector` 또는 mapper unresolved인 ticker만 `sector_override.json`에 넣는다.
3. mapper가 이미 맞힌 tickers(예: 금융/보험/자동차 정합)는 override 금지. 테스트 fixture로만 사용.
4. regression fixture는 canonical 14 각각 최소 1개 사례를 포함한다. prefix로 안정 매핑 불가한 sector는 `fixture_type="override-required"`로 명시하고, 이 경우 production row에 나타나면 override 없이는 `--apply`가 block되어야 한다.

예시 형식:

```json
{
  "override_version": "v1",
  "override_date": "2026-05-28",
  "override_source": "60차 §3 Task 5 plan SoT — only ticker-level corrections where induty mapper is insufficient",
  "tickers": {
    "254490": { "canonical": "반도체", "reason": "미래반도체 — DART induty_code=467(도매)지만 사업 실질은 반도체 유통. B66 2026-05 current row." },
    "452200": { "canonical": "2차전지", "reason": "민테크 — DART induty_code=27212(측정/시험장비)이나 배터리 진단장비 업체. B66 2026-05 current row." },
    "226330": { "canonical": "바이오", "reason": "신테카바이오 — DART induty_code=582(SW)이나 AI 신약개발 사업. B66 2026-05 current row." }
  }
}
```

**예상 override 비율**: 사전 고정하지 않는다. current 30 review CSV에서 증거가 있는 ticker만 override. 비율이 30%를 넘으면 KSIC broad mapping이 너무 공격적인 것이므로 mapper rule을 strict/unresolved 쪽으로 조정한다.

### 4.3 unknown ticker 정책 (B89 — OMXY R1에서 lock-in)

3옵션 비교:

| 옵션 | 동작 | pros | cons |
|---|---|---|---|
| **i. block** | `short_list_30` INSERT 거부 + raise | universe 품질 보장, 명시 fail | universe 축소 (어떤 corp_code는 induty_code null인 경우 발생 — DART 등록 미완) → bucket 30개 미달 위험 |
| **ii. manual review queue** | 새 테이블 `pending_sector_review` 적재 + 어드민 수동 매핑 | 단계적 보정, 운영 가시성 | 인프라 추가, 어드민 수동 부담 |
| **iii. backfill exclude** | KSIC mapper 결과 또는 override가 매칭되면 정상, 미매칭은 `sector="unknown_pending"` + log warning | 30 rows 항상 유지, 점진 보정 | DB CHECK 정합 추가 필요 (canonical 14 ∪ {"unknown_pending"}) |

**R1 lock-in**: **옵션 i + lightweight manual review (DB write block)**.

동작:
- dry-run은 unresolved rows를 `sector_review_required.csv`로 출력하고 exit code 2를 반환한다.
- `--apply`는 unresolved가 1개라도 있으면 `short_list_30` write를 전면 거부한다.
- 해결 방법은 `sector_override.json` PR 추가 또는 mapper rule 보수 후 재실행뿐이다.
- `unknown_pending`은 production `short_list_30.sector`에 절대 저장하지 않는다.

사유:
- HANDOFF §2.1 row 5의 B93 PASS는 `sector ∈ CANONICAL_SECTORS`와 `sector ∉ ('코스피','코스닥')`이다. `unknown_pending`은 B93 위반이다.
- Sector Board partA는 canonical sector 14에 의존한다. unknown sector를 넣으면 이후 PR5/리포트 path가 다시 오염된다.
- 어드민 3인 내부 도구라도 PR5 entry blocker인 Task 5의 목적은 “30 rows 유지”가 아니라 “30 rows canonical trust 회복”이다.

---

## 5. Override file 운영 정책

### 5.1 위치 + 형식

- `scripts/sector_override.json` — JSON, key=ticker(6-digit), value={canonical, reason}.
- Python loader는 `canonical_sector_mapper.py::load_override()` (캐시 + reload-on-change).
- 운영 시 어드민이 수동으로 ticker 추가 → branch + PR 머지로만 변경 (DB 적재 0). Git history가 audit trail.

### 5.2 validation rules (TDD invariant)

1. `canonical` field는 `CANONICAL_SECTORS` (14개) 중 하나만 허용 (test에서 enum 검증).
2. `reason` field는 non-empty string 필수.
3. `ticker` key는 정확히 6-digit numeric (`^[0-9]{6}$`).
4. JSON 자체 validity (parse fail 시 fail-fast).

### 5.3 override priority (impl PR §3 명시)

```
final_sector = override.json[ticker] (최우선)
            else KSIC mapper (induty_code → canonical 14)
            else unresolved → dry-run review CSV + --apply block (B89 R1 lock-in)
```

---

## 6. TDD invariants (10종)

### 6.1 Python pytest

1. **Test 1 — DART induty normalization + canonical coverage**: 3~5자리 혼재(`264`, `2642`, `2612`, `29272`, `70113`)를 longest-prefix로 처리. 5-digit-only fixture 금지. canonical 14 각각은 mapper rule 또는 `override-required` fixture 중 하나로 최소 1개 coverage.
2. **Test 2 — override priority**: current-row ambiguous ticker(예: 254490/452200/226330)가 override를 우선하고, mapper가 이미 맞히는 금융/보험/자동차 fixture는 override 파일에 없어야 한다.
3. **Test 3 — override schema validity**: invalid JSON / non-canonical field / non-6-digit key 모두 fail-fast.
4. **Test 4 — unknown handling**: induty_code=null / non-numeric / 매칭 안 되는 prefix → unresolved. dry-run은 review CSV, `--apply`는 write 전 block.
5. **Test 5 — seed pipeline 통합**: mock DART API (induty fixture) + mock pykrx universe → unresolved 0일 때만 30 mock ticker가 정확히 canonical 14로 산출.

### 6.2 TypeScript Vitest

6. **Test 6 — Python ↔ TS drift detect**: production TS SoT(`tudal/src/lib/screening/canonical-sectors.ts`)에서 `CANONICAL_SECTORS`를 test helper로 읽고 Python mapper list와 정확히 비교. `canonical-sectors.ts`가 `scripts/` JSON을 production import하지 않게 한다.
7. **Test 7 — SUB_TAG_CROSSWALK 정합**: TS `SUB_TAG_CROSSWALK` 7개 키와 Python review/override guide의 allowed sub_tag vocabulary 정합. sector mapper가 sub_tags를 임의 생성하지 않게 한다.

### 6.3 Cross-language invariant

8. **Test 8 — DB CHECK timing invariant**: 0026에는 `short_list_30.sector` CHECK를 넣지 않는다. 기존 production rows가 `코스피/코스닥` placeholder라 backfill 전 CHECK는 실패해야 정상이다. CHECK 마이그는 USER backfill PASS 후 별도.
9. **Test 9 — production audit invariant**: `select count(*) from short_list_30 where sector not in (CANONICAL_SECTORS) = 0` and `select count(*) where sector in ('코스피','코스닥') = 0`. impl PR merge 후 USER apply 직후 1회 spot-check (Supabase MCP).
10. **Test 10 — re-run idempotency**: 동일 ticker + 동일 induty + 동일 override 입력 시 결과 byte-for-byte 동일.

---

## 7. DART API integration 상세

### 7.1 induty_code fetch (DART `company.json`)

- endpoint: `https://opendart.fss.or.kr/api/company.json?crtfc_key=...&corp_code=...` (official: OpenDART 개발가이드 > 공시정보 > 기업개황)
- response field `induty_code` (업종코드). OpenDART 공식 guide는 자리수를 고정하지 않으며, repo 실측도 3~5자리 혼재다.
- per-corp 단건 호출. 2,766 corp seed = ~46분 (~1 req/sec rate-limit 가정).
- 첫 seed = `seed_dart_corp_codes.py --backfill-induty` (신규 옵션).
- 후속 (cron monthly-batch + 신규 ticker 발견 시) = batch 30~50개 신규만 fetch (분 단위 소요).

### 7.2 rate-limit / backoff (baseline — refinement impl PR)

- OpenDART 공식 메시지 기준 제한 초과는 status `020`이며, 일반적으로 20,000건 이상 요청에서 발생한다(계정별 제한 변동 가능). 2,766 단발은 안전권이나 status 기반 처리 필수.
- baseline: `time.sleep(0.2~1.0)` between req. HTTP 200이어도 JSON `status !== "000"`이면 실패로 처리. `020`/`800`/`900`/network timeout은 exponential backoff (1s → 2s → 4s, max 3 retries). 최종 실패는 `induty_code`를 덮어쓰지 말고 `induty_last_status`만 기록 + unresolved로 보낸다.
- `013`(조회된 데이터 없음)은 retry하지 않고 unresolved. `010`/`011`/`012`/`901`은 credential/IP/account 문제로 fail-fast.
- TTL: induty_last_seen_at 컬럼만, 만료 정책 없음 (KSIC 5년 주기). 사후 KSIC 6차 개정 시 운영 reseed.

### 7.3 보안

- DART_API_KEY는 `.env.local` only (Vercel env 미적재 — script 전용).
- 로그에 `crtfc_key` 노출 0 (req URL은 본문 string에서 redact).

---

## 8. 검증 게이트 + OMXY R-debate

### 8.1 검증 게이트 (impl PR 시점)

- `npm run build` — Next.js 25 routes 정상.
- `npm run lint` — 0 error.
- `npm run test:ci` — 117 → 119+ files (drift test + override schema test 추가).
- `npx tsc --noEmit` — clean.
- `pytest scripts/ -v` — Python 단위 테스트 1~5 + 8 PASS + `scripts/test_dart_signals.py` regression PASS.
- `python scripts/seed_dart_corp_codes.py --dry-run --backfill-induty --limit 30` (induty 30개만 mock fetch — DART key 보호) — log inspect.
- `python scripts/screen_shortlist_tier0.py --month 2026-05-01 --as-of 2026-05-11 --dry-run --csv-backup /tmp/test.csv --universe-limit 50` — unresolved가 있으면 review CSV + exit 2. unresolved 0일 때 sector 컬럼은 canonical 14만 허용.
- grep scope guards:
  - `rg "코스피.*else.*코스닥" scripts/screen_shortlist_tier0.py` → 0 매치 (placeholder 제거 확인).
  - `rg "from canonical_sector_mapper" scripts/screen_shortlist_tier0.py` → 1+ 매치.
  - `rg "CANONICAL_SECTORS" scripts/ tudal/src/` → Python + TS 양쪽 동일 14 라벨.

### 8.2 OMXY R-debate plan (max 8 rounds, native critic subagent 강제)

본 plan PR에 적용:

- **R1 (Claude → OMXY)**: scope guard + KSIC crosswalk 정합 + override schema + B89 unknown policy 3옵션 R-debate + 마이그 0026 vs 별도 테이블 옵션 R-debate + induty rate-limit baseline.
  - Native critic archetype (OMXY 자동 선택): Adversarial invariant + SQL/RLS/security + Product/spec/UX 3 archetype 최소.
- **R2~Rn**: BLOCKERS 발견 시 OMXY가 직접 plan 수정 (60차 §3 workflow). Claude는 OMXY 수정본을 verify (scope/style/정합).
- **CONVERGED 조건**: (a) scope guard 4종 절대 보존 (b) canonical 14가 mapper rule 또는 mandatory override/test fixture 중 하나로 모두 coverage됨 (c) override schema validation 명시 (d) B89 lock-in (e) 마이그 0026 옵션 lock-in (f) TDD 10 invariants 완전 (g) 검증 게이트 명시 (h) 검증 후 BLOCKERS 0.

### 8.3 OMXY direct-edit 권한 (60차 §3 workflow note)

- OMXY는 본 plan 파일 (`docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md`) 직접 수정 권한.
- 사용 가능 도구: omx native tools (Read/Write/Edit/Bash/Grep/Glob 등) + omx native subagents (skills) — OMXY가 자율 판단으로 선택.
- 수정 후 SIGNAL: FIXED + Claude verify 요청. fix가 R1 catch와 1:1 매핑 + scope guard 위반 0이면 Claude가 다음 round 진행 또는 CONVERGED 선언.

### 8.4 Claude verify 책임 (60차 §3 workflow note)

- OMXY fix 후 plan 파일 재읽고:
  1. scope guard 4종 유지 검증
  2. fix 범위가 R1 catch 1:1 매핑
  3. KSIC crosswalk / override / TDD / 마이그 등 핵심 SoT 정합
  4. plan 구조 (§0~§9) 무결성
  5. 신규 BLOCKERS 발견 시 OMXY로 다시 fix 지시
- CONVERGED 선언 후 commit + push + PR create (SHARED 권한 자동).

---

## 9. Risks & open questions

### 9.1 식별된 risks (R1 fixed draft — Claude verify 대기)

| # | Risk | mitigation 후보 |
|---|---|---|
| R1 | DART `company.json` API rate-limit으로 2,766 corp 초기 seed가 ~46분 소요 → seed 작업 timeout 또는 partial fail | 단발 backfill (USER 수동 1회) + 매월 cron은 신규 ticker만 → 분 단위 |
| R2 | KSIC prefix-only mapping이 26/27/28/29/58/69~75 같은 broad prefix에서 false confidence를 만든다 | longest-prefix + broad ambiguous prefix unresolved + current 30 review CSV로 override 최소화 |
| R3 | DB CHECK enum 정합 시점 (마이그 0027) — placeholder backfill 전 CHECK가 반드시 실패 | 0026에는 CHECK 금지. USER backfill PASS 후 별도 USER-gated CHECK 마이그 |
| R4 | Python `canonical_sector_mapper.py` ↔ TypeScript `canonical-sectors.ts` drift — sector 추가/변경 시 한쪽만 갱신 | production TS import 변경 없이 drift test가 TS SoT를 읽어 Python list와 비교 |
| R5 | unresolved row가 많아 `--apply` block으로 30 rows 생성이 지연 | delay는 의도된 품질 게이트. review CSV + override PR로 해소 후 apply |
| R6 | R0의 `unknown_pending` 저장 정책은 B93/Section 8 canonical contract를 위반 | R1 lock-in: unknown_pending production 저장 금지 |
| R7 | DART `company.json` status가 HTTP 200 안의 JSON status로만 실패를 표현할 수 있다 | `status !== "000"` matrix test + credential fail-fast + retryable status 분리 |

### 9.2 OMXY R1에서 명시 도전 요청

- (a) §4.1 mapping + §4.2 mandatory override/test fixture가 canonical 14 coverage를 만족하는가? prefix-only로 무리하게 전수 매핑하지 않았는가?
- (b) §4.2 override 18개 catalog는 적정량? 과다/과소?
- (c) §3.2 옵션 A vs B 선택 — induty cache TTL을 1년/없음으로 둘 때 운영 risk?
- (d) §4.3 B89 R1 lock-in(strict manual-review/block)이 B93/PR5 path와 충돌 없는가?
- (e) §6 TDD 10종이 §3~§5 scope를 충분히 커버?
- (f) §7.1 DART company.json API는 본 plan에서 첫 사용 — 보안/rate-limit/응답 형식 R-debate에서 검증?
- (g) §4.2 override 중 "035720 카카오 = IT/SW" 같은 결정이 ServicePlan-Admin §1A.5 D19 (어드민 운영 의미)와 정합?

### 9.3 OMXY direct-fix scope 보호 (Claude verify gate)

OMXY가 직접 수정 가능한 범위:
- §3.1~§3.4 DB schema 옵션 선택 + 마이그 0026 SQL refinement
- §4.1 KSIC prefix 표 추가/수정
- §4.2 override 18개 catalog 추가/수정/제거
- §4.3 B89 옵션 lock-in
- §6 TDD 추가/세분화
- §7.2 rate-limit / backoff 정책 refinement
- §9.1 Risks 추가
- 부록 B 라운드 기록 추가

**보호 범위** (OMXY 수정 금지, scope guard):
- §0 Scope guard 4종
- HANDOFF SoT 링크 (§1)
- workflow note (60차 §3 사용자 명시)
- Out-of-scope catalog (별도 PR 분리)
- production write USER-gated 박제

---

## 부록 A: 산출물 (impl PR 시점)

```
scripts/
  canonical_sector_mapper.py            (신규)
  sector_override.json                  (신규)
  seed_dart_corp_codes.py               (수정 — induty_code fetch + cache)
  screen_shortlist_tier0.py             (수정 — line 305 placeholder → mapper 호출)
  test_canonical_sector_mapper.py       (신규)
  test_sector_override.py               (신규)
  test_seed_dart_corp_codes.py          (수정 — induty fetch 테스트 추가)
  test_screen_shortlist_tier0.py        (수정 — sector canonical 정합 테스트)

tudal/
  src/lib/screening/canonical-sectors.ts                       (수정 없음 원칙 — production TS SoT 유지)
  src/lib/screening/__tests__/canonical-sectors-drift.test.ts  (신규)
  supabase/migrations/0026_dart_corp_codes_induty_code.sql      (신규)
  supabase/migrations/0026_dart_corp_codes_induty_code.rollback.sql (신규)

docs/superpowers/plans/2026-05-28-task5-b66-c-hybrid-sector-mapper.md  (본 plan, plan-only PR)
```

## 부록 B: OMXY R-debate 라운드 기록 (R1~Rn 진행 시 누적)

| Round | From | Catches | Fix scope | SIGNAL |
|---|---|---|---|---|
| R0 | Claude DRAFT | — | — | CONTINUE (initial draft) |
| R1 | OMXY | 6 BLOCKERS: induty 자리수/KSIC coverage, override catalog 오염, B89 unknown contradiction, `dart_corp_codes` consumer 누락, DART JSON status contract, Python↔TS drift contradiction | Direct-edit 적용: longest-prefix mapper + strict unresolved block, override 최소화/review CSV, consumer matrix 3개, status matrix/backoff, TS SoT 유지, TDD/gate 보강 | FIXED |
| R2 | OMXY | 4 minor: §0 B89 stale wording, §9.3 direct-fix scope catalog 누락, §0 induty flag wording, §4.1 mapper deterministic leak | Direct-edit 적용: §0 B89 R1 lock-in 반영, `--backfill-induty` default-impact 0 명시, 701* R&D unresolved 강등, 부록 B scope/log 보강 | CONVERGED |
| ... | ... | ... | ... | ... |

---

**EOF — R-debate CONVERGED (R1+R2: OMXY direct-edit 10 catches + Claude verify PASS, 60차 §3)**
