// W3b-2a (D2/D3) — admin-proposals: portfolio_proposal 영속 helper.
//   getProposalByMonth(SELECT + schema 재검증) · assertProposalPersistenceReady(preflight RPC)
//   · upsertProposalRpc(server-boundary 재검증 + upsert RPC). dormant 0034 미적용 = proposal_schema_missing.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getProposalByMonth,
  assertProposalPersistenceReady,
  upsertProposalRpc,
} from "../admin-proposals";
import type { SupabaseClient } from "@supabase/supabase-js";

const VALID_PROPOSAL = {
  positions: [
    { ticker: "005930", weight: 0.5, timeframe: "long" as const },
    { ticker: "000660", weight: 0.3, timeframe: "mid" as const },
  ],
  cashWeight: 0.2,
  rationale_kr: "반도체 집중 + 현금 20%",
};

const DB_ROW = {
  id: "prop-1",
  month: "2026-06-01",
  positions: VALID_PROPOSAL.positions,
  cash_weight: 0.2,
  rationale_kr: "반도체 집중 + 현금 20%",
  model: "claude-opus-4-8",
  created_by: "admin-uid",
  created_at: "2026-06-05T00:00:00Z",
  updated_at: "2026-06-05T00:00:00Z",
};

interface SelectResult {
  data: Record<string, unknown> | null;
  error: { code?: string; message?: string } | null;
}
interface RpcResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

function makeSelectClient(result: SelectResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as unknown as SupabaseClient, from, select, eq, maybeSingle };
}

function makeRpcClient(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

beforeEach(() => vi.clearAllMocks());

describe("getProposalByMonth", () => {
  it("row → PersistedPortfolioProposal(schema 재검증) 반환", async () => {
    const { client, from, select, eq } = makeSelectClient({ data: DB_ROW, error: null });
    const res = await getProposalByMonth({ month: "2026-06-01", client });
    expect(from).toHaveBeenCalledWith("portfolio_proposal");
    expect(eq).toHaveBeenCalledWith("month", "2026-06-01");
    expect(select).toHaveBeenCalled();
    expect(res?.id).toBe("prop-1");
    expect(res?.month).toBe("2026-06-01");
    expect(res?.model).toBe("claude-opus-4-8");
    expect(res?.proposal.positions).toHaveLength(2);
    expect(res?.proposal.cashWeight).toBe(0.2);
  });

  it("row 없음 → null", async () => {
    const { client } = makeSelectClient({ data: null, error: null });
    expect(await getProposalByMonth({ month: "2026-06-01", client })).toBeNull();
  });

  it("저장 row가 schema 위반 → portfolio_proposal_parse_failed (오염 행 거부)", async () => {
    const bad = { ...DB_ROW, cash_weight: 0.9 }; // cash cap 위반
    const { client } = makeSelectClient({ data: bad, error: null });
    await expect(getProposalByMonth({ month: "2026-06-01", client })).rejects.toThrow(
      /portfolio_proposal_parse_failed/,
    );
  });

  it("테이블 부재(42P01/PGRST205) → proposal_schema_missing", async () => {
    for (const code of ["42P01", "PGRST205"]) {
      const { client } = makeSelectClient({ data: null, error: { code } });
      await expect(getProposalByMonth({ month: "2026-06-01", client })).rejects.toThrow(
        "proposal_schema_missing",
      );
    }
  });

  it("기타 pg error → proposal_persist_failed:<code>", async () => {
    const { client } = makeSelectClient({ data: null, error: { code: "42501" } });
    await expect(getProposalByMonth({ month: "2026-06-01", client })).rejects.toThrow(
      "proposal_persist_failed:42501",
    );
  });
});

describe("assertProposalPersistenceReady", () => {
  it("RPC ok → resolve (assert_portfolio_proposal_schema 호출)", async () => {
    const { client, rpc } = makeRpcClient({ data: true, error: null });
    await expect(assertProposalPersistenceReady({ client })).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("assert_portfolio_proposal_schema");
  });

  it("RPC/스키마 부재(PGRST202/42883/PGRST204) → proposal_schema_missing", async () => {
    for (const code of ["PGRST202", "42883", "PGRST204"]) {
      const { client } = makeRpcClient({ data: null, error: { code } });
      await expect(assertProposalPersistenceReady({ client })).rejects.toThrow(
        "proposal_schema_missing",
      );
    }
  });

  it("기타 error → proposal_persist_failed:<code>", async () => {
    const { client } = makeRpcClient({ data: null, error: { code: "XX999" } });
    await expect(assertProposalPersistenceReady({ client })).rejects.toThrow(
      "proposal_persist_failed:XX999",
    );
  });
});

describe("upsertProposalRpc", () => {
  it("server-boundary 재검증 통과 → RPC 호출 인자 + {id,createdAt} 반환", async () => {
    const { client, rpc } = makeRpcClient({
      data: { id: "prop-9", created_at: "2026-06-05T01:00:00Z", updated_at: "2026-06-05T01:00:00Z" },
      error: null,
    });
    const res = await upsertProposalRpc({
      month: "2026-06-01",
      proposal: VALID_PROPOSAL,
      model: "claude-opus-4-8",
      client,
    });
    expect(rpc).toHaveBeenCalledWith("upsert_portfolio_proposal", {
      p_month: "2026-06-01",
      p_positions: VALID_PROPOSAL.positions,
      p_cash_weight: 0.2,
      p_rationale_kr: "반도체 집중 + 현금 20%",
      p_model: "claude-opus-4-8",
    });
    expect(res).toEqual({ id: "prop-9", createdAt: "2026-06-05T01:00:00Z" });
  });

  it("invalid proposal(server-boundary 재검증) → portfolio_proposal_parse_failed (RPC 미호출)", async () => {
    const { client, rpc } = makeRpcClient({ data: null, error: null });
    await expect(
      upsertProposalRpc({
        month: "2026-06-01",
        // cashWeight>0.30 → zod refine 위반 (TS 타입은 number라 통과, 런타임만 거부).
        proposal: { positions: VALID_PROPOSAL.positions, cashWeight: 0.9, rationale_kr: "x" },
        model: "claude-opus-4-8",
        client,
      }),
    ).rejects.toThrow(/portfolio_proposal_parse_failed/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("RPC/스키마 부재 → proposal_schema_missing", async () => {
    const { client } = makeRpcClient({ data: null, error: { code: "PGRST202" } });
    await expect(
      upsertProposalRpc({ month: "2026-06-01", proposal: VALID_PROPOSAL, model: "m", client }),
    ).rejects.toThrow("proposal_schema_missing");
  });

  it("기타 pg error → proposal_persist_failed:<code>", async () => {
    const { client } = makeRpcClient({ data: null, error: { code: "23514" } });
    await expect(
      upsertProposalRpc({ month: "2026-06-01", proposal: VALID_PROPOSAL, model: "m", client }),
    ).rejects.toThrow("proposal_persist_failed:23514");
  });

  it("error 없이 data null/ id 누락 → proposal_persist_failed:no_returning (영속 성공 오인 방지)", async () => {
    for (const data of [null, {}, { created_at: "2026-06-05T00:00:00Z" }]) {
      const { client } = makeRpcClient({ data, error: null });
      await expect(
        upsertProposalRpc({ month: "2026-06-01", proposal: VALID_PROPOSAL, model: "m", client }),
      ).rejects.toThrow("proposal_persist_failed:no_returning");
    }
  });
});
