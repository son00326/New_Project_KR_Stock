# PR3a: Group H stock_reports schema drift fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/report/[ticker]/page.tsx` 페이지가 `stock_reports.section_X` jsonb의 null·malformed·shape-drift 상황에서도 crash 없이 안전한 fallback UI를 렌더하도록 한다. PR1 cron 가동 전 Critical Hard gate 선행.

**Architecture:** (1) `report-section-schemas.ts` 신설 — Section 0~7 + Section 8 dual-shape (modern partA~D vs legacy conclusion/recommendation/keyQuotes) + Appendix zod schema. (2) `admin-reports.ts::transformStockReportRow` — 각 section 컬럼에 `safeParse` 적용해 valid 시 typed object, invalid·null 시 `null` 반환. `ValidatedStockReport` 타입 도입. (3) `page.tsx` — `as` 강제 어서션 제거 + section null guard + Section 8 dual-shape renderer + 헤더 `section0.conviction` early deref 해소.

**Tech Stack:** zod (이미 in repo, `section-8-schema.ts` 패턴) + Next.js 16 App Router + Vitest + TypeScript strict.

---

## Scope (53차 §5 spec doc §4 박제)

**In-scope (PR3a only)**:
- (a) `tudal/src/lib/data/admin-reports.ts` — `transformStockReportRow` validation + Section type guard
- (b) `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` — early null guard at `section0.conviction` + Section 0~7 fallback UI + Section 8 partA~D shape 호환
- (c) 신규 `tudal/src/lib/data/report-section-schemas.ts` — zod schema 단일 SoT

**Out-of-scope (별도 PR — 재해석 금지)**:
- writer Section 0~7 본문 구현 = **PR3b**
- cron `monthly-batch` real path enable = **PR1**
- UI trigger 버튼 / Track Record 탭 / Regen 실 호출 = **PR4**
- 기존 `StockReport` 타입 자체의 광범위 refactor (현 callers 안전 보존)
- mock-admin-report.ts (별도 mock SoT, S7-RealData PR1 wire 시점에 deprecation)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `tudal/src/lib/data/report-section-schemas.ts` | **Create** | zod schemas (Section 0~7 + Appendix) + Section 8 modern = `section8Schema` (from `@/lib/report/section-8-schema` import, **재정의 금지 — B4 single SoT**) + legacy schema + `parseReportSection8` dual-shape parser + `parseSectionSafe<T>` generic helper. |
| `tudal/src/lib/data/__tests__/report-section-schemas.test.ts` | **Create** | schema valid/invalid/null/empty + zod edge-case 전수 (B2): partA 0/14 pass + 1/13 reject, partB 2/6 reject + 3/5 pass, partD 10/12 reject, rationale 0/6 reject, vote/severity/state/keyQuotes.side enum invalid reject. Section 8 modern vs legacy detection + cross-check (`section8HappyExample`/`BScopeExample`이 modern으로 detect). |
| `tudal/src/lib/data/admin-reports.ts` | **Modify** | `ReportSectionX` 타입 정의를 `report-section-schemas.ts`에서 re-export. `transformStockReportRow` 안에서 각 section을 `safeParse` 통과시킨 후 nullable typed 객체로 반환. 신규 `ValidatedStockReport` 타입 export. |
| `tudal/src/lib/data/__tests__/admin-reports.test.ts` | **Modify (B1)** | 기존 test 파일 갱신. (1) `baseRow`의 partial invalid sections (section_0 = `{headline, conviction}` 등)을 valid full shape로 교체. (2) "preserves jsonb payload as-is" assertions를 "validates and returns typed sections" + "returns null for invalid/null sections"로 교체. (3) Section 8 modern + legacy shape detection 추가. **신규 파일 생성 금지 (B1 정정)**. |
| `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` | **Modify** | `as ReportSectionX` 강제 어서션 전면 제거 + section null guard + 헤더 `section0?.conviction ?? '—'` + Section 8 modern/legacy 분기 렌더러 + **modern view = `data.partC.core_revote`/`partC.sector_aggregate` authoritative 렌더 (B3 정정 — 외부 `aggregateVotes` 결과는 committee_votes 디테일 패널로 분리, partC drift 차단)** + 미구현 본문 fallback UI ("PR3b에서 채워집니다") + 모든 SectionXView가 `data: ReportSectionX \| null` 처리. |

**Pattern compliance**: `section-8-schema.ts`와 `tier1-schema.ts`의 zod refinement 패턴 재사용. 새 abstraction 도입 최소화. PR2의 PersonaPanelSchema invariant test 패턴 참고.

---

## Task 1: Section 0~7 + Appendix zod schemas

**Files:**
- Create: `tudal/src/lib/data/report-section-schemas.ts`
- Test: `tudal/src/lib/data/__tests__/report-section-schemas.test.ts`

- [ ] **Step 1: Write failing tests for Section 0~7 + Appendix schemas**

```typescript
// tudal/src/lib/data/__tests__/report-section-schemas.test.ts
import { describe, it, expect } from 'vitest';
import {
  reportSection0Schema,
  reportSection1Schema,
  reportSection2Schema,
  reportSection3Schema,
  reportSection4Schema,
  reportSection5Schema,
  reportSection6Schema,
  reportSection7Schema,
  reportAppendixSchema,
  parseSectionSafe,
} from '../report-section-schemas';

describe('reportSection0Schema', () => {
  it('accepts a valid section 0', () => {
    const valid = {
      headline: '투자 요약',
      thesis: ['논제 1', '논제 2'],
      conviction: 75,
      committeeMini: {
        core: { approve: 7, reject: 2, abstain: 2 },
        sector: { approve: 8, reject: 4, abstain: 2 },
      },
      priceBands: { bear: '5만원', base: '7만원', bull: '9만원' },
    };
    expect(reportSection0Schema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing conviction', () => {
    const invalid = {
      headline: 'h',
      thesis: [],
      committeeMini: {
        core: { approve: 0, reject: 0, abstain: 0 },
        sector: { approve: 0, reject: 0, abstain: 0 },
      },
      priceBands: { bear: '', base: '', bull: '' },
    };
    expect(reportSection0Schema.safeParse(invalid).success).toBe(false);
  });

  it('rejects null', () => {
    expect(reportSection0Schema.safeParse(null).success).toBe(false);
  });
});

describe('parseSectionSafe', () => {
  it('returns parsed data on valid input', () => {
    const result = parseSectionSafe(reportSection4Schema, {
      summary: '성장성',
      drivers: ['driver 1'],
      tam: '1조원',
    });
    expect(result).toEqual({ summary: '성장성', drivers: ['driver 1'], tam: '1조원' });
  });

  it('returns null on invalid input', () => {
    expect(parseSectionSafe(reportSection4Schema, null)).toBeNull();
    expect(parseSectionSafe(reportSection4Schema, { summary: 'ok' })).toBeNull();
  });
});

describe('reportSection5Schema', () => {
  it('accepts valid severity enum', () => {
    const valid = {
      summary: '리스크',
      risks: [{ title: '특허 분쟁', severity: 'high', detail: 'detail' }],
    };
    expect(reportSection5Schema.safeParse(valid).success).toBe(true);
  });

  it('rejects severity outside enum', () => {
    const invalid = {
      summary: 's',
      risks: [{ title: 't', severity: 'critical', detail: 'd' }],
    };
    expect(reportSection5Schema.safeParse(invalid).success).toBe(false);
  });
});

describe('reportSection6Schema', () => {
  it('accepts valid signal state enum', () => {
    const valid = {
      summary: 'momentum',
      signals: [{ name: 'm5', state: 'on', note: '' }],
      axis: { trend: 70, momentum: 60, volatility: 50 },
      divergencePct: 2.5,
    };
    expect(reportSection6Schema.safeParse(valid).success).toBe(true);
  });
});

describe('reportAppendixSchema', () => {
  it('accepts valid appendix', () => {
    const valid = {
      technicals: [{ name: 'RSI', value: '55' }],
      dataSources: ['DART', 'KRX'],
    };
    expect(reportAppendixSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when technicals not an array', () => {
    expect(reportAppendixSchema.safeParse({ technicals: 'oops', dataSources: [] }).success).toBe(false);
  });
});
```

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/report-section-schemas.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Create `report-section-schemas.ts` with Section 0~7 + Appendix schemas**

