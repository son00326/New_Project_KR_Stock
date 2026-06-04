// Tier1 selection chunk worker — cron monthly-batch selection-worker route.
// PR5 report-worker/route.ts 패턴 복제 + monthly-batch/route.ts DI 배선.
//
// 책임: auth(CRON_SECRET) → SELECTION_CRON_AUTO_ENABLED gate(200 skip) → 전용 run-mutex acquire(run_id)
//   → 1 chunk 처리(tier1-selection-batch-worker) → release(run_id fencing) → optional self-continue.
// 단발 monthly-batch cron(../route.ts)과 분리 — monthly_batch_runs / acquire_batch_lock_v2 미공유, 전용 run-mutex(0027 R2 HIGH-1).
// chunk-advance primary = DAILY cron(vercel.json). self-continue는 env-gated optional accelerator(load-bearing 아님).
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runGuardedSelectionChunk } from "@/lib/screening/tier1-selection-batch-worker";
import { getTier0Candidates } from "@/lib/data/admin-tier0-candidates";
import { makeCallPersonaPanel } from "@/lib/screening/persona-panel-adapter";
import { CORE_11_PERSONAS } from "@/lib/ai/prompts/personas";
import { callPersona } from "@/lib/ai/anthropic-client";
import { fetchFinancialsSummary } from "@/lib/data/dart-financials";
import { preflightHardcap, getMonthlyTotal } from "@/lib/cost/cost-logger";
import { upsertShortList30 } from "@/lib/data/admin-shortlist-persist";
import { runTier1Screening } from "@/lib/screening/persona-eval";
import { insertPipelineHealth } from "@/lib/data/admin-pipeline-health-insert";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
import { emitCostAlert } from "@/lib/data/admin-cost-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// monthly-batch/route.ts 패턴 복제 (cron route 동일 auth).
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
  if (process.env.SELECTION_CRON_AUTO_ENABLED !== "true") {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "selection_cron_auto_disabled" },
      { status: 200 },
    );
  }

  const month = currentMonthYM();
  const cronSystemUserId = process.env.CRON_SYSTEM_USER_ID ?? "";

  // 전용 run-mutex(0027 R2 HIGH-1) + chunk + release(run_id fencing) — 공용 guarded entry.
  let guarded;
  try {
    const supabase = createServiceRoleClient();
    guarded = await runGuardedSelectionChunk({
      month,
      client: supabase,
      promptVersionId: process.env.PROMPT_VERSION_ID ?? "render-user-prompt@v1",
      personasVersionId: process.env.PERSONAS_VERSION_ID ?? "core11@v3.1",
      // W2a Task 7 — getTier0Candidates track 필수화. 본 route는 dormant(SELECTION_CRON_AUTO_ENABLED off)
      //   + Task 8/9에서 period_key/track due-gate로 전면 재작성 예정. 현재는 Tier0Source 시그니처({month,client})
      //   정합을 위한 compile-only 어댑터 (orchestrator track:'midlong' 정합). 활성 path 무회귀(dormant).
      tier0Source: (opts) => getTier0Candidates({ track: "midlong", ...opts }),
      // 실 Core 11 panel (PR-C 어댑터). costClient=service-role → callPersona가 cost_log INSERT 가능.
      //   adminUserId=CRON_SYSTEM_USER_ID(검증된 UUID) → cost_log.called_by FK 통과. step-0 off면 미도달.
      callPersonaPanel: makeCallPersonaPanel({
        callPersona,
        personas: CORE_11_PERSONAS,
        reflectionContext: "",
        adminUserId: cronSystemUserId,
        costClient: supabase,
      }),
      fetchFinancials: (ticker) =>
        fetchFinancialsSummary(ticker, { client: supabase }),
      preflightHardcap,
      getMonthlyTotal,
      // persist는 finalize(150/150)에서만 도달. service-role + commentsByTicker 라우팅.
      persist: (m, selected, options) =>
        upsertShortList30(m, selected, options),
      // finalize replay seam — 저장된 panel_result로 글로벌 rank/select 1회 (LLM 0콜).
      runScreening: runTier1Screening,
      insertPipelineHealth,
      insertAlertEvents,
      emitCostAlert,
    });
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

  // optional self-continue accelerator (env-gated, load-bearing 아님).
  // OPS-3: forward-progress gate — claimed>0일 때만 self-continue (zero-progress tight-loop 차단).
  // remaining=0(finalize 포함)이면 self-continue 안 함.
  const madeProgress = result.claimed > 0;
  const hasMore =
    result.remaining > 0 && result.aborted === null && madeProgress;
  if (hasMore && process.env.SELECTION_CRON_SELF_CONTINUE === "true") {
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
