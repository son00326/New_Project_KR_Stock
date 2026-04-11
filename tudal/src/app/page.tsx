import Link from "next/link";
import { TrendingUp, Search, BarChart3, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StockSearch } from "@/components/stock/stock-search";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30 py-24 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              똑똑한 주식 픽,
              <span className="text-primary"> 주픽</span>
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl leading-relaxed">
              초보부터 전문가까지, 누구나 쉽게 이해할 수 있는
              <br className="hidden md:block" />
              AI 기반 주식 분석 리포트를 만나보세요.
            </p>

            {/* Hero 검색바 */}
            <div className="max-w-lg mx-auto pt-4">
              <StockSearch
                variant="hero"
                placeholder="분석하고 싶은 종목을 검색해보세요"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto text-base px-8">
                  무료로 시작하기
                </Button>
              </Link>
              <Link href="/stock/005930">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-base px-8"
                >
                  삼성전자 분석 보기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              왜 주픽인가요?
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              복잡한 주식 분석을 누구나 이해할 수 있게
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">종목 검색</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  종목명만 검색하면 Fundamental부터 Technical 분석까지 한눈에 확인할 수 있습니다.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">난이도별 분석</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  초보, 중급, 전문가 레벨로 구분된 리포트를 제공합니다. 본인 수준에 맞는 분석을 선택하세요.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Peer 비교</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  국내외 경쟁사와 멀티플을 비교하여 저평가/고평가 여부를 판단할 수 있습니다.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">신뢰도 최우선</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  팩트 체크된 데이터만 사용합니다. 허위 사실 없는 분석을 약속합니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 매크로 현황판 미리보기 */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            매크로 현황판
          </h2>
          <p className="mt-4 text-muted-foreground text-lg mb-8">
            글로벌 매크로 지표를 한눈에 파악하고, 투자 타이밍을 잡으세요
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-8">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">공포·탐욕 지수</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">38</p>
              <p className="text-xs text-blue-600 font-medium">공포</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">미국 CPI</p>
              <p className="text-2xl font-bold mt-1">3.2%</p>
              <p className="text-xs text-red-600 font-medium">둔화 추세</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">Fed 기준금리</p>
              <p className="text-2xl font-bold mt-1">4.75%</p>
              <p className="text-xs text-red-600 font-medium">인하 진행</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">원/달러 환율</p>
              <p className="text-2xl font-bold mt-1">1,345</p>
              <p className="text-xs text-blue-600 font-medium">-0.5%</p>
            </div>
          </div>

          <Link href="/macro">
            <Button size="lg" variant="outline" className="text-base px-8">
              매크로 현황판 전체 보기
            </Button>
          </Link>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            합리적인 요금제
          </h2>
          <p className="mt-4 text-muted-foreground text-lg mb-12">
            무료로 시작하고, 필요한 만큼만 업그레이드하세요
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <Card className="relative">
              <CardContent className="pt-8 pb-8 space-y-4">
                <h3 className="text-lg font-semibold">Free</h3>
                <div className="text-3xl font-bold">
                  0<span className="text-base font-normal text-muted-foreground">원/월</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2 text-left">
                  <li>- 월 3회 리포트 열람</li>
                  <li>- 초보 레벨 분석</li>
                  <li>- 일 3회 종목 검색</li>
                </ul>
                <Link href="/signup" className="block pt-2">
                  <Button variant="outline" className="w-full">
                    시작하기
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Standard */}
            <Card className="relative border-primary shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  인기
                </span>
              </div>
              <CardContent className="pt-8 pb-8 space-y-4">
                <h3 className="text-lg font-semibold">Standard</h3>
                <div className="text-3xl font-bold">
                  14,900<span className="text-base font-normal text-muted-foreground">원/월</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2 text-left">
                  <li>- 무제한 리포트 열람</li>
                  <li>- 초보 + 중급 분석</li>
                  <li>- 국내 Peer 비교</li>
                  <li>- AI 월간 리포트</li>
                </ul>
                <Link href="/signup" className="block pt-2">
                  <Button className="w-full">시작하기</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="relative">
              <CardContent className="pt-8 pb-8 space-y-4">
                <h3 className="text-lg font-semibold">Pro</h3>
                <div className="text-3xl font-bold">
                  34,900<span className="text-base font-normal text-muted-foreground">원/월</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2 text-left">
                  <li>- 전문가 레벨 분석</li>
                  <li>- 국내 + 해외 Peer 비교</li>
                  <li>- AI In-depth 리포트</li>
                  <li>- 목표주가(TP) 제공</li>
                </ul>
                <Link href="/signup" className="block pt-2">
                  <Button variant="outline" className="w-full">
                    시작하기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            지금 바로 시작하세요
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            주픽과 함께 더 나은 투자 결정을 내리세요
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button size="lg" className="text-base px-8">
                무료로 시작하기
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
