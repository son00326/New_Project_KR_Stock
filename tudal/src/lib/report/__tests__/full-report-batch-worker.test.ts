// PR5 worker — pure-ish 로직 단위 테스트 (deps mocked + fake supabase client).
// plan §6 T1/T3/T9/T-v1. DB-level claim/mutex/versioning(SQL)은 omxy SQL 리뷰 + 수동 QA (repo 컨벤션).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── module mocks ──
const orchestrateMock = vi.fn();
const getActiveShortListMock = vi.fn();
const reportExistsMock = vi.fn();
const preflightMock = vi.fn();
const getMonthlyTotalMock = vi.fn();
const insertPipelineHealthMock = vi.fn();
const emitCostAlertMock = vi.fn();
const insertAlertEventsMock = vi.fn();

vi.mock('@/lib/report/full-report-orchestrator', () => ({
  orchestrateFullReport: (...a: unknown[]) => orchestrateMock(...a),
}));
vi.mock('@/lib/data/admin-shortlist', () => ({
  getActiveShortList: (...a: unknown[]) => getActiveShortListMock(...a),
}));
vi.mock('@/lib/data/admin-reports', () => ({
  reportExistsAndCompleteForMonth: (...a: unknown[]) => reportExistsMock(...a),
}));
vi.mock('@/lib/cost/cost-logger', () => ({
  preflightHardcap: (...a: unknown[]) => preflightMock(...a),
  getMonthlyTotal: (...a: unknown[]) => getMonthlyTotalMock(...a),
}));
vi.mock('@/lib/data/admin-pipeline-health-insert', () => ({
  insertPipelineHealth: (...a: unknown[]) => insertPipelineHealthMock(...a),
}));
vi.mock('@/lib/data/admin-cost-alerts', () => ({
  emitCostAlert: (...a: unknown[]) => emitCostAlertMock(...a),
}));
vi.mock('@/lib/data/admin-alerts-insert', () => ({
  insertAlertEvents: (...a: unknown[]) => insertAlertEventsMock(...a),
}));

import { runReportBatchChunk } from '@/lib/report/full-report-batch-worker';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

// fake supabase client (worker가 사용하는 표면만)
function makeFakeClient(opts: {
  claimedJobs: Array<{ id: string; ticker: string }>;
  userExists?: boolean;
  remainingCount?: number;
}) {
  const rpcCalls: RpcCall[] = [];
  const client = {
    auth: {
      admin: {
        getUserById: vi.fn(async () =>
          opts.userExists === false
            ? { data: { user: null }, error: null }
            : { data: { user: { id: VALID_UUID } }, error: null },
        ),
      },
    },
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      chain.upsert = vi.fn(async () => ({ error: null }));
      chain.update = vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      }));
      chain.select = vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({ count: opts.remainingCount ?? 0, error: null })),
        })),
      }));
      return chain;
    }),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === 'claim_next_report_jobs') {
        return { data: opts.claimedJobs, error: null };
      }
      return { data: null, error: null };
    }),
  };
  return { client, rpcCalls };
}

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
  process.env.CRON_SYSTEM_USER_ID = VALID_UUID;
  getActiveShortListMock.mockResolvedValue([
    { ticker: '005930', name: '삼성전자', sector: '반도체' },
    { ticker: '000660', name: 'SK하이닉스', sector: '반도체' },
  ]);
  preflightMock.mockResolvedValue({ currentTotal: 0, reservation: 0, remaining: 400000 });
  getMonthlyTotalMock.mockResolvedValue(0);
  reportExistsMock.mockResolvedValue({ exists: false, complete: false });
  orchestrateMock.mockResolvedValue({ reportId: 'r1', costKrw: 535, revised: false, criticVerdict: {}, criticRunId: 'c1' });
  insertPipelineHealthMock.mockResolvedValue(undefined);
  insertAlertEventsMock.mockResolvedValue(undefined);
  emitCostAlertMock.mockResolvedValue(undefined);
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe('runReportBatchChunk step-0 fail-closed (T9 — R2 HIGH-2 + R3 HIGH-1)', () => {
  it('AI_COST_LOG_REAL_INSERT_ENABLED!==true → cost_logging_disabled, LLM 0', async () => {
    process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'false';
    const { client } = makeFakeClient({ claimedJobs: [] });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runReportBatchChunk({ month: '2026-06', client: client as any }),
    ).rejects.toThrow('cost_logging_disabled');
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('CRON_SYSTEM_USER_ID 미설정/형식 위반 → cron_system_user_id_invalid, LLM 0', async () => {
    process.env.CRON_SYSTEM_USER_ID = 'cron-system'; // not a UUID
    const { client } = makeFakeClient({ claimedJobs: [] });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runReportBatchChunk({ month: '2026-06', client: client as any }),
    ).rejects.toThrow('cron_system_user_id_invalid');
    expect(orchestrateMock).not.toHaveBeenCalled();
  });

  it('auth.users 부재 → cron_system_user_not_found, LLM 0', async () => {
    const { client } = makeFakeClient({ claimedJobs: [], userExists: false });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runReportBatchChunk({ month: '2026-06', client: client as any }),
    ).rejects.toThrow('cron_system_user_not_found');
    expect(orchestrateMock).not.toHaveBeenCalled();
  });
});

