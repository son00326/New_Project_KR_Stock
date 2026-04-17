"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { SAMSUNG_MULTIPLES_HISTORY, SAMSUNG_GLOBAL_PEERS } from "@/lib/data/mock-quarterly";

interface MultiplesHistoryProps {
  ticker: string;
  currentPrice: number;
}

export function MultiplesHistory({ ticker }: MultiplesHistoryProps) {
  if (ticker !== "005930") return null;

  const trailing = SAMSUNG_MULTIPLES_HISTORY.filter((m) => !m.isForward);
  const forward = SAMSUNG_MULTIPLES_HISTORY.filter((m) => m.isForward);
  const latest = trailing[trailing.length - 1];
  const fwd2025 = forward.find((f) => f.year === 2025);
  const fwd2026 = forward.find((f) => f.year === 2026);

  const chartData = SAMSUNG_MULTIPLES_HISTORY.map((m) => ({
    year: m.isForward ? `${m.year}E` : `${m.year}`,
    PER: m.per,
    PBR: m.pbr,
    isForward: m.isForward,
  }));

  return (
    <div className="space-y-8">
      {/* Trailing vs Forward 비교 카드 */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Trailing vs Forward 멀티플</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground">지표</th>
                <th className="text-right py-2.5 px-3 font-semibold">
                  Trailing (2024)
                  <p className="text-[10px] font-normal text-muted-foreground">실제 실적 기준</p>
                </th>
                <th className="text-right py-2.5 px-3 font-semibold text-primary">
                  Forward (2025E)
                  <p className="text-[10px] font-normal text-muted-foreground">컨센서스 추정</p>
                </th>
                <th className="text-right py-2.5 px-3 font-semibold text-primary">
                  Forward (2026E)
                  <p className="text-[10px] font-normal text-muted-foreground">컨센서스 추정</p>
                </th>
                <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground">의미</th>
              </tr>
            </thead>
            <tbody>
              <MultiplesRow label="PER" trailing={latest.per} fwd25={fwd2025?.per} fwd26={fwd2026?.per} meaning={fwd2026?.per && latest.per ? (fwd2026.per < latest.per ? "이익 증가 → 밸류에이션 매력 상승" : "이익 감소 전망") : ""} />
              <MultiplesRow label="PBR" trailing={latest.pbr} fwd25={fwd2025?.pbr} fwd26={fwd2026?.pbr} meaning={fwd2026?.pbr && latest.pbr ? (fwd2026.pbr < latest.pbr ? "자산 대비 저평가 구간 진입" : "프리미엄 유지") : ""} />
              <MultiplesRow label="PSR" trailing={latest.psr} fwd25={fwd2025?.psr} fwd26={fwd2026?.psr} meaning="매출 성장 시 PSR 하락 → 매출 대비 저평가" />
              <MultiplesRow label="EV/EBITDA" trailing={latest.evEbitda} fwd25={fwd2025?.evEbitda} fwd26={fwd2026?.evEbitda} meaning="영업현금흐름 개선 시 하락 → 기업가치 매력 상승" />
              <MultiplesRow label="ROE" trailing={latest.roe} fwd25={fwd2025?.roe} fwd26={fwd2026?.roe} suffix="%" meaning={fwd2026?.roe && latest.roe ? (fwd2026.roe > latest.roe ? "수익성 개선 → 자본 효율성 상승" : "수익성 둔화") : ""} />
            </tbody>
          </table>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 mt-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>Trailing</strong>은 과거 실적 기반, <strong>Forward</strong>는 향후 추정 실적 기반입니다.
            Forward PER이 Trailing보다 낮아지고 있다는 것은 <strong>시장이 삼성전자의 이익이 크게 늘어날 것으로 기대</strong>한다는 의미입니다.
            2024년 PER 13.6배 → 2026E PER 7.5배로 거의 절반으로 떨어지며, 이는 <strong>AI 반도체 수혜로 인한 실적 급증이 반영</strong>된 것입니다.
          </p>
        </div>
      </div>

      {/* PER 추이 차트 (5개년 + Forward) */}
      <div>
        <h4 className="text-sm font-semibold mb-3">PER / PBR 추이 (5개년 + Forward)</h4>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine x="2025E" stroke="#ddd" strokeDasharray="3 3" label={{ value: "Forward →", fontSize: 10, fill: "#999" }} />
              <Line type="monotone" dataKey="PER" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="PBR" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 해외 Peer 비교 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm font-semibold">글로벌 Peer 멀티플 비교</h4>
          <Badge variant="secondary" className="text-xs">해외</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-2 font-semibold text-muted-foreground">종목</th>
                <th className="text-left py-2 px-2 font-semibold text-muted-foreground">국가</th>
                <th className="text-right py-2 px-2 font-semibold text-muted-foreground">시총(USD)</th>
                <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Trailing PER</th>
                <th className="text-right py-2 px-2 font-semibold text-primary">Forward PER</th>
                <th className="text-right py-2 px-2 font-semibold text-muted-foreground">PBR</th>
                <th className="text-right py-2 px-2 font-semibold text-muted-foreground">EV/EBITDA</th>
                <th className="text-right py-2 px-2 font-semibold text-muted-foreground">ROE</th>
                <th className="text-right py-2 px-2 font-semibold text-muted-foreground">배당률</th>
              </tr>
            </thead>
            <tbody>
              {/* 삼성전자 (비교 기준) */}
              <tr className="border-b bg-primary/5">
                <td className="py-2 px-2 font-semibold">
                  삼성전자 <Badge variant="default" className="text-[9px] ml-1">분석 대상</Badge>
                </td>
                <td className="py-2 px-2">KR</td>
                <td className="text-right py-2 px-2">$267B</td>
                <td className="text-right py-2 px-2 font-medium">{latest.per?.toFixed(1)}</td>
                <td className="text-right py-2 px-2 font-bold text-primary">{fwd2025?.per?.toFixed(1)}</td>
                <td className="text-right py-2 px-2">{latest.pbr?.toFixed(2)}</td>
                <td className="text-right py-2 px-2">{latest.evEbitda?.toFixed(1)}</td>
                <td className="text-right py-2 px-2">{latest.roe?.toFixed(1)}%</td>
                <td className="text-right py-2 px-2">2.41%</td>
              </tr>
              {SAMSUNG_GLOBAL_PEERS.map((peer) => (
                <tr key={peer.ticker} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-2 font-medium">
                    {peer.name} <span className="text-muted-foreground">({peer.ticker})</span>
                  </td>
                  <td className="py-2 px-2">{peer.country}</td>
                  <td className="text-right py-2 px-2">${(peer.marketCap / 1_000_000_000).toFixed(0)}B</td>
                  <td className="text-right py-2 px-2 font-medium">{peer.per?.toFixed(1) ?? "적자"}</td>
                  <td className="text-right py-2 px-2 font-bold text-primary">{peer.forwardPer?.toFixed(1)}</td>
                  <td className="text-right py-2 px-2">{peer.pbr?.toFixed(2)}</td>
                  <td className="text-right py-2 px-2">{peer.evEbitda?.toFixed(1)}</td>
                  <td className="text-right py-2 px-2">{peer.roe?.toFixed(1)}%</td>
                  <td className="text-right py-2 px-2">{peer.dividendYield?.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 mt-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>삼성전자의 Forward PER({fwd2025?.per?.toFixed(1)}배)</strong>은 Micron({SAMSUNG_GLOBAL_PEERS[0].forwardPer}배)과 유사하며,
            TSMC({SAMSUNG_GLOBAL_PEERS[1].forwardPer}배)보다 크게 낮습니다.
            이는 삼성전자가 파운드리/HBM에서 TSMC/SK하이닉스 대비 <strong>디스카운트를 받고 있음</strong>을 의미합니다.
            다만 이익 성장이 실현될 경우 <strong>리레이팅(밸류에이션 상향) 여지</strong>가 존재합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function MultiplesRow({
  label, trailing, fwd25, fwd26, suffix = "배", meaning,
}: {
  label: string; trailing: number | null | undefined; fwd25: number | null | undefined; fwd26: number | null | undefined; suffix?: string; meaning: string;
}) {
  const improving = fwd26 != null && trailing != null && (
    label === "ROE" ? fwd26 > trailing : fwd26 < trailing
  );

  return (
    <tr className="border-b last:border-0">
      <td className="py-2.5 px-3 font-medium">{label}</td>
      <td className="text-right py-2.5 px-3">{trailing != null ? `${trailing.toFixed(1)}${suffix}` : "N/A"}</td>
      <td className="text-right py-2.5 px-3 text-primary font-medium">{fwd25 != null ? `${fwd25.toFixed(1)}${suffix}` : "N/A"}</td>
      <td className="text-right py-2.5 px-3 text-primary font-bold">{fwd26 != null ? `${fwd26.toFixed(1)}${suffix}` : "N/A"}</td>
      <td className="text-right py-2.5 px-3">
        <span className={`text-xs ${improving ? "text-green-700" : "text-muted-foreground"}`}>
          {meaning}
        </span>
      </td>
    </tr>
  );
}
