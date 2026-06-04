// W1a (D5) — R2 반박 라운드 템플릿 + peer/own 렌더 유닛테스트.
import { describe, it, expect } from 'vitest';
import {
  DEBATE_R2_USER_PROMPT_TEMPLATE,
  renderOwnPrior,
  renderPeerArguments,
} from '../debate-round-template';
import { renderUserPrompt } from '../render-user-prompt';
import type { PersonaScore } from '@/lib/screening/tier1-schema';

function score(personaId: string, rationale = '근거'): PersonaScore {
  return {
    persona_id: personaId,
    scores: { short: 70, mid: 60, long: 50 },
    winning_timeframe: 'short',
    rationale_kr: rationale,
    conviction: 65,
  };
}

describe('DEBATE_R2_USER_PROMPT_TEMPLATE', () => {
  it('placeholder 5종 존재', () => {
    for (const ph of [
      '{{TICKER}}',
      '{{FINANCIALS}}',
      '{{REFLECTION_CONTEXT}}',
      '{{PEER_ARGUMENTS}}',
      '{{OWN_PRIOR}}',
    ]) {
      expect(DEBATE_R2_USER_PROMPT_TEMPLATE).toContain(ph);
    }
  });

  it('renderUserPrompt 치환 — peer/own 주입 + 기존 caller(미지정) 무회귀', () => {
    const rendered = renderUserPrompt(DEBATE_R2_USER_PROMPT_TEMPLATE, {
      ticker: '005930',
      financials: 'fin',
      reflectionContext: '[재점검] ctx',
      peerArguments: '- 워렌 버핏: 단70/중60/장50',
      ownPrior: '본인 1차: 단70',
    });
    expect(rendered).toContain('- 워렌 버핏: 단70/중60/장50');
    expect(rendered).toContain('본인 1차: 단70');
    expect(rendered).not.toContain('{{');
    // 기존 caller 무회귀: peer/own 미지정이어도 throw 없이 '' 치환
    const legacy = renderUserPrompt(DEBATE_R2_USER_PROMPT_TEMPLATE, {
      ticker: '005930',
      financials: 'fin',
      reflectionContext: '',
    });
    expect(legacy).not.toContain('{{PEER_ARGUMENTS}}');
  });
});

describe('renderPeerArguments / renderOwnPrior', () => {
  it('peer: 위원당 1줄(라벨/점수/확신/근거) + 모델명 비노출', () => {
    const peers = [
      { label: '워렌 버핏', score: score('warren-buffett', '해자 견고') },
      { label: '캐시 우드', score: score('cathie-wood', '성장 잠재력') },
    ];
    const out = renderPeerArguments(peers);
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('워렌 버핏');
    expect(lines[0]).toContain('해자 견고');
    expect(lines[0]).toContain('70');
    expect(out).not.toMatch(/sonnet|gpt|opus|claude/i); // slot 모델 비노출
  });

  it('own: 본인 R1 점수/근거 포함', () => {
    const out = renderOwnPrior(score('warren-buffett', '내 근거'));
    expect(out).toContain('70');
    expect(out).toContain('내 근거');
    expect(out).toContain('short');
  });
});
