// PR-K Reflection — 회고 job 오케스트레이터 (shadow-first DI 코디네이터).
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §4.
//
// 흐름: gate → prior finalized cycle 적재 → panels → 가격(KRX·무비용) → metrics
//       → (선택)LLM 요약(별 flag + hardcap reservation) → snapshot → reflection_log upsert.
//
// 불변식:
//   - REFLECTION_ENABLED off → skipped(영속/비용 0, 모든 IO DI 미호출).
//   - prior cycle 부재 / panels 부재 → no-op fail-soft(skipped).
//   - 가격 부재/실패 → 빈 Map(fail-soft) → metrics null이어도 영속(회고는 무비용·valuable).
//   - 기본 경로 LLM 0콜(무비용). 요약은 REFLECTION_LLM_SUMMARY_ENABLED + preflight reservation.
//   - 회고지 예측 아님(retrospective). 이메일/Resend 경로 없음.

import {
  isReflectionEnabled,
  isReflectionLlmSummaryEnabled,
} from "@/lib/reflection/flags";
import { computeReflectionMetrics } from "@/lib/reflection/metrics";
import { buildReflectionContext } from "@/lib/reflection/reflection-context";
import { buildReflectionLogRow } from "@/lib/reflection/ledger";
import { REFLECTION_PRICE_SOURCE } from "@/lib/reflection/config";
import type {
  CycleSelection,
  ReflectionLogRow,
  ReflectionMetrics,
  ReflectionRunResult,
  ReflectionTrack,
} from "@/lib/reflection/types";

export interface PriorFinalizedCycle {
  month: string; // YYYY-MM-01
  periodKey: string;
  finalizedAt: string; // ISO
}

export interface ResolvedReflectionPrices {
  entryPrices: Map<string, number>;
  currentPrices: Map<string, number>;
  entryDate: string | null; // YYYYMMDD
  currentDate: string | null; // YYYYMMDD
}

export interface ReflectionJobDeps {
  track: ReflectionTrack;
  personaRoster: string[]; // CORE_11 persona_id 권위 명부
  /** 현재 미finalize period가 아닌, 가장 최근 finalize된 prior 사이클(track별). 없으면 null. */
  getPriorFinalizedCycle: () => Promise<PriorFinalizedCycle | null>;
  getCyclePanels: (periodKey: string) => Promise<CycleSelection[]>;
  /** KRX EOD entry/current(무비용). 실패는 fail-soft로 빈 Map 처리(throw 무방). */
  resolvePrices: (input: {
    tickers: string[];
    finalizedAt: string;
  }) => Promise<ResolvedReflectionPrices>;
  insertReflectionLog: (row: ReflectionLogRow) => Promise<void>;
  /** (선택) LLM 요약 cost preflight. REFLECTION_LLM_SUMMARY_ENABLED on일 때만 호출, throw=하드캡 도달→요약 skip(burn 0). */
  preflight?: () => Promise<void>;
  /** (선택) 페르소나 케이스 LLM 요약. default OFF/DI 부재 → skip(무비용). */
  summarize?: (metrics: ReflectionMetrics) => Promise<string>;
  /** (선택) cost-idempotency: 이 사이클이 이미 회고됐으면 LLM 요약 재실행 skip(re-burn 방지). cycle을 받아 (month,track,period_key) 조회. */
  alreadyReflected?: (cycle: PriorFinalizedCycle) => Promise<boolean>;
  maxPersonas?: number;
}

function skipped(
  track: ReflectionTrack,
  reason: NonNullable<ReflectionRunResult["reason"]>,
  periodKey: string | null = null,
): ReflectionRunResult {
  return {
    skipped: true,
    reason,
    track,
    periodKey,
    selectedCount: 0,
    pricedCount: 0,
    overallHitRate: null,
    overallAvgRealizedReturn: null,
  };
}

const EMPTY_PRICES: ResolvedReflectionPrices = {
  entryPrices: new Map(),
  currentPrices: new Map(),
  entryDate: null,
  currentDate: null,
};

export async function runReflectionJob(
  deps: ReflectionJobDeps,
): Promise<ReflectionRunResult> {
  // ── gate: flag off → skip(byte-identical, 비용/영속 0) ──
  if (!isReflectionEnabled()) {
    return skipped(deps.track, "flag_off");
  }

  const cycle = await deps.getPriorFinalizedCycle();
  if (!cycle) return skipped(deps.track, "no_finalized_cycle");

  const selections = await deps.getCyclePanels(cycle.periodKey);
  if (selections.length === 0) {
    return skipped(deps.track, "no_panels", cycle.periodKey);
  }

  // ── 가격(KRX EOD·무비용) — fail-soft: 실패 시 빈 Map → metrics null이어도 영속 ──
  const tickers = selections.map((s) => s.ticker);
  let prices: ResolvedReflectionPrices;
  try {
    prices = await deps.resolvePrices({ tickers, finalizedAt: cycle.finalizedAt });
  } catch {
    prices = EMPTY_PRICES;
  }

  const metrics = computeReflectionMetrics({
    selections,
    entryPrices: prices.entryPrices,
    currentPrices: prices.currentPrices,
    personaRoster: deps.personaRoster,
  });

  // ── 회고 컨텍스트 snapshot(₩0) ──
  let snapshot = buildReflectionContext(metrics, { maxPersonas: deps.maxPersonas });

  // ── (선택) LLM 케이스 요약 — 별 flag + hardcap reservation + cost-idempotency + degrade-don't-abort ──
  //   M4 cost-idempotency: 이미 회고된 사이클이면 LLM 재실행 skip(re-burn 방지). base upsert는 무비용·idempotent라 진행.
  //   M3 degrade-don't-abort: preflight(하드캡)/summarize(transient) 실패는 catch → 무비용 base 회고는 보존·영속.
  //     preflight throw가 summarize 호출 전에 잡히므로 burn 0(하드캡 차단)이면서 free 회고는 유지.
  if (isReflectionLlmSummaryEnabled() && deps.summarize) {
    const already = deps.alreadyReflected ? await deps.alreadyReflected(cycle) : false;
    if (!already) {
      try {
        await deps.preflight?.(); // 하드캡 초과 → throw → catch → 요약 skip(burn 0)
        const llmSummary = await deps.summarize(metrics);
        if (llmSummary.trim()) {
          snapshot = snapshot ? `${snapshot}\n${llmSummary.trim()}` : llmSummary.trim();
        }
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "reflection_summary_skipped",
            track: deps.track,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
  }

  // ── reflection_log row 조립 + idempotent upsert ──
  const hadPrices = prices.entryDate !== null && prices.currentDate !== null;
  const row = buildReflectionLogRow({
    metrics,
    cycle: {
      month: cycle.month,
      track: deps.track,
      periodKey: cycle.periodKey,
      finalizedAt: cycle.finalizedAt,
    },
    priceBasis: {
      source: hadPrices ? REFLECTION_PRICE_SOURCE : null,
      entryDate: prices.entryDate,
      currentDate: prices.currentDate,
    },
    snapshot,
  });
  await deps.insertReflectionLog(row);

  return {
    skipped: false,
    track: deps.track,
    periodKey: cycle.periodKey,
    selectedCount: metrics.selectedCount,
    pricedCount: metrics.pricedCount,
    overallHitRate: metrics.overallHitRate,
    overallAvgRealizedReturn: metrics.overallAvgRealizedReturn,
  };
}
