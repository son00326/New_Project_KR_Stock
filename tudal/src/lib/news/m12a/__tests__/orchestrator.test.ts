import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runM12aNewsEvaluation,
  type M12aOrchestratorDeps,
} from "@/lib/news/m12a/orchestrator";
import type { PerTickerAssessment } from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a orchestrator — shadow-first 불변식 + 연결포인트(verdict→brake→ledger→alert) 검증.
// 모든 IO는 mock DI (실 AI/DB/telegram 0 — ₩0).
// ---------------------------------------------------------------------------

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

function alertOnlyAssessment(
  over: Partial<PerTickerAssessment> = {},
): PerTickerAssessment {
  // confidence=medium → auto_remove 게이트 미충족 → alert_only
  return autoRemoveAssessment({
    ticker: "000660",
    confidence: "medium",
    affectedTickers: ["000660"],
    newsEventId: "evt-2",
    newsTitle: "SK하이닉스 전망 하향",
    thesisBreakReason: "전망 하향",
    ...over,
  });
}

function makeDeps(
  over: Partial<M12aOrchestratorDeps> = {},
): M12aOrchestratorDeps & {
  evaluateNews: ReturnType<typeof vi.fn>;
  insertAssessments: ReturnType<typeof vi.fn>;
  insertAlertEvents: ReturnType<typeof vi.fn>;
  sendTelegram: ReturnType<typeof vi.fn>;
  applyAutoRemove: ReturnType<typeof vi.fn>;
  resolveCashout: ReturnType<typeof vi.fn>;
  preflight: ReturnType<typeof vi.fn>;
} {
  return {
    month: "2026-06-01",
    runId: "run-1",
    nowIso: "2026-06-26T00:00:00.000Z",
    aiAvailable: true,
    listTrackSizes: { short: 10, midlong: 20, full: 30 },
    portfolioSize: 12,
    alertsUrl: "/admin/alerts",
    preflight: vi.fn(async () => {}),
    evaluateNews: vi.fn(async () => [autoRemoveAssessment()]),
    resolveCashout: vi.fn(async () => ({ price: 70000, priceBasisDate: "20260625" })),
    applyAutoRemove: vi.fn(async () => {}),
    insertAssessments: vi.fn(async () => {}),
    insertAlertEvents: vi.fn(async () => {}),
    sendTelegram: vi.fn(async () => ({ success: true, mockMode: false })),
    ...over,
  } as never;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runM12aNewsEvaluation — dormancy pins", () => {
  it("M12A_NEWS_EVAL_ENABLED off → skipped(flag_off), 모든 IO 0(mutation/alert/cost/telegram)", async () => {
    // 둘 다 미설정(default)
    const deps = makeDeps();
    const res = await runM12aNewsEvaluation(deps);
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe("flag_off");
    expect(deps.preflight).not.toHaveBeenCalled();
    expect(deps.evaluateNews).not.toHaveBeenCalled();
    expect(deps.insertAssessments).not.toHaveBeenCalled();
    expect(deps.insertAlertEvents).not.toHaveBeenCalled();
    expect(deps.sendTelegram).not.toHaveBeenCalled();
    expect(deps.applyAutoRemove).not.toHaveBeenCalled();
  });

  it("AI 미가용 → skipped(ai_unavailable), IO 0", async () => {
    vi.stubEnv("M12A_NEWS_EVAL_ENABLED", "true");
    const deps = makeDeps({ aiAvailable: false });
    const res = await runM12aNewsEvaluation(deps);
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe("ai_unavailable");
    expect(deps.evaluateNews).not.toHaveBeenCalled();
    expect(deps.insertAssessments).not.toHaveBeenCalled();
  });
});

describe("runM12aNewsEvaluation — shadow phase (eval on, auto-remove off)", () => {
  beforeEach(() => {
    vi.stubEnv("M12A_NEWS_EVAL_ENABLED", "true");
    // M12A_AUTO_REMOVE_ENABLED 미설정 → shadow
  });

  it("auto_remove 후보 → shadowed(would-remove), short_list/portfolio mutation 0", async () => {
    const deps = makeDeps();
    const res = await runM12aNewsEvaluation(deps);

    expect(res.skipped).toBe(false);
    expect(res.shadow).toBe(true);
    expect(res.autoRemoveCandidates).toBe(1);
    expect(res.shadowedCount).toBe(1);
    expect(res.removedCount).toBe(0);

    // ledger 기록은 됨(would-remove 감사)
    expect(deps.insertAssessments).toHaveBeenCalledTimes(1);
    const rows = deps.insertAssessments.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0].actionTaken).toBe("shadowed");
    expect(rows[0].recommendedAction).toBe("auto_remove");
    expect(rows[0].priceBasisDate).toBeNull(); // shadow → 실 청산 없음

    // mutation은 절대 일어나지 않음(shadow 핵심 불변식)
    expect(deps.applyAutoRemove).not.toHaveBeenCalled();
    expect(deps.resolveCashout).not.toHaveBeenCalled();

    // 알림: /admin durable(news_critical) + 텔레그램(shadow 표기)
    expect(deps.insertAlertEvents).toHaveBeenCalledTimes(1);
    const alerts = deps.insertAlertEvents.mock.calls[0][0];
    expect(alerts[0].alertType).toBe("news_critical");
    expect(deps.sendTelegram).toHaveBeenCalledTimes(1);
    const tgText = deps.sendTelegram.mock.calls[0][0] as string;
    expect(tgText).toContain("(shadow)");
    expect(tgText).not.toContain("이메일");
  });

  it("preflight throw → 차단(propagate), 평가/ledger 미진입", async () => {
    const deps = makeDeps({
      preflight: vi.fn(async () => {
        throw new Error("cost_hardcap_exceeded");
      }),
    });
    await expect(runM12aNewsEvaluation(deps)).rejects.toThrow(
      "cost_hardcap_exceeded",
    );
    expect(deps.evaluateNews).not.toHaveBeenCalled();
    expect(deps.insertAssessments).not.toHaveBeenCalled();
  });
});

