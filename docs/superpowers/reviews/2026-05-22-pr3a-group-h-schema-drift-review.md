---
phase: PR3a-group-h-schema-drift
reviewed: 2026-05-22T10:15:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - tudal/src/lib/data/report-section-schemas.ts
  - tudal/src/lib/data/__tests__/report-section-schemas.test.ts
  - tudal/src/lib/data/admin-reports.ts
  - tudal/src/lib/data/__tests__/admin-reports.test.ts
  - tudal/src/app/(admin)/admin/report/[ticker]/page.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# PR3a Code Review Report — Group H stock_reports schema drift fix

**Reviewed:** 2026-05-22
**Depth:** deep
**Files Reviewed:** 5 code (1 신설 schemas / 1 신설 test / 1 modify admin-reports / 1 modify admin-reports.test / 1 modify page.tsx)
**Status:** issues_found

## Summary

PR3a는 Group H stock_reports schema drift fix Critical Hard gate로, `/admin/report/[ticker]/page.tsx` 페이지가 PR1 cron 활성 후 발생할 `commit_persona_eval` RPC INSERT (section_0~7 = NULL, section_8 = modern partA~D shape) 환경에서 crash 없이 fallback UI를 렌더하도록 한다.

**전반적 평가**: 구조는 견고하다 — zod 단일 SoT (section-8-schema.ts re-export로 drift 차단), nullable typed transformer (`ValidatedStockReport`), per-section `SectionFallback` 컴포넌트, Section 8 dual-shape (modern partA~D vs legacy conclusion/recommendation/keyQuotes) tagged union, `partC` authoritative aggregate. spec §2 Group H + §4 PR3a scope와 1:1 mapping이 깨끗하다. 784/784 tests pass + tsc clean + 5 forbidden grep gates 0 match.

**그러나 Critical 1건 + Warning 6건 + Info 4건** — 가장 큰 우려는 (1) **CR-01 silent validation drop**: zod safeParse 실패 시 transformer가 무조건 `null`로 fallback하고 어떤 로깅/모니터링도 없다. PR1 cron 활성 후 writer.parseContent malformed AI 응답 → invalid section_8 → page는 정상처럼 fallback UI 렌더 → 어드민은 모든 종목이 "본문 미작성"으로 표시되는 이유를 알 수 없음. (2) **WR-04 dual-shape 우선순위 의도 vs 실제**: spec은 "modern 우선"으로 lock-in 됐지만 테스트는 modern + legacy 동시 valid시 modern 우선만 검증 — modern이 유효한 partA~D를 보내면서 stray conclusion/keyQuotes도 함께 보낸 비현실적 케이스. zod default가 unknown key를 strip하므로 ambiguous 케이스 자체가 발생할 수 없는데, 이를 정확히 테스트 주석에 박제하지 않음. (3) **WR-05 zod number sanity 부재**: conviction/axis 값에 `.min(0).max(100)` 없음 — 페이지는 render 시 clamp하지만 schema는 -1000도 허용.

**스코프 절대 보존 확인**: writer Section 0~7 본문 구현 = PR3b · cron real path = PR1 · UI trigger / Track Record 탭 / Regen 실 호출 = PR4. 본 PR3a는 정확히 schema drift fix only. 모든 OOS finding은 "PR1/PR3b/PR4로 분리" 명시.

---

## Critical Issues

### CR-01: silent validation drop은 PR1 cron 모니터링 시야 완전 차단

**File:** `tudal/src/lib/data/report-section-schemas.ts:113-119` + `tudal/src/lib/data/admin-reports.ts:99-123`

**Issue:**
`parseSectionSafe`와 `parseReportSection8` 모두 `safeParse` 실패 시 `null` 반환만 한다 — 어떤 로깅, 어떤 텔레메트리, 어떤 Supabase batch_runs 메모도 없다. PR3a는 page crash 차단이 1차 목적이지만, **silent fallback은 운영 가시성 측면에서 빈 화면과 동급의 실패 모드**가 된다.

