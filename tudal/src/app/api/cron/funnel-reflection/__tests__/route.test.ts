// G1 funnel-reflection cron route — auth + FUNNEL_REFLECTION_ENABLED gate(200 skip) +
//   로더 fail-soft + 제안 insert 배선. shadow-first: flag off → service-role client 미생성·
//   로더 0콜·insert 0콜(dormancy 단언). runFunnelReflectionJob/buildFunnelReflection은 실물 사용.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { LoadedFunnelReflectionInput } from "@/lib/reflection/funnel-reflection-source";

const { loadInputMock, insertProposalMock } = vi.hoisted(() => ({
  loadInputMock: vi.fn(),
  insertProposalMock: vi.fn(),
}));
const serviceRoleState = vi.hoisted(() => ({ created: 0 }));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => {
    serviceRoleState.created += 1;
    return { from: vi.fn() };
  },
}));

vi.mock("@/lib/reflection/funnel-reflection-source", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/reflection/funnel-reflection-source")>();
  return { ...actual, loadFunnelReflectionInput: loadInputMock };
});

vi.mock("@/lib/data/admin-funnel-reflection", () => ({
  insertFunnelReflectionProposal: insertProposalMock,
}));

import { GET } from "@/app/api/cron/funnel-reflection/route";

function req(opts: { secret?: string } = {}): NextRequest {
  const headers = new Headers();
  if (opts.secret) headers.set("authorization", `Bearer ${opts.secret}`);
  return new NextRequest("https://x/api/cron/funnel-reflection", { headers });
}

function loadedInput(): LoadedFunnelReflectionInput {
  return {
    input: {
      periodKey: "2026-06",
      championConfig: { trend: 0.5, size: 0.5 },
      candidates: [
        { ticker: "005930", factorExposures: { trend: 90, size: 70 } },
        { ticker: "000660", factorExposures: { trend: 40, size: 95 } },
        { ticker: "035420", factorExposures: { trend: 60, size: 20 } },
      ],
      realizedReturns: new Map([
        ["005930", 12],
        ["000660", -3],
        ["035420", 5],
      ]),
    },
    meta: {
      month: "2026-06",
      exposureSource: "factor_ranks",
      candidateCount: 3,
      returnWindow: { entryBasDd: "20260602", exitBasDd: "20260630" },
    },
  };
}

describe("funnel-reflection cron route", () => {
  const saved = {
    enabled: process.env.FUNNEL_REFLECTION_ENABLED,
    krx: process.env.KRX_OPENAPI_KEY,
    secret: process.env.CRON_SECRET,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    serviceRoleState.created = 0;
    delete process.env.FUNNEL_REFLECTION_ENABLED;
    delete process.env.KRX_OPENAPI_KEY;
    process.env.CRON_SECRET = "s3cr3t";
    loadInputMock.mockResolvedValue(loadedInput());
    insertProposalMock.mockResolvedValue(undefined);
  });
  afterEach(() => {
    const restore = (k: string, v: string | undefined) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    };
    restore("FUNNEL_REFLECTION_ENABLED", saved.enabled);
    restore("KRX_OPENAPI_KEY", saved.krx);
    restore("CRON_SECRET", saved.secret);
  });

  it("unauthorized(잘못된 secret) → 401 + 로더/insert 0콜", async () => {
    const res = await GET(req({ secret: "wrong" }));
    expect(res.status).toBe(401);
    expect(serviceRoleState.created).toBe(0);
    expect(loadInputMock).not.toHaveBeenCalled();
    expect(insertProposalMock).not.toHaveBeenCalled();
  });

  it("dormancy: flag off → 200 skip + service-role 미생성 + 로더/insert 0콜", async () => {
    const res = await GET(req({ secret: "s3cr3t" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("funnel_reflection_disabled");
    expect(serviceRoleState.created).toBe(0);
    expect(loadInputMock).not.toHaveBeenCalled();
    expect(insertProposalMock).not.toHaveBeenCalled();
  });

  it("성공 경로: 제안 insert 1회(evidence에 exposureSource/returnWindow 병기) + 200 요약", async () => {
    process.env.FUNNEL_REFLECTION_ENABLED = "true";
    const res = await GET(req({ secret: "s3cr3t" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      skipped: false,
      periodKey: "2026-06",
      exposureSource: "factor_ranks",
      pricedCount: 3,
    });
    expect(serviceRoleState.created).toBe(1);
    expect(insertProposalMock).toHaveBeenCalledTimes(1);
    const [proposal, opts] = insertProposalMock.mock.calls[0];
    expect(proposal.periodKey).toBe("2026-06");
    expect(proposal.championConfig).toEqual({ trend: 0.5, size: 0.5 });
    // bounded nudge 계약(±0.05 clamp[0,1]) — challenger는 champion에서 δ 이내.
    for (const k of Object.keys(proposal.championConfig)) {
      expect(
        Math.abs(proposal.challengerConfig[k] - proposal.championConfig[k]),
      ).toBeLessThanOrEqual(0.05 + 1e-9);
    }
    expect(proposal.evidence.exposureSource).toBe("factor_ranks");
    expect(proposal.evidence.returnWindow).toEqual({
      entryBasDd: "20260602",
      exitBasDd: "20260630",
    });
    expect(proposal.rationale).toContain("자동 적용 금지");
    expect(opts.client).toBeDefined();
  });

  it("로더 deps 배선: KRX 키 부재 → fetchEodPrices null / 키 존재 → 함수 주입", async () => {
    process.env.FUNNEL_REFLECTION_ENABLED = "true";
    await GET(req({ secret: "s3cr3t" }));
    expect(loadInputMock.mock.calls[0][0].fetchEodPrices).toBeNull();

    process.env.KRX_OPENAPI_KEY = "krx-key";
    await GET(req({ secret: "s3cr3t" }));
    expect(loadInputMock.mock.calls[1][0].fetchEodPrices).toBeTypeOf("function");
  });

  it("로더 fail-soft(input null) → 200 skip + reason + insert 0콜", async () => {
    process.env.FUNNEL_REFLECTION_ENABLED = "true";
    loadInputMock.mockResolvedValue({
      input: null,
      meta: { reason: "no_finalized_midlong_cycle" },
    } satisfies LoadedFunnelReflectionInput);
    const res = await GET(req({ secret: "s3cr3t" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    expect(body.reason).toBe("no_finalized_midlong_cycle");
    expect(insertProposalMock).not.toHaveBeenCalled();
  });

  it("insert throw → 200 ok:false(구조화 로그) — cron 실패격리(다음 daily run 재시도)", async () => {
    process.env.FUNNEL_REFLECTION_ENABLED = "true";
    insertProposalMock.mockRejectedValue(
      new Error("funnel_reflection_insert_failed:42501"),
    );
    const res = await GET(req({ secret: "s3cr3t" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("funnel_reflection_insert_failed");
  });
});
