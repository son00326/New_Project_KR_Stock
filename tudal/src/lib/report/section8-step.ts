import type { SupabaseClient } from '@supabase/supabase-js';

import { callPersona, type CallPersonaResult } from '@/lib/ai/anthropic-client';
import { getRoleWorstCaseMaxCostPerCallKrw } from '@/lib/ai/model-registry';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { preflightHardcap } from '@/lib/cost/cost-logger';
import { fetchFinancialsSummary } from '@/lib/data/dart-financials';
import type { ConsensusBadge } from '@/lib/screening/consensus';

import { commitTickerReportCron } from './writer';

// ---------------------------------------------------------------------------
// P2 (PR5b) — Section 8 + committee_votes report-time step (canonical/live path).
//   design SoT: HANDOFF P2 (omxy R1~R4 CONVERGED). 핵심:
//   - 배지 = short_list_30.consensus_badge (omxy R3: report-time 1-ticker self-rank 불가 → 선정 배지 권위).
//     ⚪/null → section8_not_ready (spend 0; commit_persona_eval_cron도 non-⚪ only).
//   - 내러티브 = report-time Core-11 vote-pass (legacy vote prompt 재사용; PersonaScore와 무관).
//   - service-role DI commit (commit_persona_eval_cron, 0036) — auth.uid()=null cron 경로.
//   - costLogMonth=report month DI (preflight month == insert month, omxy R4 fix2).
//   - 선정-출력 재사용(vote/quote 영속)은 FUTURE 최적화 (P3 결합 회피).
// ---------------------------------------------------------------------------

export type CommitSection8Status =
  | 'section8_not_ready' // 배지 ⚪/null — Section 8 무의미 (no spend)
  | 'section8_unavailable' // Core-11 일부 실패 — partial commit 금지 (no DB write)
  | 'committed';

export interface CommitSection8Result {
  status: CommitSection8Status;
  reportId?: string;
}

export function isAiBadge(
  badge: string | null | undefined,
): badge is Exclude<ConsensusBadge, '⚪'> {
  return badge === '🟢' || badge === '🔵' || badge === '🟣' || badge === '🟡';
}

// 단일 ticker Core-11 vote-pass — runMonthlyPersonaEval(persona-major, batch lock)과 별개.
//   report-time per-ticker용 (batch lock 없음 — worker가 이미 report_worker_lock 보유).
export async function runCore11ForTicker(input: {
  ticker: string;
  month: string; // cost_log month (report month) DI
  adminUserId: string;
  client: SupabaseClient; // service-role (cost_log insert + financials)
}): Promise<{
  personaResults: CallPersonaResult[];
  personaIds: string[];
  available: boolean;
}> {
  const financials = await fetchFinancialsSummary(input.ticker, {
    client: input.client,
  });
  const personaResults: CallPersonaResult[] = [];
  const personaIds: string[] = [];
  let available = true;

  for (const persona of CORE_11_PERSONAS) {
    try {
      const r = await callPersona({
        personaId: persona.id,
        ticker: input.ticker,
        financials,
        reflectionContext: '',
        adminUserId: input.adminUserId,
        costClient: input.client,
        costLogMonth: input.month, // omxy R4 fix2: preflight month == insert month
      });
      personaResults.push(r);
      personaIds.push(persona.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      // transient/key/billing → 평가 불가(부분 commit 금지). 그 외 = fatal rethrow.
      if (
        msg === 'ai_key_unavailable' ||
        msg === 'ai_billing_exhausted' ||
        msg.startsWith('ai_call_failed')
      ) {
        available = false;
        break; // 11개 미만 확정 → 잔여 spend 절감 early exit
      }
      throw err;
    }
  }

  return {
    personaResults,
    personaIds,
    available: available && personaResults.length === CORE_11_PERSONAS.length,
  };
}

// Section 8 commit step — orchestrator 끝 + worker body-complete 분기 공용.
export async function commitSection8Step(input: {
  ticker: string;
  month: string; // 'YYYY-MM'
  badge: string | null; // short_list_30.consensus_badge (canonical)
  adminUserId: string; // cron-system user (p_called_by + cost_log.called_by)
  client: SupabaseClient; // service-role
}): Promise<CommitSection8Result> {
  // 배지 게이트 — ⚪/null이면 무의미 + RPC 거부 → skip, spend 0.
  if (!isAiBadge(input.badge)) {
    return { status: 'section8_not_ready' };
  }
  const badge = input.badge;

  // B7 cost guard — Core-11 reservation (callerKind:'service-role' — admin cost RPC는 0030서 revoke).
  await preflightHardcap(
    {
      month: input.month,
      lines: [{
        callCount: CORE_11_PERSONAS.length,
        maxCostPerCallKrw: getRoleWorstCaseMaxCostPerCallKrw('tier1_panel'),
      }],
    },
    { client: input.client, callerKind: 'service-role' },
  );

  const { personaResults, personaIds, available } = await runCore11ForTicker({
    ticker: input.ticker,
    month: input.month,
    adminUserId: input.adminUserId,
    client: input.client,
  });
  if (!available) {
    return { status: 'section8_unavailable' };
  }

  const { reportId } = await commitTickerReportCron(
    {
      month: input.month,
      ticker: input.ticker,
      personaResults,
      personaIds,
      badge,
    },
    { client: input.client, calledBy: input.adminUserId },
  );
  return { status: 'committed', reportId };
}