```typescript
// tudal/src/lib/data/report-section-schemas.ts
import { z } from 'zod';

// ---------------------------------------------------------------------------
// PR3a — Group H schema drift fix용 단일 SoT.
// stock_reports.section_X jsonb shape를 runtime validation.
// writer가 채우지 않은 section은 transformer가 null로 반환 → page.tsx fallback UI.
// ---------------------------------------------------------------------------

export const reportSection0Schema = z.object({
  headline: z.string(),
  thesis: z.array(z.string()),
  conviction: z.number(),
  committeeMini: z.object({
    core: z.object({
      approve: z.number(),
      reject: z.number(),
      abstain: z.number(),
    }),
    sector: z.object({
      approve: z.number(),
      reject: z.number(),
      abstain: z.number(),
    }),
  }),
  priceBands: z.object({
    bear: z.string(),
    base: z.string(),
    bull: z.string(),
  }),
});
export type ReportSection0 = z.infer<typeof reportSection0Schema>;

export const reportSection1Schema = z.object({
  description: z.string(),
  segments: z.array(z.object({ name: z.string(), share: z.string() })),
  keyFacts: z.array(z.object({ label: z.string(), value: z.string() })),
});
export type ReportSection1 = z.infer<typeof reportSection1Schema>;

export const reportSection2Schema = z.object({
  summary: z.string(),
  revenue: z.array(
    z.object({ fy: z.string(), value: z.string(), yoy: z.string() }),
  ),
  margins: z.object({ operating: z.string(), net: z.string() }),
  balance: z.object({ debtRatio: z.string(), cash: z.string() }),
});
export type ReportSection2 = z.infer<typeof reportSection2Schema>;

export const reportSection3Schema = z.object({
  summary: z.string(),
  multiples: z.array(
    z.object({ metric: z.string(), value: z.string(), peer: z.string() }),
  ),
});
export type ReportSection3 = z.infer<typeof reportSection3Schema>;

export const reportSection4Schema = z.object({
  summary: z.string(),
  drivers: z.array(z.string()),
  tam: z.string(),
});
export type ReportSection4 = z.infer<typeof reportSection4Schema>;

export const reportSection5Schema = z.object({
  summary: z.string(),
  risks: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(['high', 'medium', 'low']),
      detail: z.string(),
    }),
  ),
});
export type ReportSection5 = z.infer<typeof reportSection5Schema>;

export const reportSection6Schema = z.object({
  summary: z.string(),
  signals: z.array(
    z.object({
      name: z.string(),
      state: z.enum(['on', 'watch', 'off']),
      note: z.string(),
    }),
  ),
  axis: z.object({
    trend: z.number(),
    momentum: z.number(),
    volatility: z.number(),
  }),
  divergencePct: z.number(),
});
export type ReportSection6 = z.infer<typeof reportSection6Schema>;

export const reportSection7Schema = z.object({
  summary: z.string(),
  triggers: z.array(z.string()),
  alternatives: z.array(z.object({ label: z.string(), detail: z.string() })),
});
export type ReportSection7 = z.infer<typeof reportSection7Schema>;

export const reportAppendixSchema = z.object({
  technicals: z.array(z.object({ name: z.string(), value: z.string() })),
  dataSources: z.array(z.string()),
});
export type ReportAppendix = z.infer<typeof reportAppendixSchema>;

// ---------------------------------------------------------------------------
// Generic safe parser — validation 실패 또는 null 입력 시 null 반환.
// transformer가 호출 후 page가 null guard로 fallback UI 렌더.
// ---------------------------------------------------------------------------

export function parseSectionSafe<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
```

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/report-section-schemas.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 3: Run full vitest to confirm baseline +N tests, regression 0**

Run: `cd tudal && npm run test:ci`
Expected: 746 + (new) tests passed. 0 failures.

- [ ] **Step 4: Commit**

```bash
git add tudal/src/lib/data/report-section-schemas.ts tudal/src/lib/data/__tests__/report-section-schemas.test.ts
git commit -m "feat(PR3a): Section 0~7 + Appendix zod schemas (Group H drift fix base)"
```

---

## Task 2: Section 8 dual-shape schema (modern + legacy)

**Files:**
- Modify: `tudal/src/lib/data/report-section-schemas.ts`
- Test: `tudal/src/lib/data/__tests__/report-section-schemas.test.ts`

- [ ] **Step 1: Write failing tests for Section 8 dual-shape parser + zod edge cases (B2)**

