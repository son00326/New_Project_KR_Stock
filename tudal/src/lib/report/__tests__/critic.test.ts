// PR3c Task 5 — critic.ts orchestrator (callCritic + threshold + 1회 hard cap) test.
// SoT = plan v6, omxy R6 CONVERGED.

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ai/critic-client', () => ({
  callCritic: vi.fn(),
}));

const PASS = (reason: string) => ({ verdict: 'PASS' as const, reason });
const WARN = (reason: string) => ({ verdict: 'WARN' as const, reason });
const FAIL = (reason: string) => ({ verdict: 'FAIL' as const, reason });

const allPass = {
  factuality: PASS('ok'),
  logic: PASS('ok'),
  completeness: PASS('ok'),
  structure: PASS('ok'),
  bias: PASS('ok'),
  reader_level: PASS('ok'),
};

const sectionsStub = {
  section_0: { headline: 'h' },
};

const ctx = { ticker: '196170', month: '2026-06', adminUserId: 'u1' };

describe('evaluateReport — threshold + 1회 hard cap (Q3 + B6 + B19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('모든 PASS → shouldRevise=false (failCount=0, warnCount=0)', async () => {
    const { callCritic } = await import('@/lib/ai/critic-client');
    (callCritic as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      verdict: allPass,
      usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 500 },
      costKrw: 5,
    });
    const { evaluateReport } = await import('@/lib/report/critic');
    const r = await evaluateReport(sectionsStub, ctx);
    expect(r.shouldRevise).toBe(false);
    expect(r.failCount).toBe(0);
    expect(r.warnCount).toBe(0);
    expect(r.costKrw).toBe(5);
  });

  it('FAIL 1건 → shouldRevise=true (any FAIL ≥ 1)', async () => {
    const { callCritic } = await import('@/lib/ai/critic-client');
    (callCritic as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      verdict: { ...allPass, logic: FAIL('논거 비약') },
      usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 500 },
      costKrw: 5,
    });
    const { evaluateReport } = await import('@/lib/report/critic');
    const r = await evaluateReport(sectionsStub, ctx);
    expect(r.shouldRevise).toBe(true);
    expect(r.failCount).toBe(1);
  });

  it('WARN 4건 → shouldRevise=true (Q3 threshold)', async () => {
    const { callCritic } = await import('@/lib/ai/critic-client');
    (callCritic as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      verdict: {
        factuality: WARN('w1'),
        logic: WARN('w2'),
        completeness: WARN('w3'),
        structure: WARN('w4'),
        bias: PASS('ok'),
        reader_level: PASS('ok'),
      },
      usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 500 },
      costKrw: 5,
    });
    const { evaluateReport } = await import('@/lib/report/critic');
    const r = await evaluateReport(sectionsStub, ctx);
    expect(r.shouldRevise).toBe(true);
    expect(r.warnCount).toBe(4);
  });

  it('WARN 3건 → shouldRevise=false (Q3 threshold 미달)', async () => {
    const { callCritic } = await import('@/lib/ai/critic-client');
    (callCritic as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      verdict: {
        factuality: WARN('w1'),
        logic: WARN('w2'),
        completeness: WARN('w3'),
        structure: PASS('ok'),
        bias: PASS('ok'),
        reader_level: PASS('ok'),
      },
      usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 500 },
      costKrw: 5,
    });
    const { evaluateReport } = await import('@/lib/report/critic');
    const r = await evaluateReport(sectionsStub, ctx);
    expect(r.shouldRevise).toBe(false);
    expect(r.warnCount).toBe(3);
    expect(r.failCount).toBe(0);
  });

  it('critic throw → throw (callCritic 실패 시 evaluate도 throw)', async () => {
    const { callCritic } = await import('@/lib/ai/critic-client');
    (callCritic as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('critic_llm_failed'));
    const { evaluateReport } = await import('@/lib/report/critic');
    await expect(evaluateReport(sectionsStub, ctx)).rejects.toThrow('critic_llm_failed');
  });

  // PR4 Task 2 Step 2.1 (B28 fix omxy R1): evaluateReport→callCritic client 전파 invariant.
  // orchestrator caller-di test는 evaluateReportMock 3rd arg만 검증 — critic.ts 내부에서
  // callCritic(input)로 회귀해도 silent pass. critic 직접 test에서 callCritic 2nd arg 고정.
  it('B28 — evaluateReport({client}) → callCritic 2nd arg propagation', async () => {
    const { callCritic } = await import('@/lib/ai/critic-client');
    (callCritic as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      verdict: allPass,
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
      costKrw: 1,
    });
    const fakeClient = { tag: 'fake-critic-evaluate' } as never;
    const { evaluateReport } = await import('@/lib/report/critic');
    await evaluateReport(sectionsStub, ctx, { client: fakeClient });
    expect(callCritic).toHaveBeenCalledWith(
      expect.any(Object),
      { client: fakeClient },
    );
  });

  it('B28 — default options omitted → callCritic 2nd arg = { client: undefined }', async () => {
    const { callCritic } = await import('@/lib/ai/critic-client');
    (callCritic as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      verdict: allPass,
      usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 },
      costKrw: 1,
    });
    const { evaluateReport } = await import('@/lib/report/critic');
    await evaluateReport(sectionsStub, ctx);
    expect(callCritic).toHaveBeenCalledWith(
      expect.any(Object),
      { client: undefined },
    );
  });
});
