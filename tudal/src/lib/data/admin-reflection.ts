// admin-reflection.ts — reflection_log durable 회고 로그 INSERT(upsert)/SELECT + 선정 사이클 source helper.
//
// PR-K Reflection(D32): track별 페르소나 적중률·실현 수익률·주입 컨텍스트 스냅샷.
// 본 테이블은 마이그 0043(DORMANT, USER apply-only). REFLECTION_ENABLED off → orchestrator 미호출이라 미적용도 안전.
// service-role client 주입 시 RLS using(is_admin()) 우회(cron context). admin-m12a 패턴.
//
// 회고 대상 = 해당 period의 평가된 후보 패널(tier1_selection_job done) 전체. short_list_30가 rolling
//   in-place 교체라 period별 '선정 subset'의 신뢰 가능한 historical source가 아니므로 평가 pool 사용
//   (per-period 신뢰·표본↑). [SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §1]
//
// 회고지 예측 아님(retrospective).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  CycleSelection,
  ReflectionLogRow,
  ReflectionTrack,
} from "@/lib/reflection/types";
import type { PriorFinalizedCycle } from "@/lib/reflection/orchestrator";
import type { ReflectionContextRow } from "@/lib/reflection/reflection-source";
import type { PersonaScore } from "@/lib/screening/tier1-schema";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const RUN_MONTH_YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const TRACK_SET: ReadonlySet<ReflectionTrack> = new Set<ReflectionTrack>([
  "short",
  "midlong",
]);

/**
 * reflection_log idempotent upsert(month,track,period_key). 입력 검증(month/track/period_key) 선행.
 * shadow-first: REFLECTION_ENABLED off면 orchestrator 미호출이라 본 함수 미도달.
 */
export async function insertReflectionLog(
  row: ReflectionLogRow,
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  if (!MONTH_RE.test(row.month)) {
    throw new Error(`reflection_log_invalid_month:${row.month}`);
  }
  if (!TRACK_SET.has(row.track)) {
    throw new Error(`reflection_log_invalid_track:${row.track}`);
  }
  if (!row.periodKey || typeof row.periodKey !== "string") {
    throw new Error(`reflection_log_invalid_period_key:${row.periodKey}`);
  }
  const supabase = options.client ?? (await createClient());
  const payload = {
    month: row.month,
    track: row.track,
    period_key: row.periodKey,
    finalized_at: row.finalizedAt,
    reflection_kind: row.reflectionKind,
    selected_count: row.selectedCount,
    priced_count: row.pricedCount,
    overall_hit_rate: row.overallHitRate,
    overall_avg_realized_return: row.overallAvgRealizedReturn,
    per_persona_metrics: row.perPersonaMetrics,
    injected_context_snapshot: row.injectedContextSnapshot,
    price_source: row.priceSource,
    price_basis_entry_date: row.priceBasisEntryDate,
    price_basis_current_date: row.priceBasisCurrentDate,
  };
  const { error } = await supabase
    .from("reflection_log")
    .upsert(payload, { onConflict: "month,track,period_key" });
  if (error) {
    throw new Error(`reflection_log_upsert_failed:${error.code ?? "unknown"}`);
  }
}

/**
 * track별 가장 최근 finalize된 사이클의 reflection_log 주입 컨텍스트 스냅샷.
 * 선정 진입 시 getReflectionLearningContextString이 fetchLatest로 주입(flag on일 때만 호출).
 * 정렬 = finalized_at desc(회고 대상 사이클 recency) — created_at(INSERT 시각)이 아니라 reflected-cycle
 *   recency 기준이라 manual backfill/out-of-order 재실행에도 항상 최신 finalize 사이클 스냅샷을 반환.
 */
export async function getLatestReflectionLog(options: {
  track: ReflectionTrack;
  client?: SupabaseClient;
}): Promise<ReflectionContextRow | null> {
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase
    .from("reflection_log")
    .select("injected_context_snapshot")
    .eq("track", options.track)
    .order("finalized_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`reflection_log_latest_failed:${error.code ?? "unknown"}`);
  }
  if (!data) return null;
  return {
    injectedContextSnapshot:
      (data as { injected_context_snapshot: string | null })
        .injected_context_snapshot ?? null,
  };
}

/**
 * 이 사이클(month,track,period_key)에 이미 reflection_log row가 존재하는가 — M4 cost-idempotency.
 * true면 orchestrator가 LLM 요약 재실행을 skip(re-burn 방지). base upsert는 idempotent라 무관.
 */
