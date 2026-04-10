"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getStockByTicker, MOCK_REVENUE_SEGMENTS } from "@/lib/data/mock-stocks";
import { SAMSUNG_10Y_FINANCIALS } from "@/lib/data/mock-financials-extended";
import { KeyMetricsCards, getSamsungKeyMetrics } from "@/components/stock/charts/key-metrics-cards";
import { BusinessTimeline, getSamsungTimeline } from "@/components/stock/charts/business-timeline";
import { CompetitiveMap, getSamsungCompetitiveData } from "@/components/stock/charts/competitive-map";
import { RevenueBreakdown } from "@/components/stock/charts/revenue-breakdown";
import { RevenueTrendChart } from "@/components/stock/charts/revenue-trend-chart";
import { FullFinancials } from "@/components/stock/charts/full-financials";
import { FutureOutlookVisual, getSamsungOutlookData } from "@/components/stock/charts/future-outlook-visual";

interface FundamentalTabProps {
  ticker: string;
}

type AnalysisLevel = "beginner" | "intermediate";

const LEVEL_LABELS: Record<AnalysisLevel, { label: string; description: string }> = {
  beginner: { label: "초보", description: "투자를 처음 시작하는 분을 위한 쉬운 설명" },
  intermediate: { label: "중급", description: "기본 개념을 아는 분을 위한 심화 분석" },
};

