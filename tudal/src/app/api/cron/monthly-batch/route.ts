import { NextResponse, type NextRequest } from "next/server";
import {
  buildSchedulerFailAlert,
  runMonthlyBatch,
  type BatchStep,
} from "@/lib/scheduler/monthly-batch";

// Vercel Cron 매월 day 1 00:05 UTC (= 09:05 KST). ServicePlan-Admin §3.10 R3.10-1.
// 실데이터 전환 시 KST 00:05로 미세 조정(UTC 15:05 last-day 패턴) 필요 — 현재 mock 단계에서는 day 1 09:05 KST 허용.
// 인증: Authorization: Bearer <CRON_SECRET> (Vercel Cron이 자동 주입).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // dev/mock 환경: secret 미설정 시 통과 (배포 전 반드시 세팅)
    return process.env.NODE_ENV !== "production";
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

// mock-mode 기본 스텝 — 실데이터 전환 시 각 run 함수에 실 I/O 주입.
function buildMockSteps(): BatchStep[] {
  return [
    {
      name: "screening",
      pipeline: "dart",
      run: async () => ({ success: true, meta: { tickers: 30 } }),
    },
    {
      name: "shortlist-insert",
      pipeline: "dart",
      run: async () => ({ success: true, meta: { inserted: 30 } }),
    },
    {
      name: "report-generate",
      pipeline: "ai",
      run: async () => ({ success: true, meta: { reports: 5 } }),
    },
    {
      name: "alert-broadcast",
      pipeline: "alert",
      run: async () => ({ success: true }),
    },
  ];
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const steps = buildMockSteps();
  const outcome = await runMonthlyBatch(steps, {
    sleep: () => Promise.resolve(), // mock-mode: 즉시
    maxAttempts: 3,
  });

  // 실 적재는 실데이터 전환 시: Supabase INSERT pipeline_health + alert_event
  const alertToEmit = outcome.overallSuccess ? null : buildSchedulerFailAlert(outcome);

  return NextResponse.json({
    ok: outcome.overallSuccess,
    runId: outcome.runId,
    steps: outcome.steps.map((s) => ({
      name: s.name,
      pipeline: s.pipeline,
      success: s.success,
      attempts: s.attempts,
      latencyMs: s.latencyMs,
      error: s.error,
    })),
    alertEmitted: alertToEmit?.triggerReason ?? null,
  });
}
