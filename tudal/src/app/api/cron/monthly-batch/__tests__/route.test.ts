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
