import type { PortfolioSnapshot } from "@/types/admin";

// 항목3 — 홈 섹션1 "현재 운영 중" 카드 (Server Component).
// getCurrentHoldings()가 반환한 보유 스냅샷(현금행 제외)을 편입 종목·비중·현금·수익률로 표시.
// - 기준월(basisMonth) 표기 필수: stale 오해 방지.
// - 수익률은 스냅샷에 이미 있는 totalReturn만 사용(신규 외부 데이터 의존 금지). 부재 시 생략.
// - 보유 없으면 "아직 운영 포트 확정 전" 빈 상태.

interface CurrentHoldingsCardProps {
  holdings: PortfolioSnapshot[];
  basisMonth?: string;
  nameByTicker?: Record<string, string>;
  loadError?: boolean;
}

function formatBasisMonth(month: string | undefined): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  return `${y}-${m.padStart(2, "0")}`;
}

function returnClass(value: number): string {
  if (value > 0) return "text-market-up";
  if (value < 0) return "text-market-down";
  return "text-market-neutral";
}

function formatReturn(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

export function CurrentHoldingsCard({
  holdings,
  basisMonth,
  nameByTicker,
  loadError = false,
}: CurrentHoldingsCardProps) {
  const positions = holdings.filter((h) => !h.isCash && h.ticker);
  const basis = formatBasisMonth(basisMonth ?? positions[0]?.month);

  // 현금 비중 = 1 - 보유 비중 합 (가상 포트 weight 합 ≤ 1 전제, 음수 clamp).
  const investedWeight = positions.reduce((sum, p) => sum + p.weight, 0);
  const cashWeight = Math.max(0, 1 - investedWeight);

  // 포트 수익률 = 보유 totalReturn의 비중 가중평균(비중 합 0이면 단순평균). 스냅샷 기존 값만 사용.
  const hasReturns = positions.length > 0;
  const portfolioReturn =
    positions.length === 0
      ? 0
      : investedWeight > 0
        ? positions.reduce((s, p) => s + p.totalReturn * p.weight, 0) /
          investedWeight
        : positions.reduce((s, p) => s + p.totalReturn, 0) / positions.length;

  return (
    <section
      aria-labelledby="current-holdings-heading"
      className="rounded-2xl border border-border/70 bg-card p-4 shadow-toss-sm md:p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="current-holdings-heading"
            className="text-sm font-medium text-muted-foreground"
          >
            현재 운영 중
          </h2>
          <p className="mt-0.5 text-lg font-bold">확정 운영 포트폴리오</p>
        </div>
        {basis ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            기준월: {basis}
          </span>
        ) : null}
      </div>

      {loadError ? (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 py-8 text-center text-sm font-medium text-destructive">
          운영 포트폴리오를 불러오지 못했습니다. 시스템 상태를 확인해 주세요.
        </p>
      ) : positions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border/60 bg-muted/20 py-8 text-center text-sm text-muted-foreground">
          아직 운영 포트 확정 전입니다.
        </p>
      ) : (
        <>
          {/* 요약 지표 — 종목 수 · 현금 · (있으면) 수익률 */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">편입 종목</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {positions.length}종목
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">현금 비중</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums">
                {(cashWeight * 100).toFixed(1)}%
              </div>
            </div>
            {hasReturns ? (
              <div>
                <div className="text-xs text-muted-foreground">누적 수익률</div>
                <div
                  className={`mt-0.5 text-lg font-bold tabular-nums ${returnClass(portfolioReturn)}`}
                >
                  {formatReturn(portfolioReturn)}
                </div>
              </div>
            ) : null}
          </div>

          {/* 보유 종목 리스트 */}
          <ul className="mt-4 divide-y divide-border/60">
            {positions.map((p) => {
              const name =
                (p.ticker && nameByTicker?.[p.ticker]) || p.ticker || "";
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="font-mono text-sm">{p.ticker}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="w-16 text-right text-sm font-semibold tabular-nums">
                      {(p.weight * 100).toFixed(1)}%
                    </span>
                    {hasReturns ? (
                      <span
                        className={`w-16 text-right text-sm font-semibold tabular-nums ${returnClass(p.totalReturn)}`}
                      >
                        {formatReturn(p.totalReturn)}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
