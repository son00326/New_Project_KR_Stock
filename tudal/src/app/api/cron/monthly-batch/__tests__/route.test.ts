// PR1 cron route tests (B9+B12+B15 fix · alert 검증은 orchestrator unit test 책임).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { runMock } = vi.hoisted(() => ({ runMock: vi.fn() }));

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
  createServiceRoleClient: vi.fn(() => ({})),
}));

describe('GET /api/cron/monthly-batch', () => {
  beforeEach(() => {
    vi.resetModules();
    runMock.mockReset();
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
});
