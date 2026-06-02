// PR4 Task 1 Step 1.1.8 — caller DI seam invariant tests for cost-logger (B2 fix omxy R1).
// 4 tests: preflightHardcap × 2 (with/without options) + insertCostLog × 2 (with/without options).
//
// Invariant:
//   (a) options.client 주입 시 → options.client 사용 (createClient NOT called)
//   (b) options 미지정 시 → createClient fallback
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('cost-logger — caller DI seam (PR4 Task 1 Step 1.1.8)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  const validRow = {
    month: '2026-06',
    ticker: '005930',
    persona_id: 'p1',
    prompt_version: 'v1',
    model: 'm1',
    input_tokens: 1,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 1,
    cost_krw: 1,
    prompt_cache_enabled: false,
    called_by: 'u1',
  };

  describe('preflightHardcap', () => {
    // 58차 Step 2.3 omxy R3+R4 fix — pagination chain: select → eq → order(called_at) → order(id) → range.
    function buildChain(): { fromMock: ReturnType<typeof vi.fn> } {
      const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderChain = { order: vi.fn(), range: rangeMock };
      orderChain.order = vi.fn().mockReturnValue(orderChain);
      const eqMock = vi.fn().mockReturnValue({ order: orderChain.order });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });
      return { fromMock };
    }

    it('uses options.client when provided (createClient NOT called)', async () => {
      const { fromMock } = buildChain();
      const createClientSpy = vi.fn();
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { preflightHardcap } = await import('@/lib/cost/cost-logger');
      await preflightHardcap(
        { month: '2026-06', callCount: 1 },
        // STEP-2: DI seam은 service-role 직접 SELECT 경로(from 체인)로 검증 (session=RPC 경로는 별 파일).
        { client: { from: fromMock } as never, callerKind: 'service-role' },
      );
      expect(fromMock).toHaveBeenCalledWith('cost_log');
      expect(createClientSpy).not.toHaveBeenCalled();
    });

    it('falls back to createClient when options omitted (default behavior)', async () => {
      const { fromMock } = buildChain();
      const createClientSpy = vi.fn().mockResolvedValue({ from: fromMock });
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { preflightHardcap } = await import('@/lib/cost/cost-logger');
      // STEP-2: service-role 직접 SELECT 경로로 createClient fallback DI seam 검증.
      await preflightHardcap({ month: '2026-06', callCount: 1 }, { callerKind: 'service-role' });
      expect(createClientSpy).toHaveBeenCalled();
      expect(fromMock).toHaveBeenCalledWith('cost_log');
    });
  });

  describe('insertCostLog', () => {
    it('uses options.client when provided (createClient NOT called)', async () => {
      vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
      const createClientSpy = vi.fn();
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { insertCostLog } = await import('@/lib/cost/cost-logger');
      await insertCostLog(validRow, { client: { from: fromMock } as never });
      expect(fromMock).toHaveBeenCalledWith('cost_log');
      expect(insertMock).toHaveBeenCalledWith(validRow);
      expect(createClientSpy).not.toHaveBeenCalled();
    });

    it('falls back to createClient when options omitted (default behavior)', async () => {
      vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
      const createClientSpy = vi.fn().mockResolvedValue({ from: fromMock });
      vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientSpy }));
      const { insertCostLog } = await import('@/lib/cost/cost-logger');
      await insertCostLog(validRow);
      expect(createClientSpy).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalledWith(validRow);
    });
  });
});
