"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANS, formatPrice } from "@/lib/constants";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <div className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            합리적인 요금제
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            무료로 시작하고, 필요한 만큼만 업그레이드하세요
          </p>

          {/* 월간/연간 토글 */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              월간
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              연간
              <Badge variant="secondary" className="ml-2 text-xs">
                33% 할인
              </Badge>
            </button>
          </div>
        </div>

        {/* 플랜 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free */}
          <PlanCard
            plan={PLANS.free}
            billingCycle={billingCycle}
            isPopular={false}
            ctaText="무료로 시작하기"
            ctaVariant="outline"
          />

          {/* Standard */}
          <PlanCard
            plan={PLANS.standard}
            billingCycle={billingCycle}
            isPopular={true}
            ctaText="Standard 시작하기"
            ctaVariant="default"
          />

          {/* Pro */}
          <PlanCard
            plan={PLANS.pro}
            billingCycle={billingCycle}
            isPopular={false}
            ctaText="Pro 시작하기"
            ctaVariant="outline"
          />
        </div>

        {/* 기능 비교 테이블 */}
        <div className="mt-20 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            상세 기능 비교
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-4 pr-4 font-medium text-muted-foreground">기능</th>
                  <th className="text-center py-4 px-4 font-semibold">Free</th>
                  <th className="text-center py-4 px-4 font-semibold text-primary">Standard</th>
                  <th className="text-center py-4 px-4 font-semibold">Pro</th>
                </tr>
              </thead>
              <tbody>
                <FeatureRow feature="리포트 열람" free="월 3회" standard="무제한" pro="무제한" />
                <FeatureRow feature="분석 레벨" free="초보" standard="초보 + 중급" pro="초보 + 중급 + 전문가" />
                <FeatureRow feature="종목 검색" free="일 3회" standard="무제한" pro="무제한" />
                <FeatureRow feature="포트폴리오 종목" free="5개" standard="30개" pro="무제한" />
                <FeatureRow feature="국내 Peer 비교" free={false} standard={true} pro={true} />
                <FeatureRow feature="해외 Peer 비교" free={false} standard={false} pro={true} />
                <FeatureRow feature="뉴스 알림" free={false} standard="일 3회" pro="실시간 무제한" />
                <FeatureRow feature="AI 월간 리포트" free={false} standard={true} pro={true} />
                <FeatureRow feature="AI 분기 In-depth 리포트" free={false} standard={false} pro={true} />
                <FeatureRow feature="목표주가(TP)" free={false} standard={false} pro={true} />
                <FeatureRow feature="평단가 시뮬레이터" free={false} standard={true} pro={true} />
                <FeatureRow feature="자동 매매 (추후)" free={false} standard={false} pro={true} />
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            자주 묻는 질문
          </h2>
          <div className="space-y-6">
            <FaqItem
              question="무료 체험 기간이 있나요?"
              answer="Free 플랜으로 서비스를 바로 이용할 수 있습니다. 월 3회 리포트 열람과 기본 분석 기능을 제한 없이 체험해보세요."
            />
            <FaqItem
              question="언제든지 해지할 수 있나요?"
              answer="네, 구독은 언제든지 해지 가능합니다. 해지 후에도 결제 기간이 끝날 때까지 서비스를 이용할 수 있습니다."
            />
            <FaqItem
              question="플랜을 변경할 수 있나요?"
              answer="언제든지 업그레이드 또는 다운그레이드가 가능합니다. 업그레이드 시 즉시 적용되며, 다운그레이드는 다음 결제일부터 적용됩니다."
            />
            <FaqItem
              question="투자 조언을 제공하나요?"
              answer="투달은 데이터 기반 분석 정보를 제공하는 플랫폼이며, 투자 자문 서비스가 아닙니다. 모든 투자 판단의 책임은 이용자 본인에게 있습니다."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  billingCycle,
  isPopular,
  ctaText,
  ctaVariant,
}: {
  plan: (typeof PLANS)[keyof typeof PLANS];
  billingCycle: "monthly" | "yearly";
  isPopular: boolean;
  ctaText: string;
  ctaVariant: "default" | "outline";
}) {
  const price = billingCycle === "monthly" ? plan.price : plan.yearlyPrice;
  const monthlyPrice =
    billingCycle === "yearly" && plan.yearlyPrice > 0
      ? Math.round(plan.yearlyPrice / 12)
      : plan.price;

  return (
    <Card
      className={`relative ${
        isPopular ? "border-primary shadow-lg scale-105" : ""
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="text-xs">가장 인기</Badge>
        </div>
      )}
      <CardContent className="pt-8 pb-8 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="text-sm text-muted-foreground">{plan.nameKo}</p>
        </div>

        <div>
          <span className="text-4xl font-bold">
            {monthlyPrice === 0 ? "0" : formatPrice(monthlyPrice).replace("원", "")}
          </span>
          <span className="text-muted-foreground">{monthlyPrice === 0 ? "원" : "원"}/월</span>
          {billingCycle === "yearly" && price > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              연 {formatPrice(price)} (월 {formatPrice(monthlyPrice)})
            </p>
          )}
        </div>

        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <Link href="/signup" className="block">
          <Button variant={ctaVariant} className="w-full h-11">
            {ctaText}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function FeatureRow({
  feature,
  free,
  standard,
  pro,
}: {
  feature: string;
  free: string | boolean;
  standard: string | boolean;
  pro: string | boolean;
}) {
  const renderValue = (value: string | boolean) => {
    if (value === true) return <Check className="h-4 w-4 text-green-600 mx-auto" />;
    if (value === false) return <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />;
    return <span>{value}</span>;
  };

  return (
    <tr className="border-b">
      <td className="py-3 pr-4 text-muted-foreground">{feature}</td>
      <td className="py-3 px-4 text-center">{renderValue(free)}</td>
      <td className="py-3 px-4 text-center">{renderValue(standard)}</td>
      <td className="py-3 px-4 text-center">{renderValue(pro)}</td>
    </tr>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium">{question}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
    </div>
  );
}
