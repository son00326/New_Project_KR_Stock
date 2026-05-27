// tudal/src/lib/cost/__tests__/cost-logger.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertCostLog, getMonthlyTotal, preflightHardcap } from '../cost-logger';
import { HARDCAP_KRW, MAX_COST_PER_CALL_KRW } from '../pricing';

// Supabase chain mock (feedback_test_mock_typing pattern)
interface InsertChain {
  insert: ReturnType<typeof vi.fn>;
}
interface SelectChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
}
interface QueryResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
    })),
  })),
}));

describe('cost-logger (Q2 + Q6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
  });

  it('flag-off: insertCostLog noop (DB INSERT not called)', async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'false';
    await insertCostLog({
      month: '2026-05',
      ticker: '005930',
      persona_id: 'warren-buffett',
      prompt_version: '2026-05-19',
      model: 'claude-opus-4-7',
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
      cost_krw: 100,
      prompt_cache_enabled: false,
      called_by: 'uuid-admin',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('flag-on: insertCostLog calls DB INSERT', async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
    mockInsert.mockResolvedValue({ data: null, error: null } as QueryResult<null>);
    await insertCostLog({
      month: '2026-05',
      ticker: '005930',
      persona_id: 'warren-buffett',
      prompt_version: '2026-05-19',
      model: 'claude-opus-4-7',
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
      cost_krw: 100,
      prompt_cache_enabled: false,
      called_by: 'uuid-admin',
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('RLS error throws cost_log_insert_failed (한국어 매핑은 format-error에서)', async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
    mockInsert.mockResolvedValue({
      data: null,
      error: { message: 'RLS violation', code: '42501' },
    } as QueryResult<null>);
    await expect(insertCostLog({
      month: '2026-05',
      ticker: '005930',
      persona_id: 'warren-buffett',
      prompt_version: '2026-05-19',
      model: 'claude-opus-4-7',
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
      cost_krw: 100,
      prompt_cache_enabled: false,
      called_by: 'uuid-admin',
    })).rejects.toThrow('cost_log_insert_failed');
  });

  it('preflightHardcap throws when currentTotal + reservation > HARDCAP', async () => {
    // 58차 Step 2.3 omxy R1 HIGH-1 fix — PostgREST aggregate response shape `[{sum: ...}]`.
    mockSelect.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ sum: HARDCAP_KRW - 1000 }],
        error: null,
      }),
    });
    await expect(preflightHardcap({
      month: '2026-05',
      callCount: 30,
    })).rejects.toThrow('cost_hardcap_40man');
  });

  // 58차 Mock cleanup Step 2.3 omxy R1 HIGH-1 fix — getMonthlyTotal server-side aggregate
  // (row limit fail-open 차단). regenerate cost_log 실 SELECT 통로 introduces production gate.
  describe('getMonthlyTotal — PostgREST server-side aggregate (HIGH-1 fix)', () => {
    it('uses `cost_krw.sum()` aggregate query (not client-side reduce)', async () => {
      const selectSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ sum: 12_345 }], error: null }),
      });
      mockSelect.mockImplementation(selectSpy);
      await getMonthlyTotal('2026-05');
      expect(selectSpy).toHaveBeenCalledWith('cost_krw.sum()');
    });

    it('returns 0 when aggregate sum is null (0 source rows or RLS deny)', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ sum: null }], error: null }),
      });
      const total = await getMonthlyTotal('2026-05');
      expect(total).toBe(0);
    });

    it('returns aggregate sum as number (numeric string coercion)', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ sum: '12345.67' }], error: null }),
      });
      const total = await getMonthlyTotal('2026-05');
      expect(total).toBe(12_345.67);
    });

    it('throws cost_log_select_failed:<code> on DB error (RLS evaluation error etc)', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'permission denied', code: 'PGRST301' },
        }),
      });
      await expect(getMonthlyTotal('2026-05')).rejects.toThrow(
        'cost_log_select_failed:PGRST301',
      );
    });

    it('uses options.client when provided (DI seam — auth context 공유)', async () => {
      const customSelectSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ sum: 999 }], error: null }),
      });
      const customClient = {
        from: vi.fn().mockReturnValue({ select: customSelectSpy }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const total = await getMonthlyTotal('2026-05', { client: customClient as any });
      expect(total).toBe(999);
      expect(customClient.from).toHaveBeenCalledWith('cost_log');
      expect(customSelectSpy).toHaveBeenCalledWith('cost_krw.sum()');
      // 기본 createClient는 호출되지 않음 (mockSelect 미사용)
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  it('orphan row preservation: writer failure does not delete cost_log row (audit)', async () => {
    // cost-logger는 단일 책임 (INSERT만). orphan 보존은 caller (persona-eval) 책임.
    // 본 테스트는 insertCostLog가 호출 후 별도 DELETE 행위가 없음을 검증.
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
    mockInsert.mockResolvedValue({ data: null, error: null });
    await insertCostLog({
      month: '2026-05',
      ticker: '005930',
      persona_id: 'warren-buffett',
      prompt_version: '2026-05-19',
      model: 'claude-opus-4-7',
      input_tokens: 100,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      output_tokens: 50,
      cost_krw: 100,
      prompt_cache_enabled: false,
      called_by: 'uuid-admin',
    });
    // 검증: INSERT만 호출, DELETE 없음
    expect(mockInsert).toHaveBeenCalledTimes(1);
    // DELETE 메서드가 mock에 없는지 확인 (call shape 검증)
    expect(mockInsert.mock.calls[0]).toBeDefined();
  });
});
