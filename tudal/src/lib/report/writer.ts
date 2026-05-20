import { createClient } from '@/lib/supabase/server';
import { getPersonaById } from '@/lib/ai/prompts/personas';
import type { CallPersonaResult } from '@/lib/ai/anthropic-client';
import type { ConsensusBadge } from '@/lib/screening/consensus';
import {
  type CanonicalSector,
  SECTOR_PERSONA_COUNT,
  resolveSlotTemplate,
} from '@/lib/screening/canonical-sectors';
import type { Section8 } from './section-8-schema';

interface ParsedPersonaResponse {
  vote: 'BUY' | 'HOLD' | 'SELL';
  one_line: string;
  argument_excerpt: string;
}

function parseContent(content: string): ParsedPersonaResponse {
  try {
    const parsed = JSON.parse(content);
    return {
      vote: parsed.vote,
      one_line: parsed.one_line,
      argument_excerpt: parsed.argument_excerpt,
    };
  } catch {
    return { vote: 'HOLD', one_line: 'parse failed', argument_excerpt: content.slice(0, 200) };
  }
}

export interface CommitTickerReportInput {
  month: string;
  ticker: string;
  personaResults: CallPersonaResult[]; // length 11, persona order matches personaIds
  personaIds: string[]; // length 11
  badge: Exclude<ConsensusBadge, '⚪'>; // 🟢🔵🟣🟡 only (Plan R3 BLOCKER 7 — ⚪는 commit_badge_only)
}