구체 시나리오:
1. PR1 cron 활성 → `commitTickerReport`가 `writer.ts:18-29 parseContent` 사용
2. parseContent의 try 블록에서 `JSON.parse` 성공했지만 `parsed.vote`가 `undefined` (LLM이 vote 키를 누락) → writer.ts:51-53 그대로 `vote: undefined`로 partD row 작성 → section8Schema의 `z.enum(['BUY','HOLD','SELL'])`가 reject
3. commit_persona_eval RPC는 vote enum 검증을 0017:153 line `coalesce(v->>'vote', '') not in ('BUY','HOLD','SELL')`로 한다 — partD에는 enum 검증이 없다 (votes만 검증). 따라서 RPC가 성공해서 stock_reports에 malformed section_8 행 INSERT
4. page가 그 row를 가져오면 `parseReportSection8` 실패 → null → "본문 미작성" fallback
5. 어드민은 30종목 전체가 "본문 미작성"을 보고 — **이게 진짜 미구현인지(PR3b 대기) 아니면 silent validation drop인지 구분 불가능**

또한 spec §1.3에 따라 PR1 cron이 매월 1회 자동 호출되므로 fail는 매월 발화. 운영 모니터링 없이는 30종목 batch에서 절반이 drift된 상황도 catch 못함.

**Fix:**
PR3a 안에서 `parseSectionSafe`와 `parseReportSection8`이 실패 시 **at least dev-mode console.warn**을 발화. 그리고 transformer에서 어떤 섹션이 invalid 처리됐는지 메타데이터를 page에 노출 (e.g., `validationErrors: string[]` 필드).

```typescript
// tudal/src/lib/data/report-section-schemas.ts
export function parseSectionSafe<T>(
  schema: z.ZodType<T>,
  value: unknown,
  context?: string, // 'section_0' | 'section_8' etc.
): T | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    // PR3a — silent drop 차단. PR1 cron 활성 시 운영 가시성 보장.
    if (value !== null && value !== undefined) {
      // null/undefined는 PR3b 미구현 정상 케이스 → log skip
      console.warn(
        `[report-validation] ${context ?? 'section'} drift: ${result.error.message.slice(0, 200)}`,
      );
    }
    return null;
  }
  return result.data;
}
```

그리고 `admin-reports.ts:transformStockReportRow`에서 호출부에 `context` 인자 전달.

본 fix는 PR3a scope 내에서 가능 (schemas 파일 + transformer 호출부만 변경). 후속 PR로 미루면 PR1 cron이 활성된 시점에 silent drop이 운영 표면화 — 그때는 디버깅 비용 훨씬 큼.

**대안 (defer to PR1)**: PR3a에서는 transformer가 `validationErrors: Record<string, string>` 필드를 함께 반환 + page가 dev 모드에서만 표시. PR1에서 Supabase `batch_runs` 또는 별도 `validation_drift_log`로 흘림.

**권고**: PR3a 안에서 dev-only console.warn까지는 추가. validation_drift_log 테이블은 PR1으로 분리.

---

## Warnings

### WR-01: `Omit<StockReport, keyof StockReportSectionsTyped>` 패턴이 후속 PR에서 미세 drift 위험

**File:** `tudal/src/lib/data/admin-reports.ts:69-94`

**Issue:**
`ValidatedStockReport`는 `Omit<StockReport, keyof StockReportSectionsTyped>`로 정의됐다. 본 패턴은 견고해 보이지만 두 미세 위험이 있다:

1. `StockReportSectionsTyped`는 admin-reports.ts 내부 interface로 별도 정의되어 `StockReport`의 section 키와 **lockstep 동기화가 명시되지 않음**. 누군가가 `types/admin.ts`의 `StockReportSections`에 `section_9` 또는 `appendix_v2`를 추가하면 `StockReportSectionsTyped`는 자동 갱신되지 않고, `ValidatedStockReport`는 새 키를 `unknown`으로 그대로 inherit (Omit이 못 잡음).

