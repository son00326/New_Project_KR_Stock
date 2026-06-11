// Tier1 selection chunk worker — cron monthly-batch selection-worker route.
// PR5 report-worker/route.ts 패턴 복제 + monthly-batch/route.ts DI 배선.
//
// 책임: auth(CRON_SECRET) → SELECTION_CRON_AUTO_ENABLED gate(200 skip) → 전용 run-mutex acquire(run_id)
//   → 1 chunk 처리(tier1-selection-batch-worker) → release(run_id fencing) → self-continue.
// 단발 monthly-batch cron(../route.ts)과 분리 — monthly_batch_runs / acquire_batch_lock_v2 미공유, 전용 run-mutex(0027 R2 HIGH-1).
//
// B-SEL-CRON (74차 배선감사 catch → fix):
//   (1) period-scoped due-gate — 구 날짜-단발 gate(short=월요일/midlong=1일)는 chunk 3 × daily 1회로는
//       한 period를 finalize 못 하고 차주 새 period_key가 기존 period를 고아화(silent spend·산출 0).
//       → 트랙별 "현재 period"는 window 내내(주/월) due. 미finalize면 daily cron이 계속 chunk-advance,
//       finalize 후엔 acquire의 finalized_at null-guard가 null 반환(already_finalized cheap no-op).
//   (2) SELF_CONTINUE 기본 ON(opt-out) — daily 단독 3 jobs/day로는 period당 ~130 jobs(R1+R2+judge)를
//       window 내 완주 불가 → after() self-continue는 운영 viability상 load-bearing accelerator.
//       명시 "false"(디버그 전용)면 off + 미완 period stall alert로 가시화.
//   (3) 고아 period sweep — 최근 14일 내 시작·미finalize·현재 period 아님 run row → scheduler_fail
//       warning alert (silent spend 방지 2층). 수동 재개 = `?now=<해당 window 내 ISO>` + CRON_SECRET 재호출.
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

