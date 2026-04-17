"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MOCK_MULTIPLES } from "@/lib/data/mock-stocks";
import type { Stock } from "@/types/stock";

interface MultiplesComparisonProps {
  targetTicker: string;
  targetStock: Stock;
  peers: Stock[];
}

export function MultiplesComparison({
  targetTicker,
  targetStock,
  peers,
}: MultiplesComparisonProps) {
  const allStocks = [targetStock, ...peers];

  // PER 비교 차트 데이터
  const perData = allStocks
    .map((stock) => {
      const m = MOCK_MULTIPLES[stock.ticker];
      if (!m) return null;
      return {
        name: stock.name,
        PER: m.per,
        isTarget: stock.ticker === targetTicker,
      };
    })
    .filter(Boolean);

  // PBR 비교 차트 데이터
  const pbrData = allStocks
    .map((stock) => {
      const m = MOCK_MULTIPLES[stock.ticker];
      if (!m) return null;
      return {
        name: stock.name,
        PBR: m.pbr,
        isTarget: stock.ticker === targetTicker,
      };
    })
    .filter(Boolean);

  if (perData.length === 0) return null;

  return (
    <div className="mt-8 space-y-8">
      <div>
        <h4 className="text-sm font-medium mb-4">PER 비교</h4>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                width={80}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}배`, "PER"]}
              />
              <Bar
                dataKey="PER"
                fill="#2563eb"
                radius={[0, 4, 4, 0]}
                barSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-4">PBR 비교</h4>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pbrData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                width={80}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(2)}배`, "PBR"]}
              />
              <Bar
                dataKey="PBR"
                fill="#16a34a"
                radius={[0, 4, 4, 0]}
                barSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
