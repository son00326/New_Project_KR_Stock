import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export interface JoopickPerformancePoint {
  readonly date: string;
  readonly totalReturn: number;
}

class JoopickSeriesError extends Error {
  readonly name = "JoopickSeriesError";
}

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_return: z.union([z.number().finite(), z.string().max(80)]).nullable(),
});

export function parseJoopickPerformanceRows(
  rows: readonly unknown[],
): readonly JoopickPerformancePoint[] {
  return rows.flatMap((input) => {
    const result = rowSchema.safeParse(input);
    if (!result.success) throw new JoopickSeriesError("portfolio_snapshot 형식 검증 실패");
    if (result.data.total_return === null) return [];
    const totalReturn = typeof result.data.total_return === "number"
      ? result.data.total_return
      : Number(result.data.total_return);
    if (!Number.isFinite(totalReturn)) {
      throw new JoopickSeriesError("portfolio_snapshot 수익률 형식 검증 실패");
    }
    return [{ date: result.data.date, totalReturn }];
  });
}

export async function getJoopickPerformanceSeries(): Promise<readonly JoopickPerformancePoint[]> {
  const client = await createClient();
  const admin = await client.rpc("is_admin");
  if (admin.error || admin.data !== true) {
    throw new JoopickSeriesError("주픽 비교 데이터는 관리자만 조회할 수 있습니다.");
  }

  const { data, error } = await client
    .from("portfolio_snapshot")
    .select("date, total_return")
    .is("ticker", null)
    .eq("is_cash", false)
    .order("date", { ascending: true });
  if (error) throw new JoopickSeriesError(`portfolio_snapshot 조회 실패: ${error.message}`);

  return parseJoopickPerformanceRows(data ?? []);
}
