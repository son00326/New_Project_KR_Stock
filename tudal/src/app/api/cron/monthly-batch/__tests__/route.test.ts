// Legacy monthly-batch single-shot route tests.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { runMock } = vi.hoisted(() => ({
  runMock: vi.fn(), // W1b — 구 orchestrator 삭제: stub route가 AI 코드 미임포트임을 간접 검증하는 더미
}));


function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/cron/monthly-batch', {
    headers,
  });
}

describe('GET /api/cron/monthly-batch', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    runMock.mockReset();
    process.env.CRON_SECRET = 'cron-secret';
    process.env.MONTHLY_BATCH_CRON_AI_ENABLED = 'false';
  });

  it('rejects request without Authorization header when CRON_SECRET is set', async () => {
    const { GET } = await import('../route');
    const res = await GET(req());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
    expect(runMock).not.toHaveBeenCalled();
  });

  it('rejects Bearer with wrong secret', async () => {
    const { GET } = await import('../route');
    const res = await GET(req({ authorization: 'Bearer wrong-secret' }));
    expect(res.status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
  });

  it('rejects when CRON_SECRET env undefined in production-like env (fail-closed)', async () => {
    delete process.env.CRON_SECRET;
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const { GET } = await import('../route');
      const res = await GET(req({ authorization: 'Bearer some-value' }));
      expect(res.status).toBe(401);
      expect(runMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('flag off(default) → 200 dormant skip before orchestrator/AI', async () => {
    const { GET } = await import('../route');
    const res = await GET(req({ authorization: 'Bearer cron-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      skipped: true,
      reason: 'monthly_batch_cron_ai_disabled',
    });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('flag on → still 200 deprecated skip before old single-shot orchestrator/AI cost path', async () => {
    process.env.MONTHLY_BATCH_CRON_AI_ENABLED = 'true';
    const { GET } = await import('../route');
    const res = await GET(req({ authorization: 'Bearer cron-secret' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      skipped: true,
      reason: 'monthly_batch_single_shot_deprecated',
    });
    expect(runMock).not.toHaveBeenCalled();
  });

  it('dev fallthrough without CRON_SECRET still returns dormant skip, not orchestrator', async () => {
    delete process.env.CRON_SECRET;
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', '');
    try {
      const { GET } = await import('../route');
      const res = await GET(req());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reason).toBe('monthly_batch_cron_ai_disabled');
      expect(runMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
