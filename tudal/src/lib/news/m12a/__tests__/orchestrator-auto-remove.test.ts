import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runM12aNewsEvaluation,
  type M12aOrchestratorDeps,
} from "@/lib/news/m12a/orchestrator";
import type { PerTickerAssessment } from "@/lib/news/m12a/types";

type ResolveCashout = NonNullable<M12aOrchestratorDeps["resolveCashout"]>;
type ApplyAutoRemove = NonNullable<M12aOrchestratorDeps["applyAutoRemove"]>;

function autoRemoveAssessment(
  over: Partial<PerTickerAssessment> = {},
): PerTickerAssessment {
  return {
    ticker: "005930",
    surface: "list",
    track: "short",
    scope: "company",
    severity: "critical",
    confidence: "high",
    materiality: "high",
    directness: "direct",
    thesisBreak: true,
    thesisBreakReason: "실적 쇼크로 thesis 붕괴",
    affectedTickers: ["005930"],
    newsEventId: "evt-1",
    newsTitle: "삼성전자 실적 쇼크",
    newsUrl: "https://news/1",
    ...over,
  };
}

function makeHarness(over: Partial<M12aOrchestratorDeps> = {}) {
  const evaluateNews = vi.fn<M12aOrchestratorDeps["evaluateNews"]>(
    async () => [autoRemoveAssessment()],
  );
  const resolveCashout = vi.fn<ResolveCashout>(
    async () => ({ price: 70000, priceBasisDate: "20260625" }),
  );
  const applyAutoRemove = vi.fn<ApplyAutoRemove>(async () => {});
  const insertAssessments = vi.fn<M12aOrchestratorDeps["insertAssessments"]>(
    async () => {},
  );
  const insertAlertEvents = vi.fn<M12aOrchestratorDeps["insertAlertEvents"]>(
    async () => {},
  );
  const sendTelegram = vi.fn<M12aOrchestratorDeps["sendTelegram"]>(
    async () => ({ success: true, mockMode: false }),
  );
  const deps: M12aOrchestratorDeps = {
    month: "2026-06-01",
    runId: "run-1",
    nowIso: "2026-06-26T00:00:00.000Z",
    aiAvailable: true,
    listTrackSizes: { short: 10, midlong: 20, full: 30 },
    portfolioSize: 12,
    evaluateNews,
    resolveCashout,
    applyAutoRemove,
    insertAssessments,
    insertAlertEvents,
    sendTelegram,
    ...over,
  };
  return {
    deps,
    evaluateNews,
    resolveCashout,
    applyAutoRemove,
    insertAssessments,
    insertAlertEvents,
    sendTelegram,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("M12A_NEWS_EVAL_ENABLED", "true");
  vi.stubEnv("M12A_AUTO_REMOVE_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runM12aNewsEvaluation — auto-remove mutation safety", () => {
  it("applyAutoRemove 실패 → removed ledger/alert를 남기지 않고 propagate", async () => {
    const applyAutoRemove = vi.fn<ApplyAutoRemove>(async () => {
      throw new Error("mutation_failed");
    });
    const { deps, insertAssessments, insertAlertEvents, sendTelegram } =
      makeHarness({ applyAutoRemove });
    await expect(runM12aNewsEvaluation(deps)).rejects.toThrow("mutation_failed");
    expect(applyAutoRemove).toHaveBeenCalledTimes(1);
    expect(insertAssessments).not.toHaveBeenCalled();
    expect(insertAlertEvents).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("list+portfolio 동일 ticker 제거는 mutation ticker/cashout을 1회로 dedupe", async () => {
    const bothSurfaces = [
      autoRemoveAssessment({ surface: "list", track: "short" }),
      autoRemoveAssessment({ surface: "portfolio", track: undefined }),
    ];
    const evaluateNews = vi.fn<M12aOrchestratorDeps["evaluateNews"]>(
      async () => bothSurfaces,
    );
    const { deps, resolveCashout, applyAutoRemove, insertAssessments } =
      makeHarness({ evaluateNews });
    const res = await runM12aNewsEvaluation(deps);

    expect(res.removedCount).toBe(1);
    expect(resolveCashout).toHaveBeenCalledTimes(1);
    expect(applyAutoRemove).toHaveBeenCalledTimes(1);
    const firstApplyCall = applyAutoRemove.mock.calls[0];
    if (!firstApplyCall) throw new Error("missing_apply_auto_remove_call");
    const [arg] = firstApplyCall;
    expect(arg.tickers).toEqual(["005930"]);
    expect(arg.cashouts).toHaveLength(1);

    const firstInsertCall = insertAssessments.mock.calls[0];
    if (!firstInsertCall) throw new Error("missing_insert_assessments_call");
    const [rows] = firstInsertCall;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.actionTaken)).toEqual(["removed", "removed"]);
  });
});