2. 더 큰 위험: `types/admin.ts:65-76`의 `StockReportSections`는 모든 sections를 `?:` optional로 선언했다. `Omit<StockReport, keyof StockReportSectionsTyped>`는 optional 여부를 보존하지 않고 키만 제거하므로, `ValidatedStockReport.section_0: ReportSection0 | null`은 required로 재정의된다. 호환되지만 의미 차이 — page.tsx는 항상 키 존재를 가정.

**Fix:**
`StockReportSectionsTyped`를 **`StockReportSections` 자체를 재사용**해 단일 SoT 보장:

```typescript
import type { StockReport, StockReportSections } from "@/types/admin";
// ...
export interface ValidatedStockReport
  extends Omit<StockReport, keyof StockReportSections> {
  section_0: ReportSection0 | null;
  // ...
}
```

별도 `StockReportSectionsTyped` interface 제거. types/admin.ts와 lockstep 강제.

**Scope**: PR3a 안에서 가능 (admin-reports.ts 내부 refactor only).

---

### WR-02: `transformStockReportRow` 실패 시 ValidatedStockReport 반환이 부분 일관성 깨짐

**File:** `tudal/src/lib/data/admin-reports.ts:99-123`

**Issue:**
transformer는 `id`, `ticker`, `month`, `version`, `schema_version`, `is_latest`, `generated_at`이 **untyped DB row에서 그대로 패스스루**된다 — section만 validation 하고 메타데이터는 raw 신뢰. 만약 `row.month`가 (마이그 0003에 따라 not null but might be malformed date string from misimplemented migration) `"invalid"` 또는 `null cast as string`이면, page.tsx:145의 `report.month.slice(0, 7)`이 `"invalid".slice(0,7)` = `"invalid"`로 표시. 또는 row.regen_auto_count가 `null` → page tsx의 카운터에 `null` 표시.

테스트 baseRow에는 정상 값이 있으므로 catch 안됨. spec doc은 "schema drift only"라 본 패스스루는 scope-out일 수도 있으나, transformer의 의도가 "DB → page typed pipe"라면 메타데이터까지 검증해야 일관성 있음.

**Fix:**
PR3a scope 보존을 위해 본 PR에서는 **comment로 명시**하고 fix는 PR3b 또는 별도로 분리:

```typescript
// PR3a — section만 validation. metadata (id, ticker, month, version, etc.)는
// DB constraint (NOT NULL + check) 신뢰. PR3b writer 구현 시 metadata 검증도 합쳐서 도입 가능.
```

또는 `report.month` 안전 슬라이스 helper를 page.tsx에 추가 (PR3a 안에서 가능):

```tsx
const monthShort = report.month?.length >= 7 ? report.month.slice(0, 7) : report.month;
```

**Scope**: comment-only fix는 PR3a 안에서. 본격 metadata validation은 PR3b로 분리.

---

### WR-03: `parseReportSection8` modern shape의 zod default strip가 ambiguous 케이스를 테스트하지 않음

**File:** `tudal/src/lib/data/__tests__/report-section-schemas.test.ts:222-231`

**Issue:**
"prefers modern over legacy when both could match" 테스트는 modern shape의 모든 키 + legacy의 `conclusion`/`recommendation`/`keyQuotes: []`를 함께 보낸다. 그러나 zod v4의 default 동작은 `.object()`가 unknown 키를 strip한다 — 즉, modern shape가 valid이면 legacy 키는 **이미 strip되어 legacy schema 호출 자체가 일어나지 않는 것이 아니라**, `parseReportSection8`이 `modern.safeParse(value)`를 먼저 호출하고 `value`는 원본이라서 modern이 success하면 함수가 즉시 return — 그래서 legacy schema는 평가되지 않는다.

테스트는 통과하지만, 이는 **modern.safeParse가 strip된 결과를 반환하므로 `result.data`에는 stray `conclusion` 등이 사라진 modern shape만 있음**. page는 `data.partC.verdict` 등만 접근하므로 OK이지만, 만약 후속 PR에서 zod의 `.strict()` 또는 `.passthrough()`로 모드 변경되면 동작이 바뀐다.