```typescript
// Append to tudal/src/lib/data/__tests__/report-section-schemas.test.ts

import { parseReportSection8 } from '../report-section-schemas';
import {
  section8HappyExample,
  section8BScopeExample,
} from '@/lib/report/section-8-schema';

const modernValidBScope = {
  partA: [], // B scope (length 0)
  partB: [
    { issue: '특허', pro_quote: 'p', con_quote: 'c' },
    { issue: '수수료', pro_quote: 'p', con_quote: 'c' },
    { issue: '신약', pro_quote: 'p', con_quote: 'c' },
  ],
  partC: {
    sector_aggregate: { buy: 0, hold: 0, sell: 0 },
    core_revote: { buy: 7, hold: 3, sell: 1 },
    co_chair_unanimous: false,
    verdict: 'BUY' as const,
    rationale: ['근거 1'],
  },
  partD: Array.from({ length: 11 }, (_, i) => ({
    persona_id: `core-${i}`,
    label: `Core ${i}`,
    philosophy: 'value',
    vote: 'BUY',
    one_line: 'one',
  })),
};

const legacyValid = {
  conclusion: '결론',
  recommendation: '매수',
  keyQuotes: [{ side: 'pro', quote: '근거' }],
};

describe('parseReportSection8 (dual-shape detection)', () => {
  it('detects modern shape (B scope, partA=0) and tags it', () => {
    const result = parseReportSection8(modernValidBScope);
    expect(result?.shape).toBe('modern');
    if (result?.shape === 'modern') {
      expect(result.data.partD).toHaveLength(11);
      expect(result.data.partA).toHaveLength(0);
    }
  });

  it('detects modern shape (Tier 2 active, partA=14) using section8HappyExample (B4 cross-check)', () => {
    const result = parseReportSection8(section8HappyExample);
    expect(result?.shape).toBe('modern');
    if (result?.shape === 'modern') {
      expect(result.data.partA).toHaveLength(14);
    }
  });

  it('detects modern shape using section8BScopeExample (B4 cross-check)', () => {
    const result = parseReportSection8(section8BScopeExample);
    expect(result?.shape).toBe('modern');
  });

  it('detects legacy shape and tags it', () => {
    const result = parseReportSection8(legacyValid);
    expect(result?.shape).toBe('legacy');
    if (result?.shape === 'legacy') {
      expect(result.data.conclusion).toBe('결론');
    }
  });

  it('returns null on neither shape (malformed)', () => {
    expect(parseReportSection8({ foo: 'bar' })).toBeNull();
  });

  it('returns null on null input', () => {
    expect(parseReportSection8(null)).toBeNull();
  });

  it('prefers modern over legacy when both could match', () => {
    const ambiguous = {
      ...modernValidBScope,
      conclusion: 'stray',
      recommendation: 'stray',
      keyQuotes: [],
    };
    expect(parseReportSection8(ambiguous)?.shape).toBe('modern');
  });
});

// ---------------------------------------------------------------------------
// B2 — zod refinement edge-case TDD 전수
// ---------------------------------------------------------------------------

describe('Section 8 modern refinements (B2)', () => {
  it('rejects partA length 1 (must be 0 or 14)', () => {
    const invalid = {
      ...modernValidBScope,
      partA: [
        { persona_id: 'p', label: 'l', background: 'b', vote: 'BUY', one_line: 'o' },
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partA length 13 (must be 0 or 14)', () => {
    const invalid = {
      ...modernValidBScope,
      partA: Array.from({ length: 13 }, (_, i) => ({
        persona_id: `s${i}`,
        label: `l${i}`,
        background: 'b',
        vote: 'BUY',
        one_line: 'o',
      })),
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partB length 2 (min 3)', () => {
    const invalid = {
      ...modernValidBScope,
      partB: modernValidBScope.partB.slice(0, 2),
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('accepts partB length 5 (max boundary)', () => {
    const valid = {
      ...modernValidBScope,
      partB: [
        ...modernValidBScope.partB,
        { issue: 'i4', pro_quote: 'p', con_quote: 'c' },
        { issue: 'i5', pro_quote: 'p', con_quote: 'c' },
      ],
    };
    expect(parseReportSection8(valid)?.shape).toBe('modern');
  });

  it('rejects partB length 6 (max 5)', () => {
    const invalid = {
      ...modernValidBScope,
      partB: [
        ...modernValidBScope.partB,
        { issue: 'i4', pro_quote: 'p', con_quote: 'c' },
        { issue: 'i5', pro_quote: 'p', con_quote: 'c' },
        { issue: 'i6', pro_quote: 'p', con_quote: 'c' },
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partD length 10 (must be exactly 11)', () => {
    const invalid = {
      ...modernValidBScope,
      partD: modernValidBScope.partD.slice(0, 10),
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partD length 12 (must be exactly 11)', () => {
    const invalid = {
      ...modernValidBScope,
      partD: [
        ...modernValidBScope.partD,
        { persona_id: 'extra', label: 'l', philosophy: 'v', vote: 'BUY', one_line: 'o' },
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partC.rationale length 0 (min 1)', () => {
    const invalid = {
      ...modernValidBScope,
      partC: { ...modernValidBScope.partC, rationale: [] },
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partC.rationale length 6 (max 5)', () => {
    const invalid = {
      ...modernValidBScope,
      partC: {
        ...modernValidBScope.partC,
        rationale: ['1', '2', '3', '4', '5', '6'],
      },
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partD with invalid vote enum', () => {
    const invalid = {
      ...modernValidBScope,
      partD: [
        { ...modernValidBScope.partD[0], vote: 'STRONG_BUY' },
        ...modernValidBScope.partD.slice(1),
      ],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });

  it('rejects partC.verdict outside enum', () => {
    const invalid = {
      ...modernValidBScope,
      partC: { ...modernValidBScope.partC, verdict: 'STRONG_SELL' },
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });
});

describe('Section 8 legacy refinements (B2)', () => {
  it('rejects keyQuotes.side outside enum', () => {
    const invalid = {
      conclusion: 'c',
      recommendation: 'r',
      keyQuotes: [{ side: 'bullish', quote: 'q' }],
    };
    expect(parseReportSection8(invalid)).toBeNull();
  });
});

describe('Section 5 + 6 enum refinements (B2)', () => {
  it('rejects section 5 risk.severity outside enum', () => {
    const invalid = {
      summary: 's',
      risks: [{ title: 't', severity: 'critical', detail: 'd' }],
    };
    expect(reportSection5Schema.safeParse(invalid).success).toBe(false);
  });

  it('rejects section 6 signal.state outside enum', () => {
    const invalid = {
      summary: 's',
      signals: [{ name: 'm5', state: 'flashing', note: '' }],
      axis: { trend: 0, momentum: 0, volatility: 0 },
      divergencePct: 0,
    };
    expect(reportSection6Schema.safeParse(invalid).success).toBe(false);
  });
});
```

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/report-section-schemas.test.ts`
Expected: FAIL (parseReportSection8 / reportSection5Schema / reportSection6Schema not exported).

- [ ] **Step 2: Add Section 8 dual-shape parser (import modern schema from existing SoT — B4 정정)**

```typescript
// Append to tudal/src/lib/data/report-section-schemas.ts

// ---------------------------------------------------------------------------
// Section 8 dual-shape — PR3a 전환 기간 대응.
//   modern = writer.ts::commitTickerReport 신규 출력 {partA, partB, partC, partD}
//            → B4 정정: 단일 SoT는 lib/report/section-8-schema.ts. 본 파일은
//              import + alias만 (재정의 금지).
//   legacy = 이전 박제 shape {conclusion, recommendation, keyQuotes}
// 둘 중 하나라도 valid 시 tagged union으로 반환. 둘 다 invalid 시 null.
// modern 우선 (현 writer 출력이 modern shape이므로).
// ---------------------------------------------------------------------------

import {
  section8Schema as reportSection8ModernSchema,
  type Section8 as ReportSection8Modern,
} from '@/lib/report/section-8-schema';
export { reportSection8ModernSchema };
export type { ReportSection8Modern };

export const reportSection8LegacySchema = z.object({
  conclusion: z.string(),
  recommendation: z.string(),
  keyQuotes: z.array(
    z.object({
      side: z.enum(['pro', 'con', 'neutral']),
      quote: z.string(),
    }),
  ),
});
export type ReportSection8Legacy = z.infer<typeof reportSection8LegacySchema>;

export type ReportSection8 =
  | { shape: 'modern'; data: ReportSection8Modern }
  | { shape: 'legacy'; data: ReportSection8Legacy };

