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

function diffWeights(
  champion: Record<string, number>,
  challenger: Record<string, number>,
): Array<{ factor: string; from: number; to: number }> {
  return Object.keys(challenger)
    .filter((k) => challenger[k] !== champion[k])
    .map((k) => ({ factor: k, from: champion[k] ?? 0, to: challenger[k] }));
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
        <h1 className="text-2xl font-bold tracking-tight">Tier0 Reflection Lab (G1)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          B++ funnel 가중치 champion/challenger 회고 제안 — 과거 150/30 + 실현 수익률 진단 기반.
        </p>
        <p className="mt-2 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning shadow-toss-sm">
          ⚠ diagnostic only — <strong>자동 적용 영구 금지</strong>(승인=기록만, funnel/production 무변경) ·
          예측 아님(forward-validate 후에만 채택) · PR-K(prompt 주입 회고)와 <strong>다른 층</strong>(numeric
          funnel 가중치).
        </p>
        {!adminVerified && (
          <p
            role="status"
            className="mt-2 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning shadow-toss-sm"
          >
            ⚠ 권한 미확인 — admin_emails 등록 확인 필요.
          </p>
        )}
      </header>

      {loadError && (
        <p className="rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning shadow-toss-sm">
          제안 조회 실패 — 마이그 0047 미적용 또는 권한 문제일 수 있습니다.
        </p>
      )}

      {!loadError && proposals.length === 0 ? (
        <p className="rounded-2xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground shadow-toss-sm">
          제안 없음 — 마이그 0047 apply + `FUNNEL_REFLECTION_ENABLED=true` + KRX 키 + funnel reflection
          job 실행 후 회고 제안이 쌓입니다. (계측 먼저 · 완성 늦게)
        </p>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => {
            const diffs = diffWeights(p.championConfig, p.challengerConfig);
            return (
              <li key={p.id} className="rounded-2xl border bg-card p-4 shadow-toss-sm">
                <header className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">{p.periodKey}</h2>
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
                        <strong>{d.factor}</strong>: {d.from} → {d.to}
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