export async function commitTickerReport(input: CommitTickerReportInput): Promise<{ reportId: string }> {
  if (input.personaResults.length !== 11 || input.personaIds.length !== 11) {
    throw new Error('writer_persona_count_mismatch');
  }

  // Part D (Core 11) 생성
  const partD = input.personaIds.map((id, i) => {
    const persona = getPersonaById(id);
    const parsed = parseContent(input.personaResults[i].content);
    return {
      persona_id: id,
      label: persona?.label ?? id,
      philosophy: persona?.philosophy ?? '',
      vote: parsed.vote,
      one_line: parsed.one_line,
    };
  });

  // Part B (issue debates) — B 범위: 페르소나 응답에서 의견 차이가 큰 3개 추출 (간단 휴리스틱)
  // 정교한 issue extraction은 후속 PR. 본 PR은 stub 3 issue.
  const partB = [
    {
      issue: '실적 모멘텀',
      pro_quote:
        input.personaResults.find((_, i) => parseContent(input.personaResults[i].content).vote === 'BUY')?.content.slice(0, 100) ?? '',
      con_quote:
        input.personaResults.find((_, i) => parseContent(input.personaResults[i].content).vote === 'SELL')?.content.slice(0, 100) ?? '',
    },
    {
      issue: '재무 건전성',
      pro_quote: 'stub',
      con_quote: 'stub',
    },
    {
      issue: '경영진 품질',
      pro_quote: 'stub',
      con_quote: 'stub',
    },
  ];

  // Part C (최종 합의 패널)
  const voteCounts = partD.reduce(
    (acc, v) => {
      acc[v.vote]++;
      return acc;
    },
    { BUY: 0, HOLD: 0, SELL: 0 },
  );
  const verdict: 'BUY' | 'HOLD' | 'SELL' =
    voteCounts.BUY > voteCounts.HOLD && voteCounts.BUY > voteCounts.SELL
      ? 'BUY'
      : voteCounts.SELL > voteCounts.HOLD
        ? 'SELL'
        : 'HOLD';
  // MANDATED DEVIATION: schema requires lowercase keys for core_revote
  const partC = {
    sector_aggregate: { buy: 0, hold: 0, sell: 0 }, // Tier 2 미활성
    core_revote: { buy: voteCounts.BUY, hold: voteCounts.HOLD, sell: voteCounts.SELL },
    co_chair_unanimous: false, // 본 PR은 단순 다수결, 만장일치 판정 후속
    verdict,
    rationale: [
      `Core 11 중 BUY ${voteCounts.BUY}표, HOLD ${voteCounts.HOLD}표, SELL ${voteCounts.SELL}표`,
      `위원장 의견: ${parseContent(input.personaResults[10].content).one_line}`,
      `최종 판정: ${verdict}`,
    ],
  };

  const section8: Section8 = {
    partA: [], // B 범위 — Tier 2 deferred
    partB,
    partC,
    partD,
  };

  // committee_votes payload (RPC가 INSERT) — BUY/HOLD/SELL literal 그대로 (DB enum 매핑은 RPC 내부 책임)
  const votes = partD.map((v) => ({
    persona_id: v.persona_id,
    persona_layer: 'core',
    vote: v.vote,
    argument_excerpt: parseContent(input.personaResults[input.personaIds.indexOf(v.persona_id)].content).argument_excerpt,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('commit_persona_eval', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_section_8: section8,
    p_votes: votes,
    p_consensus_badge: input.badge, // Plan R3 BLOCKER 7
  });

  if (error) {
    throw new Error(`commit_persona_eval_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('commit_persona_eval_failed:no_success');
  }
  return { reportId: data.report_id };
}

export async function commitBadgeOnly(input: { month: string; ticker: string }): Promise<{ ok: true }> {
  // Plan R3 BLOCKER 7: tier1Available=false 케이스 ⚪ persistence
  const supabase = await createClient();
  const { error } = await supabase.rpc('commit_badge_only', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_consensus_badge: '⚪',
  });
  if (error) throw new Error(`commit_badge_only_failed:${error.code ?? 'unknown'}`);
  return { ok: true };
}

// Tier 2 implementation (52차 D21) — Sector Board 14 personas commit.
// SoT = ServicePlan-Admin §1A.5 D21 + ReportFramework §7.2/§7.3 v2.5 + 마이그 0019.
// omxy R1~R3 CONVERGED + 4 acceptance details + subagent gsd BLOCKERS.
//
// 호출 조건: Core 11 (commitTickerReport) 성공 후 + Tier 2 degraded 아님 (persona-eval 결정).
// degraded 케이스 = 본 함수 호출 자체 skip (R2 B1 + R3 acc#4 — committee_votes 오염 0).
// caller wiring (cron/admin server action)은 별도 PR (R1 #7 OOS).

export interface CommitSectorReportInput {
  month: string;                               // 'YYYY-MM'
  ticker: string;                              // 6자리 KRX
  sector: CanonicalSector;                     // canonical 14 (canonical-sectors.ts)
  sub_tags?: readonly string[];                // 운영 UI sub_tags (D21 crosswalk)
  sectorPersonaResults: CallPersonaResult[];   // length 14 happy-path만 (degraded면 caller가 skip)
  sectorPersonaIds: string[];                  // length 14, slot_index 1~14 순서
}

export async function commitSectorReport(
  input: CommitSectorReportInput,
): Promise<{ reportId: string; votesInserted: number }> {
  // R2 B2 + R3 acc#3: length=14 가드
  if (
    input.sectorPersonaResults.length !== SECTOR_PERSONA_COUNT ||
    input.sectorPersonaIds.length !== SECTOR_PERSONA_COUNT
  ) {
    throw new Error('sector_writer_persona_count_mismatch');
  }

  const slotTemplate = resolveSlotTemplate(input.sector, input.sub_tags ?? []);

  // partA = 14 sectorVoteRow (writer composes rich labels from canonical-sectors.ts crosswalk)
  const partA = input.sectorPersonaIds.map((id, i) => {
    const parsed = parseContent(input.sectorPersonaResults[i].content);
    const slot = slotTemplate[i];
    return {
      persona_id: id,
      label: slot.role,
      background:
        slot.slot_type === 'sub_tag_overlay' && slot.sub_tag !== undefined
          ? `${slot.role} (sub_tag: ${slot.sub_tag})`
          : slot.role,
      vote: parsed.vote,
      one_line: parsed.one_line,
    };
  });

  // sector_aggregate = vote 카운트 (R3 acc#1 exact keys)
  const sectorAggregate = partA.reduce(
    (acc, row) => {
      if (row.vote === 'BUY') acc.buy++;
      else if (row.vote === 'HOLD') acc.hold++;
      else if (row.vote === 'SELL') acc.sell++;
      return acc;
    },
    { buy: 0, hold: 0, sell: 0 },
  );

  // committee_votes payload — persona_layer='sector', slim
  const votes = input.sectorPersonaIds.map((id, i) => {
    const parsed = parseContent(input.sectorPersonaResults[i].content);
    return {
      persona_id: id,
      persona_layer: 'sector',
      vote: parsed.vote,
      argument_excerpt: parsed.argument_excerpt,
    };
  });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('commit_sector_personas', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_sector: input.sector,
    p_part_a: partA,
    p_sector_aggregate: sectorAggregate,
    p_votes: votes,
  });

  if (error) {
    throw new Error(`commit_sector_personas_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('commit_sector_personas_failed:no_success');
  }
  return { reportId: data.report_id, votesInserted: data.votes_inserted };
}