export function parseReportSection8(value: unknown): ReportSection8 | null {
  const modern = reportSection8ModernSchema.safeParse(value);
  if (modern.success) return { shape: 'modern', data: modern.data };
  const legacy = reportSection8LegacySchema.safeParse(value);
  if (legacy.success) return { shape: 'legacy', data: legacy.data };
  return null;
}
```

**B4 정정**: `lib/report/section-8-schema.ts`의 `section8Schema` + `Section8` 타입을 alias로 import + re-export만 한다. 본 파일에 `partA/partB/partC/partD` schemas를 재정의하지 않는다. 단일 SoT 보존. writer.ts와 본 parser가 동일 schema 인스턴스를 사용하므로 drift 위험 0. 위 Step 1 cross-check tests (`section8HappyExample`/`section8BScopeExample`)가 이 invariant를 단단히 묶는다.

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/report-section-schemas.test.ts`
Expected: PASS (all 14+ tests).

- [ ] **Step 3: Commit**

```bash
git add tudal/src/lib/data/report-section-schemas.ts tudal/src/lib/data/__tests__/report-section-schemas.test.ts
git commit -m "feat(PR3a): Section 8 dual-shape schema (modern partA~D + legacy fallback)"
```

---

## Task 3: transformStockReportRow validation refactor (B1 — 기존 test 갱신)

**Files:**
- Modify: `tudal/src/lib/data/admin-reports.ts`
- Modify: `tudal/src/lib/data/__tests__/admin-reports.test.ts` **(기존 파일 갱신 — 신규 파일 생성 금지, B1 정정)**

- [ ] **Step 1: Modify existing `admin-reports.test.ts` — replace pass-through assertions with validation assertions**

기존 파일의 (a) `baseRow` partial invalid sections (b) `"preserves jsonb section payloads as-is"` (c) `"preserves null jsonb sections without coercion"` 3 구역만 교체. `getReportByTicker` + `deriveBucketNeighbors` 테스트는 그대로 유지.

```typescript
// Replace top of tudal/src/lib/data/__tests__/admin-reports.test.ts (imports + baseRow)

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  transformStockReportRow,
  deriveBucketNeighbors,
  getReportByTicker,
  type StockReportDbRow,
  type ValidatedStockReport,
} from "@/lib/data/admin-reports";
import type { ShortListItem } from "@/types/admin";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

// PR3a — 유효한 full-shape section fixture. 기존 partial shape는 validation
// 도입 후 null로 떨어지므로 의도적으로 valid full shape로 교체.
const validSection0 = {
  headline: "테스트 헤드라인",
  thesis: ["논제 1", "논제 2"],
  conviction: 80,
  committeeMini: {
    core: { approve: 7, reject: 2, abstain: 2 },
    sector: { approve: 8, reject: 4, abstain: 2 },
  },
  priceBands: { bear: "5만원", base: "7만원", bull: "9만원" },
};

const baseRow: StockReportDbRow = {
  id: "11111111-1111-1111-1111-111111111111",
  ticker: "005930",
  month: "2026-04-01",
  version: 1,
  schema_version: 1,
  is_latest: true,
  section_0: validSection0,
  section_1: null,
  section_2: null,
  section_3: null,
  section_4: null,
  section_5: null,
  section_6: null,
  section_7: null,
  section_8: null,
  appendix: null,
  regen_auto_count: 0,
  regen_manual_count: 0,
  generated_at: "2026-04-01T00:05:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  const query = {
    select: mocks.select,
    eq: mocks.eq,
    maybeSingle: mocks.maybeSingle,
  };
  mocks.from.mockReturnValue(query);
  mocks.select.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.maybeSingle.mockResolvedValue({ data: baseRow, error: null });
});
```

Replace the `describe('transformStockReportRow', ...)` block (originally 3 it() blocks asserting pass-through) with:

```typescript
describe("transformStockReportRow", () => {
  it("maps snake_case DB columns to camelCase ValidatedStockReport fields", () => {
    const report: ValidatedStockReport = transformStockReportRow(baseRow);
    expect(report.id).toBe(baseRow.id);
    expect(report.ticker).toBe("005930");
    expect(report.month).toBe("2026-04-01");
    expect(report.version).toBe(1);
    expect(report.schemaVersion).toBe(1);
    expect(report.isLatest).toBe(true);
    expect(report.regenAutoCount).toBe(0);
    expect(report.regenManualCount).toBe(0);
    expect(report.generatedAt).toBe("2026-04-01T00:05:00.000Z");
  });

  it("validates and returns typed section_0 when full-shape jsonb", () => {
    const report = transformStockReportRow(baseRow);
    expect(report.section_0).not.toBeNull();
    expect(report.section_0?.conviction).toBe(80);
    expect(report.section_0?.headline).toBe("테스트 헤드라인");
  });

  it("returns null for partial/invalid section_0 (no thesis/committeeMini)", () => {
    const row: StockReportDbRow = {
      ...baseRow,
      section_0: { headline: "h", conviction: 80 },
    };
    expect(transformStockReportRow(row).section_0).toBeNull();
  });

  it("returns null for every section when DB row is fully null (PR3b 미구현 상태)", () => {
    const sparse: StockReportDbRow = {
      ...baseRow,
      section_0: null,
    };
    const report = transformStockReportRow(sparse);
    expect(report.section_0).toBeNull();
    expect(report.section_1).toBeNull();
    expect(report.section_2).toBeNull();
    expect(report.section_3).toBeNull();
    expect(report.section_4).toBeNull();
    expect(report.section_5).toBeNull();
    expect(report.section_6).toBeNull();
    expect(report.section_7).toBeNull();
    expect(report.section_8).toBeNull();
    expect(report.appendix).toBeNull();
  });

  it("detects modern section_8 shape (writer.ts 신규 출력)", () => {
    const row: StockReportDbRow = {
      ...baseRow,
      section_8: {
        partA: [],
        partB: [
          { issue: "i1", pro_quote: "p", con_quote: "c" },
          { issue: "i2", pro_quote: "p", con_quote: "c" },
          { issue: "i3", pro_quote: "p", con_quote: "c" },
        ],
        partC: {
          sector_aggregate: { buy: 0, hold: 0, sell: 0 },
          core_revote: { buy: 7, hold: 3, sell: 1 },
          co_chair_unanimous: false,
          verdict: "BUY",
          rationale: ["근거"],
        },
        partD: Array.from({ length: 11 }, (_, i) => ({
          persona_id: `c${i}`,
          label: `l${i}`,
          philosophy: "v",
          vote: "BUY",
          one_line: "o",
        })),
      },
    };
    expect(transformStockReportRow(row).section_8?.shape).toBe("modern");
  });

  it("detects legacy section_8 shape (전환기 잔존 row)", () => {
    const row: StockReportDbRow = {
      ...baseRow,
      section_8: {
        conclusion: "c",
        recommendation: "r",
        keyQuotes: [{ side: "pro", quote: "q" }],
      },
    };
    expect(transformStockReportRow(row).section_8?.shape).toBe("legacy");
  });

  it("returns null section_8 when neither shape matches", () => {
    const row: StockReportDbRow = {
      ...baseRow,
      section_8: { foo: "bar" },
    };
    expect(transformStockReportRow(row).section_8).toBeNull();
  });
});
```

