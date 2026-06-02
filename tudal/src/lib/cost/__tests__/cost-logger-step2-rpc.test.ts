// STEP-2 cost_log fail-open hardening — getMonthlyTotal RPC-first(session) + 직접 SELECT(service-role)
// + non-admin raise fail-closed + missing-function-only fallback + service-role 무회귀.
// 패턴: orchestrate-upsert-flag.test.ts (RPC mock) + cost-logger.test.ts (chain mock).
// feedback_test_mock_typing 준수: any/eslint-disable 금지, 명시 인터페이스 + unknown 경유 cast.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMonthlyTotal, preflightHardcap } from '../cost-logger';
import { HARDCAP_KRW } from '../pricing';

interface RpcResult {
  data: number | null;
  error: { message: string; code?: string } | null;
}

// RPC client mock (session 경로 = supabase.rpc).
function rpcClient(result: RpcResult): {
  client: { rpc: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> };
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue(result);
  const from = vi.fn(); // session 경로에서 호출되면 안 됨 (RPC-first).
  return { client: { rpc, from }, rpc, from };
}

// 직접 SELECT chain mock (service-role 경로 = supabase.from().select().eq().order().order().range()).
function selectClient(rangeData: Array<{ cost_krw: number }>): {
  client: { rpc: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> };
  rpc: ReturnType<typeof vi.fn>;
  rangeSpy: ReturnType<typeof vi.fn>;
} {
  const rangeSpy = vi.fn().mockResolvedValue({ data: rangeData, error: null });
  const orderChain = { order: vi.fn(), range: rangeSpy };
  orderChain.order = vi.fn().mockReturnValue(orderChain);
  const eqMock = vi.fn().mockReturnValue({ order: orderChain.order });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
  const from = vi.fn().mockReturnValue({ select: selectMock });
  const rpc = vi.fn(); // service-role 경로에서 호출되면 안 됨 (직접 SELECT).
  return { client: { rpc, from }, rpc, rangeSpy };
}

type DiClient = Awaited<
  ReturnType<typeof import('@/lib/supabase/server').createClient>
>;

