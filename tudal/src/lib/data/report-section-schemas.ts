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
