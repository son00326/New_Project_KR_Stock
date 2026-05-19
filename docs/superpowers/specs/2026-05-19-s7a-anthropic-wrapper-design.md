# Design Spec — S7a Anthropic Wrapper + Tier 1 + 합의 배지 + Section 8 jsonb writer

- **Date**: 2026-05-19 (49차)
- **Slice**: S7a (RealData — AI 통합)
- **Range**: B (HANDOFF 명시)
- **Status**: Design CONVERGED (omxy cmux pair-debate Q2~Q6 + Q5b + Design R4 모두 SIGNAL: CONVERGED)
- **Prerequisite**: B-6 ANTHROPIC_API_KEY Vercel env 발급 (billing 충전은 코드 완성 후)

---

## 0. 목적·범위 (B)

S7a 범위 B = HANDOFF.md §2.A 명시. billing 미충전 상태에서 **코드 100% mock 기반 완성** → billing 충전 후 smoke 1회로 검증.

**포함**:
- Anthropic wrapper (single persona call)
- Tier 1 Core 11 페르소나 평가 (단/중/장 시간대별 가중치)
- 합의 배지 **5종** (Q5b spec gap 해소: 🟢🔵🟣🟡⚪)
- Section 8 jsonb writer (Part B 쟁점 인용 + Part C 합의 패널 + Part D Core 11 표)
- cost_log 실 INSERT (마이그 0017 — env flag toggle)
- monthly_batch_runs 동시 실행 lock (마이그 0017)
- commit_persona_eval RPC 트랜잭션 (마이그 0017)
- 30 종목 mock e2e

**범위 밖 (Out-of-Scope, 후속 PR)**:
- Tier 2 Sector Board 14×10 plug-in (Part A `[]` 유지)
- Reflection 자가학습 (`reflection_log` 스키마, prompt context 주입)
- Anthropic SDK retry / rate limit handling
- 정확한 admin UI 위치 (rerun action 포함)
- D11 운용 검증 게이트 워크플로우
- 멤버 트랙·S8 자동매매·자율 트랙 §B

---

## 1. omxy 합의 결정 사항 (Q1~Q6 + Q5b + Design)

### Q1 — S7a 범위
사용자 결정 = **B** (HANDOFF 명시). 사용자 직접 답변.

### Q2 — cost_log 실 INSERT (Round 2 CONVERGED)
- **C 채택**: env flag `AI_COST_LOG_REAL_INSERT_ENABLED=false` (default)
- 마이그 **0017** 본 PR 박제 (cost_log 테이블 + RLS 3종)
- RLS 3종: auth admin INSERT allow / auth non-admin INSERT deny / anon SELECT·INSERT deny
- INSERT caller = user session 기반 (`createClient(cookies())`). service_role 금지.
- session/admin 없으면 fail-closed (silently skip 금지)
- M17 hardcap = wrapper-level `SELECT sum(cost_krw) + 예상 cost` 비교 — preflight upper-bound가 primary 가드 (Design R3)
- service_role / RPC / cron bypass = S7b parking (OOS)

### Q3 — section_8 jsonb schema SoT (Round 2 CONVERGED)
- **A 채택**: ServicePlan-Admin §4에 canonical JSON contract 박제 (zod 코드는 별도 파일)
- §4에 박제: canonical JSON shape (happy + B-scope variant), 필드 의미 표, semantic constraints, 코드 SoT 추적 문구
- §4에 박제 금지: zod 코드 전문, TS 타입 전문, Section 0~7 schema, UI import 경로
- ReportFramework §8 Step 2 v2.3: "schema SoT = ServicePlan-Admin §4" 역참조 1줄
- DoD: `section-8-schema.test.ts`에 §4 happy path / B-scope fixture → zod parse 성공 + transformer round-trip

### Q4 — Core 11 prompt 템플릿 저장소 (Round 2 CONVERGED)
- **A 채택**: TS const registry (`src/lib/ai/prompts/personas/{id}.ts` × 11 + `index.ts`)
- persona contract (정적, 실행 로직 없음):
  - `id: string` — stable cost/audit identifier
  - `label: string` — UI 표시명
  - `version: string` — YYYY-MM-DD 날짜 기반
  - `philosophy: string` — Section 8 Part D 위원 표 한 줄과 1:1 매핑
  - `systemPrompt: string` — immutable cache breakpoint 후보
  - `userPromptTemplate: string` — `{{TICKER}}`, `{{FINANCIALS}}`, `{{REFLECTION_CONTEXT}}` placeholder만
