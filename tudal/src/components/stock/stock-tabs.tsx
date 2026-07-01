"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { FundamentalTab } from "@/components/stock/fundamental-tab";
import { TechnicalTab } from "@/components/stock/technical-tab";
import { CorporateTab } from "@/components/stock/corporate-tab";
import { StockPriceChart } from "@/components/stock/charts/stock-price-chart";

interface StockTabsProps {
  ticker: string;
}

const TAB_STYLE =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold px-6 py-3 text-sm font-medium transition-colors";

export function StockTabs({ ticker }: StockTabsProps) {
  return (
    <Tabs defaultValue="chart" className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto overflow-x-auto">
        <TabsTrigger value="chart" className={TAB_STYLE}>
          차트
        </TabsTrigger>
        <TabsTrigger value="fundamental" className={TAB_STYLE}>
          기본적 분석
        </TabsTrigger>
        <TabsTrigger value="technical" className={TAB_STYLE}>
          기술적 분석
        </TabsTrigger>
        <TabsTrigger value="corporate" className={TAB_STYLE}>
          기업 정보
        </TabsTrigger>
      </TabsList>

      <TabsContent value="chart" className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <StockPriceChart ticker={ticker} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="fundamental" className="mt-6">
        <FundamentalTab ticker={ticker} />
      </TabsContent>

      <TabsContent value="technical" className="mt-6">
        <TechnicalTab ticker={ticker} />
      </TabsContent>

      <TabsContent value="corporate" className="mt-6">
        <CorporateTab ticker={ticker} />
      </TabsContent>
    </Tabs>
  );
}