본 동작 자체는 정상이나 테스트 주석에 명시되지 않음 — 차후 reviewer가 "왜 modern shape에 conclusion이 사라졌지?"로 혼란.

**Fix:**
테스트에 주석 추가:

```typescript
it('prefers modern over legacy when both could match', () => {
  // zod 4 default = `.object()` unknown keys stripped. modern safeParse 성공 시
  // legacy schema는 호출 자체 안됨. ambiguous = modern shape 가능 = legacy 무관.
  // 후속 PR에서 .strict() 도입 시 본 테스트 재검토 필요.
  const ambiguous = { ...modernValidBScope, conclusion: 'stray', recommendation: 'stray', keyQuotes: [] };
  expect(parseReportSection8(ambiguous)?.shape).toBe('modern');
});
```

추가로 진짜 ambiguous 케이스 (legacy로만 valid + modern로도 valid이 동시 충족 가능한 경우는 zod 4에서 불가능 — modern은 partA/B/C/D 키 필수, legacy는 conclusion/recommendation/keyQuotes 키 필수, 동시 valid는 불가능) — **명시 박제 추가**.

**Scope**: PR3a 안에서 test 주석만 추가.

---

### WR-04: zod schema의 number 필드에 sanity bound 없음 — page render clamp만 의존

**File:** `tudal/src/lib/data/report-section-schemas.ts:12, 15-22, 87-89, 91`

**Issue:**
- `reportSection0Schema.conviction: z.number()` — 의미상 0~100, 그러나 schema는 `-1000`, `Infinity` (NaN은 zod 4가 reject)도 허용 안됨이 확인됐지만 음수/거대값은 허용
- `committeeMini.{core,sector}.{approve,reject,abstain}: z.number()` — 정수가 아닌 `1.5`, 음수 `-3` 모두 허용
- `reportSection6Schema.axis.{trend,momentum,volatility}: z.number()` — 0~100 정상이나 schema는 unbounded
- `reportSection6Schema.divergencePct: z.number()` — bounded by 검증 없음

페이지는 `Math.max(0, Math.min(100, value))`로 render 시 clamp (page.tsx:884, 1004)하지만 `MiniBar`의 `total = approve + reject + abstain || 1`은 음수 합산 시 의도와 다른 동작. 또한 `ConvictionGauge.value`가 `-50`이면 표시는 "-50/100"으로 음수가 그대로 노출.

**Fix:**

```typescript
// reportSection0Schema 내부
conviction: z.number().int().min(0).max(100),
committeeMini: z.object({
  core: z.object({
    approve: z.number().int().nonnegative(),
    reject: z.number().int().nonnegative(),
    abstain: z.number().int().nonnegative(),
  }),
  // ... sector 동일
}),

// reportSection6Schema 내부
axis: z.object({
  trend: z.number().min(0).max(100),
  momentum: z.number().min(0).max(100),
  volatility: z.number().min(0).max(100),
}),
divergencePct: z.number().finite(), // 경계 없음, but NaN/Infinity 차단
```

writer가 이미 valid 범위를 산출하므로 production 영향 없음. drift 발생 시 transformer가 null로 떨굼 + dev warn (CR-01과 결합) → 더 강한 가드.

**Scope**: PR3a 안에서 schemas 파일만 변경 + test 1~2개 추가.

---

### WR-05: `parseReportSection8`의 `prefers modern` 시 zod strip가 user-facing 데이터 일관성 미세 손상

**File:** `tudal/src/lib/data/report-section-schemas.ts:154-160`

