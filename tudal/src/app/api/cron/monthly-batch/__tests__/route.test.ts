// PR1 cron route tests (B9+B12+B15 fix · alert 검증은 orchestrator unit test 책임).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  runMock,
  getUserByIdMock,
  preflightHardcapMock,
  callPersonaMock,
  fetchFinancialsSummaryMock,
  serviceClientMock,
} = vi.hoisted(() => {
  const getUserByIdMock = vi.fn();
  return {
    runMock: vi.fn(),
    getUserByIdMock,
    preflightHardcapMock: vi.fn(),
    callPersonaMock: vi.fn(),
    fetchFinancialsSummaryMock: vi.fn(),
    serviceClientMock: {
      auth: { admin: { getUserById: getUserByIdMock } },
    },
  };
});

vi.mock('@/lib/screening/monthly-batch-orchestrator', () => ({
  runMonthlyBatchOrchestrator: runMock,
}));
// service-role/lock/persist/alert는 본 test에서 직접 호출 안 됨 (orchestrator stub이 가로챔).
// 하지만 import boundary 검증 차원에서 같이 mock 처리.
vi.mock('@/lib/data/admin-batch-runs-cron', () => ({
  acquireBatchLockCron: vi.fn(),
  releaseBatchLockCron: vi.fn(),
}));
vi.mock('@/lib/data/admin-alerts-insert', () => ({
  recordSchedulerFailAlert: vi.fn(),
}));
vi.mock('@/lib/data/admin-shortlist-persist', () => ({
  upsertShortList30: vi.fn(),
}));
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: vi.fn(() => serviceClientMock),
}));
vi.mock('@/lib/cost/cost-logger', () => ({
  isCostLoggingEnabled: () =>
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true',
  preflightHardcap: preflightHardcapMock,
}));
vi.mock('@/lib/ai/anthropic-client', () => ({
  callPersona: callPersonaMock,
}));
vi.mock('@/lib/data/dart-financials', () => ({
  fetchFinancialsSummary: fetchFinancialsSummaryMock,
}));