export function FundamentalTab({ ticker }: FundamentalTabProps) {
  const [level, setLevel] = useState<AnalysisLevel>("beginner");
  const stock = getStockByTicker(ticker);
  const financials = ticker === "005930" ? SAMSUNG_10Y_FINANCIALS : undefined;
  const segments = MOCK_REVENUE_SEGMENTS[ticker];

  if (!stock) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        해당 종목의 분석 데이터를 찾을 수 없습니다.
      </div>
    );
  }

  const isSamsung = ticker === "005930";

  return (
    <div className="space-y-8">
      {/* 레벨 선택 */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">분석 레벨:</span>
        <div className="flex gap-2">
          {(Object.keys(LEVEL_LABELS) as AnalysisLevel[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                level === l
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {LEVEL_LABELS[l].label}
            </button>
          ))}
          <button
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-muted text-muted-foreground/50 cursor-not-allowed"
            disabled
          >
            전문가
            <Badge variant="outline" className="ml-1.5 text-xs">
              Pro
            </Badge>
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {LEVEL_LABELS[level].description}
      </p>

      {/* 핵심 지표 카드 */}
      {isSamsung && (
        <section>
          <SectionTitle
            number={1}
            title="핵심 지표 한눈에 보기"
            subtitle="이 회사의 규모와 현재 상태를 한눈에 파악하세요"
          />
          <KeyMetricsCards metrics={getSamsungKeyMetrics()} />
        </section>
      )}

      {/* 회사 개요 */}
      <section>
        <SectionTitle
          number={2}
          title="이 회사는 무엇을 하는 곳인가요?"
          subtitle={level === "beginner" ? "한마디로 쉽게 설명합니다" : "사업 구조와 핵심 역량을 분석합니다"}
        />
        <Card>
          <CardContent className="pt-6">
            {level === "beginner" ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed">
                  <strong>삼성전자</strong>는 대한민국을 대표하는 글로벌 전자기업입니다. 우리가 일상에서 사용하는 스마트폰(갤럭시), TV, 냉장고 등을 만드는 회사로 잘 알려져 있지만, <strong>실제로 가장 중요한 사업은 &apos;반도체&apos;입니다.</strong>
                </p>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">반도체가 뭔가요?</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    반도체는 컴퓨터, 스마트폰, 자동차, AI 서버 등 거의 모든 전자기기에 들어가는 <strong>핵심 부품</strong>입니다. 쉽게 말해 &quot;전자기기의 두뇌&quot;와 같은 역할을 합니다. 삼성전자는 이 반도체, 그중에서도 데이터를 저장하는 <strong>&apos;메모리 반도체&apos;</strong> 분야에서 세계 1위 기업입니다.
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">왜 중요한가요?</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    최근 ChatGPT 같은 AI 서비스가 폭발적으로 성장하면서, AI를 구동하는 데 필요한 <strong>고성능 반도체 수요가 급증</strong>하고 있습니다. 삼성전자는 이 시장에서 핵심 플레이어 중 하나이며, 향후 성장의 가장 큰 동력이 됩니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed">
                  삼성전자는 메모리 반도체 세계 1위, 스마트폰 세계 1위의 글로벌 종합 전자기업입니다. 2024년 연결 매출 약 300조원, 영업이익 약 32.7조원을 기록했습니다.
                </p>
                <p className="text-sm leading-relaxed">
                  사업 포트폴리오는 <strong>DS(반도체), MX(모바일), DX(가전), SDC(디스플레이), Harman(전장)</strong>으로 구성되어 있으며, 반도체와 모바일이 전체 매출의 약 67%를 차지하는 핵심 사업부입니다.
                </p>
                <p className="text-sm leading-relaxed">
                  최근 AI 반도체 수요 급증에 따른 <strong>HBM(High Bandwidth Memory)</strong> 시장 확대가 가장 중요한 성장 동력으로 부각되고 있습니다. HBM은 AI 서버(GPU)에 필수적인 초고속 메모리로, NVIDIA의 H100/B100 GPU에 탑재됩니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 매출 구성 시각화 — 사업부별 상세 설명 포함 */}
      {segments && (
        <section>
          <SectionTitle
            number={3}
            title="돈은 어디서 벌고 있나요?"
            subtitle={level === "beginner" ? "각 사업부를 클릭하면 어떤 사업인지 상세히 알 수 있습니다" : "사업부문별 매출 비중, 핵심 제품, 시장 포지션, 전망을 분석합니다"}
          />
          <Card>
            <CardContent className="pt-6">
              <RevenueBreakdown segments={segments} level={level} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 실적 추이 차트 — 10개년 + 기간 선택 */}
      {financials && (
        <section>
          <SectionTitle
            number={4}
            title="실적은 어떻게 변해왔나요?"
            subtitle={level === "beginner" ? "매출과 이익이 어떻게 변화했는지 차트로 확인하세요" : "10개년 매출/영업이익/순이익 추이와 수익성 변화를 분석합니다"}
          />
          <Card>
            <CardContent className="pt-6">
              <FinancialPeriodSelector financials={financials} level={level} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 재무제표 상세 (손익계산서 / 재무상태표) */}
      {isSamsung && (
        <section>
          <SectionTitle
            number={5}
            title="재무제표 상세"
            subtitle={level === "beginner" ? "회사의 실제 재무 숫자를 항목별로 확인할 수 있습니다" : "손익계산서와 재무상태표를 항목별로 분석합니다"}
          />
          <Card>
            <CardContent className="pt-6">
              {level === "beginner" && (
                <div className="rounded-lg bg-muted/50 p-4 mb-6">
                  <p className="text-sm font-medium mb-2">재무제표가 뭔가요?</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong>손익계산서</strong>는 &quot;일정 기간 동안 얼마 벌고 얼마 썼는지&quot;를 보여줍니다 (성적표).
                    <strong> 재무상태표</strong>는 &quot;지금 현재 가진 재산과 빚이 얼마인지&quot;를 보여줍니다 (재산 목록).
                    두 표를 같이 보면 회사가 건강한지 판단할 수 있습니다.
                  </p>
                </div>
              )}
              <FullFinancials ticker={ticker} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 사업 히스토리 타임라인 */}
      {isSamsung && (
        <section>
          <SectionTitle
            number={6}
            title="이 회사는 어떻게 성장해왔나요?"
            subtitle={level === "beginner" ? "설립부터 지금까지의 핵심 역사를 타임라인으로 보여드립니다" : "사업 변천사에서 핵심 전환점을 파악합니다"}
          />
          <Card>
            <CardContent className="pt-6">
              <BusinessTimeline events={getSamsungTimeline()} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* 경쟁 포지션 */}
      {isSamsung && (
        <section>
          <SectionTitle
            number={7}
            title={level === "beginner" ? "경쟁사 대비 삼성전자는 어떤 위치인가요?" : "경쟁 포지셔닝 및 SWOT 분석"}
            subtitle={level === "beginner" ? "강점과 약점, 그리고 주요 경쟁사를 한눈에 비교합니다" : "사업 영역별 경쟁 포지션과 구조적 강점/약점을 분석합니다"}
          />
          <Card>
            <CardContent className="pt-6">
              {(() => {
                const data = getSamsungCompetitiveData();
                return (
                  <CompetitiveMap
                    companyName="삼성전자"
                    competitors={data.competitors}
                    strengths={data.strengths}
                    weaknesses={data.weaknesses}
                  />
                );
              })()}
              {level === "beginner" && (
                <div className="mt-6 rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">쉽게 정리하면</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    삼성전자는 <strong>메모리 반도체와 디스플레이에서는 세계 1위</strong>로 강력한 위치에 있지만,
                    <strong> AI 핵심 반도체(HBM)에서는 SK하이닉스를 추격</strong> 중이고,
                    <strong> 반도체 위탁 생산(파운드리)에서는 대만 TSMC에 크게 뒤처져</strong> 있습니다.
                    스마트폰은 출하량 기준 세계 1위이지만, 수익성은 애플이 앞서 있습니다.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 미래 전망 + 리스크 */}
      {isSamsung && (
        <section>
          <SectionTitle
            number={8}
            title={level === "beginner" ? "앞으로 어떻게 될까요?" : "미래 전망 및 투자 리스크 분석"}
            subtitle={level === "beginner" ? "성장 기회와 주의할 점을 정리했습니다" : "성장 동인과 리스크 요인을 구조적으로 분석합니다"}
          />
          <Card>
            <CardContent className="pt-6">
              <FutureOutlookVisual {...getSamsungOutlookData()} />
              {level === "beginner" && (
                <div className="mt-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <p className="text-sm font-medium text-yellow-800 mb-2">초보자를 위한 한줄 요약</p>
                  <p className="text-sm text-yellow-900/80 leading-relaxed">
                    삼성전자의 미래는 <strong>&quot;AI 시대에 얼마나 좋은 반도체를 만들 수 있느냐&quot;</strong>에 달려 있습니다.
                    AI 반도체(HBM) 시장이 폭발적으로 성장하고 있어 큰 기회가 있지만,
                    현재 SK하이닉스보다 기술적으로 뒤처져 있다는 점이 단기 리스크입니다.
                    장기적으로는 반도체·스마트폰·가전을 모두 아우르는 규모의 힘이 강점입니다.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {/* 비삼성전자 종목 기본 콘텐츠 */}
      {!isSamsung && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">
                {stock.name}의 상세 Fundamental 분석은
              </p>
              <p className="text-muted-foreground">
                AI 분석 엔진 연동 후 제공됩니다.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                현재 삼성전자(005930)에서 전체 분석 기능을 미리 체험할 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI 생성 안내 */}
      <div className="text-xs text-muted-foreground text-center py-4 border-t">
        본 리포트는 DART 전자공시, 증권사 리포트, 뉴스 기사 등 공개 자료를 기반으로 AI가 작성하였습니다.
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

function FinancialPeriodSelector({
  financials,
  level,
}: {
  financials: import("@/types/stock").FinancialData[];
  level: "beginner" | "intermediate";
}) {
  const [period, setPeriod] = useState<"4y" | "10y">("4y");

  const filtered = period === "4y" ? financials.slice(-4) : financials;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">기간:</span>
        <button
          onClick={() => setPeriod("4y")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            period === "4y" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          최근 4년
        </button>
        <button
          onClick={() => setPeriod("10y")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            period === "10y" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          10년 전체
        </button>
      </div>

      <RevenueTrendChart financials={filtered} />

      {level === "beginner" && (
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm font-medium mb-2">차트 읽는 법</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>파란색 막대(매출액)</strong>는 회사가 번 총 금액, <strong>초록색(영업이익)</strong>은 사업으로 실제 남긴 이익, <strong>보라색(순이익)</strong>은 세금 등을 다 내고 최종적으로 남은 이익입니다.
            {period === "10y" && (
              <> 10년 추이를 보면 삼성전자의 매출은 200조 → 300조로 약 50% 성장했지만, 영업이익은 <strong>반도체 사이클에 따라 크게 출렁이는 패턴</strong>이 보입니다. 2017~2018년(반도체 호황)과 2023년(반도체 불황)의 차이가 극명합니다.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