describe("runM12aNewsEvaluation — auto-remove ON (post-launch fast-follow 경로)", () => {
  beforeEach(() => {
    vi.stubEnv("M12A_NEWS_EVAL_ENABLED", "true");
    vi.stubEnv("M12A_AUTO_REMOVE_ENABLED", "true");
  });

  it("brake pass + cashout 유효 → removed + applyAutoRemove 호출(KRX EOD 가격)", async () => {
    const deps = makeDeps();
    const res = await runM12aNewsEvaluation(deps);

    expect(res.shadow).toBe(false);
    expect(res.removedCount).toBe(1);
    expect(deps.applyAutoRemove).toHaveBeenCalledTimes(1);
    const arg = deps.applyAutoRemove.mock.calls[0][0];
    expect(arg.tickers).toEqual(["005930"]);
    expect(arg.cashouts[0]).toMatchObject({
      ticker: "005930",
      price: 70000,
      priceBasisDate: "20260625",
      priceSource: "KRX_EOD",
      executionAssumption: "virtual_eod",
    });

    const rows = deps.insertAssessments.mock.calls[0][0];
    expect(rows[0].actionTaken).toBe("removed");
    expect(rows[0].priceBasisDate).toBe("20260625");
    expect(rows[0].priceSource).toBe("KRX_EOD");
  });

  it("GAP2 fail-closed: cashout null → shadowed, mutation 미실행", async () => {
    const deps = makeDeps({ resolveCashout: vi.fn(async () => null) });
    const res = await runM12aNewsEvaluation(deps);
    expect(res.removedCount).toBe(0);
    expect(res.shadowedCount).toBe(1);
    expect(deps.applyAutoRemove).not.toHaveBeenCalled();
    const rows = deps.insertAssessments.mock.calls[0][0];
    expect(rows[0].actionTaken).toBe("shadowed");
    expect(rows[0].priceBasisDate).toBeNull();
  });

  it("smart brake(4건 mass) → 전건 held_by_brake, mutation 0, 요약 알림 + 검토 텔레그램", async () => {
    const four = ["005930", "000660", "035720", "051910"].map((t, i) =>
      autoRemoveAssessment({
        ticker: t,
        affectedTickers: [t],
        newsEventId: `evt-${i}`,
        track: "short",
        // short 트랙 4건 제거는 size 10 - 4 = 6 < floor 7 도 위반하지만 mass(>3)로도 트리거
      }),
    );
    const deps = makeDeps({ evaluateNews: vi.fn(async () => four) });
    const res = await runM12aNewsEvaluation(deps);

    expect(res.brakeTriggered).toBe(true);
    expect(res.heldByBrakeCount).toBe(4);
    expect(res.removedCount).toBe(0);
    expect(deps.applyAutoRemove).not.toHaveBeenCalled();

    const rows = deps.insertAssessments.mock.calls[0][0];
    for (const r of rows) {
      expect(r.actionTaken).toBe("held_by_brake");
      expect(r.recommendedAction).toBe("hold_for_review");
      expect(r.heldByBrake).toBe(true);
    }
    // run-level 요약 알림(news_warning, ticker null) + 검토 텔레그램 1건
    const alerts = deps.insertAlertEvents.mock.calls[0][0];
    const summary = alerts.find(
      (a: { ticker: string | null }) => a.ticker === null,
    );
    expect(summary.alertType).toBe("news_warning");
    expect(summary.triggerReason).toContain("대량 제외 감지");
    // per-row news_critical 없음(전건 held)
    expect(
      alerts.some((a: { alertType: string }) => a.alertType === "news_critical"),
    ).toBe(false);
  });
});

describe("runM12aNewsEvaluation — alert_only + attention", () => {
  beforeEach(() => {
    vi.stubEnv("M12A_NEWS_EVAL_ENABLED", "true");
  });

  it("alert_only → news_warning 대시보드 알림만(텔레그램 미발송), action shadowed", async () => {
    const deps = makeDeps({
      evaluateNews: vi.fn(async () => [alertOnlyAssessment()]),
    });
    const res = await runM12aNewsEvaluation(deps);

    expect(res.alertOnlyCount).toBe(1);
    expect(res.autoRemoveCandidates).toBe(0);
    const alerts = deps.insertAlertEvents.mock.calls[0][0];
    expect(alerts[0].alertType).toBe("news_warning");
    // alert_only는 텔레그램 미발송(스팸 방지)
    expect(deps.sendTelegram).not.toHaveBeenCalled();
    const rows = deps.insertAssessments.mock.calls[0][0];
    expect(rows[0].actionTaken).toBe("shadowed");
    expect(rows[0].recommendedAction).toBe("alert_only");
  });

  it("attentionTickers = 평가된 전 종목(사유 포함) — M11 브리핑 입력", async () => {
    const deps = makeDeps({
      evaluateNews: vi.fn(async () => [
        autoRemoveAssessment(),
        alertOnlyAssessment(),
      ]),
    });
    const res = await runM12aNewsEvaluation(deps);
    expect(res.attentionTickers).toEqual([
      { ticker: "005930", reason: "실적 쇼크로 thesis 붕괴" },
      { ticker: "000660", reason: "전망 하향" },
    ]);
  });
});
