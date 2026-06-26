import { z } from "zod";
import type {
  CallPersonaInput,
  CallPersonaResult,
} from "@/lib/ai/anthropic-client";
import type { Severity } from "@/types/admin";
import type {
  M12aDirectness,
  M12aLevel,
  M12aScope,
  M12aSurface,
  PerTickerAssessment,
} from "@/lib/news/m12a/types";

// ---------------------------------------------------------------------------
// M12a — Core 11 뉴스 평가 어댑터 (R3.10-5/6, 강한 모델 병렬).
//   (뉴스, 종목) 1쌍을 Core 11 페르소나가 병렬 평가 → 각자 구조화 판정(JSON) →
//   결정론 consensus aggregateNewsAssessment → 1개 PerTickerAssessment.
//   scope(company|sector|market|unknown)는 메타데이터(게이트 아님 — decideRecommendedAction이 분리 판정).
//
//   shadow-first: 본 어댑터는 orchestrator의 evaluateNews DI 구현. flag off면 orchestrator가 미호출(₩0).
//   테스트는 callPersona를 mock(실 AI 0). 회사 귀속(news.ticker ∈ 유니버스) 뉴스만 평가 —
//   섹터/거시 뉴스의 무귀속 종목 fan-out은 후속(seam은 affected_tickers 메타로 보존).
// ---------------------------------------------------------------------------

// {{FINANCIALS}}에 뉴스 컨텍스트를 실어 보낸다(renderUserPrompt 무수정). 출력은 strict JSON.
export const M12A_NEWS_USER_PROMPT_TEMPLATE = `당신은 보유/관찰 종목 {{TICKER}}의 투자 thesis 관점에서 아래 뉴스를 평가합니다.

뉴스 컨텍스트:
{{FINANCIALS}}

이 뉴스가 종목 {{TICKER}}의 기존 투자 thesis를 깨뜨리는지(per-company thesis-break) 판정하세요. 예측/목표가가 아니라 사실 기반 영향 판정입니다.
아래 JSON 스키마로만 답하세요(추가 텍스트 금지):
{"scope":"company|sector|market|unknown","severity":"critical|warning|info","confidence":"low|medium|high","materiality":"low|medium|high","directness":"direct|indirect","thesis_break":true|false,"thesis_break_reason":"한 줄 사유 또는 null","affected_tickers":["6자리",...]}`;

const LEVELS: readonly M12aLevel[] = ["low", "medium", "high"];

const NewsJudgmentSchema = z.object({
  scope: z.enum(["company", "sector", "market", "unknown"]),
  severity: z.enum(["critical", "warning", "info"]),
  confidence: z.enum(["low", "medium", "high"]),
  materiality: z.enum(["low", "medium", "high"]),
  directness: z.enum(["direct", "indirect"]),
  thesis_break: z.boolean(),
  thesis_break_reason: z.string().nullable(),
  affected_tickers: z.array(z.string()),
});

export interface NewsPersonaJudgment {
  scope: M12aScope;
  severity: Severity;
  confidence: M12aLevel;
  materiality: M12aLevel;
  directness: M12aDirectness;
  thesisBreak: boolean;
  thesisBreakReason: string | null;
  affectedTickers: string[];
}

// persona content(JSON, 코드펜스 허용) → NewsPersonaJudgment. 파싱/검증 실패 시 throw(caller가 처리).
export function parseNewsPersonaJudgment(content: string): NewsPersonaJudgment {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("m12a_news_judgment_parse_failed:no_json");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error("m12a_news_judgment_parse_failed:invalid_json");
  }
  const parsed = NewsJudgmentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("m12a_news_judgment_parse_failed:schema");
  }
  const j = parsed.data;
  return {
    scope: j.scope,
    severity: j.severity,
    confidence: j.confidence,
    materiality: j.materiality,
    directness: j.directness,
    thesisBreak: j.thesis_break,
    thesisBreakReason: j.thesis_break_reason,
    affectedTickers: j.affected_tickers,
  };
}

function majorityCount(n: number): number {
  return Math.floor(n / 2) + 1; // 과반(>n/2)
}

// 보수적 consensus level: 과반이 도달한 최고 level(없으면 low). auto_remove 게이트가 high를 요구하므로
//   high는 진짜 과반 합의일 때만.
function consensusLevel(levels: M12aLevel[], panelSize: number): M12aLevel {
  const need = majorityCount(panelSize);
  for (let i = LEVELS.length - 1; i >= 0; i -= 1) {
    const L = LEVELS[i];
    const atLeast = levels.filter((v) => LEVELS.indexOf(v) >= i).length;
    if (atLeast >= need) return L;
  }
  return "low";
}

function modal<T extends string>(values: T[], fallback: T): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = fallback;
  let bestN = -1;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export interface AggregateNewsAssessmentInput {
  ticker: string;
  surface: M12aSurface;
  track?: "short" | "midlong";
  newsEventId: string;
  newsTitle: string;
  newsUrl: string;
  judgments: NewsPersonaJudgment[];
  totalPanelSize?: number;
}

/**
 * Core 11 판정 → 1개 PerTickerAssessment (보수적 결정론 consensus).
 *   confidence/materiality = consensusLevel(과반 도달 최고 level) · directness = 과반 direct
 *   thesisBreak = 과반 true · scope/severity = modal · affectedTickers = 과반 thesis_break이면 ticker 포함.
 */
