import { createClient } from "@/lib/supabase/server";
import {
  getFunnelReflectionProposals,
  type FunnelReflectionRow,
} from "@/lib/data/admin-funnel-reflection";
import { DecideButtons } from "@/app/(admin)/admin/funnel-reflection/decide-buttons";

// G1 Tier0 Reflection Lab (D33) — B++ funnel 가중치 champion/challenger 제안 검토(USER 승인).
// diagnostic only · 자동 적용 영구 금지(승인=기록만) · 예측 아님(forward-validate) · PR-K(prompt 주입)와 다른 층.
// shadow-first: FUNNEL_REFLECTION_ENABLED off + 0047 미적용 → 제안 부재(빈 상태). SoT: spec 2026-06-28-g1.

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<FunnelReflectionRow["status"], string> = {
  proposed: "제안됨",
  approved: "승인(기록)",
  rejected: "거절",
};

const FACTOR_LABEL: Record<string, string> = {
  trend: "추세",
  momentum: "모멘텀",
  size: "규모",
  supply: "수급",
  volatility: "변동성",
  financial: "재무",
  financials: "재무",
  quality: "안정성",
  value: "가치",
  growth: "성장성",
};

function formatPeriodLabel(periodKey: string): string {
  const match = /^(\d{4}-\d{2})_(\d{4}-\d{2})$/.exec(periodKey);
  if (!match) return "검토 기간";
  return `${match[1]}~${match[2]} 검토`;
}

function diffWeights(
  champion: Record<string, number>,
  challenger: Record<string, number>,
): Array<{ factor: string; from: number; to: number }> {
  return Object.keys(challenger)
    .filter((k) => challenger[k] !== champion[k])
    .map((k) => ({ factor: k, from: champion[k] ?? 0, to: challenger[k] }));
}

function formatFactorLabel(factor: string): string {
  return FACTOR_LABEL[factor] ?? "기타 지표";
}

export default async function FunnelReflectionPage() {
  const supabase = await createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  const adminVerified = !(adminErr || !isAdmin);

  let proposals: FunnelReflectionRow[] = [];
  let loadError = false;
  try {
    proposals = await getFunnelReflectionProposals({ client: supabase, limit: 50 });
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">AI 학습 (실험)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          과거 추천 결과와 실현 수익률을 되짚어, 종목 선정 가중치를 어떻게 조정할지
          제안을 살펴보는 참고 화면입니다.
        </p>
        <p className="mt-2 rounded-2xl border border-info/30 bg-info/10 px-3 py-2 text-xs text-info shadow-toss-sm">
          참고용 실험 화면입니다 — 여기서 검토한 내용은 실제 추천/운영에 자동으로
          반영되지 않습니다. 승인해도 기록만 남습니다.
        </p>
        {!adminVerified && (
          <p
            role="status"
            className="mt-2 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning shadow-toss-sm"
          >
            ⚠ 권한 미확인 — 관리자 계정 등록을 확인해 주세요.
          </p>
        )}
      </header>

      {loadError && (
        <p className="rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning shadow-toss-sm">
          제안을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {!loadError && proposals.length === 0 ? (
        <p className="rounded-2xl border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground shadow-toss-sm">
          아직 준비 중입니다 — 학습에 필요한 데이터가 쌓이면 조정 제안이 여기에
          표시됩니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => {
            const diffs = diffWeights(p.championConfig, p.challengerConfig);
            return (
              <li key={p.id} className="rounded-2xl border bg-card p-4 shadow-toss-sm">
                <header className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {formatPeriodLabel(p.periodKey)}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABEL[p.status]} ·{" "}
                    {new Date(p.createdAt).toLocaleString("ko-KR", { hour12: false })}
                  </span>
                </header>
                <p className="mt-2 text-xs leading-relaxed">{p.rationale}</p>
                {diffs.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {diffs.map((d) => (
                      <li key={d.factor} className="tabular-nums">
                        <strong>{formatFactorLabel(d.factor)}</strong>: {d.from} → {d.to}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">가중치 변화 제안 없음.</p>
                )}
                {p.status === "proposed" && <DecideButtons id={p.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
