import type { CommitteeVote } from "@/types/admin";
import { MOCK_ADMIN_REPORTS } from "@/lib/data/mock-admin-report";
import { MOCK_ADMIN_SHORTLIST } from "@/lib/data/mock-admin-shortlist";
import {
  CORE_PERSONAS,
  getSectorPersonas,
} from "@/lib/data/mock-admin-committee-personas";

// S2 mock — E3 CommitteeVote. Core 11 + Sector 5 per report.
// Vote 분포는 리포트의 composite score에서 결정적 유도 (BL-4 B codegen 전략).
// approve/reject/abstain 각 페르소나 할당은 페르소나 archetype 관점에서 공정 분배.

const CREATED_AT = "2026-04-01T00:10:00.000Z";

type VoteOutcome = "approve" | "reject" | "abstain";

// Core 11 페르소나에 대해 composite score별 투표 결과 매핑
// (approve 순서 · reject 순서 · abstain 순서) 고정 — 페르소나별 성향 반영
const CORE_ORDER_APPROVE = [
  "core-5", // Quality
  "core-2", // Growth
  "core-10", // Thematic
  "core-7", // Momentum
  "core-3", // Macro
  "core-9", // Dividend
  "core-4", // Quant
  "core-1", // Value
  "core-11", // Tactical
  "core-8", // Contrarian
  "core-6", // Risk-off
] as const;
const CORE_ORDER_REJECT = [...CORE_ORDER_APPROVE].reverse();

function distributeCoreVotes(composite: number): Map<string, VoteOutcome> {
  let approve: number, reject: number, abstain: number;
  if (composite >= 88) ({ approve, reject, abstain } = { approve: 10, reject: 0, abstain: 1 });
  else if (composite >= 80) ({ approve, reject, abstain } = { approve: 8, reject: 1, abstain: 2 });
  else if (composite >= 72) ({ approve, reject, abstain } = { approve: 6, reject: 3, abstain: 2 });
  else ({ approve, reject, abstain } = { approve: 4, reject: 4, abstain: 3 });

  const out = new Map<string, VoteOutcome>();
  const approvers = CORE_ORDER_APPROVE.slice(0, approve);
  approvers.forEach((id) => out.set(id, "approve"));
  const rejecters = CORE_ORDER_REJECT.filter((id) => !out.has(id)).slice(0, reject);
  rejecters.forEach((id) => out.set(id, "reject"));
  CORE_PERSONAS.forEach((p) => {
    if (!out.has(p.id)) out.set(p.id, "abstain");
  });
  // Sanity: 총합 = 11
  void abstain;
  return out;
}

function distributeSectorVotes(
  composite: number,
  sectorPersonaIds: string[],
): Map<string, VoteOutcome> {
  // composite별 (approve, reject, abstain) — sector 5인
  let a: number, r: number, ab: number;
  if (composite >= 88) [a, r, ab] = [5, 0, 0];
  else if (composite >= 80) [a, r, ab] = [4, 1, 0];
  else if (composite >= 72) [a, r, ab] = [3, 1, 1];
  else [a, r, ab] = [2, 2, 1];
  const out = new Map<string, VoteOutcome>();
  const ids = sectorPersonaIds;
  ids.slice(0, a).forEach((id) => out.set(id, "approve"));
  ids.slice(a, a + r).forEach((id) => out.set(id, "reject"));
  ids.slice(a + r, a + r + ab).forEach((id) => out.set(id, "abstain"));
  return out;
}

function pickArgument(
  personaId: string,
  outcome: VoteOutcome,
  tickerSummary: string,
): string {
  // 페르소나 archetype + 종목 특성 간단 매핑
  const persona = CORE_PERSONAS.find((p) => p.id === personaId);
  const archetype = persona?.archetype ?? "Generic";
  const prefix: Record<VoteOutcome, string> = {
    approve: `[${archetype}]`,
    reject: `[${archetype}·반대]`,
    abstain: `[${archetype}·기권]`,
  };
  const body =
    outcome === "approve"
      ? tickerSummary
      : outcome === "reject"
        ? "상방 서사 대비 하방 시나리오 근거 우세."
        : "결정적 시그널 부족, 다음 사이클 관찰.";
  return `${prefix[outcome]} ${body}`;
}

// ─── 실제 투표 생성 ─────────────────────────────────────────────────────────
export const MOCK_ADMIN_COMMITTEE_VOTES: CommitteeVote[] = MOCK_ADMIN_REPORTS.flatMap(
  (report) => {
    const row = MOCK_ADMIN_SHORTLIST.find((r) => r.ticker === report.ticker);
    if (!row) return [];

    const firstLine = row.summary3Line.split("\n")[0] ?? row.signalLabel;

    // Core 11
    const coreVotes = distributeCoreVotes(report.section_0 && typeof report.section_0 === "object"
      ? ((report.section_0 as { conviction?: number }).conviction ?? row.compositeScore)
      : row.compositeScore);

    const coreRecords: CommitteeVote[] = CORE_PERSONAS.map((p) => ({
      id: `vote-${report.id}-${p.id}`,
      reportId: report.id,
      personaId: p.id,
      personaLayer: "core",
      vote: coreVotes.get(p.id) ?? "abstain",
      argumentExcerpt: pickArgument(p.id, coreVotes.get(p.id) ?? "abstain", firstLine),
      createdAt: CREATED_AT,
    }));

    // Sector Board (해당 섹터 5인)
    const sectorPersonas = getSectorPersonas(row.sector);
    const sectorIds = sectorPersonas.map((p) => p.id);
    const sectorVotes = distributeSectorVotes(row.compositeScore, sectorIds);

    const sectorRecords: CommitteeVote[] = sectorPersonas.map((p) => ({
      id: `vote-${report.id}-${p.id}`,
      reportId: report.id,
      personaId: p.id,
      personaLayer: "sector",
      sector: p.sector,
      vote: sectorVotes.get(p.id) ?? "abstain",
      argumentExcerpt:
        sectorVotes.get(p.id) === "approve"
          ? `[${p.archetype}] ${row.deltaReason}`
          : sectorVotes.get(p.id) === "reject"
            ? `[${p.archetype}·반대] ${row.sector} 섹터 단기 피크아웃 우려.`
            : `[${p.archetype}·기권] 섹터 레벨 판단 유보.`,
      createdAt: CREATED_AT,
    }));

    return [...coreRecords, ...sectorRecords];
  },
);

// 리포트별 투표 조회 헬퍼
export function getVotesByReportId(reportId: string): CommitteeVote[] {
  return MOCK_ADMIN_COMMITTEE_VOTES.filter((v) => v.reportId === reportId);
}

// 집계 유틸 (M3 Section 8 패널용)
export function aggregateVotes(votes: CommitteeVote[]) {
  const init = { approve: 0, reject: 0, abstain: 0 };
  const core = { ...init };
  const sector = { ...init };
  votes.forEach((v) => {
    const target = v.personaLayer === "core" ? core : sector;
    target[v.vote] += 1;
  });
  return { core, sector };
}
