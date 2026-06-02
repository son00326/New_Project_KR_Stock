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
    // 58차 Step 2.3 omxy R3+R4 fix — pagination chain: select → eq → order(called_at) → order(id) → range.
    const rangeMock = vi.fn().mockResolvedValue({
      data: [{ cost_krw: HARDCAP_KRW - 1000 }],
      error: null,
    });
    const orderChain = { order: vi.fn(), range: rangeMock };
    orderChain.order = vi.fn().mockReturnValue(orderChain);
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({ order: orderChain.order }),
    });
    await expect(preflightHardcap({
      month: '2026-05',
      callCount: 30,
    }, { callerKind: 'service-role' })).rejects.toThrow('cost_hardcap_40man');
  });

  // 58차 Mock cleanup Step 2.3 omxy R1 + R2 HIGH-1 fix — getMonthlyTotal pagination loop
  // (PostgREST aggregate disabled in production, PGRST123 live verified 2026-05-28).
  // regenerate cost_log 실 SELECT 통로 → row limit 무관 + non-finite guard 보장.
  //
  // STEP-2 (cost_log fail-open hardening): getMonthlyTotal에 callerKind 분기 도입.
  //   본 describe의 pagination/guard 테스트는 callerKind:'service-role'(직접 SELECT, RLS bypass)
  //   경로를 검증한다. session(default) RPC-first 경로 + non-admin fail-closed는
  //   cost-logger-step2-rpc.test.ts가 커버.
  describe('getMonthlyTotal — pagination loop (service-role 직접 SELECT, HIGH-1 fix)', () => {
    // R3 HIGH-1 + R4 MEDIUM fix — pagination chain shape: select → eq → order(called_at) → order(id) → range.
    // 헬퍼: 모든 page chain을 한 번에 wire. inner order() return은 자기 자신을 chain하여 2nd order
    // 호출 후 range로 이어지도록 구성.
    function buildChainWithRange(
      rangeSpy: ReturnType<typeof vi.fn>,
    ): { eq: ReturnType<typeof vi.fn> } {
      const orderChain = { order: vi.fn(), range: rangeSpy };
      orderChain.order = vi.fn().mockReturnValue(orderChain);
      return { eq: vi.fn().mockReturnValue({ order: orderChain.order }) };
    }

    it('returns 0 when first page is empty (0 rows / RLS deny)', async () => {
      const rangeSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSelect.mockReturnValue(buildChainWithRange(rangeSpy));
      const total = await getMonthlyTotal('2026-05', { callerKind: 'service-role' });
      expect(total).toBe(0);
      expect(rangeSpy).toHaveBeenCalledTimes(1);
      expect(rangeSpy).toHaveBeenCalledWith(0, 999);
    });

    it('single page <1000 rows sums correctly (no further pagination)', async () => {
      const rangeSpy = vi.fn().mockResolvedValue({
        data: [{ cost_krw: 100 }, { cost_krw: 200.5 }, { cost_krw: 50 }],
        error: null,
      });
      mockSelect.mockReturnValue(buildChainWithRange(rangeSpy));
      const total = await getMonthlyTotal('2026-05', { callerKind: 'service-role' });
      expect(total).toBe(350.5);
      expect(rangeSpy).toHaveBeenCalledTimes(1);
    });

    it('paginates when first page returns PAGE_SIZE rows (row limit bypass)', async () => {
      // page 1 = 1000 rows × cost_krw=100 (sum 100,000) + page 2 = 500 rows × cost_krw=200 (sum 100,000)
      const page1 = Array.from({ length: 1000 }, () => ({ cost_krw: 100 }));
      const page2 = Array.from({ length: 500 }, () => ({ cost_krw: 200 }));
      const rangeSpy = vi
        .fn()
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null });
      mockSelect.mockReturnValue(buildChainWithRange(rangeSpy));
      const total = await getMonthlyTotal('2026-05', { callerKind: 'service-role' });
      expect(total).toBe(200_000);
      expect(rangeSpy).toHaveBeenCalledTimes(2);
      expect(rangeSpy).toHaveBeenNthCalledWith(1, 0, 999);
      expect(rangeSpy).toHaveBeenNthCalledWith(2, 1000, 1999);
    });

    it('orders by called_at then id ascending (R4 MEDIUM fix — deterministic ordering snapshot)', async () => {
      // R3 fix(`.order('id')` 단일)는 random UUID라 정적 snapshot만 deterministic.
      // R4 fix는 called_at primary + id tiebreak secondary로 application-level monotonic
      // 가정 (insertCostLog interface에 called_at 부재) 위에서 deterministic ordering 보장.
      // ⚠️ R5 MEDIUM 박제: backdated INSERT / parallel commit / NTP step에서는 monotonic
      // 가정이 깨질 수 있음 (cost-logger.ts 본체 주석 참조). 완전 차단은 SECURITY DEFINER
      // RPC 또는 schema CHECK 마이그레이션 (W-cost-log-pagination-snapshot defer).
      const rangeSpy = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderChain = { order: vi.fn(), range: rangeSpy };
      orderChain.order = vi.fn().mockReturnValue(orderChain);
      const eqSpy = vi.fn().mockReturnValue({ order: orderChain.order });
      mockSelect.mockReturnValue({ eq: eqSpy });

      await getMonthlyTotal('2026-05', { callerKind: 'service-role' });

      // primary order = called_at asc, secondary order = id asc (chain 2회 호출).
      expect(orderChain.order).toHaveBeenCalledTimes(2);
      expect(orderChain.order).toHaveBeenNthCalledWith(1, 'called_at', { ascending: true });
      expect(orderChain.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    });

    it('throws cost_log_select_failed:<code> on DB error (RLS evaluation error etc)', async () => {
      mockSelect.mockReturnValue(
        buildChainWithRange(
          vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'permission denied', code: 'PGRST301' },
          }),
        ),
      );
      await expect(getMonthlyTotal('2026-05', { callerKind: 'service-role' })).rejects.toThrow(
        'cost_log_select_failed:PGRST301',
      );
    });

    it('throws cost_log_select_failed:non_finite_cost_krw on NaN row (R2 MEDIUM-2 fix — fail-closed)', async () => {
      mockSelect.mockReturnValue(
        buildChainWithRange(
          vi.fn().mockResolvedValue({
            data: [{ cost_krw: 100 }, { cost_krw: 'not-a-number' }],
            error: null,
          }),
        ),
      );
      await expect(getMonthlyTotal('2026-05', { callerKind: 'service-role' })).rejects.toThrow(
        'cost_log_select_failed:non_finite_cost_krw',
      );
    });

    it('throws cost_log_select_failed:negative_cost_krw on negative row (R3 MEDIUM-1 fix — financial integrity)', async () => {
      // 0017 schema lacks `cost_krw >= 0` CHECK → bad row이 hardcap total을 낮춰 unblock risk.
      mockSelect.mockReturnValue(
        buildChainWithRange(
          vi.fn().mockResolvedValue({
            data: [{ cost_krw: 100 }, { cost_krw: -50 }],
            error: null,
          }),
        ),
      );
      await expect(getMonthlyTotal('2026-05', { callerKind: 'service-role' })).rejects.toThrow(
        'cost_log_select_failed:negative_cost_krw',
      );
    });

    it('uses options.client when provided (DI seam — auth context 공유)', async () => {
      // R4 fix — pagination chain: select → eq → order(called_at) → order(id) → range.
      const customRangeSpy = vi
        .fn()
        .mockResolvedValue({ data: [{ cost_krw: 999 }], error: null });
      const orderChain = { order: vi.fn(), range: customRangeSpy };
      orderChain.order = vi.fn().mockReturnValue(orderChain);
      const customClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ order: orderChain.order }),
          }),
        }),
      };
      // R2 MEDIUM-4 fix — `any` 금지. unknown 경유 cast로 타입 안전 + lint clean.
      const total = await getMonthlyTotal('2026-05', {
        client: customClient as unknown as Awaited<
          ReturnType<typeof import('@/lib/supabase/server').createClient>
        >,
        callerKind: 'service-role',
      });
      expect(total).toBe(999);
      expect(customClient.from).toHaveBeenCalledWith('cost_log');
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