**Issue:**
`reportSection8ModernSchema.safeParse(value)` 성공 시 `modern.data`는 `section-8-schema.ts`가 정의한 키만 남기고 unknown 키는 strip. 따라서 만약 writer가 후속 PR에서 `section_8.partE` 또는 `section_8.metadata`를 추가하더라도 transformer 통과 시 자동 strip. **이는 forward-compatibility 측면에서 의도된 동작이라 볼 수도 있으나**, 만약 stock_reports 마이그가 partE를 추가하고 commit_persona_eval RPC가 INSERT한 jsonb에 partE가 포함되면, page는 partE를 표시할 수 없음 + 디버깅 시 "DB에는 있는데 화면에 없네?"로 시간 낭비.

**Fix:**
PR3a 안에서 명시적 decision: **strip vs passthrough**. spec doc은 "zero drift"를 목표로 하므로 strip을 선택하되, 주석으로 박제:

```typescript
// PR3a — modern Section 8 shape는 section-8-schema.ts의 .object() default = strip.
// 후속 PR에서 partE 등 추가 시 본 파일도 동시 갱신 + section-8-schema.ts SoT 갱신
// (lockstep). passthrough를 원하면 .passthrough() 명시 추가.
```

**Scope**: PR3a 안에서 주석만.

---

### WR-06: `Section8ModernView`의 partC authoritative 분기가 partC.sector_aggregate=0 케이스에서 사용자 혼란

**File:** `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx:669-673, 696-700`

**Issue:**
spec §1A.5 D21 + writer.ts:95에 따라 Tier 2 미활성 (B 범위) 상태에서는 `section_8.partC.sector_aggregate = { buy: 0, hold: 0, sell: 0 }`로 박제. page.tsx의 `Section8ModernView`는 본 0 값을 그대로 `VoteAggCard`에 전달 (line 696-700). VoteAggCard는 `MiniBar` 호출 → `total = 0 || 1` = 1 사용 → `approvePct = 0/1 * 100 = 0`. 따라서 사용자는 "Sector Board — {sector} (Part C 집계): 총 0표 · 찬성률 0%"를 본다.

이는 정확한 데이터지만, "0표"를 본 사용자는 (a) Tier 2 미활성인지 (b) Sector Board가 0표 실투표인지 구분 불가. 또한 spec 1.7에 따라 Level C (SECTOR_PHILOSOPHIES)는 14 sectors 모두 박제 완료지만 Tier 2 실 호출은 미활성 — 그래서 "0표"는 정상 상태.

**Fix:**
`Section8ModernView`에서 Tier 2 미활성 감지 → 별도 UI badge:

```tsx
const sectorBoardActive =
  data.partA.length === 14 ||
  data.partC.sector_aggregate.buy +
    data.partC.sector_aggregate.hold +
    data.partC.sector_aggregate.sell >
    0;

// VoteAggCard 옆에 conditional badge
{!sectorBoardActive && (
  <span className="text-xs text-muted-foreground">
    ※ Tier 2 Sector Board 미활성 (B 범위)
  </span>
)}
```

또는 partA.length === 0 → "Sector Board" 카드 자체를 hide.

**Scope**: PR3a 안에서 가능 — 본 finding은 강제 아니지만 사용자 경험 측면 개선.

**대안 (defer to PR3b/PR4)**: Tier 2 활성/비활성 UI는 PR3b/PR4로 분리. PR3a는 schema drift fix only.

---

## Info

### IN-01: Section 8 dual-shape의 "legacy" 정의가 어디서 왔는지 코드/주석 박제 불충분

**File:** `tudal/src/lib/data/report-section-schemas.ts:138-148`

**Issue:**
`reportSection8LegacySchema`는 `{conclusion, recommendation, keyQuotes}` 3 필드만 갖는다. 본 shape는 **spec §2 Group H의 "이전 박제 shape" 라는 어휘만 있을 뿐, 실제로 어떤 마이그/코드/mock 파일이 본 shape를 emit했는지 박제되지 않음**. 코드 그렙 결과 본 shape를 emit하는 producer는 찾을 수 없음 — 어쩌면 mock-admin-report.ts의 일부일 수도, 또는 이전 design doc의 박제 상태일 수도.

