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
import {
  runGuardedSelectionChunk,
  type GuardedSelectionChunkOutput,
} from "@/lib/screening/tier1-selection-batch-worker";
import { getTier0Candidates } from "@/lib/data/admin-tier0-candidates";
import {
  getIncumbents,
  buildIncumbentThesisContexts,
} from "@/lib/data/admin-shortlist-incumbents";
import {
  currentShortPeriodKey,
  currentMidlongPeriodKey,
  isShortDue,
  isMidlongDue,
  monthYMOfPeriod,
} from "@/lib/screening/selection-period";
import type { SelectionTrack } from "@/lib/screening/tier1-schema";
import {
  makeCallPersonaPanel,
  makeCallDebatePanel,
} from "@/lib/screening/persona-panel-adapter";
import { resolveTier1PanelSlot } from "@/lib/ai/model-registry";
import { callJudge, callDualJudge } from "@/lib/ai/judge-client";
import { renderPeerArguments } from "@/lib/ai/prompts/debate-round-template";
import type { PersonaScore } from "@/lib/screening/tier1-schema";
import { CORE_11_PERSONAS } from "@/lib/ai/prompts/personas";
import { callPersona } from "@/lib/ai/anthropic-client";
import { fetchFinancialsSummary } from "@/lib/data/dart-financials";
import { preflightHardcap, getMonthlyTotal } from "@/lib/cost/cost-logger";
import { upsertShortListTrack } from "@/lib/data/admin-shortlist-persist";
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

