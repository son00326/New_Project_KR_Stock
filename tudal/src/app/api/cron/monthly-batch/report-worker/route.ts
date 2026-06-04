// PR5 — cron monthly-batch report-worker route.
// plan SoT: docs/superpowers/plans/2026-05-29-pr5-cron-monthly-batch-auto.md (omxy R1~R4 17 catch fix).
//
// 책임: auth(CRON_SECRET) → PR5_CRON_AUTO_ENABLED gate(200 skip) → 전용 run-mutex acquire(run_id)
//   → 1 chunk 처리(full-report-batch-worker) → release(run_id fencing) → optional self-continue.
// selection cron(../route.ts)과 분리 — selection의 batch-run lock 미공유, 전용 run-mutex 사용(R2 HIGH-1).
// chunk-advance primary = DAILY cron(vercel.json). self-continue는 env-gated optional accelerator(load-bearing 아님, R1).
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runGuardedReportChunk } from "@/lib/report/full-report-batch-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// monthly-batch/route.ts:23-40 패턴 복제 (4 cron route 동일 auth).
function isProductionLikeForAuth(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return !isProductionLikeForAuth();
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function currentMonthYM(): string {
  const now = new Date();
  const m = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  return `${now.getUTCFullYear()}-${m}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // flag gate: dormant 시 200 skip (502 아님 — dormant ≠ failure, mutex 미취득, spend 0).
  if (process.env.PR5_CRON_AUTO_ENABLED !== "true") {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "pr5_cron_auto_disabled" },
      { status: 200 },
    );
  }

  const month = currentMonthYM();

  // 전용 run-mutex(R2 HIGH-1) + chunk + release(run_id fencing R3 MEDIUM-1) — 공용 guarded entry.
  let guarded;
  try {
    const supabase = createServiceRoleClient();
    guarded = await runGuardedReportChunk({ month, client: supabase });
  } catch (err) {
    const code = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: code }, { status: 502 });
  }

  if (guarded.skipped) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: guarded.skipped },
      { status: 200 },
    );
  }
  const result = guarded.result!;

  // W2a Task 9.5 (R3 HIGH-2): worker가 shortlist<30 not-ready 반환 → 502 false-alarm 대신 200 clean skip.
  if (result.notReady) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: result.notReady.reason },
      { status: 200 },
    );
  }

  // optional self-continue accelerator (env-gated, load-bearing 아님 — R1/MEDIUM-3).
  // waitUntil/after 취소 가능 → 정확성은 daily cron + idempotent claim에 의존. 기본 off.
  // OPS-3: forward-progress gate — claimed>0일 때만 self-continue. claimed=0 + remaining>0은
  // 남은 row가 모두 non-stale 'running'(직전 crash mid-flight, <10min job-stale)이라는 뜻이고,
  // 즉시 재호출하면 10min job-stale window 전까지 zero-progress tight-loop가 된다. 그 reclaim은
  // load-bearing daily cron이 처리하므로, madeProgress 게이트로 낭비 루프를 차단한다.
  const madeProgress = result.claimed > 0;
  const hasMore =
    result.remaining > 0 && result.aborted === null && madeProgress;
  if (hasMore && process.env.PR5_CRON_SELF_CONTINUE === "true") {
    const secret = process.env.CRON_SECRET;
    const selfUrl = new URL(
      request.nextUrl.pathname,
      request.nextUrl.origin,
    ).toString();
    after(async () => {
      try {
        await fetch(selfUrl, {
          headers: secret ? { authorization: `Bearer ${secret}` } : {},
        });
      } catch {
        // best-effort — 실패해도 daily cron이 다음 chunk advance (idempotent).
      }
    });
    return NextResponse.json(
      { ok: true, continued: true, result },
      { status: 202 },
    );
  }

  return NextResponse.json({ ok: true, result }, { status: 200 });
}