따라서 "legacy" 분기는 **defensive coverage만이며 실제 발화 가능성 0**. spec doc은 "전환기 잔존 row"라고 했지만 실제 DB row 중 본 shape를 가진 row가 있는지 확인 불가.

**Fix:**
주석 보강:

```typescript
// reportSection8LegacySchema —
// 본 shape를 emit하는 코드 path는 현재 0 (writer.ts는 modern shape만 INSERT).
// PR3a 도입 시점에 실 stock_reports.section_8 row 0건 — defensive coverage.
// 만약 PR3b/후속에서 legacy shape를 더 이상 지원할 필요 없음이 확인되면
// 본 schema + Section8LegacyView 제거 가능 (단, parseReportSection8의 단일
// shape return은 유지).
```

**Scope**: 주석만 변경.

---

### IN-02: `partD with invalid vote enum` 테스트가 partA invalid vote enum과 중복 분리

**File:** `tudal/src/lib/data/__tests__/report-section-schemas.test.ts:330-368`

**Issue:**
"rejects partD with invalid vote enum"와 "rejects partA with invalid vote enum (Tier 2 active, partA=14, B6 정정)" 두 테스트가 같은 enum 검증을 다른 표면에서 한다. 본 분리는 의도적 (partA는 Tier 2 active 케이스를 표면화) — 의미 있다. 다만 partA 테스트는 partA=14 설정을 testlocal로 다시 build하므로 다소 verbose.

**Fix:**
`modernValidTier2`를 파일 상단에 fixture로 export:

```typescript
const modernValidTier2 = {
  ...modernValidBScope,
  partA: Array.from({ length: 14 }, (_, i) => ({
    persona_id: `s${i}`,
    label: `l${i}`,
    background: 'b',
    vote: 'BUY' as const,
    one_line: 'o',
  })),
};
```

후속 테스트가 Tier 2 active 케이스를 더 쉽게 박제 가능.

**Scope**: 테스트 리팩터 — PR3a 안에서 가능하지만 필수 아님.

---

### IN-03: `recordReportView`가 mock console.log only — silent observability 누락

**File:** `tudal/src/app/(admin)/admin/report/[ticker]/record-view.ts:33-43`

**Issue:**
본 파일은 T2.4 mock state로 production에서는 `console.log` 발화 0 (NODE_ENV check). `page.tsx:78`에서 항상 호출되지만 production observability 0. 본 PR3a 스코프는 아니지만, page.tsx 진입 path 보강 시 함께 확인 권장.

**Fix:**
PR3b 또는 별도 T7e.7 후속 slice에서 실 INSERT 활성. 본 PR3a는 무관.

**Scope**: out-of-scope (T7e.7 또는 PR4로 분리).

---

### IN-04: `aggregateVotes` 결과의 audit 패널이 modern view에서만 노출

**File:** `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx:733-753`

**Issue:**
`Section8ModernView`의 마지막 `<details>` "committee_votes audit" 패널은 partC와의 drift 확인용. **그러나 `Section8LegacyView`에는 동일 audit 패널 없음** — legacy shape에서는 partC가 없으니 외부 aggregate가 authoritative. 그런데 LegacyView의 `<details>` "위원별 개별 투표 보기"는 코드 중복이 큼. modern view의 audit panel과 legacy view의 vote-list panel의 동일 부분 (VoteList core + sector)을 extract하면 더 깔끔.

**Fix:**
공통 helper component 추출:

```tsx
function VoteListPanel({ coreVotes, sectorVotes, sector }: {...}) {
  return (
    <div className="grid gap-3 border-t px-3 py-2 md:grid-cols-2">
      <VoteList title="Core" votes={coreVotes} personas={CORE_PERSONAS} />
      <VoteList title={`Sector — ${sector}`} votes={sectorVotes} personas={getSectorPersonas(sector)} />
    </div>
  );
}
```

modern view + legacy view 모두 재사용.

**Scope**: PR3a 안에서 가능하지만 필수 아님 — refactor only.

---

