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
//   (3) 고아 period sweep — 최근 60일 내 시작·미finalize·현재 period 아님 run row → scheduler_fail
//       warning alert (silent spend 방지 2층). 수동 재개 = `?now=<해당 window 내 ISO>` + CRON_SECRET 재호출.
import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
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

// B-SEL-CRON — self-continue hop 식별 마커. self-continue fetch URL에 &selfcontinue=1을 부여하므로
//   genuine cron-entry(또는 수동 ?now= 재개)와 self-continue hop을 구분한다. 모든 route-level 관측
//   alert(orphan sweep / track-throw / stall)는 hop에서 skip → 하루 ~수십 hop의 alert 폭주 차단
//   (finding 2/5/12/14/15/17/23). 1 cron-entry/일 = 1 alert/일로 bound.
function isSelfContinueHop(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get("selfcontinue") === "1";
}

// 고아 sweep lookback. midlong period window(~31일)를 초과해야 익월 rollover로 고아가 된 midlong run row
//   (created_at은 최초 acquire 시 고정·ON CONFLICT 미갱신, 0031)을 탐지할 수 있다. 14일이면 midlong
//   고아를 구조적으로 영원히 놓쳤다(finding 1/8/10). 60일 = midlong window + ~30일 가시화 grace.
const ORPHAN_LOOKBACK_DAYS = 60;

