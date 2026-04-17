import { notFound } from "next/navigation";
import { getStockByTicker } from "@/lib/data/mock-stocks";
import { StockHeader } from "@/components/stock/stock-header";
import { StockTabs } from "@/components/stock/stock-tabs";

interface StockPageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: StockPageProps) {
  const { ticker } = await params;
  const stock = getStockByTicker(ticker);
  if (!stock) return { title: "종목을 찾을 수 없습니다 | 주픽" };

  return {
    title: `${stock.name} (${stock.ticker}) 분석 | 주픽`,
    description: `${stock.name}의 Fundamental, Technical 분석 리포트. ${stock.description}`,
  };
}

export default async function StockPage({ params }: StockPageProps) {
  const { ticker } = await params;
  const stock = getStockByTicker(ticker);

  if (!stock) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <StockHeader stock={stock} />
      <StockTabs ticker={ticker} />
    </div>
  );
}