export function aggregateNewsAssessment(
  input: AggregateNewsAssessmentInput,
): PerTickerAssessment {
  const js = input.judgments;
  if (js.length === 0) {
    throw new Error("m12a_aggregate_empty_judgments");
  }
  const panelSize = input.totalPanelSize ?? js.length;
  const need = majorityCount(panelSize);
  const thesisBreak = js.filter((j) => j.thesisBreak).length >= need;
  const directness: M12aDirectness =
    js.filter((j) => j.directness === "direct").length >= need
      ? "direct"
      : "indirect";
  // thesis_break 사유 = break를 본 페르소나의 최빈 사유(없으면 null).
  const breakReasons = js
    .filter((j) => j.thesisBreak && j.thesisBreakReason)
    .map((j) => j.thesisBreakReason as string);
  const thesisBreakReason =
    thesisBreak && breakReasons.length > 0
      ? modal(breakReasons, breakReasons[0])
      : null;
  // 과반이 이 ticker를 affected로 본 경우에만 affectedTickers에 포함(auto_remove 게이트 정합).
  const affectedForThis =
    js.filter((j) => j.affectedTickers.includes(input.ticker)).length >= need;

  return {
    ticker: input.ticker,
    surface: input.surface,
    track: input.track,
    scope: modal(
      js.map((j) => j.scope),
      "unknown",
    ),
    severity: modal(
      js.map((j) => j.severity),
      "info",
    ),
    confidence: consensusLevel(
      js.map((j) => j.confidence),
      panelSize,
    ),
    materiality: consensusLevel(
      js.map((j) => j.materiality),
      panelSize,
    ),
    directness,
    thesisBreak,
    thesisBreakReason,
    affectedTickers: affectedForThis ? [input.ticker] : [],
    newsEventId: input.newsEventId,
    newsTitle: input.newsTitle,
    newsUrl: input.newsUrl,
  };
}

export interface M12aNewsEvaluatorDeps {
  callPersona: (input: CallPersonaInput) => Promise<CallPersonaResult>;
  personas: readonly { id: string }[]; // CORE_11_PERSONAS
  adminUserId: string;
  costClient?: import("@supabase/supabase-js").SupabaseClient;
  costLogMonth?: string;
  // 패널 일부 실패 허용 비율(기본: 1명만 성공해도 aggregate). 전원 실패면 그 (뉴스,종목) skip.
}

export interface M12aNewsItem {
  newsEventId: string;
  ticker: string; // KRX 6자리(회사 귀속 뉴스)
  title: string;
  url: string;
  context?: string; // 추가 본문(없으면 title)
}

export interface EvaluateNewsInput {
  newsItems: M12aNewsItem[];
  listTracks: ReadonlyMap<string, "short" | "midlong">; // ticker → 트랙(홈 리스트)
  portfolioTickers: ReadonlySet<string>; // 보유 가상포트 ticker
}

/**
 * orchestrator.evaluateNews DI 구현 — 회사 귀속 뉴스(ticker ∈ list ∪ portfolio)를 Core 11로 평가.
 *   동일 ticker가 list+portfolio 양쪽이면 surface별 2개 assessment.
 *   한 (뉴스,종목)의 페르소나가 전원 실패하면 그 쌍 skip(graceful). 부분 성공이면 성공분으로 aggregate.
 */
export function makeM12aNewsEvaluator(
  deps: M12aNewsEvaluatorDeps,
): (input: EvaluateNewsInput) => Promise<PerTickerAssessment[]> {
  return async ({ newsItems, listTracks, portfolioTickers }) => {
    const out: PerTickerAssessment[] = [];
    for (const item of newsItems) {
      const inList = listTracks.has(item.ticker);
      const inPortfolio = portfolioTickers.has(item.ticker);
      if (!inList && !inPortfolio) continue; // 유니버스 밖 — skip(비용 절약)

      const settled = await Promise.allSettled(
        deps.personas.map((p) =>
          deps.callPersona({
            personaId: p.id,
            ticker: item.ticker,
            financials: item.context ?? item.title,
            reflectionContext: "",
            adminUserId: deps.adminUserId,
            userPromptTemplate: M12A_NEWS_USER_PROMPT_TEMPLATE,
            costClient: deps.costClient,
            costLogMonth: deps.costLogMonth,
          }),
        ),
      );
      const judgments: NewsPersonaJudgment[] = [];
      for (const r of settled) {
        if (r.status !== "fulfilled") continue;
        try {
          judgments.push(parseNewsPersonaJudgment(r.value.content));
        } catch {
          // 파싱 실패 persona는 제외(부분 성공 허용)
        }
      }
      if (judgments.length === 0) continue; // 전원 실패 — 그 쌍 skip

      const surfaces: M12aSurface[] = [];
      if (inList) surfaces.push("list");
      if (inPortfolio) surfaces.push("portfolio");
      for (const surface of surfaces) {
        out.push(
          aggregateNewsAssessment({
            ticker: item.ticker,
            surface,
            track: surface === "list" ? listTracks.get(item.ticker) : undefined,
            newsEventId: item.newsEventId,
            newsTitle: item.title,
            newsUrl: item.url,
            judgments,
            totalPanelSize: deps.personas.length,
          }),
        );
      }
    }
    return out;
  };
}
