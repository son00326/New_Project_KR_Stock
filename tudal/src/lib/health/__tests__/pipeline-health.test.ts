// pipeline-health.test.ts — M18 집계 단위 테스트 (S5a T5a.4)
import { describe, it, expect } from "vitest";
import {
  aggregatePipelineHealth,
  overallSeverity,
  recentFailures,
  severityFromRate,
  KNOWN_PIPELINES,
} from "../pipeline-health";
import type { PipelineHealth, PipelineKind } from "@/types/admin";

function record(
  pipeline: PipelineKind,
  status: PipelineHealth["status"],
  minutesAgo: number,
  latencyMs = 100,
  idSuffix = "",
): PipelineHealth {
  const startedAt = new Date(
    Date.now() - minutesAgo * 60 * 1000,
  ).toISOString();
  return {
    id: `${pipeline}-${status}-${minutesAgo}${idSuffix}`,
    runId: null,
    pipeline,
    status,
    startedAt,
    finishedAt: new Date(
      Date.now() - minutesAgo * 60 * 1000 + latencyMs,
    ).toISOString(),
    latencyMs,
    error: status === "failed" ? "mock error" : null,
  };
}

describe("severityFromRate", () => {
  it("성공률 0.94 → critical (< 0.95)", () => {
    expect(severityFromRate(0.94)).toBe("critical");
  });
  it("성공률 0.95 → warning (경계: < 0.99)", () => {
    expect(severityFromRate(0.95)).toBe("warning");
  });
  it("성공률 0.989 → warning", () => {
    expect(severityFromRate(0.989)).toBe("warning");
  });
  it("성공률 1.0 → info", () => {
    expect(severityFromRate(1.0)).toBe("info");
  });
});

describe("aggregatePipelineHealth", () => {
  it("윈도우 외 레코드 제외", () => {
    const records: PipelineHealth[] = [
      record("dart", "success", 30),
      record("dart", "success", 30, 100, "b"),
      record("dart", "success", 25 * 60), // 25h 전 — 윈도우 밖
    ];
    const summaries = aggregatePipelineHealth(records);
    const dart = summaries.find((s) => s.pipeline === "dart")!;
    expect(dart.total24h).toBe(2);
    expect(dart.successRate).toBe(1);
  });

  it("실패 포함 성공률 계산", () => {
    const records: PipelineHealth[] = [
      record("alert", "success", 10),
      record("alert", "success", 20, 100, "b"),
      record("alert", "success", 30, 100, "c"),
      record("alert", "failed", 40, 100, "d"),
    ];
    const summaries = aggregatePipelineHealth(records);
    const alert = summaries.find((s) => s.pipeline === "alert")!;
    expect(alert.total24h).toBe(4);
    expect(alert.success24h).toBe(3);
    expect(alert.failed24h).toBe(1);
    expect(alert.successRate).toBe(0.75);
    expect(alert.severity).toBe("critical"); // 75% < 95%
  });

  it("레코드 0건인 파이프라인은 warning(미확인)", () => {
    const summaries = aggregatePipelineHealth([]);
    expect(summaries).toHaveLength(KNOWN_PIPELINES.length);
    summaries.forEach((s) => {
      expect(s.total24h).toBe(0);
      expect(s.severity).toBe("warning");
    });
  });

  it("lastRun은 최근 시작순 첫 번째", () => {
    const recent = record("news", "success", 5);
    const older = record("news", "success", 60, 100, "o");
    const summaries = aggregatePipelineHealth([older, recent]);
    const news = summaries.find((s) => s.pipeline === "news")!;
    expect(news.lastRun?.id).toBe(recent.id);
  });
});

describe("recentFailures", () => {
  it("실패만 반환 · 최신순 · limit 적용", () => {
    const records: PipelineHealth[] = [
      record("alert", "success", 5),
      record("alert", "failed", 10, 100, "a"),
      record("alert", "failed", 20, 100, "b"),
      record("alert", "failed", 30, 100, "c"),
    ];
    const f = recentFailures(records, 2);
    expect(f).toHaveLength(2);
    expect(f[0].id).toContain("10"); // 가장 최근 실패
  });
});

describe("overallSeverity", () => {
  it("하나라도 critical이면 critical", () => {
    const summaries = aggregatePipelineHealth([
      record("alert", "failed", 10),
      record("alert", "failed", 20, 100, "b"),
      record("dart", "success", 10, 100, "c"),
    ]);
    expect(overallSeverity(summaries)).toBe("critical");
  });

  it("critical 없고 warning만 → warning", () => {
    // 데이터 0건 파이프라인이 있으면 warning이 됨
    const summaries = aggregatePipelineHealth([
      record("dart", "success", 10),
    ]);
    // 나머지 4개 파이프라인은 total=0 → warning
    expect(overallSeverity(summaries)).toBe("warning");
  });
});
