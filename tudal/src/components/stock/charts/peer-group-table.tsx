"use client";

import { Badge } from "@/components/ui/badge";
import { MOCK_MULTIPLES } from "@/lib/data/mock-stocks";
import { formatKRW } from "@/lib/constants";
import type { Stock } from "@/types/stock";

interface PeerGroupTableProps {
  targetTicker: string;
  targetStock: Stock;
  peers: Stock[];
}

export function PeerGroupTable({
  targetTicker,
  targetStock,
  peers,
}: PeerGroupTableProps) {
  const allStocks = [targetStock, ...peers];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 pr-4 font-medium text-muted-foreground">
              종목
            </th>
            <th className="text-right py-3 px-3 font-medium text-muted-foreground">
              시가총액
            </th>
            <th className="text-right py-3 px-3 font-medium text-muted-foreground">
              PER
            </th>
            <th className="text-right py-3 px-3 font-medium text-muted-foreground">
              PBR
            </th>
            <th className="text-right py-3 px-3 font-medium text-muted-foreground">
              PSR
            </th>
            <th className="text-right py-3 px-3 font-medium text-muted-foreground">
              EV/EBITDA
            </th>
            <th className="text-right py-3 px-3 font-medium text-muted-foreground">
              ROE
            </th>
          </tr>
        </thead>
        <tbody>
          {allStocks.map((stock) => {
            const multiples = MOCK_MULTIPLES[stock.ticker];
            const isTarget = stock.ticker === targetTicker;

            return (
              <tr
                key={stock.ticker}
                className={`border-b last:border-0 transition-colors ${
                  isTarget ? "bg-primary/5" : "hover:bg-muted/30"
                }`}
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isTarget ? "text-primary" : ""}`}>
                      {stock.name}
                    </span>
                    {isTarget && (
                      <Badge variant="default" className="text-xs">
                        분석 대상
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {stock.ticker}
                  </span>
                </td>
                <td className="text-right py-3 px-3 tabular-nums">
                  {formatKRW(stock.marketCap)}
                </td>
                <td className="text-right py-3 px-3 font-medium tabular-nums">
                  {multiples?.per?.toFixed(1) ?? "N/A"}
                </td>
                <td className="text-right py-3 px-3 tabular-nums">
                  {multiples?.pbr?.toFixed(2) ?? "N/A"}
                </td>
                <td className="text-right py-3 px-3 tabular-nums">
                  {multiples?.psr?.toFixed(2) ?? "N/A"}
                </td>
                <td className="text-right py-3 px-3 tabular-nums">
                  {multiples?.evEbitda?.toFixed(1) ?? "N/A"}
                </td>
                <td className="text-right py-3 px-3 tabular-nums">
                  {multiples?.roe ? `${multiples.roe.toFixed(1)}%` : "N/A"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
