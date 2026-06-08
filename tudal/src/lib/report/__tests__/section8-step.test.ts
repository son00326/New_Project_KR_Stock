import { describe, it, expect, vi } from 'vitest';

import { buildSection8AndVotes } from '../writer';
import { isAiBadge, commitSection8Step } from '../section8-step';
import type { CallPersonaResult } from '@/lib/ai/anthropic-client';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';

// ---------------------------------------------------------------------------
// P2 (PR5b) — Section 8 step pure-logic + badge-gate 단위 테스트 (0 live, omxy 테스트 계약).
//   live Section 8 (실 Core-11 + commit_persona_eval_cron)은 P2b canary(P3 후, AI-badged ticker)에서 검증.
// ---------------------------------------------------------------------------

function mkResult(vote: 'BUY' | 'HOLD' | 'SELL', i: number): CallPersonaResult {
  return {
    content: JSON.stringify({
      vote,
      one_line: `one_line_${i}`,
      argument_excerpt: `arg_${i}`,
    }),
    usage: {
      input_tokens: 10,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 10,
    },
    costKrw: 1,
    promptCacheEnabled: false,
  };
}

const PERSONA_IDS = CORE_11_PERSONAS.map((p) => p.id);

describe('isAiBadge', () => {
  it('🟢🔵🟣🟡 → true', () => {
    for (const b of ['🟢', '🔵', '🟣', '🟡']) expect(isAiBadge(b)).toBe(true);
  });
  it('⚪ / null / undefined / 빈문자 → false', () => {
    expect(isAiBadge('⚪')).toBe(false);
    expect(isAiBadge(null)).toBe(false);
    expect(isAiBadge(undefined)).toBe(false);
    expect(isAiBadge('')).toBe(false);
  });
});

describe('buildSection8AndVotes (pure)', () => {
  it('11 results → partD 11 + votes 11(persona_layer core) + verdict majority', () => {
    // BUY 6 / HOLD 3 / SELL 2 → verdict BUY
    const votes: Array<'BUY' | 'HOLD' | 'SELL'> = [
      'BUY', 'BUY', 'BUY', 'BUY', 'BUY', 'BUY', 'HOLD', 'HOLD', 'HOLD', 'SELL', 'SELL',
    ];
    const results = votes.map((v, i) => mkResult(v, i));
    const built = buildSection8AndVotes(results, PERSONA_IDS);

    expect(built.section8.partD).toHaveLength(11);
    expect(built.votes).toHaveLength(11);
    expect(built.votes.every((v) => v.persona_layer === 'core')).toBe(true);
    expect(built.section8.partC.verdict).toBe('BUY');
    expect(built.section8.partC.core_revote).toEqual({ buy: 6, hold: 3, sell: 2 });
    // partA Tier 2 deferred (B 범위) — 빈 배열 (schema-valid)
    expect(built.section8.partA).toEqual([]);
    // committee_votes argument_excerpt 보존
    expect(built.votes[0].argument_excerpt).toBe('arg_0');
  });

  it('SELL 다수 → verdict SELL', () => {
    const votes: Array<'BUY' | 'HOLD' | 'SELL'> = [
      'SELL', 'SELL', 'SELL', 'SELL', 'SELL', 'SELL', 'HOLD', 'HOLD', 'BUY', 'BUY', 'HOLD',
    ];
    const built = buildSection8AndVotes(votes.map((v, i) => mkResult(v, i)), PERSONA_IDS);
    expect(built.section8.partC.verdict).toBe('SELL');
  });

  it('count mismatch (10) → writer_persona_count_mismatch throw', () => {
    const results = Array.from({ length: 10 }, (_, i) => mkResult('HOLD', i));
    expect(() => buildSection8AndVotes(results, PERSONA_IDS.slice(0, 10))).toThrow(
      'writer_persona_count_mismatch',
    );
  });
});

describe('commitSection8Step — badge gate (no spend, no client interaction)', () => {
  // 배지 ⚪/null이면 첫 줄 가드에서 section8_not_ready 반환 — preflight/Core-11/RPC 미호출.
  function throwingClient() {
    return {
      rpc: vi.fn(() => {
        throw new Error('client should NOT be called on badge-gate skip');
      }),
      from: vi.fn(() => {
        throw new Error('client should NOT be called on badge-gate skip');
      }),
      auth: { admin: { getUserById: vi.fn() } },
    } as never;
  }

  it('badge ⚪ → section8_not_ready, client 미호출', async () => {
    const client = throwingClient();
    const r = await commitSection8Step({
      ticker: '005930',
      month: '2026-05',
      badge: '⚪',
      adminUserId: '39202d8b-1042-48a6-8da0-df14a52fabea',
      client,
    });
    expect(r.status).toBe('section8_not_ready');
    expect((client as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it('badge null → section8_not_ready, client 미호출', async () => {
    const client = throwingClient();
    const r = await commitSection8Step({
      ticker: '005930',
      month: '2026-05',
      badge: null,
      adminUserId: '39202d8b-1042-48a6-8da0-df14a52fabea',
      client,
    });
    expect(r.status).toBe('section8_not_ready');
  });
});