// now seam — 테스트만 `?now=<ISO>` 주입(결정성). 운영은 무인자 → new Date().
//   유효하지 않은 값이면 무시(현재 시각). due-gate/period_key는 KST=UTC+9로 selection-period가 보정.
function resolveNow(request: NextRequest): Date {
  const raw = request.nextUrl.searchParams.get("now");
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

// 트랙별 chunk 결과 보고(부분실패 격리 — 한 트랙 throw가 다른 트랙·전체를 막지 않음, R3 MED-5).
interface TrackOutcome {
  track: SelectionTrack;
  ok: boolean;
  skipped?: GuardedSelectionChunkOutput["skipped"];
  result?: NonNullable<GuardedSelectionChunkOutput["result"]>;
  error?: string;
}

// W1b — judge 입력 패널 요약: persona_id → Core 11 label 매핑 (미상 id는 id 그대로).
function renderJudgePanelSummary(finalPanel: readonly PersonaScore[]): string {
  const labelById = new Map(CORE_11_PERSONAS.map((p) => [p.id, p.label]));
  return renderPeerArguments(
    finalPanel.map((score) => ({
      label: labelById.get(score.persona_id) ?? score.persona_id,
      score,
    })),
  );
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

  // W2a Task 9 — KST due-gate(Hobby-safe daily 단일 route): 월요일=short / 매월1일=midlong.
  //   둘 다 due(1일=월요일)면 순차 2회 — 각 독립 period_key라 트랙별 독립 run-mutex.
  const now = resolveNow(request);
  const dueTracks: { track: SelectionTrack; periodKey: string; month: string }[] =
    [];
  if (isShortDue(now)) {
    const periodKey = currentShortPeriodKey(now);
    dueTracks.push({ track: "short", periodKey, month: monthYMOfPeriod(periodKey) });
  }
  if (isMidlongDue(now)) {
    const periodKey = currentMidlongPeriodKey(now);
    dueTracks.push({
      track: "midlong",
      periodKey,
      month: monthYMOfPeriod(periodKey),
    });
  }

  // 둘 다 not due → 200 no-op (mutex 미취득, spend 0).
  if (dueTracks.length === 0) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "no_track_due" },
      { status: 200 },
    );
  }

  const cronSystemUserId = process.env.CRON_SYSTEM_USER_ID ?? "";
  const supabase = createServiceRoleClient();

  // per-track try/catch/continue — 한 트랙 실패가 다른 트랙을 막지 않음(부분실패 보고, 전체 502 단일화 금지).
  const outcomes: TrackOutcome[] = [];
  for (const t of dueTracks) {
    try {
      const guarded = await runGuardedSelectionChunk({
        month: t.month,
        track: t.track,
        periodKey: t.periodKey,
        client: supabase,
        promptVersionId:
          process.env.PROMPT_VERSION_ID ?? "render-user-prompt@v1",
        personasVersionId: process.env.PERSONAS_VERSION_ID ?? "core11@v3.1",
        tier0Source: (opts) =>
          getTier0Candidates({ track: t.track, ...opts }),
        // W2b (D27 Q5) — incumbent union + per-ticker thesis context (service-role client 경유).
        incumbentsSource: (opts) => getIncumbents(opts),
        buildIncumbentContexts: (incumbents, opts) =>
          buildIncumbentThesisContexts(incumbents, opts),
        // 실 Core 11 panel (PR-C 어댑터). costClient=service-role → callPersona가 cost_log INSERT 가능.
        //   adminUserId=CRON_SYSTEM_USER_ID(검증된 UUID) → cost_log.called_by FK 통과. step-0 off면 미도달.
        callPersonaPanel: makeCallPersonaPanel({
          callPersona,
          personas: CORE_11_PERSONAS,
          reflectionContext: "",
          adminUserId: cronSystemUserId,
          costClient: supabase,
          // W1a (D28 ①) — per-slot 모델 mix (Sonnet×6 + GPT mid×5, GPT-off 시 전원 Sonnet).
          slotResolver: resolveTier1PanelSlot,
        }),
        // W1a (D26 Q4) — R2 반박 라운드 패널 (R1 panel + peer 컨텍스트 주입).
        callDebatePanel: makeCallDebatePanel({
          callPersona,
          personas: CORE_11_PERSONAS,
          reflectionContext: "",
          adminUserId: cronSystemUserId,
          costClient: supabase,
          slotResolver: resolveTier1PanelSlot,
        }),
        // W1b (D28 ③) — per-ticker 최종 judge(Opus) + 경계 dual-judge(GPT↔Opus auto-detect).
        //   패널 요약 = renderPeerArguments(11명 전원, persona label — slot 모델 비노출).
        callJudgePanel: ({ ticker, month, track, finalPanel, reflectionContext }) =>
          callJudge({
            ticker,
            month,
            track,
            panelSummary: renderJudgePanelSummary(finalPanel),
            reflectionContext,
            adminUserId: cronSystemUserId,
            costClient: supabase,
          }),
        callDualJudge: ({ ticker, month, track, finalPanel, reflectionContext }) =>
          callDualJudge({
            ticker,
            month,
            track,
            panelSummary: renderJudgePanelSummary(finalPanel),
            reflectionContext,
            adminUserId: cronSystemUserId,
            costClient: supabase,
          }),
        fetchFinancials: (ticker) =>
          fetchFinancialsSummary(ticker, { client: supabase }),
        preflightHardcap,
        getMonthlyTotal,
        // persist는 finalize에서만 도달. rolling writer(트랙별 in-place 교체) + commentsByTicker 라우팅.
        persist: (m, tr, selected, options) =>
          upsertShortListTrack(m, tr, selected, options),
        // finalize replay seam — 저장된 panel_result로 글로벌 rank/select 1회 (LLM 0콜).
        runScreening: runTier1Screening,
        insertPipelineHealth,
        insertAlertEvents,
        emitCostAlert,
      });
      if (guarded.skipped) {
        outcomes.push({ track: t.track, ok: true, skipped: guarded.skipped });
      } else {
        outcomes.push({ track: t.track, ok: true, result: guarded.result! });
      }
    } catch (err) {
      outcomes.push({
        track: t.track,
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  // optional self-continue accelerator (env-gated, load-bearing 아님).
  // OPS-3: forward-progress gate — claimed>0 또는 R2/judge enqueue 진행(remaining>0·미abort)일 때만 self-continue.
  //   per-track 분기 후엔 어느 due 트랙이라도 forward-progress 있으면 1회 self-continue(다음 chunk advance).
  const hasMore = outcomes.some(
    (o) =>
      o.result !== undefined &&
      o.result.remaining > 0 &&
      o.result.aborted === null &&
      (o.result.claimed > 0 || o.result.r2Enqueued > 0 || o.result.judgeEnqueued > 0),
  );
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
      { ok: true, continued: true, tracks: outcomes },
      { status: 202 },
    );
  }

  // 전체 ok = 모든 due 트랙 성공(skip 포함). 일부 실패해도 200 + 트랙별 보고(전체 502 단일화 금지).
  const ok = outcomes.every((o) => o.ok);
  return NextResponse.json({ ok, tracks: outcomes }, { status: 200 });
}
