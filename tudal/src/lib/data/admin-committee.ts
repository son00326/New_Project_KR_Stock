import { createClient } from "@/lib/supabase/server";
import type { CommitteeVote, PersonaLayer, VoteKind } from "@/types/admin";

// ---------------------------------------------------------------------------
// committee_votes (E3) — Supabase 실 SELECT (T7e.3).
// RLS 정책 = is_admin() (0003 마이그). 에러는 throw (T7e.2 정책 동일).
// ---------------------------------------------------------------------------

export interface CommitteeVoteDbRow {
  id: string;
  report_id: string;
  persona_id: string;
  persona_layer: PersonaLayer;
  sector: string | null;
  vote: VoteKind;
  argument_excerpt: string | null;
  created_at: string;
}

const VOTE_COLUMNS =
  "id, report_id, persona_id, persona_layer, sector, vote, argument_excerpt, created_at";

export function transformCommitteeVoteRow(
  row: CommitteeVoteDbRow,
): CommitteeVote {
  return {
    id: row.id,
    reportId: row.report_id,
    personaId: row.persona_id,
    personaLayer: row.persona_layer,
    sector: row.sector ?? undefined,
    vote: row.vote,
    argumentExcerpt: row.argument_excerpt ?? "",
    createdAt: row.created_at,
  };
}

export async function getVotesByReportId(
  reportId: string,
): Promise<CommitteeVote[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("committee_votes")
    .select(VOTE_COLUMNS)
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `committee_votes query failed: ${error.message ?? "unknown error"}`,
    );
  }

  const rows = (data ?? []) as CommitteeVoteDbRow[];
  return rows.map(transformCommitteeVoteRow);
}

// ---------------------------------------------------------------------------
// pure 집계 — Section 8 패널용 (M3 AC-2). mock 시절 mock-admin-committee.ts에서
// 이관. 입력은 transformer 결과 또는 동등 shape.
// ---------------------------------------------------------------------------

export function aggregateVotes(votes: CommitteeVote[]): {
  core: { approve: number; reject: number; abstain: number };
  sector: { approve: number; reject: number; abstain: number };
} {
  const init = () => ({ approve: 0, reject: 0, abstain: 0 });
  const core = init();
  const sector = init();
  for (const v of votes) {
    const target = v.personaLayer === "core" ? core : sector;
    target[v.vote] += 1;
  }
  return { core, sector };
}
