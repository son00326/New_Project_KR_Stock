import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getActiveShortListMock = vi.fn();
const reportExistsMock = vi.fn();
const orchestrateMock = vi.fn();
const preflightMock = vi.fn();
const getMonthlyTotalMock = vi.fn();
const insertPipelineHealthMock = vi.fn();
const emitCostAlertMock = vi.fn();
const insertAlertEventsMock = vi.fn();
const enrichMock = vi.fn();
const commitSection8StepMock = vi.fn();

vi.mock('@/lib/data/admin-shortlist', () => ({
  getActiveShortList: (...args: unknown[]) => getActiveShortListMock(...args),
}));
vi.mock('@/lib/data/admin-reports', () => ({
  reportExistsAndCompleteForMonth: (...args: unknown[]) => reportExistsMock(...args),
}));
vi.mock('@/lib/report/full-report-orchestrator', () => ({
  orchestrateFullReport: (...args: unknown[]) => orchestrateMock(...args),
}));
vi.mock('@/lib/cost/cost-logger', () => ({
  preflightHardcap: (...args: unknown[]) => preflightMock(...args),
  getMonthlyTotal: (...args: unknown[]) => getMonthlyTotalMock(...args),
}));
vi.mock('@/lib/data/admin-pipeline-health-insert', () => ({
  insertPipelineHealth: (...args: unknown[]) => insertPipelineHealthMock(...args),
}));
vi.mock('@/lib/data/admin-cost-alerts', () => ({
  emitCostAlert: (...args: unknown[]) => emitCostAlertMock(...args),
}));
vi.mock('@/lib/data/admin-alerts-insert', () => ({
  insertAlertEvents: (...args: unknown[]) => insertAlertEventsMock(...args),
}));
vi.mock('@/lib/report/report-input-enricher', () => ({
  enrichReportInput: (...args: unknown[]) => enrichMock(...args),
}));
vi.mock('@/lib/report/section8-step', () => ({
  commitSection8Step: (...args: unknown[]) => commitSection8StepMock(...args),
  isAiBadge: (badge: string | null | undefined) =>
    badge === '🟢' || badge === '🔵' || badge === '🟣' || badge === '🟡',
}));

import { runReportBatchChunk } from '@/lib/report/full-report-batch-worker';

type WorkerClient = Parameters<typeof runReportBatchChunk>[0]['client'];
type RpcArgs = Record<string, unknown>;
interface RpcCall {
  readonly name: string;
  readonly args: RpcArgs;
}

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const ORIGINAL_ENV = { ...process.env };

function workerClient(client: unknown): WorkerClient {
  return client as WorkerClient;
}

function buildShortList(firstBadge: string | null | undefined) {
  return [
    { ticker: '005930', name: '삼성전자', sector: '반도체', consensusBadge: firstBadge },
    ...Array.from({ length: 29 }, (_, i) => ({
      ticker: `9${String(i).padStart(5, '0')}`,
      name: `테스트${i}`,
      sector: '테스트',
      consensusBadge: '🟢',
    })),
  ];
}

