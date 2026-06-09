import { z } from 'zod';

// ---------------------------------------------------------------------------
// PR3a — Group H schema drift fix용 단일 SoT.
// stock_reports.section_X jsonb shape를 runtime validation.
// writer가 채우지 않은 section은 transformer가 null로 반환 → page.tsx fallback UI.
// ---------------------------------------------------------------------------

// PR3a multi-source review (gsd WR-04 + testing T#6/T#8 + red-team RT#4) —
// 숫자 필드에 sanity bound 추가. Section 0/6은 UI에 직접 노출되는 0-100 점수.
// NaN/Infinity는 zod 기본 reject이지만 명시적 .finite()로 박제. 음수/거대값 차단.
const score0to100 = z.number().min(0).max(100).finite();
const voteCount = z.number().int().nonnegative().finite();

// PR4 Task 6 (PR3a OOS RT#4/RT#5): LLM string/array max bound top 5. LLM이 prompt 무시하고
// 거대 문자열·array를 생성해도 schema validate에서 reject. UI 폭증·DB row 비대 차단.
export const reportSection0Schema = z.object({
  headline: z.string().max(200),
  thesis: z.array(z.string()).max(10),
  conviction: score0to100,
  committeeMini: z.object({
    core: z.object({
      approve: voteCount,
      reject: voteCount,
      abstain: voteCount,
    }),
    sector: z.object({
      approve: voteCount,
      reject: voteCount,
      abstain: voteCount,
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
  summary: z.string().max(1000),
  revenue: z.array(
    z.object({ fy: z.string(), value: z.string(), yoy: z.string() }),
  ),
  margins: z.object({ operating: z.string(), net: z.string() }),
  balance: z.object({ debtRatio: z.string(), cash: z.string() }),
});
export type ReportSection2 = z.infer<typeof reportSection2Schema>;

export const reportSection3Schema = z.object({
  summary: z.string().max(1000),
  multiples: z.array(
    z.object({ metric: z.string(), value: z.string(), peer: z.string() }),
  ),
});
export type ReportSection3 = z.infer<typeof reportSection3Schema>;

export const reportSection4Schema = z.object({
  summary: z.string().max(1000),
  drivers: z.array(z.string()),
  tam: z.string(),
});
export type ReportSection4 = z.infer<typeof reportSection4Schema>;

export const reportSection5Schema = z.object({
  summary: z.string().max(1000),
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
  summary: z.string().max(1000),
  signals: z.array(
    z.object({
      name: z.string(),
      state: z.enum(['on', 'watch', 'off']),
      note: z.string(),
    }),
  ),
  axis: z.object({
    trend: score0to100,
    momentum: score0to100,
    volatility: score0to100,
  }),
  // divergencePct는 음수 허용 (m60 괴리율). .finite()만 박제.
  divergencePct: z.number().finite(),
});
export type ReportSection6 = z.infer<typeof reportSection6Schema>;

export const reportSection7Schema = z.object({
  summary: z.string().max(1000),
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
// PR3a multi-source review (gsd CR-01 + red-team RT#2 + omxy R7 P2):
// silent null drop은 PR1 cron 가동 후 운영 모니터링 blind spot 위험.
// onError 콜백 제공해서 caller (transformer)가 ticker/section context 박제하도록 함.
// PR1 격상 완료: caller(admin-reports.ts)가 logStructured('warn',
// 'report_section_validation_failed', ...)로 위임 → serverless 로그 드레인에서 쿼리 가능.
// ---------------------------------------------------------------------------

export interface ParseErrorContext {
  /** zod error path (e.g. ['partA', 0, 'vote']) — symbol 키는 제외 (jsonb path는 string|number만). */
  readonly path: ReadonlyArray<string | number>;
  /** zod error message */
  readonly message: string;
}

function normalizePath(
  path: ReadonlyArray<PropertyKey>,
): ReadonlyArray<string | number> {
  return path.filter((p): p is string | number => typeof p !== 'symbol');
}

export function parseSectionSafe<T>(
  schema: z.ZodType<T>,
  value: unknown,
  onError?: (ctx: ParseErrorContext) => void,
): T | null {
  // null/undefined 입력은 writer가 채우지 않은 정상 케이스 — 로그하지 않음.
  if (value === null || value === undefined) return null;
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  if (onError) {
    const first = result.error.issues[0];
    onError({
      path: first ? normalizePath(first.path) : [],
      message: first?.message ?? 'unknown',
    });
  }
  return null;
}

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
      // PR4 Task 6 (PR3a OOS RT#4): LLM quote 비대 차단.
      quote: z.string().max(500),
    }),
  ),
});
export type ReportSection8Legacy = z.infer<typeof reportSection8LegacySchema>;

export type ReportSection8 =
  | { shape: 'modern'; data: ReportSection8Modern }
  | { shape: 'legacy'; data: ReportSection8Legacy };

export interface ParseSection8ErrorContext {
  readonly modernError: ParseErrorContext;
  readonly legacyError: ParseErrorContext;
}

export function parseReportSection8(
  value: unknown,
  onError?: (ctx: ParseSection8ErrorContext) => void,
): ReportSection8 | null {
  if (value === null || value === undefined) return null;
  const modern = reportSection8ModernSchema.safeParse(value);
  if (modern.success) return { shape: 'modern', data: modern.data };
  const legacy = reportSection8LegacySchema.safeParse(value);
  if (legacy.success) return { shape: 'legacy', data: legacy.data };
  if (onError) {
    const m = modern.error.issues[0];
    const l = legacy.error.issues[0];
    onError({
      modernError: {
        path: m ? normalizePath(m.path) : [],
        message: m?.message ?? 'unknown',
      },
      legacyError: {
        path: l ? normalizePath(l.path) : [],
        message: l?.message ?? 'unknown',
      },
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// PR3a testing T#5 catch — Section 8 partC core_revote / sector_aggregate를
// committee aggregate shape ({approve, reject, abstain})로 매핑하는 pure helper.
// RPC commit_persona_eval enum 매핑 (BUY→approve / HOLD→abstain / SELL→reject)과
// 1:1 정합. JSX 내부에 인라인되어 있던 매핑 로직을 unit-testable 함수로 추출.
// 매핑 convention drift 시 unit test가 즉시 catch.
// ---------------------------------------------------------------------------

export interface PartCVoteCounts {
  readonly buy: number;
  readonly hold: number;
  readonly sell: number;
}

export interface CommitteeVoteAggregate {
  readonly approve: number;
  readonly reject: number;
  readonly abstain: number;
}

export function partCToCommitteeAgg(
  counts: PartCVoteCounts,
): CommitteeVoteAggregate {
  return {
    approve: counts.buy,
    abstain: counts.hold,
    reject: counts.sell,
  };
}