- 공통 render module: template + validated input → final prompt string (정확한 파일명 OOS)
- `persona_id` + `prompt_version` 양축 분리 → cost_log 2 컬럼 / cache key `${persona_id}:${prompt_version}`
- registry test 5종: id 중복 없음 / 11명 모두 / version YYYY-MM-DD regex / required placeholders / empty 없음
- 비-dev 어드민(son00326·shjang1001) prompt 편집 원칙: GitHub 이슈로 초안 → dev PR 반영. ServicePlan-Admin §3.7 한 줄 박제.

### Q5 — 합의 배지 임계값 정의 방식 (Round 3 CONVERGED)
- **A 채택**: hard-coded const in `consensus.ts`
- `TOP_PERCENTILE_THRESHOLD = 0.30` (JSDoc D19 SoT 참조)
- `isTopTier(rank: number, total: number): boolean` — pure
- 계산 정책:
  - rank=1 best (lowest = best)
  - cutoff = `Math.ceil(total * 0.30)`
  - bucket-level (단/중/장 각 10 → top 3)
- invalid input → throw `consensus_rank_invalid`
- 동점 처리 = ranker 책임 (OOS, consensus는 normalized rank만 받음)
- 테스트 boundary + happy 5종

### Q5b — D19 spec gap 해소 (Round 2 CONVERGED)
- **(i) 신규 배지 채택**: 4종 → **5종 배지 시스템**
- 명칭 정정: "약한 합의" → **🟡 "관망"** (단어 1개, "합의" 어휘 오해 방지)
- 5종 matrix (서로 배타적, 전체 케이스 완전 커버):

| Tier 0 | Tier 1 | tier1Available | Badge | 의미 |
|---|---|---|---|---|
| top | top | true | 🟢 강한 합의 | 둘 다 강함 |
| top | non-top | true | 🔵 숫자 우세 | 인디케이터만 강함 |
| non-top | top | true | 🟣 AI 우세 | AI 평가만 강함 |
| non-top | non-top | true | 🟡 관망 | 30 내 후보지만 매수 우선순위 낮음, 추가 검토 권장 |
| — | — | false | ⚪ AI 분석 대기 | AI 키 미발급 / 호출 실패 |

- hover/legend full label = "Tier 0·Tier 1 모두 bucket top 30% 외 — 30 내 후보, 매수 우선순위 낮음, 추가 검토 권장"
- 박제 위치:
  - ServicePlan-Admin §1A.5 D19 — 4종 → 5종 갱신
  - ReportFramework §8 Step 2 — Section 0 1행 배지 5종으로 갱신 (v2.4)
  - P3.1 D20 컴포넌트 — 5종 매핑 (후속 PR)
  - consensus.ts JSDoc + 테스트 5 happy

### Q6 — Anthropic prompt cache 정책 (Round 2 CONVERGED)
- **C 채택**: env flag `AI_PROMPT_CACHE_ENABLED=false` (default)
- 2 env flag 성격 분리: cost_log = DB side-effect kill-switch / prompt cache = API 비용 최적화
- wrapper 책임 (single persona call):
  - flag-off: cache_control 없음, cache usage 0
  - flag-on: stable system block 끝에 `cache_control: { type: 'ephemeral' }`
  - 반환: `usage.input_tokens` / `cache_creation_input_tokens` / `cache_read_input_tokens` / `output_tokens` / `costKrw` / `promptCacheEnabled`
- cost_log 마이그 0017 컬럼 5종:
  - `input_tokens` int
  - `cache_creation_input_tokens` int (+25% 단가)
  - `cache_read_input_tokens` int (~10% 단가)
  - `output_tokens` int
  - `prompt_cache_enabled` boolean (월별 cache on/off 비용 분석 가능)
- 비용 계산 (`pricing.ts`): `cost_krw = (input × pIn + cache_creation × pIn × 1.25 + cache_read × pIn × 0.10 + output × pOut) × 환율`. 정확한 단가 = OOS writing-plans.
- **persona-major warm-first 호출 순서** (cache-on 운영 조건):
  - Outer: 페르소나 11 sequential (Buffett → Druckenmiller → ... → 위원장)
  - per persona p:
    - **Warm**: `ticker[0]` 단독 호출 → cache write (응답 대기)
    - **Fan-out**: `ticker[1..29]` 29개 Promise.all → cache read (5분 TTL 안)
  - 총 시간 ≈ 22초 (페르소나당 ~2초)
  - cache miss는 비용 ↑ but 정상 완료
