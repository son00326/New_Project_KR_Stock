import { z } from 'zod';

export const renderInputSchema = z.object({
  ticker: z.string().regex(/^\d{6}$/), // KRX 6자리
  financials: z.string().min(1),
  reflectionContext: z.string(), // 첫달은 빈 문자열 허용
});

export type RenderInput = z.infer<typeof renderInputSchema>;

export function renderUserPrompt(template: string, input: RenderInput): string {
  const validated = renderInputSchema.parse(input);
  return template
    .replaceAll('{{TICKER}}', validated.ticker)
    .replaceAll('{{FINANCIALS}}', validated.financials)
    .replaceAll('{{REFLECTION_CONTEXT}}', validated.reflectionContext);
}
