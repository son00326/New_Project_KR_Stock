import { MANUAL_REGEN_CAP } from "@/lib/performance/regen-cap";
import { createClient } from "@/lib/supabase/server";
import type { RegenCounter } from "@/types/admin";

// ---------------------------------------------------------------------------
// regen_counter (E8) — Supabase 실 I/O (T7e.5).
// Race-safe manual increment via optimistic compare-and-swap.
// DB CHECK(manual_count >= 0 and <= 2) is the ultimate hard cap (migration 0005).
// ---------------------------------------------------------------------------

export interface RegenCounterDbRow {
  id: string;
  ticker: string;
  month: string;
  auto_count: number;
  manual_count: number;
  reset_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, ticker, month, auto_count, manual_count, reset_at, updated_at";

const UNIQUE_VIOLATION = "23505";

export function transformRegenCounterRow(
  row: RegenCounterDbRow,
): RegenCounter {
  return {
    id: row.id,
    ticker: row.ticker,
    month: row.month,
    autoCount: row.auto_count,
    manualCount: row.manual_count,
    resetAt: row.reset_at,
  };
}

/**
 * 다음 달 1일 00:00 KST의 ISO 문자열을 반환한다.
 * 입력 month 형식: 'YYYY-MM-01'.
 */
export function computeNextMonthResetAt(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const mon = Number(monthStr);
  const nextMon = mon === 12 ? 1 : mon + 1;
  const nextYear = mon === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMon).padStart(2, "0")}-01T00:00:00+09:00`;
}

export async function getRegenCounter(
  ticker: string,
  month: string,
): Promise<RegenCounter | null> {
  const client = await createClient();
  const { data, error } = await client
    .from("regen_counter")
    .select(COLUMNS)
    .eq("ticker", ticker)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(
      `regen_counter query failed: ${error.message ?? "unknown error"}`,
    );
  }
  if (!data) return null;
  return transformRegenCounterRow(data as RegenCounterDbRow);
}

export type IncrementManualResult =
  | { ok: true; manualCount: number }
  | { ok: false; reason: "cap_exhausted"; manualCount: number };

/**
 * regen_counter.manual_count를 1 증가시킨다.
 *
 * 동시성 보호:
 *   1) Idempotent INSERT (manual_count=0). UNIQUE(ticker, month)로 중복은 23505 무시.
 *   2) 현재 행 SELECT.
 *   3) manual_count >= cap이면 즉시 cap_exhausted 반환 (UPDATE 안 함).
 *   4) UPDATE WHERE id AND manual_count = current — matching UPDATE가 잡는
 *      Postgres row lock + optimistic CAS.
 *      RETURNING이 비면 동시 증가에 졌다는 뜻 → conflict 에러를 throw.
 *   DB CHECK(manual_count <= 2)가 마지막 안전망.
 */
export async function incrementManualRegenCount(
  ticker: string,
  month: string,
): Promise<IncrementManualResult> {
  const client = await createClient();

  // Step 1: idempotent INSERT (manual_count=0). UNIQUE 충돌은 무시.
  const insertResult = await client.from("regen_counter").insert({
    ticker,
    month,
    auto_count: 0,
    manual_count: 0,
    reset_at: computeNextMonthResetAt(month),
  });
  if (
    insertResult.error &&
    insertResult.error.code !== UNIQUE_VIOLATION
  ) {
    throw new Error(
      `regen_counter insert failed: ${insertResult.error.message ?? "unknown error"}`,
    );
  }

  // Step 2: 현재 상태 SELECT.
  const { data: current, error: selectError } = await client
    .from("regen_counter")
    .select(COLUMNS)
    .eq("ticker", ticker)
    .eq("month", month)
    .single();
  if (selectError || !current) {
    throw new Error(
      `regen_counter lookup failed: ${selectError?.message ?? "row missing after insert"}`,
    );
  }
  const row = current as RegenCounterDbRow;

  // Step 3: 이미 cap에 도달했으면 UPDATE 없이 즉시 종료.
  if (row.manual_count >= MANUAL_REGEN_CAP) {
    return {
      ok: false,
      reason: "cap_exhausted",
      manualCount: row.manual_count,
    };
  }

  // Step 4: CAS UPDATE — manual_count = current_value 인 행만 1 증가.
  const { data: updated, error: updateError } = await client
    .from("regen_counter")
    .update({
      manual_count: row.manual_count + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("manual_count", row.manual_count)
    .select(COLUMNS)
    .maybeSingle();
  if (updateError) {
    throw new Error(
      `regen_counter update failed: ${updateError.message ?? "unknown error"}`,
    );
  }
  if (!updated) {
    throw new Error("regen_counter write conflict");
  }

  const after = updated as RegenCounterDbRow;
  return { ok: true, manualCount: after.manual_count };
}
