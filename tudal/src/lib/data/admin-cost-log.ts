// tudal/src/lib/data/admin-cost-log.ts
// Mock cleanup Step 2.4 (2026-05-28): cost page (`/admin/settings/cost`)의
// `MOCK_ADMIN_COST_LOG` + `MOCK_ADMIN_COST_LOG_OVER_WARNING` +
// `MOCK_ADMIN_COST_LOG_OVER_HARDCAP` 3 fixture → 실 `cost_log` SELECT 전환.
//
// Step 2.3 cost-logger.ts::getMonthlyTotal hardening 패턴 정합:
//   - pagination loop (PAGE_SIZE=1000, Supabase row limit 1000 truncate 차단)
//   - monotonic ordering snapshot (`called_at` ASC primary + `id` ASC tiebreak)
//   - non-finite / negative cost_krw guard (financial integrity fail-closed)
//   - DI seam (`options: { client?: SupabaseClient } = {}`)
//
// getMonthlyTotal은 sum만 반환 → cost page는 individual rows 필요 (Purpose별 비중 +
// Top 5 contributor) → 신규 helper. DB schema (마이그 0017): purpose / section 컬럼
// 부재 → persona_id prefix로 purpose derive + section=null.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { CostLog, CostPurpose } from "@/types/admin";

export interface AdminCostLogOptions {
  client?: SupabaseClient;
}

const CORE_11_PERSONA_IDS = new Set([
  "warren-buffett",
  "stanley-druckenmiller",
  "cathie-wood",
  "peter-lynch",
  "charlie-munger",
  "phil-fisher",
  "rakesh-jhunjhunwala",
  "mohnish-pabrai",
  "michael-burry",
  "nassim-taleb",
  "chair",
]);

// production insertCostLog 정합 (S7a, src/lib/ai/*-client.ts):
//   full_report_writer / critic → 'report' (writer + critic 모두 본문 흐름 sub-step)
//   revise → 'regenerate' (재생성 path Q2 dual-revise R1)
//   warren-buffett ... chair → 'committee' (CORE_11 production persona.id, kebab-case)
//   core-* / core_* → 'committee' (legacy/synthetic Core labels)
//   sector-* / sector_* → 'committee' (Tier 2 sector eval, D21 14×10 overlay)
//   shortlist / shortlist-* / shortlist_* → 'shortlist'
//   briefing / briefing-* / briefing_* → 'briefing'
//   else → 'other' (fallback — future persona convention 변경에도 page render 무사)
//
// persona_id snake_case vs kebab-case 양쪽 수용 (HANDOFF §7.6 결함 카탈로그 정합).
function derivePurpose(personaId: string): CostPurpose {
  if (personaId === "full_report_writer") return "report";
  if (personaId === "critic") return "report";
  if (personaId === "revise") return "regenerate";
  if (CORE_11_PERSONA_IDS.has(personaId)) return "committee";
  if (personaId.startsWith("core-") || personaId.startsWith("core_")) {
    return "committee";
  }
  if (personaId.startsWith("sector-") || personaId.startsWith("sector_")) {
    return "committee";
  }
  if (
    personaId === "shortlist" ||
    personaId.startsWith("shortlist-") ||
    personaId.startsWith("shortlist_")
  ) {
    return "shortlist";
  }
  if (
    personaId === "briefing" ||
    personaId.startsWith("briefing-") ||
    personaId.startsWith("briefing_")
  ) {
    return "briefing";
  }
  return "other";
}

interface DbCostLogRow {
  id: string;
  month: string;
  ticker: string;
  persona_id: string;
  prompt_version: string;
  model: string;
  input_tokens: number | string;
  cache_creation_input_tokens: number | string;
  cache_read_input_tokens: number | string;
  output_tokens: number | string;
  cost_krw: number | string;
  prompt_cache_enabled: boolean;
  called_at: string;
}