function makeFakeClient(claimedJobs: readonly { readonly id: string; readonly ticker: string }[]) {
  const rpcCalls: RpcCall[] = [];
  const client = {
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({ data: { user: { id: VALID_UUID } }, error: null })),
      },
    },
    from: vi.fn(() => ({
      upsert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({ count: 0, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({ error: null })),
        })),
      })),
    })),
    rpc: vi.fn(async (name: string, args: RpcArgs) => {
      rpcCalls.push({ name, args });
      if (name === 'claim_next_report_jobs') return { data: claimedJobs, error: null };
      return { data: null, error: null };
    }),
  };
  return { client, rpcCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
  process.env.PR5_CRON_AUTO_ENABLED = 'true';
  process.env.CRON_SYSTEM_USER_ID = VALID_UUID;
  delete process.env.PR5B_SECTION8_ENABLED;
  getActiveShortListMock.mockResolvedValue(buildShortList('🟢'));
  reportExistsMock.mockResolvedValue({ exists: true, complete: true, hasSection8: false });
  preflightMock.mockResolvedValue({ currentTotal: 0, reservation: 0, remaining: 500000 });
  getMonthlyTotalMock.mockResolvedValue(0);
  insertPipelineHealthMock.mockResolvedValue(undefined);
  insertAlertEventsMock.mockResolvedValue(undefined);
  emitCostAlertMock.mockResolvedValue(undefined);
  commitSection8StepMock.mockResolvedValue({ status: 'committed', reportId: 'report-section8' });
  orchestrateMock.mockResolvedValue({ reportId: 'body-report' });
  enrichMock.mockResolvedValue({});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('runReportBatchChunk PR5b Section8 branches', () => {
  it('flag off + body-complete rows are skipped without Section8 work', async () => {
    const { client, rpcCalls } = makeFakeClient([{ id: 'job-1', ticker: '005930' }]);

    const result = await runReportBatchChunk({
      month: '2026-06',
      client: workerClient(client),
      chunkSize: 1,
    });

    expect(result.skipped).toBe(1);
    expect(result.done).toBe(0);
    expect(commitSection8StepMock).not.toHaveBeenCalled();
    expect(orchestrateMock).not.toHaveBeenCalled();
    expect(rpcCalls.some((call) => call.name === 'reset_section8_eligible_jobs')).toBe(false);
    expect(rpcCalls.find((call) => call.name === 'mark_report_job')?.args).toMatchObject({
      p_status: 'done',
      p_error: null,
    });
  });

  it('badge present + Section8 committed marks the job done', async () => {
    process.env.PR5B_SECTION8_ENABLED = 'true';
    const { client, rpcCalls } = makeFakeClient([{ id: 'job-1', ticker: '005930' }]);

    const result = await runReportBatchChunk({
      month: '2026-06',
      client: workerClient(client),
      chunkSize: 1,
    });

    expect(result.done).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.deferred).toBe(0);
    expect(commitSection8StepMock).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: '005930', month: '2026-06', badge: '🟢' }),
    );
    expect(rpcCalls.some((call) => call.name === 'reset_section8_eligible_jobs')).toBe(true);
    expect(rpcCalls.find((call) => call.name === 'mark_report_job')?.args).toMatchObject({
      p_status: 'done',
      p_report_id: 'report-section8',
      p_error: null,
    });
  });

  it('badge present + Section8 unavailable marks the job failed, not deferred', async () => {
    process.env.PR5B_SECTION8_ENABLED = 'true';
    commitSection8StepMock.mockResolvedValue({ status: 'section8_unavailable' });
    const { client, rpcCalls } = makeFakeClient([{ id: 'job-1', ticker: '005930' }]);

    const result = await runReportBatchChunk({
      month: '2026-06',
      client: workerClient(client),
      chunkSize: 1,
    });

    expect(result.failed).toBe(1);
    expect(result.deferred).toBe(0);
    expect(rpcCalls.find((call) => call.name === 'mark_report_job')?.args).toMatchObject({
      p_status: 'failed',
      p_error: 'section8_unavailable',
    });
  });

  it('badge null marks Section8 as not-ready deferred without spending Section8 calls', async () => {
    process.env.PR5B_SECTION8_ENABLED = 'true';
    getActiveShortListMock.mockResolvedValue(buildShortList(null));
    const { client, rpcCalls } = makeFakeClient([{ id: 'job-1', ticker: '005930' }]);

    const result = await runReportBatchChunk({
      month: '2026-06',
      client: workerClient(client),
      chunkSize: 1,
    });

    expect(result.deferred).toBe(1);
    expect(result.failed).toBe(0);
    expect(commitSection8StepMock).not.toHaveBeenCalled();
    expect(rpcCalls.find((call) => call.name === 'mark_report_job')?.args).toMatchObject({
      p_status: 'deferred',
      p_error: 'section8_not_ready',
    });
  });
});
