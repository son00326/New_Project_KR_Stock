import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PrismMarket = "kr" | "us";
export type PrismSnapshotSlot = "am" | "pm" | "daily";
export type PrismSectionObject = Readonly<Record<string, unknown>>;
export type PrismSection = PrismSectionObject | readonly PrismSectionObject[];

export interface ParsedPrismPayload {
  readonly generatedAt: string;
  readonly tradingMode: string;
  readonly market: "KR" | "US" | null;
  readonly currency: "KRW" | "USD" | null;
  readonly summary: PrismSectionObject | null;
  readonly holdings: readonly PrismSectionObject[] | null;
  readonly realPortfolio: readonly PrismSectionObject[] | null;
  readonly accountSummary: PrismSectionObject | null;
  readonly tradingHistory: readonly PrismSectionObject[] | null;
  readonly watchlist: readonly PrismSectionObject[] | null;
  readonly holdingDecisions: readonly PrismSectionObject[] | null;
  readonly prismPerformance: readonly PrismSectionObject[] | null;
  readonly marketCondition: readonly PrismSectionObject[] | null;
  readonly extraSections: Readonly<Record<string, PrismSection | null>>;
}

export interface PrismTerminalPerformance {
  readonly date: string;
  readonly cumulativeRealizedProfit: number;
  readonly prismSimulatorReturn: number;
}

export interface PrismSnapshot {
  readonly id: string;
  readonly market: PrismMarket;
  readonly snapshotDate: string;
  readonly snapshotSlot: PrismSnapshotSlot;
  readonly marketSessionDate: string;
  readonly generatedAt: string;
  readonly payload: ParsedPrismPayload;
  readonly terminalPerformance: PrismTerminalPerformance | null;
}

export interface PrismHistoryPoint {
  readonly market: PrismMarket;
  readonly snapshotDate: string;
  readonly snapshotSlot: PrismSnapshotSlot;
  readonly marketSessionDate: string;
  readonly terminalPerformance: PrismTerminalPerformance | null;
}

export interface PrismBenchmarkMeta {
  readonly market: PrismMarket;
  readonly benchmarkSessionDate: string;
  readonly anchoredSnapshotId: string;
  readonly createdAt: string;
}

export interface PrismStaleStatus {
  readonly isStale: boolean;
  readonly nextScheduledAt: Date;
  readonly staleAfter: Date;
}

export class PrismDataError extends Error {
  readonly kind: "forbidden" | "query" | "validation";

