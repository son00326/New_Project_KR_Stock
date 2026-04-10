"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatKRW } from "@/lib/constants";
import {
  SAMSUNG_INCOME_STATEMENTS,
  SAMSUNG_BALANCE_SHEETS,
  type IncomeStatement,
  type BalanceSheet,
} from "@/lib/data/mock-financials-extended";

interface FullFinancialsProps {
  ticker: string;
}

type StatementType = "income" | "balance";

export function FullFinancials({ ticker }: FullFinancialsProps) {
  const [statementType, setStatementType] = useState<StatementType>("income");

  if (ticker !== "005930") {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        상세 재무제표는 데이터 연동 후 제공됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatementType("income")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statementType === "income"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          손익계산서
        </button>
        <button
          onClick={() => setStatementType("balance")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            statementType === "balance"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          재무상태표
        </button>
      </div>

      {statementType === "income" ? (
        <IncomeStatementTable statements={SAMSUNG_INCOME_STATEMENTS} />
      ) : (
        <BalanceSheetTable sheets={SAMSUNG_BALANCE_SHEETS} />
      )}
    </div>
  );
}

function IncomeStatementTable({ statements }: { statements: IncomeStatement[] }) {
  const sorted = [...statements].sort((a, b) => a.year - b.year);

  const rows: { label: string; key: keyof IncomeStatement; isPercent?: boolean; isBold?: boolean; indent?: boolean }[] = [
    { label: "매출액", key: "revenue", isBold: true },
    { label: "매출원가", key: "costOfRevenue", indent: true },
    { label: "매출총이익", key: "grossProfit", isBold: true },
    { label: "매출총이익률", key: "grossMargin", isPercent: true },
    { label: "판관비", key: "sgna", indent: true },
    { label: "연구개발비", key: "rnd", indent: true },
    { label: "영업이익", key: "operatingIncome", isBold: true },
    { label: "영업이익률", key: "operatingMargin", isPercent: true },
    { label: "기타수익", key: "otherIncome", indent: true },
    { label: "이자비용", key: "interestExpense", indent: true },
    { label: "세전이익", key: "preTaxIncome", isBold: true },
    { label: "법인세", key: "incomeTax", indent: true },
    { label: "당기순이익", key: "netIncome", isBold: true },
    { label: "순이익률", key: "netMargin", isPercent: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground sticky left-0 bg-muted/30 min-w-[140px]">
              손익계산서
            </th>
            {sorted.map((s) => (
              <th key={s.year} className="text-right py-2.5 px-3 font-semibold min-w-[110px]">
                {s.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={`border-b last:border-0 ${row.isBold ? "bg-muted/10" : ""}`}
            >
              <td className={`py-2 px-3 sticky left-0 bg-background ${row.indent ? "pl-6 text-muted-foreground" : ""} ${row.isBold ? "font-semibold bg-muted/10" : ""} ${row.isPercent ? "text-muted-foreground text-xs italic" : ""}`}>
                {row.label}
              </td>
              {sorted.map((s) => {
                const value = s[row.key] as number;
                return (
                  <td
                    key={s.year}
                    className={`text-right py-2 px-3 ${row.isBold ? "font-semibold bg-muted/10" : ""} ${row.isPercent ? "text-xs italic text-muted-foreground" : ""}`}
                  >
                    {row.isPercent ? `${value.toFixed(1)}%` : formatKRW(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalanceSheetTable({ sheets }: { sheets: BalanceSheet[] }) {
  const sorted = [...sheets].sort((a, b) => a.year - b.year);

  const rows: { label: string; key: keyof BalanceSheet; isRatio?: boolean; isBold?: boolean; indent?: boolean; isHeader?: boolean }[] = [
    { label: "[ 자산 ]", key: "totalAssets", isHeader: true },
    { label: "유동자산", key: "currentAssets", isBold: true },
    { label: "  현금 및 현금성자산", key: "cash", indent: true },
    { label: "  재고자산", key: "inventory", indent: true },
    { label: "비유동자산", key: "nonCurrentAssets", isBold: true },
    { label: "  유형자산 (PP&E)", key: "ppe", indent: true },
    { label: "자산총계", key: "totalAssets", isBold: true },
    { label: "[ 부채 ]", key: "totalLiabilities", isHeader: true },
    { label: "유동부채", key: "currentLiabilities" },
    { label: "비유동부채", key: "nonCurrentLiabilities" },
    { label: "부채총계", key: "totalLiabilities", isBold: true },
    { label: "[ 자본 ]", key: "totalEquity", isHeader: true },
    { label: "이익잉여금", key: "retainedEarnings" },
    { label: "자본총계", key: "totalEquity", isBold: true },
    { label: "[ 재무 비율 ]", key: "debtToEquity", isHeader: true },
    { label: "부채비율 (D/E)", key: "debtToEquity", isRatio: true },
    { label: "유동비율", key: "currentRatio", isRatio: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left py-2.5 px-3 font-semibold text-muted-foreground sticky left-0 bg-muted/30 min-w-[160px]">
              재무상태표
            </th>
            {sorted.map((s) => (
              <th key={s.year} className="text-right py-2.5 px-3 font-semibold min-w-[110px]">
                {s.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.isHeader) {
              return (
                <tr key={`header-${i}`} className="bg-muted/20">
                  <td colSpan={sorted.length + 1} className="py-2 px-3 font-bold text-xs text-muted-foreground">
                    {row.label}
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={`${row.key}-${i}`}
                className={`border-b last:border-0 ${row.isBold ? "bg-muted/10" : ""}`}
              >
                <td className={`py-2 px-3 sticky left-0 bg-background ${row.indent ? "pl-6 text-muted-foreground text-xs" : ""} ${row.isBold ? "font-semibold bg-muted/10" : ""}`}>
                  {row.label}
                </td>
                {sorted.map((s) => {
                  const value = s[row.key] as number;
                  return (
                    <td
                      key={s.year}
                      className={`text-right py-2 px-3 ${row.isBold ? "font-semibold bg-muted/10" : ""}`}
                    >
                      {row.isRatio
                        ? row.key === "debtToEquity"
                          ? `${value.toFixed(1)}%`
                          : `${value.toFixed(2)}x`
                        : formatKRW(value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
