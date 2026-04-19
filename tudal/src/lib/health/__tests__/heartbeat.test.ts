import { describe, expect, it } from "vitest";
import {
  buildHeartbeatEmailSubject,
  buildHeartbeatMessage,
  buildHeartbeatMissingAlert,
  classifyHeartbeat,
  toHeartbeatLogRecord,
} from "@/lib/health/heartbeat";
import type { AlertEvent, PipelineHealth } from "@/types/admin";

const REF_NOW = new Date("2026-04-19T12:00:00Z");

function pipeline(
  pipeline: PipelineHealth["pipeline"],
  status: PipelineHealth["status"],
  hoursAgo = 1,
): PipelineHealth {
  return {
    id: `p-${pipeline}-${hoursAgo}`,
    runId: null,
    pipeline,
    status,
    startedAt: new Date(REF_NOW.getTime() - hoursAgo * 3600 * 1000).toISOString(),
    finishedAt: new Date(
      REF_NOW.getTime() - hoursAgo * 3600 * 1000 + 1000,
    ).toISOString(),
    latencyMs: 1000,
    error: status === "failed" ? "test error" : null,
  };
}

function alert(severity: AlertEvent["severity"], hoursAgo = 1): AlertEvent {
  return {
    id: `a-${severity}-${hoursAgo}`,
    alertType: "news_critical",
    ticker: null,
    severity,
    triggerReason: "test",
    signalSentAt: new Date(REF_NOW.getTime() - hoursAgo * 3600 * 1000).toISOString(),
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: false,
  };
}

// 5개 파이프라인 모두 success 1건씩 — 100% 정상
const HEALTHY_5: PipelineHealth[] = [
  pipeline("dart", "success"),
  pipeline("news", "success"),
  pipeline("price", "success"),
  pipeline("ai", "success"),
  pipeline("alert", "success"),
];

describe("classifyHeartbeat", () => {
  it("모든 파이프라인 정상 + Critical 0건 → status=ok", () => {
    const c = classifyHeartbeat({
      date: "2026-04-19",
      pipelineHealth: HEALTHY_5,
      recentAlerts: [],
      referenceNow: REF_NOW,
    });
    expect(c.status).toBe("ok");
    expect(c.criticalAlertCount).toBe(0);
    expect(c.pipelineSummary).toHaveLength(5);
  });

  it("Critical AlertEvent 1건 → status=red_alert", () => {
    const c = classifyHeartbeat({
      date: "2026-04-19",
      pipelineHealth: HEALTHY_5,
      recentAlerts: [alert("critical")],
      referenceNow: REF_NOW,
    });
    expect(c.status).toBe("red_alert");
    expect(c.criticalAlertCount).toBe(1);
  });

  it("Warning 5건 → status=red_alert", () => {
    const c = classifyHeartbeat({
      date: "2026-04-19",
      pipelineHealth: HEALTHY_5,
      recentAlerts: [
        alert("warning"),
        alert("warning"),
        alert("warning"),
        alert("warning"),
        alert("warning"),
      ],
      referenceNow: REF_NOW,
    });
    expect(c.status).toBe("red_alert");
    expect(c.warningAlertCount).toBe(5);
  });

  it("Warning 4건은 임계 미만 → status=ok", () => {
    const c = classifyHeartbeat({
      date: "2026-04-19",
      pipelineHealth: HEALTHY_5,
      recentAlerts: [alert("warning"), alert("warning"), alert("warning"), alert("warning")],
      referenceNow: REF_NOW,
    });
    expect(c.status).toBe("ok");
  });

  it("파이프라인 critical 1건이면 status=red_alert", () => {
    const failures: PipelineHealth[] = [
      ...HEALTHY_5,
      pipeline("news", "failed"),
      pipeline("news", "failed"), // 2/3 실패 → 33% 성공률 → critical
    ];
    const c = classifyHeartbeat({
      date: "2026-04-19",
      pipelineHealth: failures,
      recentAlerts: [],
      referenceNow: REF_NOW,
    });
    expect(c.status).toBe("red_alert");
    const newsSummary = c.pipelineSummary.find((p) => p.pipeline === "news")!;
    expect(newsSummary.severity).toBe("critical");
  });
});

describe("buildHeartbeatMessage", () => {
  it("ok 상태는 '오늘 이상 없음' 포함", () => {
    const c = classifyHeartbeat({
      date: "2026-04-19",
      pipelineHealth: HEALTHY_5,
      recentAlerts: [],
      referenceNow: REF_NOW,
    });
    const msg = buildHeartbeatMessage(c, "2026-04-19");
    expect(msg).toContain("오늘 이상 없음");
    expect(msg).toContain("2026-04-19");
  });

  it("red_alert 상태는 '적색 경보' + 이슈 라인 포함", () => {
    const c = classifyHeartbeat({
      date: "2026-04-19",
      pipelineHealth: HEALTHY_5,
      recentAlerts: [alert("critical")],
      referenceNow: REF_NOW,
    });
    const msg = buildHeartbeatMessage(c, "2026-04-19");
    expect(msg).toContain("적색 경보");
    expect(msg).toContain("Critical 알림");
  });
});

describe("buildHeartbeatEmailSubject", () => {
  it("ok와 red_alert subject 분기", () => {
    expect(buildHeartbeatEmailSubject("ok", "2026-04-19")).toContain("이상 없음");
    expect(buildHeartbeatEmailSubject("red_alert", "2026-04-19")).toContain(
      "적색 경보",
    );
  });
});

describe("toHeartbeatLogRecord", () => {
  it("DB 적재 페이로드 생성", () => {
    const c = classifyHeartbeat({
      date: "2026-04-19",
      pipelineHealth: HEALTHY_5,
      recentAlerts: [],
      referenceNow: REF_NOW,
    });
    const rec = toHeartbeatLogRecord(c, "2026-04-19", "msg", ["telegram"], false);
    expect(rec.date).toBe("2026-04-19");
    expect(rec.status).toBe("ok");
    expect(rec.sentChannels).toEqual(["telegram"]);
    expect(rec.sendFailed).toBe(false);
    expect(rec.message).toBe("msg");
  });
});

describe("buildHeartbeatMissingAlert", () => {
  it("heartbeat_missing alertType + critical severity", () => {
    const a = buildHeartbeatMissingAlert("2026-04-19", "telegram timeout");
    expect(a.alertType).toBe("heartbeat_missing");
    expect(a.severity).toBe("critical");
    expect(a.triggerReason).toContain("2026-04-19");
    expect(a.triggerReason).toContain("telegram timeout");
  });
});