- 테스트: flag on/off payload shape + call order + warm-first concurrency (deferred mock — warm promise resolve 전 fan-out 미호출 검증)

### Design R4 — 4 추가 정정 (Round 4 CONVERGED)
1. **Monthly batch execution lock** (마이그 0017 신규 테이블)
   - `monthly_batch_runs(month PK, status, started_at, started_by uuid, finished_at, call_count_done int, error_code text)`
   - status check: `('running', 'succeeded', 'failed')`
   - admin server action 흐름:
     1. auth check (`is_admin()`)
     2. lock 획득: `INSERT ... ON CONFLICT (month) DO NOTHING`
        - returning empty → status 분기:
          - `'running'` → throw `batch_already_running`
          - `'succeeded'` → throw `batch_already_completed` (rerun action OOS)
          - `'failed'` → UPDATE → status='running' 재시도 허용
     3. preflight budget check
     4. Anthropic calls + cost_log (독립 트랜잭션)
     5. writer RPC per ticker (트랜잭션)
     6. lock release: status='succeeded' or 'failed' + error_code (try/finally 보장)
   - RLS: admin SELECT/INSERT/UPDATE allow / anon deny
2. **cost_log = API audit log, writer와 트랜잭션 독립**
   - Anthropic 호출 성공 시 cost_log INSERT (단독 auto-commit)
   - writer RPC `commit_persona_eval` 실패 시 cost_log row 보존 (이미 과금됨)
   - 매월 reconciliation: stock_reports 없는 cost_log = orphan call (writer 실패 인덱스, operator 검토 후 rerun)
3. **writer RPC retry = Anthropic response 재활용**
   - "ticker 단위 retry"는 writer RPC만 (in-memory persona response 재호출). Anthropic 재호출 안 함.
   - 전체 batch rerun (Anthropic 재호출 포함) = 별도 operator decision (rerun action UI = OOS)
4. **cron route = mock dry-run only**
   - `/api/cron/monthly-batch` = flag-off 경로 mock 호출 30 ticker + stock_reports/committee_votes 미 INSERT + 200 + summary
   - Real persona-eval + INSERT = authenticated admin server action (정확한 UI 위치 OOS)
   - cron caller session 결정 = OOS S7b parking 유지

---

## 2. Architecture

```
admin clicks "이번 달 분석 실행" 버튼 (authenticated server action)
  ↓
1. auth check (is_admin)
  ↓
2. monthly_batch_runs lock 획득 (INSERT ON CONFLICT)
   → batch_already_running / batch_already_completed 차단
  ↓
3. preflight: getMonthlyTotal + 30 × MAX_COST_PER_CALL_KRW upper-bound vs HARDCAP_KRW (40만원)
   → cost_hardcap_40man 차단 (writer/Anthropic 호출 전)
  ↓
4. persona-major loop (11 outer sequential):
     - warm: callPersona(persona, ticker[0]) → cost_log INSERT (audit, 독립)
     - fan-out: Promise.all(ticker[1..29].map(callPersona)) → 각 cost_log INSERT
  ↓
5. consensus.assignBadge per ticker (5종)
  ↓
6. writer RPC commit_persona_eval per ticker (트랜잭션):
     - UPSERT stock_reports ON CONFLICT (month, ticker)
     - DELETE committee_votes WHERE report_id = ?
     - INSERT committee_votes 11 rows
   → 실패 시 caller catch + writer RPC retry (persona response 재활용, cost_log 보존)
  ↓
7. lock release: status='succeeded' (또는 try/finally 'failed' + error_code)

Vercel cron monthly-batch (월 1일 00:05 UTC) = mock dry-run only, 위 흐름과 별개
```

---

## 3. Components

### 3.1 신규 모듈