describe('runReportBatchChunk sequential + skip + isolation', () => {
  it('T-v1 SKIP: 이미 완성된 본문은 orchestrate 미호출 + mark done', async () => {
    reportExistsMock.mockResolvedValue({ exists: true, complete: true });
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [{ id: 'j1', ticker: '005930' }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await runReportBatchChunk({ month: '2026-06', client: client as any });
    expect(orchestrateMock).not.toHaveBeenCalled();
    expect(res.skipped).toBe(1);
    expect(res.done).toBe(0);
    const marks = rpcCalls.filter((c) => c.name === 'mark_report_job');
    expect(marks[0].args.p_status).toBe('done');
  });

  it('T1 isolation: 1 종목 실패 → 나머지 처리 계속, 실패 종목 mark failed', async () => {
    orchestrateMock
      // non-transient(retry 0) per-ticker 실패 → 격리 (transient면 retry가 복구하므로 부적합).
      .mockRejectedValueOnce(new Error('orchestrate_failed:writer_validation:section_0')) // 005930
      .mockResolvedValue({ reportId: 'r2', costKrw: 535, revised: false, criticVerdict: {}, criticRunId: 'c2' });
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [
        { id: 'j1', ticker: '005930' },
        { id: 'j2', ticker: '000660' },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await runReportBatchChunk({ month: '2026-06', client: client as any });
    expect(res.failed).toBe(1);
    expect(res.done).toBe(1);
    const marks = rpcCalls.filter((c) => c.name === 'mark_report_job');
    expect(marks.find((m) => m.args.p_id === 'j1')?.args.p_status).toBe('failed');
    expect(marks.find((m) => m.args.p_id === 'j2')?.args.p_status).toBe('done');
    // 실패 시 summary scheduler_fail alert + pipeline_health failed
    expect(insertAlertEventsMock).toHaveBeenCalled();
  });

  it('T3 systemic abort: ai_key_unavailable → batch throw (나머지 미처리)', async () => {
    orchestrateMock.mockRejectedValue(new Error('ai_key_unavailable'));
    const { client } = makeFakeClient({
      claimedJobs: [
        { id: 'j1', ticker: '005930' },
        { id: 'j2', ticker: '000660' },
      ],
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runReportBatchChunk({ month: '2026-06', client: client as any }),
    ).rejects.toThrow('ai_key_unavailable');
    // 첫 종목에서 abort → 두번째 orchestrate 미호출 (1회만)
    expect(orchestrateMock).toHaveBeenCalledTimes(1);
  });

  it('T-c4 all-green: 전 종목 성공 시 summary alert 0 (pipeline_health success)', async () => {
    const { client } = makeFakeClient({
      claimedJobs: [
        { id: 'j1', ticker: '005930' },
        { id: 'j2', ticker: '000660' },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await runReportBatchChunk({ month: '2026-06', client: client as any });
    expect(res.done).toBe(2);
    expect(res.failed).toBe(0);
    expect(insertAlertEventsMock).not.toHaveBeenCalled(); // green = alert 0
    expect(insertPipelineHealthMock).toHaveBeenCalledWith(
      expect.objectContaining({ pipeline: 'ai', status: 'success' }),
      expect.anything(),
    );
  });
});

describe('runReportBatchChunk cost_hardcap abort (T4)', () => {
  it('batch preflight cost_hardcap_40man → deferred + cost alert + STOP (throw 안 함)', async () => {
    preflightMock.mockRejectedValue(new Error('cost_hardcap_40man'));
    const { client, rpcCalls } = makeFakeClient({
      claimedJobs: [],
      remainingCount: 5,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await runReportBatchChunk({ month: '2026-06', client: client as any });
    expect(res.aborted).toBe('cost_hardcap');
    expect(emitCostAlertMock).toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
    // claim 미진입
    expect(rpcCalls.find((c) => c.name === 'claim_next_report_jobs')).toBeUndefined();
  });
});