Leave `describe('getReportByTicker', ...)` + `describe('deriveBucketNeighbors', ...)` unchanged.

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/admin-reports.test.ts`
Expected: FAIL (`ValidatedStockReport` not exported, transformer returns `StockReport`).

- [ ] **Step 2: Refactor `admin-reports.ts` to use schemas + return `ValidatedStockReport`**

Replace the existing `ReportSection0`~`ReportAppendix` type definitions (lines 4-72) and the transformer (lines 103-125):

```typescript
// tudal/src/lib/data/admin-reports.ts (top portion replacement)
import { createClient } from "@/lib/supabase/server";
import type { ShortListItem, StockReport } from "@/types/admin";
import {
  reportSection0Schema,
  reportSection1Schema,
  reportSection2Schema,
  reportSection3Schema,
  reportSection4Schema,
  reportSection5Schema,
  reportSection6Schema,
  reportSection7Schema,
  reportAppendixSchema,
  parseReportSection8,
  parseSectionSafe,
  type ReportSection0,
  type ReportSection1,
  type ReportSection2,
  type ReportSection3,
  type ReportSection4,
  type ReportSection5,
  type ReportSection6,
  type ReportSection7,
  type ReportSection8,
  type ReportAppendix,
} from "./report-section-schemas";

// 호환을 위해 re-export — page.tsx의 기존 type import path 보존.
export type {
  ReportSection0,
  ReportSection1,
  ReportSection2,
  ReportSection3,
  ReportSection4,
  ReportSection5,
  ReportSection6,
  ReportSection7,
  ReportSection8,
  ReportAppendix,
};

// ---------------------------------------------------------------------------
// DB row + transformer
// ---------------------------------------------------------------------------

export interface StockReportDbRow {
  id: string;
  ticker: string;
  month: string;
  version: number;
  schema_version: number;
  is_latest: boolean;
  section_0: unknown;
  section_1: unknown;
  section_2: unknown;
  section_3: unknown;
  section_4: unknown;
  section_5: unknown;
  section_6: unknown;
  section_7: unknown;
  section_8: unknown;
  appendix: unknown;
  regen_auto_count: number;
  regen_manual_count: number;
  generated_at: string;
}

// PR3a — 각 section을 zod safeParse 통과시켜 nullable typed 결과로 반환.
// page.tsx는 본 결과를 받아 null guard로 fallback UI 렌더.
export interface ValidatedStockReport
  extends Omit<StockReport, keyof StockReportSectionsTyped> {
  section_0: ReportSection0 | null;
  section_1: ReportSection1 | null;
  section_2: ReportSection2 | null;
  section_3: ReportSection3 | null;
  section_4: ReportSection4 | null;
  section_5: ReportSection5 | null;
  section_6: ReportSection6 | null;
  section_7: ReportSection7 | null;
  section_8: ReportSection8 | null;
  appendix: ReportAppendix | null;
}

interface StockReportSectionsTyped {
  section_0: unknown;
  section_1: unknown;
  section_2: unknown;
  section_3: unknown;
  section_4: unknown;
  section_5: unknown;
  section_6: unknown;
  section_7: unknown;
  section_8: unknown;
  appendix: unknown;
}

const REPORT_COLUMNS =
  "id, ticker, month, version, schema_version, is_latest, section_0, section_1, section_2, section_3, section_4, section_5, section_6, section_7, section_8, appendix, regen_auto_count, regen_manual_count, generated_at";

export function transformStockReportRow(
  row: StockReportDbRow,
): ValidatedStockReport {
  return {
    id: row.id,
    ticker: row.ticker,
    month: row.month,
    version: row.version,
    schemaVersion: row.schema_version,
    isLatest: row.is_latest,
    section_0: parseSectionSafe(reportSection0Schema, row.section_0),
    section_1: parseSectionSafe(reportSection1Schema, row.section_1),
    section_2: parseSectionSafe(reportSection2Schema, row.section_2),
    section_3: parseSectionSafe(reportSection3Schema, row.section_3),
    section_4: parseSectionSafe(reportSection4Schema, row.section_4),
    section_5: parseSectionSafe(reportSection5Schema, row.section_5),
    section_6: parseSectionSafe(reportSection6Schema, row.section_6),
    section_7: parseSectionSafe(reportSection7Schema, row.section_7),
    section_8: parseReportSection8(row.section_8),
    appendix: parseSectionSafe(reportAppendixSchema, row.appendix),
    regenAutoCount: row.regen_auto_count,
    regenManualCount: row.regen_manual_count,
    generatedAt: row.generated_at,
  };
}

// ---------------------------------------------------------------------------
// Supabase wrappers — 에러는 throw (T7e.2 정책 동일).
// 호출부 Server Component는 error.tsx 바운더리, Server Action은 try/catch 변환.
// ---------------------------------------------------------------------------

export async function getReportByTicker(
  ticker: string,
  options?: { month?: string },
): Promise<ValidatedStockReport | null> {
  const client = await createClient();
  let query = client
    .from("stock_reports")
    .select(REPORT_COLUMNS)
    .eq("ticker", ticker)
    .eq("is_latest", true);

  if (options?.month) {
    query = query.eq("month", options.month);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(
      `stock_reports query failed: ${error.message ?? "unknown error"}`,
    );
  }
  if (!data) return null;
  return transformStockReportRow(data as StockReportDbRow);
}
```

Keep the rest of the file (`reportExistsForMonth`, `BucketNeighbor`, `deriveBucketNeighbors`) unchanged.

Run: `cd tudal && npm run test:ci -- src/lib/data/__tests__/admin-reports-transformer.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 3: Run full test suite + tsc to catch type drift in callers**

Run: `cd tudal && npm run test:ci && npx tsc --noEmit`
Expected: PASS / no new tsc errors except inside page.tsx (we will fix in Task 4). If tsc errors appear in non-page.tsx files, **fix them now** before proceeding.

- [ ] **Step 4: Commit**

```bash
git add tudal/src/lib/data/admin-reports.ts tudal/src/lib/data/__tests__/admin-reports.test.ts
git commit -m "feat(PR3a): validated transformer returns nullable typed sections"
```

---

## Task 4: page.tsx null guards + dual-shape Section 8 renderer

**Files:**
- Modify: `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx`

- [ ] **Step 1: Remove `as` assertions; declare validated nullable sections**

Replace lines 82-91 of page.tsx (the 10 `as ReportSectionX` assertions):

```tsx
  // PR3a — getReportByTicker returns ValidatedStockReport. 각 section은
  // zod safeParse 결과로 ReportSectionX | null. 미구현 본문은 fallback UI 렌더.
  const section0 = report.section_0;
  const section1 = report.section_1;
  const section2 = report.section_2;
  const section3 = report.section_3;
  const section4 = report.section_4;
  const section5 = report.section_5;
  const section6 = report.section_6;
  const section7 = report.section_7;
  const section8 = report.section_8;
  const appendix = report.appendix;
```

Then update the unused type imports near the top — remove the type imports that are no longer needed in page.tsx (they came from admin-reports re-export and are still available via `ValidatedStockReport`).

Actually, keep the type imports as they are. They're used in `SectionBag` and individual `SectionXView` function signatures.

- [ ] **Step 2: Add header `section0.conviction` null guard**

Replace line 170 (the Conviction header span):

```tsx
            <span>
              Conviction{" "}
              <b className="font-mono tabular-nums">
                {section0?.conviction ?? "—"}
              </b>
            </span>
```

- [ ] **Step 3: Update `SectionBag` interface to nullable sections**

Replace `SectionBag` interface (lines 245-261):