describe('GET /api/cron/monthly-batch', () => {
  beforeEach(() => {
    vi.resetModules();
    runMock.mockReset();
    getUserByIdMock.mockReset();
    preflightHardcapMock.mockReset();
    callPersonaMock.mockReset();
    fetchFinancialsSummaryMock.mockReset();
    fetchFinancialsSummaryMock.mockResolvedValue('[005930] 재무 데이터 없음');
    process.env.CRON_SECRET = 'cron-secret';
  });

  describe('authorization (G-cron-auth)', () => {
    it('rejects request without Authorization header (401)', async () => {
      const { GET } = await import('../route');
      const res = await GET(
        new NextRequest('http://localhost/api/cron/monthly-batch'),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('unauthorized');
    });

    it('rejects Bearer with wrong secret', async () => {
      const { GET } = await import('../route');
      const res = await GET(
        new NextRequest('http://localhost/api/cron/monthly-batch', {
          headers: { authorization: 'Bearer wrong-secret' },
        }),
      );
      expect(res.status).toBe(401);
    });

    it('rejects non-Bearer scheme', async () => {
      const { GET } = await import('../route');
      const res = await GET(
        new NextRequest('http://localhost/api/cron/monthly-batch', {
          headers: { authorization: 'Basic cron-secret' },
        }),
      );
      expect(res.status).toBe(401);
    });

    // PR4 Task 7 (B18 CRON_SECRET 401 test) — Plan §Step 7.1.2 (d) + B39+B40 fix omxy R1+R2.
    //
    // MF4 invariant (route.ts isProductionLikeForAuth):
    //   NODE_ENV='production' || VERCEL_ENV='production' || VERCEL_ENV='preview' || NEXT_PUBLIC_APP_ENV='production'
    // 4 OR 분기 완전 cover + branch-isolation 박제 (B40 fix omxy R2):
    //   neutralizeProductionLikeEnvs()로 모든 OR 분기를 non-production으로 fix → target 1개만 stub.
    //   ambient CI env (예: 호스트가 NEXT_PUBLIC_APP_ENV=production 이미 set)에 의한 false-positive 차단.
    //
    // 운영 박제: Vercel에서 CRON_SECRET 빠지면 cron route 통과 차단 → 무단 호출 방어.

    // B40 helper: 모든 production-like env를 non-production으로 fix → target branch만 활성.
    function neutralizeProductionLikeEnvs() {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('VERCEL_ENV', '');
      vi.stubEnv('NEXT_PUBLIC_APP_ENV', '');
      delete process.env.CRON_SECRET;
    }

    it('rejects when CRON_SECRET env undefined in NODE_ENV=production (MF4 fail-closed)', async () => {
      neutralizeProductionLikeEnvs();
      vi.stubEnv('NODE_ENV', 'production'); // target branch만 활성
      try {
        const { GET } = await import('../route');
        const res = await GET(
          new NextRequest('http://localhost/api/cron/monthly-batch', {
            headers: { authorization: 'Bearer some-value' },
          }),
        );
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('unauthorized');
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('rejects when CRON_SECRET env undefined in VERCEL_ENV=preview (MF4 fail-closed)', async () => {
      neutralizeProductionLikeEnvs();
      vi.stubEnv('VERCEL_ENV', 'preview'); // target branch만 활성
      try {
        const { GET } = await import('../route');
        const res = await GET(
          new NextRequest('http://localhost/api/cron/monthly-batch', {
            headers: { authorization: 'Bearer some-value' },
          }),
        );
        expect(res.status).toBe(401);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    // B39 fix omxy R1 — MF4 4 OR 분기 완전 cover.
    // B40 fix omxy R2 — neutralize 후 single-stub으로 branch isolation 보장.
    it('rejects when CRON_SECRET env undefined in VERCEL_ENV=production (MF4 fail-closed)', async () => {
      neutralizeProductionLikeEnvs();
      vi.stubEnv('VERCEL_ENV', 'production'); // target branch만 활성
      try {
        const { GET } = await import('../route');
        const res = await GET(
          new NextRequest('http://localhost/api/cron/monthly-batch', {
            headers: { authorization: 'Bearer some-value' },
          }),
        );
        expect(res.status).toBe(401);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('rejects when CRON_SECRET env undefined in NEXT_PUBLIC_APP_ENV=production (MF4 fail-closed)', async () => {
      neutralizeProductionLikeEnvs();
      vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production'); // target branch만 활성
      try {
        const { GET } = await import('../route');
        const res = await GET(
          new NextRequest('http://localhost/api/cron/monthly-batch', {
            headers: { authorization: 'Bearer some-value' },
          }),
        );
        expect(res.status).toBe(401);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    // B40 추가 sanity check: 모든 분기 non-production일 때 CRON_SECRET 미설정은 dev-only fallthrough.
    // 본 invariant가 깨져야 (즉 production-like가 한 분기라도 true이면) 401. 신규 test로 회귀 catch.
    it('accepts (dev fallthrough) when CRON_SECRET undefined + all production-like envs neutralized', async () => {
      neutralizeProductionLikeEnvs();
      runMock.mockResolvedValue({
        month: '2026-06',
        selectedCount: 30,
        notSelectedCount: 120,
        badgeOnlyCount: 0,
        promptVersionId: 'render-user-prompt@v1',
        personasVersionId: 'core11@v3.1',
      });
      try {
        const { GET } = await import('../route');
        const res = await GET(
          new NextRequest('http://localhost/api/cron/monthly-batch', {
            headers: {}, // no authorization (route allows when !isProductionLike() + no secret)
          }),
        );
        // dev mode (no production-like env + no secret) → isAuthorized returns true → 200.
        // 본 test가 fail하면 isProductionLikeForAuth가 over-trigger 중 (false-positive) 의심.
        expect(res.status).toBe(200);
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  it('returns 200 + outcome body when orchestrator succeeds', async () => {
    runMock.mockResolvedValue({
      month: '2026-06',
      selectedCount: 30,
      notSelectedCount: 120,
      badgeOnlyCount: 0,
      promptVersionId: 'render-user-prompt@v1',
      personasVersionId: 'core11@v3.1',
    });
    const { GET } = await import('../route');
    const res = await GET(
      new NextRequest('http://localhost/api/cron/monthly-batch', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.outcome.selectedCount).toBe(30);
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('returns 502 + error body when orchestrator throws (B9 fix: route catch no alert)', async () => {
    runMock.mockRejectedValue(new Error('tier0_source_not_wired_pr1_followup'));
    const { GET } = await import('../route');
    const res = await GET(
      new NextRequest('http://localhost/api/cron/monthly-batch', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('tier0_source_not_wired_pr1_followup');
  });

  it('passes service-role lock helpers to orchestrator (B1+B17 fix)', async () => {
    runMock.mockResolvedValue({
      month: '2026-06',
      selectedCount: 30,
      notSelectedCount: 120,
      badgeOnlyCount: 0,
      promptVersionId: 'render-user-prompt@v1',
      personasVersionId: 'core11@v3.1',
    });
    const { GET } = await import('../route');
    await GET(
      new NextRequest('http://localhost/api/cron/monthly-batch', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    const args = runMock.mock.calls[0][0];
    expect(args.adminUserId).toBe('cron-system');
    expect(typeof args.lock.acquire).toBe('function');
    expect(typeof args.lock.release).toBe('function');
    expect(typeof args.recordSchedulerFailAlert).toBe('function');
  });

  // ── PR-G: cron 실 AI preflight 4 게이트 (fail-closed, callPersonaPanel 전 throw → cost 0) ──
  describe('PR-G real-AI preflight gates', () => {
    const okOutcome = {
      month: '2026-06',
      selectedCount: 30,
      notSelectedCount: 120,
      badgeOnlyCount: 0,
      promptVersionId: 'render-user-prompt@v1',
      personasVersionId: 'core11@v3.1',
    };

    async function getPreflight() {
      runMock.mockResolvedValue(okOutcome);
      const { GET } = await import('../route');
      await GET(
        new NextRequest('http://localhost/api/cron/monthly-batch', {
          headers: { authorization: 'Bearer cron-secret' },
        }),
      );
      const args = runMock.mock.calls[0][0];
      return args.preflight as (i: {
        month: string;
        callCount: number;
      }) => Promise<void>;
    }

    it('flag off (default) → monthly_batch_cron_ai_disabled (실 AI 차단, cost 0)', async () => {
      // MONTHLY_BATCH_CRON_AI_ENABLED=false/미설정 = off. createServiceRoleClient.auth 미접근.
      vi.stubEnv('MONTHLY_BATCH_CRON_AI_ENABLED', 'false');
      try {
        const preflight = await getPreflight();
        await expect(
          preflight({ month: '2026-06', callCount: 1650 }),
        ).rejects.toThrow('monthly_batch_cron_ai_disabled');
        expect(getUserByIdMock).not.toHaveBeenCalled();
        expect(preflightHardcapMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('flag on + cost-logging off → cost_logging_disabled (hardcap fail-open 차단)', async () => {
      vi.stubEnv('MONTHLY_BATCH_CRON_AI_ENABLED', 'true');
      vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'false');
      try {
        const preflight = await getPreflight();
        await expect(
          preflight({ month: '2026-06', callCount: 1650 }),
        ).rejects.toThrow('cost_logging_disabled');
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('flag on + cost on + no ANTHROPIC_API_KEY → ai_key_unavailable', async () => {
      vi.stubEnv('MONTHLY_BATCH_CRON_AI_ENABLED', 'true');
      vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      try {
        const preflight = await getPreflight();
        await expect(
          preflight({ month: '2026-06', callCount: 1650 }),
        ).rejects.toThrow('ai_key_unavailable');
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('flag on + cost on + key + invalid CRON_SYSTEM_USER_ID → cron_system_user_id_invalid', async () => {
      vi.stubEnv('MONTHLY_BATCH_CRON_AI_ENABLED', 'true');
      vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
      vi.stubEnv('CRON_SYSTEM_USER_ID', 'cron-system'); // not a UUID
      try {
        const preflight = await getPreflight();
        await expect(
          preflight({ month: '2026-06', callCount: 1650 }),
        ).rejects.toThrow('cron_system_user_id_invalid');
        expect(getUserByIdMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('flag on + valid UUID + user not found → cron_system_user_not_found', async () => {
      vi.stubEnv('MONTHLY_BATCH_CRON_AI_ENABLED', 'true');
      vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
      vi.stubEnv('CRON_SYSTEM_USER_ID', '00000000-0000-4000-8000-000000000000');
      getUserByIdMock.mockResolvedValue({ data: { user: null }, error: null });
      try {
        const preflight = await getPreflight();
        await expect(
          preflight({ month: '2026-06', callCount: 1650 }),
        ).rejects.toThrow('cron_system_user_not_found');
        expect(getUserByIdMock).toHaveBeenCalledWith(
          '00000000-0000-4000-8000-000000000000',
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('route-level contract: flag off stops before the Anthropic panel', async () => {
      vi.stubEnv('MONTHLY_BATCH_CRON_AI_ENABLED', 'false');
      runMock.mockImplementation(async (args) => {
        await args.preflight({ month: '2026-06', callCount: 1650 });
        await args.callPersonaPanel({ ticker: '005930', financials: 'f' });
        return okOutcome;
      });
      try {
        const { GET } = await import('../route');
        const res = await GET(
          new NextRequest('http://localhost/api/cron/monthly-batch', {
            headers: { authorization: 'Bearer cron-secret' },
          }),
        );
        const body = await res.json();
        expect(res.status).toBe(502);
        expect(body.error).toBe('monthly_batch_cron_ai_disabled');
        expect(callPersonaMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('route-level contract: open gates validate cron user and thread service-role costClient into panel calls', async () => {
      const cronUserId = '00000000-0000-4000-8000-000000000000';
      vi.stubEnv('MONTHLY_BATCH_CRON_AI_ENABLED', 'true');
      vi.stubEnv('AI_COST_LOG_REAL_INSERT_ENABLED', 'true');
      vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
      vi.stubEnv('CRON_SYSTEM_USER_ID', cronUserId);
      getUserByIdMock.mockResolvedValue({
        data: { user: { id: cronUserId } },
        error: null,
      });
      callPersonaMock.mockResolvedValue({
        content: JSON.stringify({
          scores: { short: 70, mid: 71, long: 72 },
          winning_timeframe: 'long',
          rationale_kr: '테스트 근거',
          conviction: 80,
        }),
        usage: {
          input_tokens: 1,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
          output_tokens: 1,
        },
        costKrw: 1,
        promptCacheEnabled: false,
      });

      const order: string[] = [];
      let panelLength = 0;
      let financials = '';
      runMock.mockImplementation(async (args) => {
        await args.preflight({ month: '2026-06', callCount: 1650 });
        order.push('preflight');
        const panel = await args.callPersonaPanel({
          ticker: '005930',
          financials: 'f',
        });
        panelLength = panel.length;
        order.push('panel');
        financials = await args.fetchFinancials('005930');
        order.push('financials');
        return okOutcome;
      });

      try {
        const { GET } = await import('../route');
        const res = await GET(
          new NextRequest('http://localhost/api/cron/monthly-batch', {
            headers: { authorization: 'Bearer cron-secret' },
          }),
        );
        expect(res.status).toBe(200);
        expect(order).toEqual(['preflight', 'panel', 'financials']);
        expect(panelLength).toBe(11);
        expect(financials).toBe('[005930] 재무 데이터 없음');
        expect(getUserByIdMock).toHaveBeenCalledWith(cronUserId);
        expect(preflightHardcapMock).toHaveBeenCalledWith(
          { month: '2026-06', callCount: 1650 },
          { client: serviceClientMock },
        );
        expect(callPersonaMock).toHaveBeenCalledTimes(11);
        expect(callPersonaMock).toHaveBeenCalledWith(
          expect.objectContaining({
            ticker: '005930',
            adminUserId: cronUserId,
            costClient: serviceClientMock,
          }),
        );
        expect(fetchFinancialsSummaryMock).toHaveBeenCalledWith('005930', {
          client: serviceClientMock,
        });
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  it('PR-G: wires real callPersonaPanel + fetchFinancials (not throwing stubs)', async () => {
    runMock.mockResolvedValue({
      month: '2026-06',
      selectedCount: 30,
      notSelectedCount: 120,
      badgeOnlyCount: 0,
      promptVersionId: 'render-user-prompt@v1',
      personasVersionId: 'core11@v3.1',
    });
    const { GET } = await import('../route');
    await GET(
      new NextRequest('http://localhost/api/cron/monthly-batch', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    );
    const args = runMock.mock.calls[0][0];
    expect(typeof args.callPersonaPanel).toBe('function');
    expect(typeof args.fetchFinancials).toBe('function');
    expect(typeof args.preflight).toBe('function');
  });
});