  constructor(kind: PrismDataError["kind"], message: string) {
    super(message);
    this.name = "PrismDataError";
    this.kind = kind;
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HISTORY_COLUMNS =
  "market, snapshot_date, snapshot_slot, market_session_date, terminal_performance";
const LATEST_COLUMNS = `${HISTORY_COLUMNS}, id, generated_at, payload`;
const KNOWN_PAYLOAD_KEYS = new Set([
  "generated_at", "trading_mode", "market", "currency", "summary", "holdings",
  "real_portfolio", "account_summary", "trading_history", "watchlist",
  "holding_decisions", "prism_performance", "market_condition",
]);
const requiredValueSchema = z.unknown().refine((value) => value !== undefined);
const envelopeSchema = z.object({
  generated_at: z.string().max(80),
  trading_mode: z.string().max(80),
  market: z.enum(["KR", "US"]).optional(),
  currency: z.enum(["KRW", "USD"]).optional(),
  summary: requiredValueSchema,
  holdings: requiredValueSchema,
  real_portfolio: requiredValueSchema,
  account_summary: requiredValueSchema,
  trading_history: requiredValueSchema,
  watchlist: requiredValueSchema,
}).loose();
const sectionObjectSchema = z.record(z.string().max(120), z.unknown())
  .refine((value) => Object.keys(value).length <= 120);
const sectionArraySchema = z.array(sectionObjectSchema).max(5_000);
const sectionSchema = z.union([sectionObjectSchema, sectionArraySchema]);
const terminalSchema = z.object({
  date: z.string().regex(DATE_PATTERN),
  cumulative_realized_profit: z.number().finite(),
  prism_simulator_return: z.number().finite(),
}).loose();
const historyRowSchema = z.object({
  market: z.enum(["kr", "us"]),
  snapshot_date: z.string().regex(DATE_PATTERN),
  snapshot_slot: z.enum(["am", "pm", "daily"]),
  market_session_date: z.string().regex(DATE_PATTERN),
  terminal_performance: z.unknown().nullable(),
});
const latestRowSchema = historyRowSchema.extend({
  id: z.string().uuid(),
  generated_at: z.string().max(80),
  payload: z.unknown(),
});
const metaRowSchema = z.object({
  market: z.enum(["kr", "us"]),
  benchmark_session_date: z.string().regex(DATE_PATTERN),
  anchored_snapshot_id: z.string().uuid(),
  created_at: z.string().max(80),
});

function parseSection<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

export function parsePrismPayload(input: unknown, expectedMarket: PrismMarket): ParsedPrismPayload {
  const result = envelopeSchema.safeParse(input);
  if (!result.success) throw new PrismDataError("validation", "PRISM payload envelope validation failed");
  const value = result.data;
  const marketMatches = expectedMarket === "us"
    ? value.market === "US" && value.currency === "USD"
    : (value.market === undefined || value.market === "KR")
      && (value.currency === undefined || value.currency === "KRW");
  if (!marketMatches) throw new PrismDataError("validation", "PRISM payload market mismatch");
  const extraSections: Record<string, PrismSection | null> = {};
  for (const [key, section] of Object.entries(value)) {
    if (!KNOWN_PAYLOAD_KEYS.has(key)) extraSections[key] = parseSection(sectionSchema, section);
  }
  return {
    generatedAt: value.generated_at,
    tradingMode: value.trading_mode,
    market: value.market ?? null,
    currency: value.currency ?? null,
    summary: parseSection(sectionObjectSchema, value.summary),
    holdings: parseSection(sectionArraySchema, value.holdings),
    realPortfolio: parseSection(sectionArraySchema, value.real_portfolio),
    accountSummary: parseSection(sectionObjectSchema, value.account_summary),
    tradingHistory: parseSection(sectionArraySchema, value.trading_history),
    watchlist: parseSection(sectionArraySchema, value.watchlist),
    holdingDecisions: value.holding_decisions === undefined
      ? [] : parseSection(sectionArraySchema, value.holding_decisions),
    prismPerformance: value.prism_performance === undefined
      ? [] : parseSection(sectionArraySchema, value.prism_performance),
    marketCondition: value.market_condition === undefined
      ? [] : parseSection(sectionArraySchema, value.market_condition),
    extraSections,
  };
}

function parseTerminal(input: unknown): PrismTerminalPerformance | null {
  if (input === null) return null;
  const result = terminalSchema.safeParse(input);
  if (!result.success) throw new PrismDataError("validation", "PRISM terminal performance validation failed");
  return {
    date: result.data.date,
    cumulativeRealizedProfit: result.data.cumulative_realized_profit,
    prismSimulatorReturn: result.data.prism_simulator_return,
  };
}

export function transformPrismSnapshotRow(input: unknown): PrismSnapshot {
  const result = latestRowSchema.safeParse(input);
  if (!result.success) throw new PrismDataError("validation", "PRISM snapshot validation failed");
  const row = result.data;
  return {
    id: row.id, market: row.market, snapshotDate: row.snapshot_date,
    snapshotSlot: row.snapshot_slot, marketSessionDate: row.market_session_date,
    generatedAt: row.generated_at, payload: parsePrismPayload(row.payload, row.market),
    terminalPerformance: parseTerminal(row.terminal_performance),
  };
}

function transformHistoryRow(input: unknown, market: PrismMarket): PrismHistoryPoint {
  const result = historyRowSchema.safeParse(input);
  if (!result.success || result.data.market !== market) {
    throw new PrismDataError("validation", "PRISM history validation failed");
  }
  const row = result.data;
  return {
    market: row.market, snapshotDate: row.snapshot_date, snapshotSlot: row.snapshot_slot,
    marketSessionDate: row.market_session_date,
    terminalPerformance: parseTerminal(row.terminal_performance),
  };
}

export function selectPrismHistoryRows(input: readonly unknown[], market: PrismMarket): PrismHistoryPoint[] {
  const rows = input.map((row) => transformHistoryRow(row, market));
  if (market === "us") return rows.filter((row) => row.snapshotSlot === "daily");
  const byDate = new Map<string, PrismHistoryPoint>();
  for (const row of rows) {
    if (row.snapshotSlot === "daily") throw new PrismDataError("validation", "PRISM KR history slot mismatch");
    const selected = byDate.get(row.snapshotDate);
    if (selected === undefined || row.snapshotSlot === "pm") byDate.set(row.snapshotDate, row);
  }
  return [...byDate.values()].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
}

async function requireAdmin(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.rpc("is_admin");
  if (error || data !== true) throw new PrismDataError("forbidden", "PRISM admin access required");
}

function queryFailed(scope: string, error: { readonly message?: string } | null): PrismDataError {
  return new PrismDataError("query", `${scope} query failed: ${error?.message ?? "unknown error"}`);
}

export async function getLatestPrismSnapshot(market: PrismMarket): Promise<PrismSnapshot | null> {
  const client = await createClient();
  await requireAdmin(client);
  const { data, error } = await client.from("prism_snapshot").select(LATEST_COLUMNS)
    .eq("market", market).order("generated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw queryFailed("prism_snapshot latest", error);
  return data === null ? null : transformPrismSnapshotRow(data);
}

export async function getPrismHistorySeries(market: PrismMarket): Promise<PrismHistoryPoint[]> {
  const client = await createClient();
  await requireAdmin(client);
  let query = client.from("prism_snapshot").select(HISTORY_COLUMNS).eq("market", market);
  query = market === "kr" ? query.in("snapshot_slot", ["am", "pm"]) : query.eq("snapshot_slot", "daily");
  const { data, error } = await query.order("snapshot_date", { ascending: true });
  if (error) throw queryFailed("prism_snapshot history", error);
  return selectPrismHistoryRows(data ?? [], market);
}

export async function getPrismBenchmarkMeta(): Promise<PrismBenchmarkMeta[]> {
  const client = await createClient();
  await requireAdmin(client);
  const { data, error } = await client.from("prism_benchmark_meta")
    .select("market, benchmark_session_date, anchored_snapshot_id, created_at")
    .order("market", { ascending: true });
  if (error) throw queryFailed("prism_benchmark_meta", error);
  return (data ?? []).map((input) => {
    const result = metaRowSchema.safeParse(input);
    if (!result.success) throw new PrismDataError("validation", "PRISM benchmark meta validation failed");
    return {
      market: result.data.market,
      benchmarkSessionDate: result.data.benchmark_session_date,
      anchoredSnapshotId: result.data.anchored_snapshot_id,
      createdAt: result.data.created_at,
    };
  });
}

function scheduledAt(date: string, hour: number, minute: number): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute));
}

