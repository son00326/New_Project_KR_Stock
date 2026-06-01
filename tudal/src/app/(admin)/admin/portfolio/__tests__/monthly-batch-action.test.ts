// PR1 triggerMonthlyBatch admin server action tests.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  getUserMock,
  runOrchestratorMock,
  upsertMock,
  isCostLoggingEnabledMock,
  preflightHardcapMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  runOrchestratorMock: vi.fn(),
  upsertMock: vi.fn(),
  isCostLoggingEnabledMock: vi.fn(),
  preflightHardcapMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock },
  }),
}));
vi.mock('@/lib/screening/monthly-batch-orchestrator', () => ({
  runMonthlyBatchOrchestrator: runOrchestratorMock,
}));
vi.mock('@/lib/data/admin-batch-runs', () => ({
  acquireBatchLock: vi.fn(),
  releaseBatchLock: vi.fn(),
}));
vi.mock('@/lib/data/admin-shortlist-persist', () => ({
  upsertShortList30: upsertMock,
}));
// PR-E — cost-logger 격리 mock (isCostLoggingEnabled/preflightHardcap 내부는 cost-logger.test.ts에서 검증).
//   여기서는 admin preflight closure의 fail-closed 전파만 검증.
vi.mock('@/lib/cost/cost-logger', () => ({
  isCostLoggingEnabled: isCostLoggingEnabledMock,
  preflightHardcap: preflightHardcapMock,
  // anthropic-client가 import (callPersona 미실행이라 noop이면 충분).
  insertCostLog: vi.fn(),
}));

import { triggerMonthlyBatch } from '../actions';

const ADMIN_USER = { data: { user: { id: 'admin-uuid-123' } } };
const ORCHESTRATOR_OK = {
  month: '2026-06',
  selectedCount: 30,
  notSelectedCount: 120,
  badgeOnlyCount: 0,
  promptVersionId: 'render-user-prompt@v1',
  personasVersionId: 'core11@v3.1',
};

beforeEach(() => {
  getUserMock.mockReset();
  runOrchestratorMock.mockReset();
  upsertMock.mockReset();
  upsertMock.mockResolvedValue(undefined);
  isCostLoggingEnabledMock.mockReset();
  preflightHardcapMock.mockReset();
});

describe('triggerMonthlyBatch', () => {
  it('returns invalid_input when month not string', async () => {
    // @ts-expect-error testing runtime input validation
    const res = await triggerMonthlyBatch({});
    expect(res).toEqual({ success: false, error: 'invalid_input' });
  });

  it('returns invalid_month for YYYY-MM-DD (full date)', async () => {
    const res = await triggerMonthlyBatch({ month: '2026-06-01' });
    expect(res).toEqual({ success: false, error: 'invalid_month' });
  });

  it('returns invalid_month for YYYY-M (single digit month)', async () => {
    const res = await triggerMonthlyBatch({ month: '2026-6' });
    expect(res).toEqual({ success: false, error: 'invalid_month' });
  });

  it('returns auth_unavailable when no admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({ success: false, error: 'auth_unavailable' });
    expect(runOrchestratorMock).not.toHaveBeenCalled();
  });

  it('success path returns selectedCount + wires real AI path (PR-E)', async () => {
    getUserMock.mockResolvedValue(ADMIN_USER);
    runOrchestratorMock.mockResolvedValue(ORCHESTRATOR_OK);
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({ success: true, data: { selectedCount: 30 } });
    const args = runOrchestratorMock.mock.calls[0][0];
    expect(args.adminUserId).toBe('admin-uuid-123');
    expect(typeof args.recordSchedulerFailAlert).toBe('function');
    expect(typeof args.preflight).toBe('function');
    expect(typeof args.callPersonaPanel).toBe('function'); // makeCallPersonaPanel 결과 (실 Anthropic은 미실행)
    // persist는 실 upsertShortList30로 라우팅 (commentsByTicker 포함, session client).
    const comments = { '005930': { comment_kr: '강력 매수', conviction: 80 } };
    await args.persist('2026-06', [], comments);
    expect(upsertMock).toHaveBeenCalledWith(
      '2026-06',
      [],
      expect.objectContaining({ commentsByTicker: comments }),
    );
    // commitBadgeOnly no-op (resolves, no throw).
    await expect(
      args.commitBadgeOnly({ month: '2026-06', ticker: '005930', badge: '⚪' }),
    ).resolves.toBeUndefined();
  });

  // PR-E (omxy §2.0a 합의) — admin preflight fail-closed 비용 가드.
  async function capturePreflight(): Promise<
    (i: { month: string; callCount: number }) => Promise<void>
  > {
    getUserMock.mockResolvedValue(ADMIN_USER);
    runOrchestratorMock.mockResolvedValue(ORCHESTRATOR_OK);
    await triggerMonthlyBatch({ month: '2026-06' });
    return runOrchestratorMock.mock.calls[0][0].preflight;
  }

  it('preflight fail-closed: cost flag off → cost_logging_disabled (hardcap 미호출)', async () => {
    isCostLoggingEnabledMock.mockReturnValue(false);
    const preflight = await capturePreflight();
    await expect(preflight({ month: '2026-06', callCount: 1650 })).rejects.toThrow(
      'cost_logging_disabled',
    );
    expect(preflightHardcapMock).not.toHaveBeenCalled();
  });

  it('preflight fail-closed: ANTHROPIC_API_KEY 부재 → ai_key_unavailable (hardcap 미호출)', async () => {
    isCostLoggingEnabledMock.mockReturnValue(true);
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const preflight = await capturePreflight();
      await expect(
        preflight({ month: '2026-06', callCount: 1650 }),
      ).rejects.toThrow('ai_key_unavailable');
      expect(preflightHardcapMock).not.toHaveBeenCalled();
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });

  it('preflight: flag on + key present → preflightHardcap(callCount, {client}) 호출', async () => {
    isCostLoggingEnabledMock.mockReturnValue(true);
    preflightHardcapMock.mockResolvedValue({
      currentTotal: 0,
      reservation: 0,
      remaining: 1,
    });
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    try {
      const preflight = await capturePreflight();
      await preflight({ month: '2026-06', callCount: 1650 });
      expect(preflightHardcapMock).toHaveBeenCalledWith(
        { month: '2026-06', callCount: 1650 },
        expect.objectContaining({ client: expect.anything() }),
      );
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('preflight fail-closed: hardcap 초과 → cost_hardcap_40man 전파', async () => {
    isCostLoggingEnabledMock.mockReturnValue(true);
    preflightHardcapMock.mockRejectedValue(new Error('cost_hardcap_40man'));
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    try {
      const preflight = await capturePreflight();
      await expect(
        preflight({ month: '2026-06', callCount: 1650 }),
      ).rejects.toThrow('cost_hardcap_40man');
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
      else delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('orchestrator throw → error mapped to message', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'admin-uuid-123' } },
    });
    runOrchestratorMock.mockRejectedValue(
      new Error('tier0_source_not_wired_pr1_followup'),
    );
    const res = await triggerMonthlyBatch({ month: '2026-06' });
    expect(res).toEqual({
      success: false,
      error: 'tier0_source_not_wired_pr1_followup',
    });
  });
});