// PostgREST numeric → number coerce (Step 2.3 lesson: int8/numeric은 string 가능).
// 비유한 값은 0 fallback (tokens 합산 invariant 정확하지 않아도 page render 우선 —
// cost_krw 같은 financial integrity 컬럼은 별도 fail-closed guard로 차단).
function safeInt(v: number | string): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function transformCostLogRow(row: DbCostLogRow): CostLog {
  const cost = Number(row.cost_krw);
  // Step 2.3 cost-logger.ts hardening 정합 — non-finite / negative 차단 (financial
  // integrity fail-closed). PostgREST shape drift / locale string / bad row가
  // hardcap 우회시키지 못하도록 throw.
  if (!Number.isFinite(cost)) {
    throw new Error("cost_log_select_failed:non_finite_cost_krw");
  }
  if (cost < 0) {
    throw new Error("cost_log_select_failed:negative_cost_krw");
  }
  const tokensPrompt =
    safeInt(row.input_tokens) +
    safeInt(row.cache_creation_input_tokens) +
    safeInt(row.cache_read_input_tokens);
  return {
    id: row.id,
    ts: row.called_at,
    // DB는 'YYYY-MM' (insertCostLog SoT 정합) — aggregate.ts normalizeMonth가
    // 'YYYY-MM-01'로 변환하므로 pass-through.
    month: row.month,
    model: row.model,
    purpose: derivePurpose(row.persona_id),
    ticker: row.ticker,
    personaId: row.persona_id,
    // DB schema에 section 컬럼 부재 — 후속 mapping (prompt_version → section label)은
    // 별도 트랙 (production cost_log 적재 본격화 시점에 결정).
    section: null,
    tokensPrompt,
    tokensCompletion: safeInt(row.output_tokens),
    costKrw: cost,
  };
}

const COST_LOG_PAGE_SIZE = 1000;
const COST_LOG_SELECT_COLUMNS = [
  "id",
  "month",
  "ticker",
  "persona_id",
  "prompt_version",
  "model",
  "input_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
  "output_tokens",
  "cost_krw",
  "prompt_cache_enabled",
  "called_at",
].join(", ");

// month 인자: 'YYYY-MM-01' / 'YYYY-MM-DD' / 'YYYY-MM' 모두 허용 → DB 'YYYY-MM' 비교
// (insertCostLog SoT 정합 — anthropic/critic/full-report/revise client 모두 'YYYY-MM'
// 적재). page caller (currentMonth)는 'YYYY-MM-01' 형식 사용.
//
// W-cost-log-admin-assertion 박제 (HANDOFF §9.5): cost_log RLS `using (is_admin())`는
// non-admin caller에게 silent-0 (throw 안 함). mock parity 유지 — admin assertion은
// 별도 hardening 트랙 (rpc('is_admin') 또는 SECURITY DEFINER RPC).
//
// W-cost-log-pagination-snapshot 박제 (HANDOFF §9.5): pagination loop의 monotonic
// ordering은 application-level only. concurrent insert / backdated called_at 시
// page boundary skip/duplicate risk. PR5 cron + Smoke Stage 2 시점에 hardening
// 트랙 진입 (SECURITY DEFINER RPC server-side SUM transaction snapshot 또는 schema
// `CHECK (called_at >= ...)` 마이그).
export async function getMonthlyCostLog(
  month: string,
  options: AdminCostLogOptions = {},
): Promise<CostLog[]> {
  const dbMonth = month.slice(0, 7);

  const supabase = options.client ?? (await createClient());
  const result: CostLog[] = [];
  let offset = 0;
  // 무한 loop 차단: PAGE_SIZE 미만 page 도달 시 break.
  // worst case (cost_log 10k rows/month) = 10 round trips → 운영 빈도 (cron 30 자동
  // 가동 시 월 ~150 rows 추정) 대비 미미. 일반 (수백 rows) = 1 trip.
  for (;;) {
    const { data, error } = await supabase
      .from("cost_log")
      .select(COST_LOG_SELECT_COLUMNS)
      .eq("month", dbMonth)
      .order("called_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + COST_LOG_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`cost_log_select_failed:${error.code ?? "unknown"}`);
    }
    if (!data || data.length === 0) break;
    // PostgREST inferred type (`GenericStringError[]` union when columns string은 schema와
    // type-link 부재) → unknown 경유 cast. 런타임 shape는 transformCostLogRow 내부 fail-closed
    // guard가 검증.
    const rows = data as unknown as DbCostLogRow[];
    for (const row of rows) {
      result.push(transformCostLogRow(row));
    }
    if (rows.length < COST_LOG_PAGE_SIZE) break;
    offset += COST_LOG_PAGE_SIZE;
  }
  return result;
}
