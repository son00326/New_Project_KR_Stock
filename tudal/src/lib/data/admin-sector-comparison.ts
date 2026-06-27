import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { BucketKind } from "@/types/admin";

// B-1 섹터 비교 메뉴 — Track-2 shadow arm top-N read (0046 RPC).
// shadow 테이블(0039)은 SELECT revoke → SECURITY DEFINER RPC get_tier0_shadow_arm_top 경유.
// read-only. 부재/오류/미적용(0039·0046 dormant) → [] (fail-soft, 메뉴 빈 상태).
// SoT: docs/superpowers/specs/2026-06-28-sector-comparison-menu.md

export type ShadowArm = "production-mirror" | "sector-soft-tilt";

export interface ShadowArmRow {
  ticker: string;
  name: string | null;
  sector: string;
  bucket: BucketKind;
  rank: number;
  tier0Score: number | null;
}

const BUCKETS: ReadonlySet<string> = new Set(["short", "mid", "long"]);

function toRow(raw: unknown): ShadowArmRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ticker = typeof r.ticker === "string" ? r.ticker : "";
  const bucket = typeof r.bucket === "string" ? r.bucket : "";
  const rank = typeof r.rank === "number" ? r.rank : Number(r.rank);
  if (!/^[0-9]{6}$/.test(ticker) || !BUCKETS.has(bucket) || !Number.isFinite(rank)) {
    return null;
  }
  const score =
    r.tier0_score === null || r.tier0_score === undefined
      ? null
      : Number(r.tier0_score);
  return {
    ticker,
    name: typeof r.name === "string" ? r.name : null,
    sector: typeof r.sector === "string" ? r.sector : "미분류",
    bucket: bucket as BucketKind,
    rank,
    tier0Score: score !== null && Number.isFinite(score) ? score : null,
  };
}

/**
 * Track-2 shadow arm의 버킷별 top-N 후보. soft 비교 전용(arm allowlist는 RPC가 강제).
 * 0039/0046 미적용·shadow run 부재·RLS deny → [] (fail-soft, 메뉴는 "미실행" 안내).
 */
export async function getShadowArmTop(
  arm: ShadowArm,
  periodKey: string,
  options: { limitPerBucket?: number; client?: SupabaseClient } = {},
): Promise<ShadowArmRow[]> {
  try {
    const supabase = options.client ?? (await createClient());
    const { data, error } = await supabase.rpc("get_tier0_shadow_arm_top", {
      p_arm: arm,
      p_period_key: periodKey,
      p_limit_per_bucket: options.limitPerBucket ?? 10,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as unknown[]).map(toRow).filter((r): r is ShadowArmRow => r !== null);
  } catch {
    return [];
  }
}

/** short_list_30 month(YYYY-MM-01) → shadow period_key(YYYY-MM). */
export function monthToPeriodKey(month: string): string {
  return month.slice(0, 7);
}