describe('getMonthlyTotal STEP-2 — session RPC-first vs service-role direct SELECT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('session(default): calls get_cost_log_monthly_total_admin RPC, returns SUM', async () => {
    const { client, rpc, from } = rpcClient({ data: 12345, error: null });
    const total = await getMonthlyTotal('2026-06', {
      client: client as unknown as DiClient,
    });
    expect(rpc).toHaveBeenCalledWith('get_cost_log_monthly_total_admin', {
      p_month: '2026-06',
    });
    // RPC-first: 직접 SELECT(from) 미사용.
    expect(from).not.toHaveBeenCalled();
    expect(total).toBe(12345);
  });

  it('session: non-admin RPC raise(admin_required) → fail-closed throw, NO SELECT fallback', async () => {
    // RLS silent-0 fail-open을 RPC가 admin_required raise로 전환. fallback 금지.
    const { client, from } = rpcClient({
      data: null,
      error: { message: 'admin_required', code: 'P0001' },
    });
    await expect(
      getMonthlyTotal('2026-06', { client: client as unknown as DiClient }),
    ).rejects.toThrow('cost_log_select_failed:P0001');
    expect(from).not.toHaveBeenCalled(); // ★ undercount 우회 차단 — SELECT 폴백 없음.
  });

  it('session: permission(42501)/RLS error → fail-closed throw, NO fallback', async () => {
    const { client, from } = rpcClient({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    });
    await expect(
      getMonthlyTotal('2026-06', { client: client as unknown as DiClient }),
    ).rejects.toThrow('cost_log_select_failed:42501');
    expect(from).not.toHaveBeenCalled();
  });

  it('session: missing-function(PGRST202) → falls back to paginated SELECT (pre-migration only)', async () => {
    // 0030 apply 전 무회귀: RPC 없음 → 직접 SELECT.
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'function not found', code: 'PGRST202' },
    });
    const rangeSpy = vi
      .fn()
      .mockResolvedValue({ data: [{ cost_krw: 700 }], error: null });
    const orderChain = { order: vi.fn(), range: rangeSpy };
    orderChain.order = vi.fn().mockReturnValue(orderChain);
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: orderChain.order }),
      }),
    });
    const client = { rpc, from };
    const total = await getMonthlyTotal('2026-06', {
      client: client as unknown as DiClient,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('cost_log'); // 폴백으로 SELECT.
    expect(total).toBe(700);
  });

  it('session: target undefined_function(42883) → falls back to paginated SELECT (pre-migration only)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          'function public.get_cost_log_monthly_total_admin(p_month => text) does not exist',
        code: '42883',
      },
    });
    const rangeSpy = vi
      .fn()
      .mockResolvedValue({ data: [{ cost_krw: 50 }], error: null });
    const orderChain = { order: vi.fn(), range: rangeSpy };
    orderChain.order = vi.fn().mockReturnValue(orderChain);
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: orderChain.order }),
      }),
    });
    const client = { rpc, from };
    const total = await getMonthlyTotal('2026-06', {
      client: client as unknown as DiClient,
    });
    expect(total).toBe(50);
  });

  it('session: unrelated undefined_function(42883) → fail-closed, NO fallback', async () => {
    const { client, from } = rpcClient({
      data: null,
      error: { message: 'function public.is_admin_broken() does not exist', code: '42883' },
    });
    await expect(
      getMonthlyTotal('2026-06', { client: client as unknown as DiClient }),
    ).rejects.toThrow('cost_log_select_failed:42883');
    expect(from).not.toHaveBeenCalled();
  });

  it('session: RPC negative SUM guard → fail-closed throw', async () => {
    const { client } = rpcClient({ data: -5, error: null });
    await expect(
      getMonthlyTotal('2026-06', { client: client as unknown as DiClient }),
    ).rejects.toThrow('cost_log_select_failed:negative_cost_krw');
  });

  it('session: RPC non-finite SUM guard → fail-closed throw', async () => {
    const { client } = rpcClient({
      data: NaN as unknown as number,
      error: null,
    });
    await expect(
      getMonthlyTotal('2026-06', { client: client as unknown as DiClient }),
    ).rejects.toThrow('cost_log_select_failed:non_finite_cost_krw');
  });

  it('service-role: bypasses RPC, uses direct paginated SELECT (worker 무회귀)', async () => {
    const { client, rpc, rangeSpy } = selectClient([
      { cost_krw: 100 },
      { cost_krw: 200 },
    ]);
    const total = await getMonthlyTotal('2026-06', {
      client: client as unknown as DiClient,
      callerKind: 'service-role',
    });
    // ★ service-role은 admin-only RPC를 절대 호출하지 않음.
    expect(rpc).not.toHaveBeenCalled();
    expect(rangeSpy).toHaveBeenCalledWith(0, 999);
    expect(total).toBe(300);
  });
});

describe('preflightHardcap STEP-2 — callerKind 전파', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('session(default): preflight uses RPC SUM, throws when over hardcap', async () => {
    const { client, rpc } = rpcClient({ data: HARDCAP_KRW - 1000, error: null });
    await expect(
      preflightHardcap(
        { month: '2026-06', callCount: 30 },
        { client: client as unknown as DiClient },
      ),
    ).rejects.toThrow('cost_hardcap_40man');
    expect(rpc).toHaveBeenCalledWith('get_cost_log_monthly_total_admin', {
      p_month: '2026-06',
    });
  });

  it('service-role: preflight propagates callerKind → direct SELECT (RPC not called)', async () => {
    const { client, rpc, rangeSpy } = selectClient([{ cost_krw: 10 }]);
    const res = await preflightHardcap(
      { month: '2026-06', callCount: 1, maxCostPerCallKrw: 100 },
      { client: client as unknown as DiClient, callerKind: 'service-role' },
    );
    expect(rpc).not.toHaveBeenCalled();
    expect(rangeSpy).toHaveBeenCalledTimes(1);
    expect(res.currentTotal).toBe(10);
    expect(res.reservation).toBe(100);
  });
});
