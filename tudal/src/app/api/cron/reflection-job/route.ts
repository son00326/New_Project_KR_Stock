// PR-K Reflection (D32) 회고 job cron route — shadow-first.
//
// 책임: auth(CRON_SECRET) → REFLECTION_ENABLED 게이트(200 skip·service-role 미생성·spend 0)
//   → service-role client → 두 트랙(short+midlong) 각각 runReflectionJob(직전 finalize 사이클 회고)
//   → per-track 실패격리(부분실패 보고) → 200.
//
// vercel.json 무변경: production schedule 추가는 USER go-live(또는 외부 스케줄). 본 라우트는 schedule
//   없이도 dormant-correct(flag off → skip)·수동 호출 가능. M12a가 morning-briefing에 hook한 것과 달리
//   reflection은 전용 라우트(track-cadence 독립). 운영 권장: 새 선정 사이클 시작 전(직전 사이클 finalize 후) 발화.
//
// 불변식: REFLECTION_ENABLED off → 회고 미실행·영속 0·선정 무관(선정 prompt는 별 경로). 기본 무비용(KRX EOD).
//   LLM 케이스 요약은 REFLECTION_LLM_SUMMARY_ENABLED on일 때만 preflight(hardcap reservation)+summarize 주입.
//   회고지 예측 아님(retrospective). 이메일/Resend 경로 없음.
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  isReflectionEnabled,
  isReflectionLlmSummaryEnabled,
} from "@/lib/reflection/flags";
import {
  runReflectionJob,
  type ResolvedReflectionPrices,
} from "@/lib/reflection/orchestrator";
import { resolveReflectionPrices } from "@/lib/reflection/prices";
import { summarizeReflection } from "@/lib/reflection/summarizer";
import {
  getPriorFinalizedCycle,
  getCyclePanels,
  insertReflectionLog,
  reflectionExists,
} from "@/lib/data/admin-reflection";
import { resolveEntryPricesKrw } from "@/lib/data/krx-eod";
import { loadKrBusinessDays } from "@/lib/portfolio/calendar";
import { CORE_11_PERSONAS } from "@/lib/ai/prompts/personas";
import { preflightHardcap } from "@/lib/cost/cost-logger";
import { getRoleWorstCaseMaxCostPerCallKrw } from "@/lib/ai/model-registry";
import type { ReflectionRunResult, ReflectionTrack } from "@/lib/reflection/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// selection-worker/route.ts 패턴 복제 (cron route 동일 auth).
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

const TRACKS: readonly ReflectionTrack[] = ["short", "midlong"];
const PERSONA_ROSTER: string[] = CORE_11_PERSONAS.map((p) => p.id);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMPTY_PRICES: ResolvedReflectionPrices = {
  entryPrices: new Map(),
  currentPrices: new Map(),
  entryDate: null,
  currentDate: null,
};

function currentUtcMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface TrackOutcome {
  track: ReflectionTrack;
  ok: boolean;
  result?: ReflectionRunResult;
  error?: string;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 게이트: dormant 시 200 skip (service-role 미생성·회고/영속/비용 0).
  if (!isReflectionEnabled()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "reflection_disabled" },
      { status: 200 },
    );
  }

  const supabase: SupabaseClient = createServiceRoleClient();
  const cronSystemUserId = process.env.CRON_SYSTEM_USER_ID ?? "";
  const authKey = process.env.KRX_OPENAPI_KEY?.trim();
  const now = new Date();
  // LLM 비용이 발생하는 실행 시점 월(현재 UTC월) — preflight month == cost_log month 정합.
  const costMonth = currentUtcMonth(now);

  // ── LLM 케이스 요약 fail-closed 게이트 (selection-worker step-0 패턴) ──
  //   기본 회고 job은 무비용(KRX)이라 항상 진행. LLM 요약만 아래 3중 충족 시 활성:
  //   (H2) AI_COST_LOG_REAL_INSERT_ENABLED — off면 insertCostLog noop → cost_log undercount →
  //        preflightHardcap fail-open(하드캡 무력화·무제한 burn). 강제.
  //   (H3) CRON_SYSTEM_USER_ID 유효 UUID + auth.users 존재 — cost_log.called_by FK(0017). 미충족이면 실
  //        spend 후 INSERT FK 실패(unrecorded burn)라 spend 전 차단. 미충족 → LLM 요약 비활성(무비용 base만).
  let llmSummary = isReflectionLlmSummaryEnabled();
  if (llmSummary) {
    let llmDisabledReason: string | null = null;
    if (process.env.AI_COST_LOG_REAL_INSERT_ENABLED !== "true") {
      llmDisabledReason = "cost_logging_disabled";
    } else if (!UUID_RE.test(cronSystemUserId)) {
      llmDisabledReason = "cron_system_user_id_invalid";
    } else {
      const { data: userData, error: userErr } =
        await supabase.auth.admin.getUserById(cronSystemUserId);
      if (userErr || !userData?.user) {
        llmDisabledReason = "cron_system_user_not_found";
      }
    }
    if (llmDisabledReason) {
      llmSummary = false; // degrade: 무비용 base 회고는 계속 진행(LLM 요약만 skip).
      console.error(
        JSON.stringify({ event: "reflection_llm_summary_disabled", reason: llmDisabledReason }),
      );
    }
  }

  const outcomes: TrackOutcome[] = [];
  for (const track of TRACKS) {
    try {
      const result = await runReflectionJob({
        track,
        personaRoster: PERSONA_ROSTER,
        getPriorFinalizedCycle: () => getPriorFinalizedCycle({ track, client: supabase }),
        getCyclePanels: (periodKey) => getCyclePanels({ periodKey, client: supabase }),
        // KRX EOD(무비용). 키 부재 → EMPTY(fail-soft → metrics null·영속은 진행).
        resolvePrices: ({ tickers, finalizedAt }) =>
          authKey
            ? resolveReflectionPrices(
                { tickers, finalizedAt },
                {
                  now,
                  loadBusinessDays: loadKrBusinessDays,
                  fetchEodPrices: (t, basDd) =>
                    resolveEntryPricesKrw(t, { authKey, basDd }),
                },
              )
            : Promise.resolve(EMPTY_PRICES),
        insertReflectionLog: (row) => insertReflectionLog(row, { client: supabase }),
        // (선택) LLM 케이스 요약 — flag on일 때만 주입. 미주입 시 orchestrator 무비용.
        //   preflight = hardcap reservation(critic 역할 worst-case 단가 × 1콜), summarize = 실 LLM 호출.
        preflight: llmSummary
          ? async () => {
              await preflightHardcap(
                {
                  month: costMonth,
                  lines: [
                    {
                      callCount: 1,
                      maxCostPerCallKrw: getRoleWorstCaseMaxCostPerCallKrw("critic"),
                    },
                  ],
                },
                { client: supabase, callerKind: "service-role" },
              );
            }
          : undefined,
        summarize: llmSummary
          ? (metrics) =>
              summarizeReflection({
                metrics,
                track,
                month: costMonth,
                adminUserId: cronSystemUserId,
                costClient: supabase,
              })
          : undefined,
        // M4 cost-idempotency — 이미 회고된 사이클이면 LLM 요약 재실행 skip(re-burn 방지). LLM on일 때만 필요.
        alreadyReflected: llmSummary
          ? (cycle) =>
              reflectionExists({
                month: cycle.month,
                track,
                periodKey: cycle.periodKey,
                client: supabase,
              })
          : undefined,
      });
      outcomes.push({ track, ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      outcomes.push({ track, ok: false, error: message });
      console.error(
        JSON.stringify({ event: "reflection_job_track_failed", track, message }),
      );
    }
  }

  const ok = outcomes.every((o) => o.ok);
  return NextResponse.json({ ok, skipped: false, tracks: outcomes }, { status: 200 });
}