| Path | Purpose |
|---|---|
| `src/lib/ai/anthropic-client.ts` | wrapper: single persona call, cache_control 조건부, cost-logger 호출, hardcap 보조 가드 |
| `src/lib/ai/prompts/personas/{warren-buffett,stanley-druckenmiller,cathie-wood,peter-lynch,charlie-munger,phil-fisher,rakesh-jhunjhunwala,mohnish-pabrai,michael-burry,nassim-taleb,chair}.ts` × 11 | Q4 persona contract (정적, 실행 로직 없음) |
| `src/lib/ai/prompts/personas/index.ts` | registry export |
| `src/lib/ai/prompts/render-user-prompt.ts` (또는 동등) | template + input → final string (정확한 이름 OOS) |
| `src/lib/cost/cost-logger.ts` | cost_log INSERT (flag-aware), getMonthlyTotal, hardcap preflight helper |
| `src/lib/cost/pricing.ts` | Anthropic 공식 단가 상수 + `MAX_COST_PER_CALL_KRW` 보수적 upper-bound + 환율 |
| `src/lib/screening/persona-eval.ts` | 30×11 orchestration, persona-major warm-first, lock 획득/해제, preflight, consensus 호출 |
| `src/lib/screening/consensus.ts` | pure: `assignBadge` (5종) + `isTopTier` |
| `src/lib/report/writer.ts` | Section 0/1/8 jsonb 생성 + commit_persona_eval RPC 호출 |
| `src/lib/report/section-8-schema.ts` | zod schema (Q3 1:1 매핑) |
| `src/lib/data/admin-batch-runs.ts` | monthly_batch_runs CRUD wrapper |
| `supabase/migrations/0017_cost_log_and_batch_runs.sql` + `.rollback.sql` | cost_log + monthly_batch_runs + commit_persona_eval RPC + UNIQUE constraints + RLS |

### 3.2 변경 모듈

| Path | Change |
|---|---|
| `src/app/api/cron/monthly-batch/route.ts` | mock dry-run only (real INSERT 없음) |
| `src/lib/admin/format-error.ts` | 신규 코드 5종 매핑: `consensus_rank_invalid` / `consensus_undefined_case` / `batch_already_running` / `batch_already_completed` / `persona_eval_fatal` |
| `.env.example` | `AI_COST_LOG_REAL_INSERT_ENABLED=false` + `AI_PROMPT_CACHE_ENABLED=false` |
| `Document/Service/Planning/ServicePlan-Admin.md` | §1A.5 D19 4→5종 배지 + §3.7 비-dev prompt 편집 원칙 + §4 stock_reports.section_8 canonical contract |
| `Document/Service/Report/ReportFramework.md` | §8 Step 2 v2.4 (schema SoT 역참조 + Section 0 1행 5종) |

---

## 4. Data Flow (상세)

(§2 Architecture 참조. 6 step + cron mock dry-run)

---

## 5. Error Handling

| Error code | Trigger | Korean message | Behavior |
|---|---|---|---|
| `ai_key_unavailable` | ANTHROPIC_API_KEY 없음 | "AI 키가 발급되지 않았습니다" | persona-eval ticker catch → tier1Available=false → ⚪ |
| `ai_billing_exhausted` | Anthropic 401/402 | "AI 사용량 초과" | 동일 → ⚪ |
| `cost_hardcap_40man` | preflight upper-bound 초과 | "월 비용 한도(40만원) 초과 우려" | writer/Anthropic 호출 전 차단. cost_log 손실 0. |
| `consensus_rank_invalid` | rank<1 / rank>total / NaN | "합의 배지 산출 로직 오류" | persona_eval_fatal re-throw → 500 + lock=failed |
| `consensus_undefined_case` | (안전망, Q5b 합의로 unreachable) | "합의 배지 정의 누락" | 동일 |
| `batch_already_running` | lock INSERT ON CONFLICT, status=running | "이번 달 분석이 이미 진행 중입니다" | server action reject |
| `batch_already_completed` | lock status=succeeded | "이번 달 분석이 이미 완료되었습니다. rerun 액션 필요" | server action reject (rerun UI = OOS) |
| `persona_eval_fatal` | logic bug / writer RPC repeated failure | "분석 실행 중 치명적 오류" | cron/server action 500, lock=failed + error_code |
| Anthropic timeout/rate | (writing-plans OOS) | (TBD) | persona-eval ticker catch → ⚪ (재시도 정책 OOS) |
| DB INSERT 23505 | (writer는 upsert 사용으로 미발생) | — | — |

**cost_log·writer 트랜잭션 독립 정책**:
- Anthropic 호출 성공 → cost_log INSERT (auto-commit 독립)
- writer RPC `commit_persona_eval` 실패 → cost_log row 보존
- 매월 reconciliation: stock_reports에 없는 cost_log = orphan (operator rerun 후보)

---

## 6. Testing Strategy

총 **~45 신규 tests** (현 463 → ~508).

