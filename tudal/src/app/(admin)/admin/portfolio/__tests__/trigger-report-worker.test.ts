// PR-H scope 4 — triggerReportWorkerChunk admin server action tests.
// SoT spec: tasks/w99tzsvzw.output §4 + §5.4.
//
// invariant:
//   - input.month TRIGGER_MONTH_YM_RE 검증.
//   - is_admin() RPC 게이트 (비admin이 worker 트리거 차단).
//   - service-role client 주입 (worker 내부 cron-system 전제 — session client는 worker가 깨짐).
//   - flag-off(PR5_CRON_AUTO_ENABLED!==true) → worker step0 abortBeforeSpend → throw → action error,
//     orchestrate 0회 = cost 0.
//   - runGuardedReportChunk skipped("already_running") → {success:true, skipped} 전달.
//   - guarded.result → 통계 반환.
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getUserMock,
  rpcMock,
  runGuardedMock,
  createServiceRoleMock,
  SESSION_CLIENT,
  SERVICE_ROLE_CLIENT,
} = vi.hoisted(() => {
  const getUserMock = vi.fn();
  const rpcMock = vi.fn();
  return {
    getUserMock,
    rpcMock,
    runGuardedMock: vi.fn(),
    createServiceRoleMock: vi.fn(),
    SESSION_CLIENT: { auth: { getUser: getUserMock }, rpc: rpcMock },
    SERVICE_ROLE_CLIENT: { __kind: "service-role" },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(SESSION_CLIENT),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: createServiceRoleMock,
}));
vi.mock("@/lib/report/full-report-batch-worker", () => ({
  runGuardedReportChunk: runGuardedMock,
}));

import { triggerReportWorkerChunk } from "../actions";

beforeEach(() => {
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "admin-uid" } }, error: null });
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: true, error: null });
  runGuardedMock.mockReset();
  createServiceRoleMock.mockReset();
  createServiceRoleMock.mockReturnValue(SERVICE_ROLE_CLIENT);
});

describe("triggerReportWorkerChunk", () => {
  it("rejects invalid month format", async () => {
    const res = await triggerReportWorkerChunk({ month: "2026-6" });
    expect(res).toEqual({ success: false, error: "invalid_month" });
    expect(runGuardedMock).not.toHaveBeenCalled();
    expect(createServiceRoleMock).not.toHaveBeenCalled();
  });

  it("rejects non-string month (invalid_input)", async () => {
    // @ts-expect-error runtime validation
    const res = await triggerReportWorkerChunk({ month: 202606 });
    expect(res).toEqual({ success: false, error: "invalid_input" });
  });

  it("rejects when auth unavailable (user null)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await triggerReportWorkerChunk({ month: "2026-06" });
    expect(res).toEqual({ success: false, error: "auth_unavailable" });
    expect(runGuardedMock).not.toHaveBeenCalled();
    expect(createServiceRoleMock).not.toHaveBeenCalled();
  });

  it("rejects when is_admin() false (admin_required) — worker NOT called", async () => {
    rpcMock.mockResolvedValueOnce({ data: false, error: null });
    const res = await triggerReportWorkerChunk({ month: "2026-06" });
    expect(res).toEqual({ success: false, error: "admin_required" });
    expect(runGuardedMock).not.toHaveBeenCalled();
    expect(createServiceRoleMock).not.toHaveBeenCalled();
  });

  it("rejects when is_admin() RPC errors (admin_required, fail-closed)", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "PGRST301" } });
    const res = await triggerReportWorkerChunk({ month: "2026-06" });
    expect(res).toEqual({ success: false, error: "admin_required" });
    expect(runGuardedMock).not.toHaveBeenCalled();
    expect(createServiceRoleMock).not.toHaveBeenCalled();
  });

  it("injects service-role client into runGuardedReportChunk (worker cron-system 전제)", async () => {
    runGuardedMock.mockResolvedValueOnce({
      result: { month: "2026-06", claimed: 1, done: 1, skipped: 0, failed: 0, deferred: 0, remaining: 29, aborted: null },
    });
    const res = await triggerReportWorkerChunk({ month: "2026-06" });
    expect(res).toEqual({
      success: true,
      data: { processed: 1, remaining: 29, aborted: null },
    });
    // service-role client 주입 (session client 아님 — worker 내부 깨짐 방지).
    expect(runGuardedMock).toHaveBeenCalledWith({
      month: "2026-06",
      client: SERVICE_ROLE_CLIENT,
    });
  });

  it("flag-off → worker abortBeforeSpend throw → action error + cost 0 (orchestrate 0회는 worker invariant)", async () => {
    // PR5_CRON_AUTO_ENABLED!==true 시 worker step0가 throw('pr5_cron_auto_disabled').
    runGuardedMock.mockRejectedValueOnce(new Error("pr5_cron_auto_disabled"));
    const res = await triggerReportWorkerChunk({ month: "2026-06" });
    expect(res).toEqual({ success: false, error: "pr5_cron_auto_disabled" });
  });

  it("runGuardedReportChunk skipped(already_running) → {success:true, skipped}", async () => {
    runGuardedMock.mockResolvedValueOnce({ skipped: "already_running" });
    const res = await triggerReportWorkerChunk({ month: "2026-06" });
    expect(res).toEqual({ success: true, skipped: "already_running" });
  });

  it("returns processed = done+skipped+failed + aborted passthrough", async () => {
    runGuardedMock.mockResolvedValueOnce({
      result: { month: "2026-06", claimed: 3, done: 2, skipped: 1, failed: 0, deferred: 27, remaining: 0, aborted: "cost_hardcap" },
    });
    const res = await triggerReportWorkerChunk({ month: "2026-06" });
    expect(res).toEqual({
      success: true,
      data: { processed: 3, remaining: 0, aborted: "cost_hardcap" },
    });
  });
});
