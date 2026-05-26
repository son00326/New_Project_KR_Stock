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

// PR4 Task 5 (PR3a OOS RT#3): runtime layer 2 guard — DB CHECK constraint
// (0003_s2_reports.sql:75 `vote in ('approve','reject','abstain')`) 이미 존재.
// 본 PR4 마이그 0건 유지. 런타임 layer만 보강 — DB-TS 경계 + 직접 row read caller 보호.
const VALID_VOTES = new Set<VoteKind>(["approve", "reject", "abstain"]);

/**
 * Layer 1: row-level guard.
 * invalid vote → null 반환 + warn. transformCommitteeVoteRows wrapper에서 filter.
 *
 * Plan v7 §Step 5.1.3 — `as never` 캐스트로 enum miss 노출.
 */
export function transformCommitteeVoteRow(
  row: CommitteeVoteDbRow,
): CommitteeVote | null {
  if (!VALID_VOTES.has(row.vote as never)) {
    console.warn(
      `[transformCommitteeVoteRow] invalid_vote_skipped row_id=${row.id} vote=${String(row.vote)}`,
    );
    return null;
  }
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

/**
 * Layer 1 wrapper: array → filter null.
 * caller가 invalid row를 자동 skip (B11 fix omxy R2 — `rows.map(transformCommitteeVoteRow)` 직접 호출 시
 * null이 array에 들어가 caller 폭증. 본 wrapper 강제 사용).
 */
export function transformCommitteeVoteRows(
  rows: CommitteeVoteDbRow[],
): CommitteeVote[] {
  return rows
    .map(transformCommitteeVoteRow)
    .filter((v): v is CommitteeVote => v !== null);
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
  // PR4 Task 5 Step 5.3 (B11 fix omxy R2): wrapper 사용으로 null array 회귀 차단.
  return transformCommitteeVoteRows(rows);
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
    // PR4 Task 5 Step 5.2 (layer 2 defensive guard): 직접 row read caller (transformer 우회) 보호.
    // invalid vote → skip + warn. target['unknown'] undefined access NaN 차단.
    if (!VALID_VOTES.has(v.vote)) {
      console.warn(
        `[aggregateVotes] invalid_vote_skipped vote=${String(v.vote)} personaLayer=${v.personaLayer}`,
      );
      continue;
    }
    const target = v.personaLayer === "core" ? core : sector;
    target[v.vote] += 1;
  }
  return { core, sector };
}