// B-SEL-CRON (finding 1/3/7/8/9/10/11/18/20/24/26) — 고아 period sweep.
//   미finalize인데 현재 period가 아닌 run row = 처리되다 중단된 period. scheduler_fail warning으로 가시화.
//   anchor는 ?now= seam이 아닌 실 wall-clock(new Date())으로 고정 — 수동 ?now=<과거 ISO> 재개가
//   진짜 현재 진행 period를 고아로 오탐하지 않도록(finding 3/7/11/18/24). currentPeriodKeys = seam ∪ real
//   (재개 대상 period와 라이브 period 양쪽 모두 제외). best-effort — 실패해도 caller 응답을 막지 않는다.
async function sweepOrphanPeriods(
  supabase: SupabaseClient,
  seamPeriodKeys: readonly string[],
): Promise<void> {
  try {
    const realNow = new Date();
    const currentPeriodKeys = new Set<string>([
      ...seamPeriodKeys,
      currentShortPeriodKey(realNow),
      currentMidlongPeriodKey(realNow),
    ]);
    const sinceIso = new Date(
      realNow.getTime() - ORPHAN_LOOKBACK_DAYS * 86400000,
    ).toISOString();
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
    if (orphans.length === 0) return;
    const keys = orphans.map((r) => r.period_key).join(",");
    console.error(
      JSON.stringify({
        event: "selection_period_orphaned",
        periodKeys: keys,
        hint: "manual resume = GET ?now=<ISO within that window> + CRON_SECRET (두 트랙 모두 해당 시점 period로 진행됨)",
      }),
    );
    await insertAlertEvents(
      [
        {
          alertType: "scheduler_fail",
          ticker: null,
          severity: "warning",
          // finding 20/26: sweep는 cost_log를 확인하지 않으므로 'spend 발생'을 단정하지 않는다
          //   (zero-spend run row = 미seed/step-0 abort/flag-off도 고아로 잡힘).
          triggerReason: `selection period 미finalize 중단(window 경과): ${keys} — spend 여부는 cost_log 확인, 재개 = 해당 window 내 ?now= 재호출(두 트랙 진행)`,
          signalSentAt: realNow.toISOString(),
          outcomeAt: null,
          t7PriceChange: null,
          decisionRecorded: null,
          decisionMemo: null,
        },
      ],
      { client: supabase },
    );
  } catch (sweepErr) {
    console.error(
      JSON.stringify({
        event: "selection_orphan_sweep_failed",
        message: sweepErr instanceof Error ? sweepErr.message : String(sweepErr),
      }),
    );
  }
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

  const isHop = isSelfContinueHop(request);

  // B-SEL-CRON (1) — period-scoped due-gate: 두 트랙 모두 "현재 period"로 매일 진행.
  //   short = 그 주 KST 월요일 키(주 내내 동일) / midlong = 그 달 키(월 내내 동일).
  //   미finalize period는 자연히 계속 due가 되고, finalize 후엔 acquire null-guard가 cheap no-op.
  //   순차 2회 — 각 독립 period_key라 트랙별 독립 run-mutex.
  const now = resolveNow(request);
  const shortPeriodKey = currentShortPeriodKey(now);
  const midlongPeriodKey = currentMidlongPeriodKey(now);
  let supabase: SupabaseClient | null = null;

  // B-SEL-CRON (finding 9) — 고아 sweep은 flag gate 앞에서 실행: USER가 비용 사유로 period 중반에
  //   flag를 끄는 것이 미finalize 고아(spend 발생·산출 0)의 가장 현실적 경로인데, gate 뒤면 그 상태에서
  //   sweep이 한 번도 돌지 않는다. sweep은 read 1쿼리 + 조건부 alert뿐(LLM/claim/mutex 0)이라 dormant
  //   invariant(spend 0) 불변. client 생성 실패도 dormant flag skip을 막지 않도록 best-effort.
  //   hop에서는 skip(finding 2/5/12/17/23 — 폭주 차단, cron-entry 1회/일만).
  if (!isHop) {
    try {
      supabase = createServiceRoleClient();
      await sweepOrphanPeriods(supabase, [shortPeriodKey, midlongPeriodKey]);
    } catch (sweepErr) {
      console.error(
        JSON.stringify({
          event: "selection_orphan_sweep_failed",
          message:
            sweepErr instanceof Error ? sweepErr.message : String(sweepErr),
        }),
      );
    }
  }

  // flag gate: dormant 시 200 skip (502 아님 — dormant ≠ failure, mutex 미취득, spend 0).
  if (process.env.SELECTION_CRON_AUTO_ENABLED !== "true") {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "selection_cron_auto_disabled" },
      { status: 200 },
    );
  }

  supabase ??= createServiceRoleClient();

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
          // B-SEL-CRON (cluster D) — preflight month == insert month 정합 (period 월경계 누수 차단).
          costLogMonth: t.month,
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
          costLogMonth: t.month,
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
        const result = guarded.result!;
        outcomes.push({
          track: t.track,
          ok: result.aborted === null,
          result,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      outcomes.push({ track: t.track, ok: false, error: message });
      // B-SEL-CRON (finding 14) — track throw 가시화: finalize 결정론 실패(cross_bucket_overlap 등)는
      //   worker summarize에 도달하지 못해(throw가 선행) 응답 body에만 남는 silent 상태였다. always-due로
      //   매일 재시도되므로 best-effort scheduler_fail로 알린다. hop에서는 skip(중복 차단) — cron-entry
      //   1회/일. systemic abort는 worker가 이미 self-alert하므로 드물게 중복 가능(허용 — 가시성 우선).
      if (!isHop) {
        try {
          await insertAlertEvents(
            [
              {
                alertType: "scheduler_fail",
                ticker: null,
                severity: "warning",
                triggerReason: `selection track ${t.track} ${t.periodKey} 실패(${t.month}): ${message}`,
                signalSentAt: new Date().toISOString(),
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
              event: "selection_track_fail_alert_failed",
              track: t.track,
              message:
                alertErr instanceof Error ? alertErr.message : String(alertErr),
            }),
          );
        }
      }
    }
  }

  // B-SEL-CRON (2) — self-continue 기본 ON(opt-out). daily 단독 3 jobs/day로는 period 완주 불가
  //   → load-bearing accelerator. 명시 "false"는 디버그 전용이며 아래 stall alert로 가시화.
  const selfContinueEnabled = process.env.SELECTION_CRON_SELF_CONTINUE !== "false";

  // OPS-3: forward-progress gate — claimed>0 또는 R2/judge enqueue 진행(remaining>0·미abort)일 때만 self-continue.
  //   per-track 분기 후엔 어느 due 트랙이라도 forward-progress 있으면 1회 self-continue(다음 chunk advance).
  const hasForwardProgress = (o: TrackOutcome): boolean =>
    o.result !== undefined &&
    (o.result.claimed > 0 ||
      o.result.r2Enqueued > 0 ||
      o.result.judgeEnqueued > 0);
  const hasMore = outcomes.some(
    (o) =>
      o.result !== undefined &&
      o.result.remaining > 0 &&
      o.result.aborted === null &&
      hasForwardProgress(o),
  );

  // B-SEL-CRON (finding 15) — stall alert 일반화: 미완 period(remaining>0, 미abort)가 진행 불능이면
  //   가시화. 두 클래스: (a) self-continue 명시 off → accelerator 없어 daily-only로 완주 불가,
  //   (b) 기본 ON이라도 forward-progress 0(claimed=0 & enqueue 0 — attempts 소진 pending livelock 등)
  //   → self-continue가 안 돌아 stall. 구판은 (a)만 잡아 (b) default-ON livelock이 silent였다.
  //   hop에서는 skip(중복 차단) — cron-entry 1회/일.
  if (!isHop) {
    const stalledTracks = outcomes.filter((o) => {
      const r = o.result;
      if (!r || r.remaining <= 0 || r.aborted !== null) return false;
      return !selfContinueEnabled || !hasForwardProgress(o);
    });
    if (stalledTracks.length > 0) {
      const detail = stalledTracks
        .map((o) => {
          const cause = !selfContinueEnabled
            ? "self_continue=false"
            : "no_forward_progress(attempts소진/livelock 의심)";
          return `${o.track}(remaining ${o.result!.remaining}, ${cause})`;
        })
        .join(", ");
      console.error(
        JSON.stringify({ event: "selection_stall", tracks: detail }),
      );
      try {
        await insertAlertEvents(
          [
            {
              alertType: "scheduler_fail",
              ticker: null,
              severity: "warning",
              triggerReason: `selection stall(진행 불능): ${detail} — SELF_CONTINUE=false면 플래그 제거/true, 아니면 livelock(attempts 소진 pending) 점검`,
              signalSentAt: new Date().toISOString(),
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

  // 전체 ok = 모든 due 트랙 성공(skip 포함). 일부 실패해도 트랙별 보고(전체 502 단일화 금지).
  //   finding 21: 202 self-continue 경로도 ok를 하드코딩하지 않고 실제 트랙 성공으로 계산
  //   (always-due로 '한 트랙 지속 실패 + 다른 트랙 진행'이 일상화 → 실패 마스킹 방지).
  const ok = outcomes.every((o) => o.ok);

  if (hasMore && selfContinueEnabled) {
    const secret = process.env.CRON_SECRET;
    // self-continue fetch에 &selfcontinue=1 마커 부여 → 다음 hop이 orphan sweep/track-throw/stall
    //   alert를 skip(폭주 차단, finding 2/5/12/14/15/17/23). ?now= 등 기존 쿼리는 보존.
    const selfUrlObj = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      request.nextUrl.origin,
    );
    selfUrlObj.searchParams.set("selfcontinue", "1");
    const selfUrl = selfUrlObj.toString();
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
      { ok, continued: true, tracks: outcomes },
      { status: 202 },
    );
  }

  return NextResponse.json({ ok, tracks: outcomes }, { status: 200 });
}
