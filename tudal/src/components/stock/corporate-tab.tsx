"use client";

import { Card, CardContent } from "@/components/ui/card";
import { getStockByTicker } from "@/lib/data/mock-stocks";
import {
  MOCK_SUBSIDIARIES,
  MOCK_SHAREHOLDERS,
  MOCK_ORDER_BACKLOG,
  MOCK_DIVIDENDS,
  MOCK_EXECUTIVES,
  MOCK_CREDIT_RATINGS,
} from "@/lib/data/mock-corporate";
import { GovernanceTree } from "@/components/stock/charts/governance-tree";
import { ShareholderChart } from "@/components/stock/charts/shareholder-chart";
import { OrderBacklogChart } from "@/components/stock/charts/order-backlog-chart";
import { DividendChart } from "@/components/stock/charts/dividend-chart";
import { ExecutiveInfo } from "@/components/stock/charts/executive-info";

interface CorporateTabProps {
  ticker: string;
}

export function CorporateTab({ ticker }: CorporateTabProps) {
  const stock = getStockByTicker(ticker);
  const subsidiaries = MOCK_SUBSIDIARIES[ticker];
  const shareholders = MOCK_SHAREHOLDERS[ticker];
  const orders = MOCK_ORDER_BACKLOG[ticker];
  const dividends = MOCK_DIVIDENDS[ticker];
  const executives = MOCK_EXECUTIVES[ticker];
  const creditRatings = MOCK_CREDIT_RATINGS[ticker];

  if (!stock) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        해당 종목의 데이터를 찾을 수 없습니다.
      </div>
    );
  }

  const hasData = subsidiaries || shareholders || orders;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">
              {stock.name}의 기업 정보는
            </p>
            <p className="text-muted-foreground">
              데이터 연동 후 제공됩니다.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              삼성전자(005930)에서 전체 기능을 미리 체험할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. 주주 구성 */}
      {shareholders && (
        <section>
          <SectionTitle
            number={1}
            title="주주 구성"
            subtitle="누가 이 회사의 주인인지, 지분율을 한눈에 파악하세요"
          />
          <Card>
            <CardContent className="pt-6">
              <ShareholderChart shareholders={shareholders} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 2. 지배구조 / 계열사 */}
      {subsidiaries && (
        <section>
          <SectionTitle
            number={2}
            title="지배구조 및 계열사"
            subtitle="삼성그룹 내 주요 계열사와 지분 관계를 확인하세요"
          />
          <Card>
            <CardContent className="pt-6">
              <GovernanceTree
                companyName={stock.name}
                companyTicker={stock.ticker}
                subsidiaries={subsidiaries}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 3. 주요 경영진 + 신용등급 */}
      {executives && creditRatings && (
        <section>
          <SectionTitle
            number={3}
            title="경영진 및 신용등급"
            subtitle="누가 경영하고 있는지, 회사의 재무 건전성은 어떤지 확인하세요"
          />
          <Card>
            <CardContent className="pt-6">
              <ExecutiveInfo
                executives={executives}
                creditRatings={creditRatings}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 4. 수주 추이 */}
      {orders && (
        <section>
          <SectionTitle
            number={4}
            title="수주 추이"
            subtitle="새로운 주문이 얼마나 들어오고 있는지, 미래 매출 가시성을 판단하세요"
          />
          <Card>
            <CardContent className="pt-6">
              <OrderBacklogChart orders={orders} companyName={stock.name} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 5. 배당 */}
      {dividends && (
        <section>
          <SectionTitle
            number={5}
            title="배당 이력"
            subtitle="주주에게 얼마나 돌려주고 있는지, 배당 투자자를 위한 분석입니다"
          />
          <Card>
            <CardContent className="pt-6">
              <DividendChart dividends={dividends} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 면책 */}
      <div className="text-xs text-muted-foreground text-center py-4 border-t">
        기업 정보는 DART 전자공시, 사업보고서, 각 평가기관 데이터를 기반으로 합니다.
        투자 판단의 최종 책임은 이용자 본인에게 있습니다.
      </div>
    </div>
  );
}

function SectionTitle({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
          {number}
        </span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mt-1 pl-10">{subtitle}</p>
    </div>
  );
}
