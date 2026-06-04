// PR5 report-worker route — auth + flag gate + run-mutex skip (plan §6 T-r1/T-r2 + T8 route side).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const guardedMock = vi.fn();

// next/server `after()`는 request scope를 요구 → vitest node env에서 throw.
// NextResponse/NextRequest는 real 유지하고 after만 no-op stub (self-continue 게이트 결정만 검증).
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: () => {} };
});

vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => ({ rpc: vi.fn() }),
}));
vi.mock('@/lib/report/full-report-batch-worker', () => ({
  runGuardedReportChunk: (...a: unknown[]) => guardedMock(...a),
}));

import { GET } from '@/app/api/cron/monthly-batch/report-worker/route';

const URL = 'http://localhost/api/cron/monthly-batch/report-worker';
const ORIG_ENV = { ...process.env };

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(URL, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'secret-x';
  process.env.PR5_CRON_AUTO_ENABLED = 'true';
  delete process.env.PR5_CRON_SELF_CONTINUE;
  // NODE_ENV는 read-only(vitest='test', !=='production'이라 production-like false). VERCEL_ENV/NEXT_PUBLIC만 정리.
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_APP_ENV;
  guardedMock.mockResolvedValue({
    result: { month: '2026-06', claimed: 2, done: 2, skipped: 0, failed: 0, deferred: 0, remaining: 0, aborted: null },
  });
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe('report-worker auth (T-r2)', () => {
  it('Authorization 부재 → 401', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(guardedMock).not.toHaveBeenCalled();
  });

  it('잘못된 Bearer → 401', async () => {
    const res = await GET(req({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('production-like + CRON_SECRET 미설정 → 401 (fail-closed)', async () => {
    delete process.env.CRON_SECRET;
    process.env.VERCEL_ENV = 'production';
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});

describe('report-worker flag gate (T-r1)', () => {
  it('PR5_CRON_AUTO_ENABLED 미설정 → 200 skipped, guarded 미호출 (spend 0)', async () => {
    delete process.env.PR5_CRON_AUTO_ENABLED;
    const res = await GET(req({ authorization: 'Bearer secret-x' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('pr5_cron_auto_disabled');
    expect(guardedMock).not.toHaveBeenCalled();
  });
});

describe('report-worker run-mutex + result', () => {
  it('T8: run-mutex 미획득(already_running) → 200 skipped', async () => {
    guardedMock.mockResolvedValue({ skipped: 'already_running' });
    const res = await GET(req({ authorization: 'Bearer secret-x' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('already_running');
  });

  it('성공 → 200 ok + result', async () => {
    const res = await GET(req({ authorization: 'Bearer secret-x' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result.done).toBe(2);
  });

  // W2a Task 9.5 (R3 HIGH-2): worker가 <30 not-ready 결과 반환 → 502 false-alarm 대신 200 clean skip.
  it('worker not-ready(<30) 결과 → 200 skipped shortlist_not_ready (502 아님)', async () => {
    guardedMock.mockResolvedValue({
      result: {
        month: '2026-06',
        claimed: 0,
        done: 0,
        skipped: 0,
        failed: 0,
        deferred: 0,
        remaining: 0,
        aborted: null,
        notReady: { reason: 'shortlist_not_ready' },
      },
    });
    const res = await GET(req({ authorization: 'Bearer secret-x' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe('shortlist_not_ready');
  });

  it('worker throw → 502', async () => {
    guardedMock.mockRejectedValue(new Error('cost_logging_disabled'));
    const res = await GET(req({ authorization: 'Bearer secret-x' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('cost_logging_disabled');
  });
});

describe('report-worker self-continue forward-progress gate (OPS-3)', () => {
  it('claimed>0 + remaining>0 + SELF_CONTINUE → 202 continued', async () => {
    process.env.PR5_CRON_SELF_CONTINUE = 'true';
    guardedMock.mockResolvedValue({
      result: { month: '2026-06', claimed: 3, done: 3, skipped: 0, failed: 0, deferred: 0, remaining: 27, aborted: null },
    });
    const res = await GET(req({ authorization: 'Bearer secret-x' }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.continued).toBe(true);
  });

  it('claimed=0 + remaining>0 + SELF_CONTINUE → 200 (no zero-progress self-loop)', async () => {
    process.env.PR5_CRON_SELF_CONTINUE = 'true';
    guardedMock.mockResolvedValue({
      result: { month: '2026-06', claimed: 0, done: 0, skipped: 0, failed: 0, deferred: 0, remaining: 5, aborted: null },
    });
    const res = await GET(req({ authorization: 'Bearer secret-x' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.continued).toBeUndefined();
    expect(body.ok).toBe(true);
  });
});
