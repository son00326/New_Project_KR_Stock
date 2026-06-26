import { z } from 'zod';

export const renderInputSchema = z.object({
  ticker: z.string().regex(/^\d{6}$/), // KRX 6자리
  financials: z.string().min(1),
  reflectionContext: z.string(), // 첫달은 빈 문자열 허용
  // W1a (D5) — R2 반박 라운드 전용 placeholder. 미지정 시 ''(기존 템플릿엔 placeholder 자체가 없어 no-op).
  peerArguments: z.string().optional(),
  ownPrior: z.string().optional(),
  // G4 (D33 §4) — 거시 컨텍스트(supplementary). 비어 있으면 append 안 함 → byte-identical(dormant).
  //   Tier0 factor 아님·M12a와 범주 분리. 템플릿 수정 0(끝에 조건부 append)로 기존 프롬프트 무회귀.
  macroContext: z.string().optional(),
});

export type RenderInput = z.infer<typeof renderInputSchema>;

export function renderUserPrompt(template: string, input: RenderInput): string {
  const validated = renderInputSchema.parse(input);
  const base = template
    .replaceAll('{{TICKER}}', validated.ticker)
    .replaceAll('{{FINANCIALS}}', validated.financials)
    .replaceAll('{{REFLECTION_CONTEXT}}', validated.reflectionContext)
    .replaceAll('{{PEER_ARGUMENTS}}', validated.peerArguments ?? '')
    .replaceAll('{{OWN_PRIOR}}', validated.ownPrior ?? '');
  const macro = validated.macroContext?.trim();
  return macro ? `${base}\n\n${macro}` : base;
}
