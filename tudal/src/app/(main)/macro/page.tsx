import type { Metadata } from "next";
import { MacroDashboard } from "@/components/macro/macro-dashboard";

export const metadata: Metadata = {
  title: "매크로 현황판 | 투달",
  description: "글로벌 매크로 지표를 한눈에. CPI, PPI, 금리, 공포지수, 환율, 원자재 그리고 종합 투자 판단까지.",
};

export default function MacroPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <MacroDashboard />
    </div>
  );
}
