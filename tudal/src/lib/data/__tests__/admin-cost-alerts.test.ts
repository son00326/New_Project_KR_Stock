import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitCostAlert } from "@/lib/data/admin-cost-alerts";

const insertAlertEventsMock = vi.fn();

vi.mock("@/lib/data/admin-alerts-insert", () => ({
  insertAlertEvents: (...args: unknown[]) => insertAlertEventsMock(...args),
}));

const fakeClient = { from: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  insertAlertEventsMock.mockResolvedValue(undefined);
});

describe("emitCostAlert", () => {
  it("total below 350k threshold → no alert", async () => {
    await emitCostAlert(
      {
        month: "2026-06",
        currentTotalKrw: 100_000,
        projectedKrw: 249_999,
      },
      { client: fakeClient as never },
    );

    expect(insertAlertEventsMock).not.toHaveBeenCalled();
  });

  it("350k <= total <= 400k → cost_warning / warning", async () => {
    await emitCostAlert(
      {
        month: "2026-06",
        currentTotalKrw: 340_000,
        projectedKrw: 10_000,
      },
      { client: fakeClient as never },
    );

    expect(insertAlertEventsMock).toHaveBeenCalledTimes(1);
    const [events, options] = insertAlertEventsMock.mock.calls[0];
    expect(events[0]).toMatchObject({
      alertType: "cost_warning",
      severity: "warning",
      ticker: null,
    });
    expect(options.client).toBe(fakeClient);
  });

  it("total > 400k → cost_hardcap / critical", async () => {
    await emitCostAlert(
      {
        month: "2026-06",
        currentTotalKrw: 399_000,
        projectedKrw: 1_001,
      },
      { client: fakeClient as never },
    );

    expect(insertAlertEventsMock).toHaveBeenCalledTimes(1);
    const [events] = insertAlertEventsMock.mock.calls[0];
    expect(events[0]).toMatchObject({
      alertType: "cost_hardcap",
      severity: "critical",
      ticker: null,
    });
  });
});