```tsx
interface SectionBag {
  section0: ReportSection0 | null;
  section1: ReportSection1 | null;
  section2: ReportSection2 | null;
  section3: ReportSection3 | null;
  section4: ReportSection4 | null;
  section5: ReportSection5 | null;
  section6: ReportSection6 | null;
  section7: ReportSection7 | null;
  section8: ReportSection8 | null;
  appendix: ReportAppendix | null;
  sector: string;
  coreAgg: { approve: number; reject: number; abstain: number };
  sectorAgg: { approve: number; reject: number; abstain: number };
  votes: CommitteeVote[];
  viewers: number;
}
```

- [ ] **Step 4: Add `SectionFallback` helper component (single source of fallback UI)**

Add after the `ReportSectionAccordion` component:

```tsx
// PR3a — Section 0~7 본문 미구현 fallback (PR3b에서 구현 예정).
function SectionFallback({ sectionId }: { sectionId: string }) {
  return (
    <div className="rounded border border-dashed bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
      <div className="font-medium">본문 미작성</div>
      <p className="mt-1 text-xs">
        {sectionId} 본문은 후속 PR3b (writer Section 0~7 본문 구현)에서 채워집니다.
        DB에 jsonb가 비어 있거나 validation 실패 상태입니다.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Update every `SectionXView` to accept `data: ReportSectionX | null`**

Each function now branches on null:

```tsx
function Section0View({ data }: { data: ReportSection0 | null }) {
  if (!data) return <SectionFallback sectionId="0 · 투자 요약" />;
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{data.headline}</h3>
      <ol className="list-decimal space-y-1.5 pl-5">
        {data.thesis.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-3">
        <ConvictionGauge value={data.conviction} />
        <MiniBar label="Core 11" agg={data.committeeMini.core} />
        <MiniBar label="Sector" agg={data.committeeMini.sector} />
      </div>
      <div className="rounded border bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground">목표가 시나리오</span>
        <div className="mt-1 flex gap-4 font-mono tabular-nums">
          <span>
            Bear <b>{data.priceBands.bear}</b>
          </span>
          <span>
            Base <b>{data.priceBands.base}</b>
          </span>
          <span>
            Bull <b>{data.priceBands.bull}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function Section1View({ data }: { data: ReportSection1 | null }) {
  if (!data) return <SectionFallback sectionId="1 · 기업 개요" />;
  return ( /* existing body */ );
}

// Repeat for Section2View ~ Section7View, AppendixView.
```

Apply the same `if (!data) return <SectionFallback sectionId="..." />;` guard at the top of `Section1View`, `Section2View`, `Section3View`, `Section4View`, `Section5View`, `Section6View`, `Section7View`, `AppendixView` — preserve the existing body otherwise.

For `AppendixView`, the fallback id is `"Appendix"`.

- [ ] **Step 6: Split `Section8View` into modern + legacy + fallback**

Replace the existing `Section8View` (lines 569-643):

```tsx
function Section8View({
  data,
  coreAgg,
  sectorAgg,
  sector,
  votes,
}: {
  data: ReportSection8 | null;
  coreAgg: { approve: number; reject: number; abstain: number };
  sectorAgg: { approve: number; reject: number; abstain: number };
  sector: string;
  votes: CommitteeVote[];
}) {
  if (!data) return <SectionFallback sectionId="8 · 최종 의견" />;
  if (data.shape === "modern") {
    return (
      <Section8ModernView
        data={data.data}
        coreAgg={coreAgg}
        sectorAgg={sectorAgg}
        sector={sector}
        votes={votes}
      />
    );
  }
  return (
    <Section8LegacyView
      data={data.data}
      coreAgg={coreAgg}
      sectorAgg={sectorAgg}
      sector={sector}
      votes={votes}
    />
  );
}

// PR3a — modern (writer.ts 신규 출력) 렌더러.
// B3 정정: partC.core_revote + partC.sector_aggregate 가 authoritative.
// 외부 committee_votes aggregation (coreAgg/sectorAgg)은 별도 "audit" 카드로
// 분리해 drift 위험 표면화 (정상 시 partC와 일치; lag/empty 시 partC 우선).
function Section8ModernView({
  data,
  coreAgg,
  sectorAgg,
  sector,
  votes,
}: {
  data: ReportSection8Modern;
  coreAgg: { approve: number; reject: number; abstain: number };
  sectorAgg: { approve: number; reject: number; abstain: number };
  sector: string;
  votes: CommitteeVote[];
}) {
  const coreVotes = votes.filter((v) => v.personaLayer === "core");
  const sectorVotes = votes.filter((v) => v.personaLayer === "sector");
  const verdictLabel =
    data.partC.verdict === "BUY"
      ? "매수"
      : data.partC.verdict === "SELL"
        ? "매도"
        : "관망";

  // B3 — partC authoritative aggregate (BUY/HOLD/SELL → approve/abstain/reject 매핑).
  // RPC commit_persona_eval이 동일 매핑으로 committee_votes INSERT하므로
  // 정상 상태에서 partC와 voteAgg가 일치. drift 시 partC 우선.
  const partCCoreAgg = {
    approve: data.partC.core_revote.buy,
    abstain: data.partC.core_revote.hold,
    reject: data.partC.core_revote.sell,
  };
  const partCSectorAgg = {
    approve: data.partC.sector_aggregate.buy,
    abstain: data.partC.sector_aggregate.hold,
    reject: data.partC.sector_aggregate.sell,
  };

  return (
    <div className="space-y-4">
      <div className="rounded border bg-muted/20 px-3 py-2">
        <div className="mb-0.5 text-xs font-semibold text-muted-foreground">
          최종 판정 (Part C — 합의 패널)
        </div>
        <p className="font-medium">{verdictLabel}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {data.partC.rationale.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <div className="mt-1 text-xs text-muted-foreground">
          Core 11 재투표: 찬성 {data.partC.core_revote.buy} · 관망{" "}
          {data.partC.core_revote.hold} · 반대 {data.partC.core_revote.sell}
          {data.partC.co_chair_unanimous ? " · 위원장 만장일치" : ""}
        </div>
      </div>

      {/* B3 정정 — partC authoritative 집계 */}
      <div className="grid gap-3 md:grid-cols-2">
        <VoteAggCard title="Core Committee (Part C 재투표)" agg={partCCoreAgg} />
        <VoteAggCard
          title={`Sector Board — ${sector} (Part C 집계)`}
          agg={partCSectorAgg}
        />
      </div>

      {data.partB.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
            쟁점 (Part B)
          </div>
          <ul className="space-y-1.5">
            {data.partB.map((b, i) => (
              <li
                key={i}
                className="rounded border bg-muted/10 px-3 py-2 text-sm"
              >
                <div className="font-medium">{b.issue}</div>
                <div className="mt-1 text-xs">
                  <span className="text-[color:var(--color-market-up)]">
                    찬:
                  </span>{" "}
                  {b.pro_quote}
                </div>
                <div className="text-xs">
                  <span className="text-[color:var(--color-market-down)]">
                    반:
                  </span>{" "}
                  {b.con_quote}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* B3 정정 — committee_votes 외부 집계는 audit 카드로 분리. drift 시 사용자가 확인. */}
      <details className="rounded border bg-muted/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
          ▸ committee_votes audit ({coreVotes.length + sectorVotes.length}건 / Part C와 일치 시 정상)
        </summary>
        <div className="grid gap-3 border-t px-3 py-2 md:grid-cols-2">
          <VoteAggCard title="Core (committee_votes 집계)" agg={coreAgg} />
          <VoteAggCard
            title={`Sector — ${sector} (committee_votes 집계)`}
            agg={sectorAgg}
          />
        </div>
        <div className="grid gap-3 border-t px-3 py-2 md:grid-cols-2">
          <VoteList title="Core" votes={coreVotes} personas={CORE_PERSONAS} />
          <VoteList
            title={`Sector — ${sector}`}
            votes={sectorVotes}
            personas={getSectorPersonas(sector)}
          />
        </div>
      </details>
    </div>
  );
}

// PR3a — legacy shape 렌더러. 기존 page.tsx 본문 그대로 보존.
function Section8LegacyView({
  data,
  coreAgg,
  sectorAgg,
  sector,
  votes,
}: {
  data: ReportSection8Legacy;
  coreAgg: { approve: number; reject: number; abstain: number };
  sectorAgg: { approve: number; reject: number; abstain: number };
  sector: string;
  votes: CommitteeVote[];
}) {
  const coreVotes = votes.filter((v) => v.personaLayer === "core");
  const sectorVotes = votes.filter((v) => v.personaLayer === "sector");
  return (
    <div className="space-y-4">
      <div className="rounded border bg-muted/20 px-3 py-2">
        <div className="mb-0.5 text-xs font-semibold text-muted-foreground">
          최종 의견
        </div>
        <p className="font-medium">{data.recommendation}</p>
        <p className="mt-1 text-sm">{data.conclusion}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <VoteAggCard title="Core Committee (11명)" agg={coreAgg} />
        <VoteAggCard
          title={`Sector Board — ${sector} (${sectorVotes.length}명)`}
          agg={sectorAgg}
        />
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
          핵심 논거 인용
        </div>
        <ul className="space-y-1.5">
          {data.keyQuotes.map((q, i) => (
            <li
              key={i}
              className="rounded border-l-2 bg-muted/10 py-1.5 pl-3 pr-2 text-sm"
              style={{
                borderLeftColor:
                  q.side === "pro"
                    ? "var(--color-market-up)"
                    : q.side === "con"
                      ? "var(--color-market-down)"
                      : "var(--color-market-neutral)",
              }}
            >
              <span className="mr-1 text-[10px] font-semibold uppercase text-muted-foreground">
                {q.side === "pro" ? "찬성" : q.side === "con" ? "반대" : "중립"}
              </span>
              {q.quote}
            </li>
          ))}
        </ul>
      </div>

      <details className="rounded border bg-muted/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
          ▸ 위원별 개별 투표 보기 ({coreVotes.length + sectorVotes.length}건)
        </summary>
        <div className="grid gap-3 border-t px-3 py-2 md:grid-cols-2">
          <VoteList title="Core" votes={coreVotes} personas={CORE_PERSONAS} />
          <VoteList
            title={`Sector — ${sector}`}
            votes={sectorVotes}
            personas={getSectorPersonas(sector)}
          />
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 7: Import the new types in page.tsx**

Update the import from `@/lib/data/admin-reports`:

```tsx
import {
  deriveBucketNeighbors,
  getReportByTicker,
  type ReportSection0,
  type ReportSection1,
  type ReportSection2,
  type ReportSection3,
  type ReportSection4,
  type ReportSection5,
  type ReportSection6,
  type ReportSection7,
  type ReportSection8,
  type ReportAppendix,
} from "@/lib/data/admin-reports";
import type {
  ReportSection8Modern,
  ReportSection8Legacy,
} from "@/lib/data/report-section-schemas";
```

- [ ] **Step 8: Run typecheck + build + test:ci + lint**

```bash
cd tudal
npx tsc --noEmit
npm run lint
npm run test:ci
npm run build
```

Expected:
- `tsc`: clean (0 errors)
- `lint`: 0 errors (warnings may remain at pre-PR baseline 6)
- `test:ci`: 746 + N passed (Task 1 ~10 + Task 2 ~25 (B2 edge cases) + Task 3 modify existing admin-reports.test.ts net +5 = ~+40, regression 0)
- `build`: 25 routes, success

If any gate fails, fix before commit. Do **not** mask errors with `// @ts-expect-error` or `// eslint-disable`.

- [ ] **Step 9: Commit**

```bash
git add tudal/src/app/\(admin\)/admin/report/\[ticker\]/page.tsx
git commit -m "fix(PR3a): page null guards + Section 8 dual-shape renderer (Group H crash fix)"
```

---

## Task 5: omxy 적대적 검토 R1~Rn + gsd-code-reviewer + final verification

**Files:** (no code changes unless BLOCKERS found)

- [ ] **Step 1: omxy R1 — implementation 적대적 검수**

Use the `debate-with-omx` skill with scope guard 4종 박제:

- 목적: PR3a Group H schema drift fix 4 commits 적대적 검수
- 컨텍스트: branch `fix/pr3a-group-h-schema-drift` HEAD <hash>, 4 commits, spec doc §2 Group H + §4 PR3a scope
- 선택지: CONVERGED / CONTINUE with BLOCKERS
- SCOPE GUARD: 사용자 lock-in §1.2 (단일 산출물) · PR3a scope (a)+(b)+신규 schemas 파일만 · OOS PR3b writer Section 0~7 · OOS PR1 cron · OOS PR4 UI

검증 요청:
- (a) spec §4 PR3a scope와 1:1 일치?
- (b) zod refinement edge case (modern partA length 0/14 only)?
- (c) 기존 SoT 모듈 충돌? (writer.ts Section8 schema와 호환?)
- (d) Type 일관성 (ValidatedStockReport vs StockReport)?
- (e) grep forbidden patterns: `as ReportSection` 잔존 0 / `section_X.` early deref 0 / `// @ts-expect-error` 0

CONVERGED 받을 때까지 반복 (최대 8 rounds). BLOCKERS 발견 시 Task 1~4로 돌아가 fix → 새 commit → omxy 재호출.

- [ ] **Step 2: gsd-code-reviewer agent (depth=deep)**

Dispatch via Agent tool:

```
subagent_type: gsd-code-reviewer
prompt: Review the PR3a Group H schema drift fix on branch fix/pr3a-group-h-schema-drift.

Files to review:
- tudal/src/lib/data/report-section-schemas.ts (new)
- tudal/src/lib/data/__tests__/report-section-schemas.test.ts (new)
- tudal/src/lib/data/__tests__/admin-reports-transformer.test.ts (new)
- tudal/src/lib/data/admin-reports.ts (modified, transformer + types)
- tudal/src/app/(admin)/admin/report/[ticker]/page.tsx (modified, null guards + Section 8 dual)

Spec context: docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §2 Group H + §4 PR3a scope. This is the Critical Hard gate before PR1 cron activation.

Depth: deep. Produce structured REVIEW.md at docs/superpowers/reviews/2026-05-22-pr3a-group-h-schema-drift-review.md with Critical/Warning/Info findings.
```

Apply Critical/Warning findings as fix commits. Info → defer to follow-up PRs.

- [ ] **Step 3: Final verification gate 4종**

```bash
cd tudal && npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

Expected ALL GREEN:
- build: 25 routes
- lint: 0 errors, ≤6 warnings (baseline)
- test:ci: 746 + new = 765+
- tsc: clean

- [ ] **Step 4: scope purity grep**

Run from worktree root:

```bash
git diff main --stat
git diff main -- 'tudal/src/lib/screening/' 'tudal/src/lib/report/writer.ts' 'tudal/src/app/api/cron/' 'tudal/supabase/migrations/'
```

Expected:
- diff scope = (1) 신설 `report-section-schemas.ts` + (2) 신설 `report-section-schemas.test.ts` + (3) modify `admin-reports.ts` + (4) modify 기존 `admin-reports.test.ts` (B1 정정) + (5) modify page.tsx = **5 files total**
- 0 changes to screening / writer / cron / migrations / section-8-schema.ts (PR3a scope guard — PR1/PR3b/PR4 territory + B4 SoT 보존)

- [ ] **Step 5: Push + PR create (SHARED 권한)**

```bash
git push -u origin fix/pr3a-group-h-schema-drift

gh pr create --title "fix(PR3a): Group H stock_reports schema drift fix (Critical Hard gate)" --body "$(cat <<'EOF'
## Summary

53차 §5 정정 spec doc §2 Group H + §4 PR3a scope. PR1 cron 가동 전 Critical Hard gate 선행 fix.

**Scope (a) + (b)**:
- (a) `admin-reports.ts::transformStockReportRow` validation — zod safeParse per section, nullable typed `ValidatedStockReport` 반환.
- (b) `/admin/report/[ticker]/page.tsx` — `as` 강제 어서션 전면 제거 + section null guard + 헤더 `section0?.conviction ?? '—'` + Section 8 dual-shape (modern partA~D vs legacy conclusion/recommendation/keyQuotes) 분기 렌더러.

**신규 단일 SoT**: `tudal/src/lib/data/report-section-schemas.ts` — Section 0~8 + Appendix zod schema + `parseReportSection8` dual-shape parser + `parseSectionSafe` generic helper.

**Out-of-scope (재해석 금지)**: writer Section 0~7 본문 (PR3b) · cron real path (PR1) · UI trigger / Track Record 탭 / Regen 실 호출 (PR4).

## Verification

- build: 25 routes ✅
- lint: 0 errors, 6 warnings (baseline 보존)
- test:ci: 746 → +<N> = <total>, regression 0
- tsc: clean

## omxy + gsd

- omxy R1~R<N> CONVERGED, BLOCKERS catch & fix <count>
- gsd-code-reviewer (depth=deep): Critical <c> / Warning <w> / Info <i> — Critical+Warning 전부 fix, Info <list> 별도 PR

## Hard gate 박제

**PR1 cron 가동 ⊥ 본 PR 미머지 = `/admin/report/[ticker]` page crash inevitable.** 본 PR 머지 후 PR1 진입 가능.

## Test plan

- [x] Vitest 단위 — schema valid/invalid/null + transformer nullable + Section 8 modern/legacy 분기
- [x] tsc + build + lint + test:ci 4종 ALL GREEN
- [ ] 수동 QA: `npm run dev` → `/admin/report/[ticker]` (section_X null 상태) → fallback UI 렌더 + 헤더 crash 0 확인 (USER review)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: PR body 사후 final sanity (PR2 패턴 — gh pr edit)**

omxy R2~Rn 결과로 test count / commit count / BLOCKERS catch count drift 있으면 `gh pr edit <PR#> --body-file ...`로 정정.

- [ ] **Step 7: Update HANDOFF.md §6 entry (post-merge PHASE B에서)**

USER가 머지 트리거 후 main 갱신 → HANDOFF.md §6에 PR3a 완료 entry 박제 + §1 표 + §2.1 Step matrix 정정. 본 단계는 후속 세션 또는 머지 직후.

---

## Self-Review

**Spec coverage** (against §2 Group H + §4 PR3a):
- (a) admin-reports.ts validation ✅ Task 3
- (b) page.tsx null guard at section0.conviction ✅ Task 4 Step 2
- (b) Section 0~7 fallback UI ✅ Task 4 Step 4·5
- (b) Section 8 partA~D 호환 ✅ Task 2 + Task 4 Step 6
- (c) section_8 jsonb shape migration / page mapping helper ✅ Task 2 parseReportSection8 + Task 4 Section8ModernView
- writer Section 0~7 본문 구현 = PR3b (correctly out of scope)
- cron monthly-batch = PR1 (correctly out of scope)

**omxy R1 BLOCKERS 정정 박제**:
- **B1** (기존 admin-reports.test.ts 충돌): Task 3 → 기존 파일 `tudal/src/lib/data/__tests__/admin-reports.test.ts` modify (신규 transformer test file 생성 금지). baseRow의 partial invalid section_0를 valid full shape로 교체 + pass-through assertions를 validation assertions로 교체.
- **B2** (zod edge-case 부족): Task 2 Step 1 — partA 0/14 pass + 1/13 reject + partB 2/6 reject + 3/5 pass + partD 10/12 reject + rationale 0/6 reject + vote/severity/state/keyQuotes.side enum invalid reject 전수.
- **B3** (Section8ModernView aggregate drift): Task 4 Step 6 → `data.partC.core_revote` + `data.partC.sector_aggregate`가 authoritative. 외부 `coreAgg`/`sectorAgg` (`aggregateVotes` 결과)은 audit 패널로 분리.
- **B4** (Section 8 SoT 중복): Task 2 Step 2 → `section8Schema` + `Section8` 타입을 `@/lib/report/section-8-schema`에서 import + alias re-export. 본 파일에 partA~D schemas 재정의 0. Task 1 cross-check tests (`section8HappyExample`/`section8BScopeExample`)가 invariant 단단히 유지.

**Placeholder scan**: no TBD / TODO / "appropriate error handling" / "similar to Task N" / "fill in" found. Every test has actual code. Every command has expected output.

**Type consistency**:
- `ReportSection0` defined in report-section-schemas.ts (Task 1), used in admin-reports.ts (Task 3) re-export, used in page.tsx (Task 4 imports).
- `ValidatedStockReport` defined in admin-reports.ts (Task 3), used as `getReportByTicker` return type (Task 3 Step 2) — page.tsx inherits via `report.section_X` access (Task 4).
- `ReportSection8` tagged union defined in report-section-schemas.ts (Task 2), shape discriminator `'modern' | 'legacy'` matches Task 4 Step 6 branch.
- `ReportSection8Modern` = alias of `Section8` (B4 정정 — `@/lib/report/section-8-schema`의 `Section8` import). `ReportSection8Legacy` separately defined in `report-section-schemas.ts`. 둘 다 page.tsx (Task 4 Step 7)에서 `Section8ModernView` / `Section8LegacyView` props로 import.

**Spec requirement with no task**: none found.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-22-pr3a-group-h-schema-drift.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

53차 §5 spec doc + Hard gate를 감안하면 **Inline Execution (this session)**이 권장 — schema·transformer·page가 강하게 결합돼 subagent 간 컨텍스트 전달 비용이 크고, omxy 검토 사이클이 parent context와 자연스럽게 결합되기 때문. 단, 사용자가 Subagent-Driven을 명시하면 그에 따라 분리 dispatch.

---

**End of Plan — omxy R1 적대적 검토 대기**