// now seam — 테스트는 `?now=<ISO>` 주입(결정성). 운영은 무인자 → new Date().
//   유효하지 않은 값이면 무시(현재 시각). period_key는 KST=UTC+9로 selection-period가 보정.
//   운영 수동 재개 경로: 고아 period(미finalize·window 경과)는 해당 window 내 ISO를 `?now=`로
//   넘겨 CRON_SECRET와 함께 재호출하면 같은 period_key로 이어서 진행된다.
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

  // B-SEL-CRON (1) — period-scoped due-gate: 두 트랙 모두 "현재 period"로 매일 진행.
  //   short = 그 주 KST 월요일 키(주 내내 동일) / midlong = 그 달 키(월 내내 동일).
  //   미finalize period는 자연히 계속 due가 되고, finalize 후엔 acquire null-guard가 cheap no-op.
  //   순차 2회 — 각 독립 period_key라 트랙별 독립 run-mutex.
  const now = resolveNow(request);
  const shortPeriodKey = currentShortPeriodKey(now);
  const midlongPeriodKey = currentMidlongPeriodKey(now);
  const dueTracks: { track: SelectionTrack; periodKey: string; month: string }[] = [
    {
      track: "short",
      periodKey: shortPeriodKey,
      month: monthYMOfPeriod(shortPeriodKey),
    },
    {
      track: "midlong",
      periodKey: midlongPeriodKey,
      month: monthYMOfPeriod(midlongPeriodKey),
    },
  ];

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

  // B-SEL-CRON (3) — 고아 period sweep: 최근 14일 내 시작됐고 미finalize인데 현재 period가
  //   아닌 run row = 이미 spend가 발생했는데 산출 0으로 중단된 period. scheduler_fail warning으로
  //   가시화 (resume는 수동 `?now=` 재호출). best-effort — 실패해도 본 응답을 막지 않는다.
  const currentPeriodKeys = new Set([shortPeriodKey, midlongPeriodKey]);
  try {
    const sinceIso = new Date(now.getTime() - 14 * 86400000).toISOString();
    const { data: openRuns, error: openRunsErr } = await supabase
      .from("tier1_selection_run")
      .select("period_key, track, created_at")
      .is("finalized_at", null)
      .gt("created_at", sinceIso);
    if (openRunsErr) {
      throw new Error(`orphan_sweep_select_failed:${openRunsErr.code ?? "unknown"}`);
    }
    const orphans = (openRuns ?? []).filter(
      (r) => !currentPeriodKeys.has(r.period_key),
    );
    if (orphans.length > 0) {
      const keys = orphans.map((r) => r.period_key).join(",");
      console.error(
        JSON.stringify({
          event: "selection_period_orphaned",
          periodKeys: keys,
          hint: "manual resume = GET this route with ?now=<ISO within that window> + CRON_SECRET",
        }),
      );
      const nowIso = new Date().toISOString();
      await insertAlertEvents(
        [
          {
            alertType: "scheduler_fail",
            ticker: null,
            severity: "warning",
            triggerReason: `selection period orphaned (미finalize 중단): ${keys} — 수동 재개 = 해당 window 내 ?now= 재호출`,
            signalSentAt: nowIso,
            outcomeAt: null,
            t7PriceChange: null,
            decisionRecorded: null,
            decisionMemo: null,
          },
        ],
        { client: supabase },
      );
    }
  } catch (sweepErr) {
    console.error(
      JSON.stringify({
        event: "selection_orphan_sweep_failed",
        message: sweepErr instanceof Error ? sweepErr.message : String(sweepErr),
      }),
    );
  }

  // B-SEL-CRON (2) — self-continue 기본 ON(opt-out). daily 단독 3 jobs/day로는 period 완주 불가
  //   → load-bearing accelerator. 명시 "false"는 디버그 전용이며 아래 stall alert로 가시화.
  const selfContinueEnabled = process.env.SELECTION_CRON_SELF_CONTINUE !== "false";

  // OPS-3: forward-progress gate — claimed>0 또는 R2/judge enqueue 진행(remaining>0·미abort)일 때만 self-continue.
  //   per-track 분기 후엔 어느 due 트랙이라도 forward-progress 있으면 1회 self-continue(다음 chunk advance).
  const hasMore = outcomes.some(
    (o) =>
      o.result !== undefined &&
      o.result.remaining > 0 &&
      o.result.aborted === null &&
      (o.result.claimed > 0 || o.result.r2Enqueued > 0 || o.result.judgeEnqueued > 0),
  );

  // stall alert: self-continue 명시 off + 미완 period(remaining>0, 미abort) = daily 3 jobs/day로는
  //   window 내 finalize 불가 상태. scheduler_fail warning으로 매일 가시화 (해소 = SELF_CONTINUE 복원).
  if (!selfContinueEnabled) {
    const stalledTracks = outcomes.filter(
      (o) => o.result !== undefined && o.result.remaining > 0 && o.result.aborted === null,
    );
    if (stalledTracks.length > 0) {
      const detail = stalledTracks
        .map((o) => `${o.track}(remaining ${o.result!.remaining})`)
        .join(", ");
      console.error(
        JSON.stringify({
          event: "selection_self_continue_disabled_stall",
          tracks: detail,
        }),
      );
      try {
        const nowIso = new Date().toISOString();
        await insertAlertEvents(
          [
            {
              alertType: "scheduler_fail",
              ticker: null,
              severity: "warning",
              triggerReason: `self_continue_disabled_stall: ${detail} — SELECTION_CRON_SELF_CONTINUE=false로는 period 완주 불가(daily ${dueTracks.length}트랙 × chunk 3). 플래그 제거/true 권장`,
              signalSentAt: nowIso,
              outcomeAt: null,
              t7PriceChange: null,
              decisionRecorded: null,
              decisionMemo: null,
            },
          ],
          { client: supabase },
        );
      } catch (alertErr) {
        console.error(
          JSON.stringify({
            event: "selection_stall_alert_failed",
            message: alertErr instanceof Error ? alertErr.message : String(alertErr),
          }),
        );
      }
    }
  }

  if (hasMore && selfContinueEnabled) {
    const secret = process.env.CRON_SECRET;
    const selfUrl = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
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