export async function reflectionExists(options: {
  month: string;
  track: ReflectionTrack;
  periodKey: string;
  client?: SupabaseClient;
}): Promise<boolean> {
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase
    .from("reflection_log")
    .select("id")
    .eq("month", options.month)
    .eq("track", options.track)
    .eq("period_key", options.periodKey)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`reflection_exists_failed:${error.code ?? "unknown"}`);
  }
  return data !== null;
}

interface PriorRunRow {
  period_key: string;
  track: string;
  month: string; // YYYY-MM (tier1_selection_run)
  finalized_at: string;
}

/**
 * 가장 최근 finalize된 prior 사이클(track별). finalized_at not null이라 현재 진행(미finalize) period는 제외.
 * 없으면 null(fail-soft no-op — cron-live/선정 미가동 커버). month는 reflection_log용 YYYY-MM-01로 변환.
 */
export async function getPriorFinalizedCycle(options: {
  track: ReflectionTrack;
  client?: SupabaseClient;
}): Promise<PriorFinalizedCycle | null> {
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase
    .from("tier1_selection_run")
    .select("period_key, track, month, finalized_at")
    .eq("track", options.track)
    .not("finalized_at", "is", null)
    .order("finalized_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`reflection_prior_cycle_failed:${error.code ?? "unknown"}`);
  }
  if (!data) return null;
  const row = data as PriorRunRow;
  const month = RUN_MONTH_YM_RE.test(row.month)
    ? `${row.month}-01`
    : row.month; // 비정상 month은 그대로(상위 검증) — 정상 'YYYY-MM' → 'YYYY-MM-01'
  return {
    month,
    periodKey: row.period_key,
    finalizedAt: row.finalized_at,
  };
}

interface PanelJobRow {
  ticker: string;
  round: number | null;
  panel_result: unknown;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** panel_result(unknown jsonb)를 최소 검증해 PersonaScore[]로 coerce. 빈/비배열/원소 결손 → 제외(fail-soft). */
function coercePanel(raw: unknown): PersonaScore[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PersonaScore[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") return null;
    const rec = item as Record<string, unknown>;
    if (typeof rec.persona_id !== "string" || !isFiniteNumber(rec.conviction)) {
      return null;
    }
    out.push(rec as unknown as PersonaScore);
  }
  return out;
}

/**
 * 해당 period의 평가된 후보 패널(status done, panel_result not null) → CycleSelection[].
 *
 * 멀티라운드(0032/0033): tier1_selection_job은 (period_key, ticker, round) unique — 한 ticker에
 *   round 1(R1 PersonaScore[]) + round 2(R2 반박 PersonaScore[]) + round 3(JudgeVerdict object)가 공존한다.
 *   ticker별 **최종 PersonaScore 패널(R2 우선 / R1 fallback)** 1건만 채택(worker finalize와 동일 의미) —
 *   round dedup 없으면 R1+R2가 둘 다 잡혀 double-count·R1/R2 conviction 혼합으로 메트릭이 오염된다.
 *   round 3(JudgeVerdict)은 coercePanel이 배열 아님으로 제외. panel_result 결손도 fail-soft 제외(throw 0).
 */
export async function getCyclePanels(options: {
  periodKey: string;
  client?: SupabaseClient;
}): Promise<CycleSelection[]> {
  const supabase = options.client ?? (await createClient());
  const { data, error } = await supabase
    .from("tier1_selection_job")
    .select("ticker, round, panel_result")
    .eq("period_key", options.periodKey)
    .eq("status", "done")
    .not("panel_result", "is", null);
  if (error) {
    throw new Error(`reflection_cycle_panels_failed:${error.code ?? "unknown"}`);
  }
  const rows = (data ?? []) as PanelJobRow[];
  // ticker → 최고 PersonaScore round(R2>R1) 1건. round null/누락은 legacy default 1 간주.
  const byTicker = new Map<string, { round: number; panel: PersonaScore[] }>();
  for (const r of rows) {
    const panel = coercePanel(r.panel_result);
    if (!panel) continue; // round 3 JudgeVerdict(object) / 결손 → 제외
    const round =
      typeof r.round === "number" && Number.isFinite(r.round) ? r.round : 1;
    const existing = byTicker.get(r.ticker);
    if (!existing || round > existing.round) {
      byTicker.set(r.ticker, { round, panel });
    }
  }
  return [...byTicker.entries()].map(([ticker, v]) => ({ ticker, panel: v.panel }));
}