| File | Tests |
|---|---|
| `consensus.test.ts` | 5 happy (🟢🔵🟣🟡⚪) + 5 boundary (rank=3 true, rank=4 false for total=10, tier1Available=false → ⚪ propagation, invalid input throw, isTopTier pure) = **10** |
| `section-8-schema.test.ts` | happy path / B-scope variant (Part A=[]) / transformer round-trip = **3** |
| `persona-registry.test.ts` | id 중복 없음 / 11명 모두 / version YYYY-MM-DD regex / required placeholders / empty 없음 = **5** |
| `pricing.test.ts` | cache-off / cache-creation / cache-read / mixed 비용 계산 = **4** |
| `anthropic-client.test.ts` | flag-on cache_control payload / flag-off plain / hardcap throw / token usage 반환 / cost-logger 호출 / preflight 보조 가드 = **6** |
| `persona-eval.test.ts` | persona-major call order / warm-first concurrency (deferred mock — warm promise resolve 전 fan-out 미호출 assertion) / tier1Available=false → ⚪ propagation / preflight upper-bound × 30 가드 / lock acquisition first call success / second concurrent call throws batch_already_running = **6** |
| `writer.test.ts` | section_8 jsonb 생성 happy / Part A=[] / commit_persona_eval RPC 호출 검증 = **3** |
| `cost-logger.test.ts` | flag-off noop / flag-on INSERT / RLS error 매핑 / sum 가드 / orphan row 보존 (writer 실패 mock) = **5** |
| `admin-batch-runs.test.ts` | lock INSERT ON CONFLICT / status 분기 (running/succeeded/failed) / try/finally lock release = **3** |

**검증 게이트**:
- `npm run build` = 25 routes (변경 없음, cron route mock)
- `npm run lint` = 0
- `npm run test:ci` = ~508 / ~58 files
- `npx tsc --noEmit` = clean
- Supabase 마이그 0017 apply (dev → production) + advisor anon WARN 0건 유지 / authenticated WARN +N (cost_log + monthly_batch_runs + RPC)
- RLS 3종 검증 (auth admin allow / auth non-admin deny / anon deny) on cost_log + monthly_batch_runs
- Mock e2e: server action mock 호출 → 30 ticker 모두 stock_reports/committee_votes 생성 + monthly_batch_runs status='succeeded'

---

## 7. Migration 0017 명세

`supabase/migrations/0017_cost_log_and_batch_runs.sql` + `.rollback.sql`

**포함**:
- `cost_log` 테이블 신규 (id uuid PK / month text / ticker text / persona_id text / prompt_version text / model text / input_tokens / cache_creation_input_tokens / cache_read_input_tokens / output_tokens / cost_krw numeric / prompt_cache_enabled boolean / called_at timestamptz / called_by uuid)
- `monthly_batch_runs` 테이블 신규 (month text PK / status text check ('running','succeeded','failed') / started_at / started_by uuid / finished_at / call_count_done int default 0 / error_code text)
- `commit_persona_eval(p_month, p_ticker, p_section_8 jsonb, p_votes jsonb) returns jsonb` SECURITY DEFINER RPC
  - `set search_path = public, pg_temp`
  - plpgsql 단일 txn (auto-rollback on exception)
  - `auth.uid()` null → `auth_unavailable` raise
  - `is_admin()` 가드 → `admin_required` raise
  - `jsonb_typeof p_votes = 'array'` guard
  - UPSERT stock_reports ON CONFLICT (month, ticker) DO UPDATE
  - DELETE committee_votes WHERE report_id = ?
  - INSERT committee_votes 11 rows from `jsonb_array_elements(p_votes)`
  - `revoke from public + revoke from anon + grant to authenticated` ([[feedback_supabase_security_definer_pattern]])
- `stock_reports(month, ticker)` UNIQUE constraint (기존에 없으면 추가)
- `committee_votes(report_id, persona_id)` UNIQUE constraint (기존에 없으면 추가)
- RLS:
  - cost_log: auth admin INSERT allow + auth non-admin INSERT deny + anon SELECT/INSERT deny
  - monthly_batch_runs: auth admin SELECT/INSERT/UPDATE allow + anon deny
- 권한: `revoke from public + revoke from anon + grant to authenticated` 3종 세트 (모든 신규 SECURITY DEFINER 함수)

**Rollback**: DROP RPC + DROP TABLE 순서. UNIQUE constraint도 짝 rollback.

---

## 8. Definition of Done