## Out-of-scope findings (PR1/PR3b/PR4로 분리)

다음은 PR3a scope 밖이지만 review 중 발견 — 박제만:

1. **OOS-1 (PR1)**: `REPORT_COLUMNS`가 `consensus_badge`를 SELECT하지 않음. PR1 cron이 INSERT한 badge 값이 page에 표시되지 않음. → **PR1 안에서 admin-reports.ts:97 추가 + page.tsx에 badge 표시 컴포넌트 추가**.

2. **OOS-2 (PR3b)**: writer.ts:18-29 `parseContent`의 catch fallback이 `vote: 'HOLD', one_line: 'parse failed'`로 무조건 HOLD stub. core 11 path는 HOLD stub 허용이지만, **transformer는 본 stub을 그대로 valid section_8로 통과**. PR3b에서 writer가 sector strict parser와 동등한 정책으로 강화 필요.

3. **OOS-3 (PR3b)**: writer.ts:59-77 partB가 stub 3 issue ('실적 모멘텀', '재무 건전성', '경영진 품질') — 의미 있는 issue extraction 미구현. PR3b에서 LLM-driven extraction 도입.

4. **OOS-4 (PR4)**: `/admin/report/[ticker]/regenerate` Link가 page.tsx:162에 있지만 본 라우트의 실 호출 wire 상태는 spec §1.3 (c) "quota counter만, 실 AI 재생성 0"로 박제. PR4에서 wire.

5. **OOS-5 (PR1)**: `record-view.ts:34` `today = new Date().toISOString().slice(0, 10)` UTC 기준 — KST 자정 직후 사용자는 전날 dedupe 키 사용. 후속 T7e.7 RLS QA에서 KST 기준으로 변경 (또는 D15 R3.3-8 2인 열람 게이팅 카운터 동기 동작 확인).

---

## Verification Gates 확인

- `npx tsc --noEmit`: clean (0 errors) ✅
- `npm run test:ci`: 784/784 passed ✅ (baseline 746 → +38, regression 0)
- `git diff main --stat`: 5 코드 + 1 plan = 6 files ✅
- `rg "as ReportSection" tudal/src/app/.../page.tsx`: 0 매치 ✅
- `rg "\bsection[0-8]\.[A-Za-z_]" page.tsx`: 0 매치 (optional chain `section0?.` 미매치 — 의도) ✅
- `rg "@ts-expect-error|eslint-disable.*any"`: 0 매치 ✅
- `rg "z\.object.*partA|sectorVoteRowSchema|coreVoteRowSchema|finalConsensusPanelSchema" report-section-schemas.ts`: 0 매치 (B4 invariant) ✅

---

## Recommendations

**Critical (CR-01)**은 PR3a 안에서 fix 강력 권장 — 후속 PR1 cron 활성 시 silent drop 운영 모니터링 부재가 즉시 표면화. 최소 dev-mode console.warn 추가 (zero infra cost).

**Warning 6건 중**:
- WR-01 (`Omit<StockReport, keyof StockReportSections>` SoT lock): PR3a 안에서 fix 권장 (1 line change)
- WR-04 (zod number sanity bound): PR3a 안에서 fix 권장 (writer가 이미 valid 범위 산출하므로 production 영향 0, defense-in-depth)
- WR-02, WR-03, WR-05, WR-06: 주석/UX 개선 — PR3a 안에서 fix 가능하나 필수 아님

**Info 4건**: 모두 refactor/주석/post-PR1 trigger — defer to follow-up.

**최종 의견**: 본 PR3a는 spec §2 Group H + §4 PR3a scope의 atomic 변경이며, Hard gate (PR1 cron ⊥ PR3a 미머지 = page crash inevitable) 차단 목적 달성. **CR-01 fix 후 머지 권장**. WR-01/WR-04도 fix 시 더 견고 (PR3a 안에서 가능). 나머지 Warning + Info는 후속 PR로 분리해도 위험 없음.

---

_Reviewed: 2026-05-22T10:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