function nextDate(date: string, acceptsDay: (day: number) => boolean): string {
  const cursor = scheduledAt(date, 9, 0);
  do cursor.setUTCDate(cursor.getUTCDate() + 1); while (!acceptsDay(cursor.getUTCDay()));
  return cursor.toISOString().slice(0, 10);
}

export function getPrismStaleStatus(
  latest: Pick<PrismSnapshot, "market" | "snapshotDate" | "snapshotSlot">,
  now = new Date(),
): PrismStaleStatus {
  let nextScheduledAt: Date;
  if (latest.market === "kr") {
    if (latest.snapshotSlot === "daily") throw new PrismDataError("validation", "PRISM KR slot mismatch");
    nextScheduledAt = latest.snapshotSlot === "am"
      ? scheduledAt(latest.snapshotDate, 17, 25)
      : scheduledAt(nextDate(latest.snapshotDate, (day) => day >= 1 && day <= 5), 11, 20);
  } else {
    if (latest.snapshotSlot !== "daily") throw new PrismDataError("validation", "PRISM US slot mismatch");
    nextScheduledAt = scheduledAt(nextDate(latest.snapshotDate, (day) => day >= 2 && day <= 6), 8, 15);
  }
  const staleAfter = new Date(nextScheduledAt.getTime() + 12 * 60 * 60 * 1_000);
  return { isStale: now.getTime() > staleAfter.getTime(), nextScheduledAt, staleAfter };
}

export function isPrismSnapshotStale(
  latest: Pick<PrismSnapshot, "market" | "snapshotDate" | "snapshotSlot">,
  now = new Date(),
): boolean {
  return getPrismStaleStatus(latest, now).isStale;
}

function requireFiniteUnit(value: number): number {
  if (!Number.isFinite(value)) throw new PrismDataError("validation", "PRISM return unit must be finite");
  return value;
}

export function joopickFractionToPrismPercent(value: number): number {
  return requireFiniteUnit(value) * 100;
}

export function prismPercentToJoopickFraction(value: number): number {
  return requireFiniteUnit(value) / 100;
}
