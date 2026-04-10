"use client";

import { Badge } from "@/components/ui/badge";
import { formatKRW, formatPercent } from "@/lib/constants";
import type { Stock } from "@/types/stock";

interface StockHeaderProps {
  stock: Stock;
}

export function StockHeader({ stock }: StockHeaderProps) {
  const isPositive = stock.changePercent > 0;
  const isNegative = stock.changePercent < 0;

  return (
    <div className="mb-8">
      {/* 종목 기본 정보 */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold md:text-3xl">{stock.name}</h1>
            <Badge variant="secondary">{stock.market}</Badge>
            <Badge variant="outline">{stock.industry}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{stock.ticker}</p>
        </div>

        <div className="sm:ml-auto text-left sm:text-right">
          <div className="text-3xl font-bold">
            {stock.currentPrice.toLocaleString("ko-KR")}
            <span className="text-base font-normal text-muted-foreground ml-1">원</span>
          </div>
          <div className="flex items-center gap-2 sm:justify-end mt-1">
            <span
              className={`text-lg font-semibold ${
                isPositive
                  ? "text-red-600"
                  : isNegative
                  ? "text-blue-600"
                  : "text-muted-foreground"
              }`}
            >
              {formatPercent(stock.changePercent)}
            </span>
          </div>
        </div>
      </div>

      {/* 요약 정보 바 */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground border-t pt-4">
        <div>
          <span className="text-xs">시가총액</span>
          <span className="ml-2 font-medium text-foreground">
            {formatKRW(stock.marketCap)}
          </span>
        </div>
        <div>
          <span className="text-xs">거래량</span>
          <span className="ml-2 font-medium text-foreground">
            {stock.volume.toLocaleString("ko-KR")}주
          </span>
        </div>
        <div>
          <span className="text-xs">업종</span>
          <span className="ml-2 font-medium text-foreground">{stock.sector}</span>
        </div>
        <div>
          <span className="text-xs">상장일</span>
          <span className="ml-2 font-medium text-foreground">{stock.listingDate}</span>
        </div>
      </div>
    </div>
  );
}
