import { z } from 'zod';

// canonical contract — SoT = ServicePlan-Admin §4 stock_reports.section_8 jsonb
// 변경 시 SoT와 동기 갱신 (Q3 omxy 합의)

export const sectorVoteRowSchema = z.object({
  persona_id: z.string(),
  label: z.string(),
  background: z.string(),
  vote: z.enum(['BUY', 'HOLD', 'SELL']),
  one_line: z.string(),
});

export const coreVoteRowSchema = z.object({
  persona_id: z.string(),
  label: z.string(),
  philosophy: z.string(),
  vote: z.enum(['BUY', 'HOLD', 'SELL']),
  one_line: z.string(),
});

export const issueDebateExcerptSchema = z.object({
  issue: z.string(),
  pro_quote: z.string(),
  con_quote: z.string(),
  arbiter_quote: z.string().optional(),
});

export const finalConsensusPanelSchema = z.object({
  sector_aggregate: z.object({
    buy: z.number().int().nonnegative(),
    hold: z.number().int().nonnegative(),
    sell: z.number().int().nonnegative(),
  }),
  core_revote: z.object({
    buy: z.number().int().nonnegative(),
    hold: z.number().int().nonnegative(),
    sell: z.number().int().nonnegative(),
  }),
  co_chair_unanimous: z.boolean(),
  verdict: z.enum(['BUY', 'HOLD', 'SELL']),
  rationale: z.array(z.string()).min(1).max(5),
});

export const section8Schema = z.object({
  partA: z.array(sectorVoteRowSchema),   // B 범위 = [] / Tier 2 후 14
  partB: z.array(issueDebateExcerptSchema).min(3).max(5),
  partC: finalConsensusPanelSchema,
  partD: z.array(coreVoteRowSchema).length(11),
});

export type Section8 = z.infer<typeof section8Schema>;

// Fixtures
export const section8HappyExample: Section8 = {
  partA: Array.from({ length: 14 }, (_, i) => ({
    persona_id: `sector-${i + 1}`,
    label: `Sector ${i + 1}`,
    background: 'Sector background',
    vote: 'BUY' as const,
    one_line: 'one line',
  })),
  partB: [
    { issue: '특허 분쟁 vs 기술력', pro_quote: 'pro', con_quote: 'con' },
    { issue: '수수료율 2% vs 5%', pro_quote: 'pro', con_quote: 'con' },
    { issue: '신약 승인 시점', pro_quote: 'pro', con_quote: 'con' },
  ],
  partC: {
    sector_aggregate: { buy: 8, hold: 4, sell: 2 },
    core_revote: { buy: 7, hold: 3, sell: 1 },
    co_chair_unanimous: true,
    verdict: 'BUY',
    rationale: ['근거 1', '근거 2', '근거 3'],
  },
  partD: Array.from({ length: 11 }, (_, i) => ({
    persona_id: `core-${i + 1}`,
    label: `Core ${i + 1}`,
    philosophy: 'Value investing',
    vote: 'HOLD' as const,
    one_line: 'one line',
  })),
};

export const section8BScopeExample: Section8 = {
  ...section8HappyExample,
  partA: [],
};
