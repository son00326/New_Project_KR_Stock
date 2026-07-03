// G1 Funnel Reflection cron route (D-5) — reflection-job 클론, shadow-first.
//
// 책임: auth(CRON_SECRET) → FUNNEL_REFLECTION_ENABLED 게이트(200 skip·service-role 미생성·비용 0)
//   → service-role client → loadFunnelReflectionInput(직전 완료 월 150 + factor exposure +
//   실현수익, fail-soft) → runFunnelReflectionJob(insert DI = insertFunnelReflectionProposal,
//   UNIQUE(period_key) 23505 idempotent 재실행 안전) → 200 요약 + 구조화 로그.
//
// 불변식: 자동 적용 영구 금지 — 제안 insert만(short_list_30/funnel config/production 무변경).
//   PR-K reflectionLearningContext/선정 prompt 경로 배선 없음(G1 ≠ PR-K, 별 테이블·별 타입).
//   무비용(KRX EOD only — AI 호출 0). diagnostic only — 예측 아님(forward-validate).
//   이메일/Resend 경로 없음. flag off → service-role 미생성·DB read 0(byte-identical).
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isFunnelReflectionEnabled } from "@/lib/reflection/flags";
import { runFunnelReflectionJob } from "@/lib/reflection/funnel-reflection-job";
import { loadFunnelReflectionInput } from "@/lib/reflection/funnel-reflection-source";
import { insertFunnelReflectionProposal } from "@/lib/data/admin-funnel-reflection";
import { resolveEntryPricesKrw } from "@/lib/data/krx-eod";
import { loadKrBusinessDays } from "@/lib/portfolio/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// reflection-job/route.ts 패턴 복제 (cron route 동일 auth — production-like fail-closed).
function isProductionLikeForAuth(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production"
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return !isProductionLikeForAuth();
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 게이트: dormant 시 200 skip (service-role 미생성·로더/영속/비용 0).
  if (!isFunnelReflectionEnabled()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "funnel_reflection_disabled" },
      { status: 200 },
    );
  }

  const supabase: SupabaseClient = createServiceRoleClient();
  const authKey = process.env.KRX_OPENAPI_KEY?.trim();
  const now = new Date();

  try {
    const loaded = await loadFunnelReflectionInput({
      client: supabase,
      now,
      loadBusinessDays: loadKrBusinessDays,
      // KRX EOD(무비용). 키 부재 → null(로더 fail-soft: 빈 realizedReturns → 표본부족 rationale).
      fetchEodPrices: authKey
        ? (tickers, basDd) => resolveEntryPricesKrw(tickers, { authKey, basDd })
        : null,
    });

    if (!loaded.input) {
      console.error(
        JSON.stringify({ event: "funnel_reflection_skipped", ...loaded.meta }),
      );
      return NextResponse.json(
        { ok: true, skipped: true, reason: loaded.meta.reason ?? "no_input" },
        { status: 200 },
      );
    }

    const meta = loaded.meta;
    const result = await runFunnelReflectionJob(loaded.input, {
      // insert DI — evidence에 로더 provenance(exposure 기저·수익 창)를 병기(0047 jsonb).
      insert: (proposal) => {
        const evidence = {
          ...proposal.evidence,
          exposureSource: meta.exposureSource ?? null,
          returnWindow: meta.returnWindow ?? null,
        };
        return insertFunnelReflectionProposal(
          { ...proposal, evidence },
          { client: supabase },
        );
      },
    });

    console.error(
      JSON.stringify({
        event: "funnel_reflection_job_done",
        periodKey: loaded.input.periodKey,
        exposureSource: meta.exposureSource,
        candidateCount: meta.candidateCount,
        pricedCount: result.pricedCount,
        challengerMoved: result.challengerMoved,
      }),
    );
    return NextResponse.json(
      {
        ok: true,
        skipped: false,
        periodKey: loaded.input.periodKey,
        exposureSource: meta.exposureSource,
        pricedCount: result.pricedCount,
        challengerMoved: result.challengerMoved,
      },
      { status: 200 },
    );
  } catch (err) {
    // per-run 실패격리(fail-soft) — cron retry 대상 아님·다음 daily run이 재시도(UNIQUE 안전).
    const message = err instanceof Error ? err.message : "unknown";
    console.error(
      JSON.stringify({ event: "funnel_reflection_job_failed", message }),
    );
    return NextResponse.json(
      { ok: false, skipped: false, error: message },
      { status: 200 },
    );
  }
}
