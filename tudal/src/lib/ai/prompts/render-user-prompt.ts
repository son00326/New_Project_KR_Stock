import { z } from 'zod';

export const renderInputSchema = z.object({
  ticker: z.string().regex(/^\d{6}$/), // KRX 6자리
  financials: z.string().min(1),
  reflectionContext: z.string(), // 첫달은 빈 문자열 허용
  // W1a (D5) — R2 반박 라운드 전용 placeholder. 미지정 시 ''(기존 템플릿엔 placeholder 자체가 없어 no-op).
  peerArguments: z.string().optional(),
  ownPrior: z.string().optional(),
});

export type RenderInput = z.infer<typeof renderInputSchema>;

export function renderUserPrompt(template: string, input: RenderInput): string {
  const validated = renderInputSchema.parse(input);
  return template
    .replaceAll('{{TICKER}}', validated.ticker)
    .replaceAll('{{FINANCIALS}}', validated.financials)
    .replaceAll('{{REFLECTION_CONTEXT}}', validated.reflectionContext)
    .replaceAll('{{PEER_ARGUMENTS}}', validated.peerArguments ?? '')
    .replaceAll('{{OWN_PRIOR}}', validated.ownPrior ?? '');
}
