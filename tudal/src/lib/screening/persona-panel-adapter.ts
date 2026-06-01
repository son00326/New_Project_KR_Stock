// PR-C (ADR 2026-05-31): callPersona(free-text) ↔ PersonaScore 어댑터.
// runTier1Screening의 callPersonaPanel(input:{ticker,financials})→PersonaScore[] 계약을 실 Anthropic으로 충족.
//
// 흐름: ticker당 Core 11 페르소나 각각 callPersona(PERSONA_SCORE_USER_PROMPT_TEMPLATE 주입) → content(JSON 문자열)
//      → parsePersonaScore → PersonaScore. persona_id는 input personaId로 authoritative 주입(LLM echo 미신뢰).
//
// 실패 정책: 한 페르소나라도 parse/validation 실패 시 panel 전체 reject → runTier1Screening allSettled가 ticker를 ⚪ 처리.
//           (PersonaPanelSchema + assertPanelMatchesCore11은 정확히 11명 요구 → all-or-nothing per ticker.)
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CallPersonaInput,
  CallPersonaResult,
} from "@/lib/ai/anthropic-client";
import { PERSONA_SCORE_USER_PROMPT_TEMPLATE } from "@/lib/ai/prompts/user-prompt-template";
import { PersonaScoreSchema, type PersonaScore } from "@/lib/screening/tier1-schema";

const DEFAULT_MAX_CONCURRENT_PERSONA_CALLS = 4;

function resolveMaxConcurrentCalls(explicit?: number): number {
  const raw =
    explicit ??
    (process.env.TIER1_PERSONA_MAX_CONCURRENCY
      ? Number(process.env.TIER1_PERSONA_MAX_CONCURRENCY)
      : DEFAULT_MAX_CONCURRENT_PERSONA_CALLS);
  if (!Number.isInteger(raw) || raw < 1) {
    throw new Error("invalid_tier1_persona_max_concurrency");
  }
  return raw;
}

function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    if (active >= maxConcurrent) return;
    const next = queue.shift();
    if (!next) return;
    active += 1;
    next();
  };

  return async function runLimited<T>(task: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      queue.push(resolve);
      pump();
    });
    try {
      return await task();
    } finally {
      active -= 1;
      pump();
    }
  };
}

// content에서 첫 parse 가능한 JSON object 추출 (마크다운 펜스 / 앞뒤 텍스트 허용).
function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  // ```json ... ``` 또는 ``` ... ``` 펜스 제거.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  let sawBalancedObject = false;
  for (let start = 0; start < candidate.length; start++) {
    if (candidate[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          sawBalancedObject = true;
          try {
            return JSON.parse(candidate.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  if (!sawBalancedObject) {
    throw new Error("persona_score_parse_failed:no_json_object");
  }
  throw new Error("persona_score_parse_failed:invalid_json");
}

/**
 * callPersona content(free-text JSON) → PersonaScore (순수, 유닛테스트 대상).
 * persona_id는 호출자 personaId로 주입(authoritative). rationale_kr은 80자 graceful truncate.
 * scores/winning_timeframe/conviction은 PersonaScoreSchema 검증 — 위반 시 throw.
 */
export function parsePersonaScore(content: string, personaId: string): PersonaScore {
  let raw: unknown;
  try {
    raw = extractJsonObject(content);
  } catch (err) {
    throw new Error(
      err instanceof Error && err.message.startsWith("persona_score_parse_failed")
        ? err.message
        : "persona_score_parse_failed:invalid_json",
    );
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  const candidate = {
    persona_id: personaId, // authoritative — LLM echo 미신뢰
    scores: obj.scores,
    winning_timeframe: obj.winning_timeframe,
    // rationale_kr은 80자 초과 시 ticker 전체 fail 대신 graceful truncate (한 줄 근거).
    rationale_kr:
      typeof obj.rationale_kr === "string" ? obj.rationale_kr.slice(0, 80) : "",
    conviction: obj.conviction,
  };
  const result = PersonaScoreSchema.safeParse(candidate);
  if (!result.success) {
    const path = result.error.issues[0]?.path.join(".") ?? "unknown";
    throw new Error(`persona_score_validation_failed:${path}`);
  }
  return result.data;
}

export interface CallPersonaPanelDeps {
  callPersona: (input: CallPersonaInput) => Promise<CallPersonaResult>;
  personas: readonly { id: string }[]; // CORE_11_PERSONAS
  reflectionContext: string; // 첫달은 빈 문자열
  adminUserId: string; // cron-system UUID 등
  userPromptTemplate?: string; // default = PERSONA_SCORE_USER_PROMPT_TEMPLATE
  /**
   * PR-E impl-review fix: runTier1Screening invokes 150 panels concurrently.
   * This cap is shared by the returned closure, so the real path queues 1650 persona
   * calls instead of firing them all at once and rate-limit failing the 150/150 gate.
   */
  maxConcurrentCalls?: number;
  /**
   * PR-G (cron 실 AI prep): cost_log INSERT용 client DI. callPersona로 전파.
   *   cron caller = service-role client (auth.uid()=null RLS bypass). admin caller = 미지정(session fallback).
   */
  costClient?: SupabaseClient;
}

/**
 * runMonthlyBatchOrchestrator의 callPersonaPanel DI에 주입할 실 구현 factory.
 * ticker당 personas 전원 callPersona 병렬 → PersonaScore[] (정확히 personas.length개).
 * 한 명이라도 실패하면 reject (Promise.all) → ticker ⚪.
 */
export function makeCallPersonaPanel(
  deps: CallPersonaPanelDeps,
): (input: { ticker: string; financials: string }) => Promise<PersonaScore[]> {
  const template = deps.userPromptTemplate ?? PERSONA_SCORE_USER_PROMPT_TEMPLATE;
  const runLimited = createLimiter(resolveMaxConcurrentCalls(deps.maxConcurrentCalls));
  return async ({ ticker, financials }) => {
    return Promise.all(
      deps.personas.map(async (persona) => {
        const res = await runLimited(() =>
          deps.callPersona({
            personaId: persona.id,
            ticker,
            financials,
            reflectionContext: deps.reflectionContext,
            adminUserId: deps.adminUserId,
            userPromptTemplate: template,
            costClient: deps.costClient,
          }),
        );
        return parsePersonaScore(res.content, persona.id);
      }),
    );
  };
}