- [ ] omxy Q1~Q6 + Q5b + Design R4 모든 합의 사항 코드에 정확히 반영
- [ ] Migration 0017 dev apply 검증 → production apply 사용자 트리거
- [ ] RLS 3종 검증 (수동 또는 SQL test)
- [ ] advisor anon WARN 0건 유지 / authenticated WARN delta 명시
- [ ] 신규 모듈 11종 + 변경 모듈 5종 모두 commit
- [ ] ~45 신규 tests 모두 pass, test:ci 463 → ~508
- [ ] Mock e2e: server action mock 호출 → 30 ticker 전수 처리 + monthly_batch_runs status='succeeded' + cost_log 330 rows + stock_reports 30 rows + committee_votes 330 rows
- [ ] flag-on/off 양쪽 경로 모두 테스트 커버
- [ ] persona-major warm-first concurrency assertion 통과 (deferred mock)
- [ ] hardcap preflight upper-bound × 30 가드 통과
- [ ] lock acquisition 동시 호출 시 두 번째는 `batch_already_running` throw
- [ ] cost_log·writer 트랜잭션 독립 시나리오 테스트 (writer 실패 mock → cost_log row 보존)
- [ ] format-error.ts 신규 5 코드 한국어 매핑
- [ ] .env.example 2 flag 추가
- [ ] ServicePlan-Admin 3 섹션 + ReportFramework 1 섹션 SoT 갱신
- [ ] HANDOFF.md 49차 박제 + ProgressDashboard 갱신

---

## 9. SoT 참조

| 정보 | 위치 |
|---|---|
| Tier 0/1/2 구조 + 합의 배지 + Reflection | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19` (5종 갱신 예정) |
| Section 8 정적 표 4종 박제 | 같은 파일 `§3.7 R3.7-6/7/8` + `§6 D20` |
| Section 8 writer 작성 가이드 | `Document/Service/Report/ReportFramework.md §8 Step 0~4 v2.3 → v2.4` |
| Section 8 reference 양식 | `Document/Outputs/Report-Alteogen_196170_v3-Readable.md §Section 8 Part A/B/C` |
| stock_reports.section_8 canonical contract | `Document/Service/Planning/ServicePlan-Admin.md §4` (추가 예정) |
| Tier 0 Signal 4·5 production | `scripts/screen_shortlist_tier0.py` (45차 박제) |
| 마이그 0016 RPC 패턴 (재사용) | `supabase/migrations/0016_accept_shortlist_rpc.sql` |
| 부분 마이그 boundary 패턴 | `feedback_partial_migration_boundary` memory |
| SECURITY DEFINER 권한 3종 세트 | `feedback_supabase_security_definer_pattern` memory |
| Supabase chain mock typing | `feedback_test_mock_typing` memory |

---

## 10. Open Questions → writing-plans 단계로 이전

본 spec에서 OOS 표기된 항목 = writing-plans 단계에서 implementation plan 작성 시 확정:
- 정확한 파일명·import 경로 (`render-user-prompt.ts` 등)
- Anthropic SDK 버전·정확한 단가 상수·rate limit handling
- admin server action 정확한 UI 위치
- rerun action UI 위치
- monthly_batch_runs `ticker_count_done` → `call_count_done` 네이밍 (omxy R4 주의)
- monthly_batch_runs lock RETURNING column 확정 (id 컬럼 없음 → RETURNING month)
- 마이그 0017 내부 `stock_reports(month, ticker)` UNIQUE constraint 기존 존재 확인

---

## 11. Debate Trail (omxy CONVERGED rounds)

| Decision | Rounds | Final SIGNAL |
|---|---|---|
| Q2 cost_log flag | 2 | CONVERGED |
| Q3 section_8 schema SoT | 2 | CONVERGED |
| Q4 prompt 저장소 | 2 | CONVERGED |
| Q5 임계값 정의 방식 | 3 (R2 ESCALATE → R3 split) | CONVERGED |
| Q5b D19 spec gap (5종) | 2 | CONVERGED |
| Q6 prompt cache 정책 | 2 | CONVERGED |
| Design 5 sections | 4 (R1·R2·R3 정정 → R4 CONVERGED) | CONVERGED |

omxy 적대적 검토에서 캐치된 정정 (대표):
- Q5 R2 ESCALATE → D19 spec gap "둘 다 non-top" 케이스 미정의 발견 → Q5b 5종 배지 신규
- Design R1 → M17 hardcap vs fan-out race + cron caller session + idempotency + scope creep 4 결함
- Design R3 → monthly batch execution lock + retry 의미 명확화
