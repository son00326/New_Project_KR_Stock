import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Database, FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PrismMarket = "kr" | "us";

export function resolveMarket(value: string | string[] | undefined): PrismMarket {
  return value === "us" ? "us" : "kr";
}

export function resolvePage(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === undefined) return 1;
  const parsed = Number.parseInt(candidate, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

interface PrismPageHeaderProps {
  readonly title: string;
  readonly description: string;
  readonly market: PrismMarket;
  readonly pathname: string;
  readonly trailing?: ReactNode;
}

export function PrismPageHeader({
  title,
  description,
  market,
  pathname,
  trailing,
}: PrismPageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <FlaskConical aria-hidden="true" className="size-4 text-primary" />
          <p className="text-xs font-semibold text-primary">외부 엔진 사이드카</p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {trailing}
        <MarketToggle market={market} pathname={pathname} />
      </div>
    </header>
  );
}

interface MarketToggleProps {
  readonly market: PrismMarket;
  readonly pathname: string;
}

export function MarketToggle({ market, pathname }: MarketToggleProps) {
  return (
    <div
      aria-label="시장 선택"
      className="inline-flex rounded-xl bg-muted p-1"
      role="group"
    >
      {(["kr", "us"] as const).map((item) => (
        <Link
          key={item}
          aria-current={market === item ? "page" : undefined}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
            market === item
              ? "bg-card text-foreground shadow-toss-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          href={`${pathname}?market=${item}`}
        >
          {item === "kr" ? "한국" : "미국"}
        </Link>
      ))}
    </div>
  );
}

interface SectionFallbackProps {
  readonly title: string;
  readonly description?: string;
}

export function SectionFallback({ title, description }: SectionFallbackProps) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex min-h-32 items-center gap-3 py-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Database aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">{title}을 표시할 수 없어요</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {description ?? "이 섹션의 데이터 형식이 변경되었거나 아직 비어 있습니다."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Database aria-hidden="true" className="size-5 text-muted-foreground" />
        </div>
        <p className="mt-4 font-semibold">{title}</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly description?: string;
  readonly tone?: "neutral" | "up" | "down";
}

export function MetricCard({
  label,
  value,
  description,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl font-bold tabular-nums",
            tone === "up" && "text-market-up",
            tone === "down" && "text-market-down",
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {description === undefined ? null : (
        <CardContent className="text-xs text-muted-foreground">
          {description}
        </CardContent>
      )}
    </Card>
  );
}

interface StaleNoticeProps {
  readonly stale: boolean;
  readonly label: string;
  readonly description: string;
}

export function StaleNotice({ stale, label, description }: StaleNoticeProps) {
  if (!stale) {
    return <Badge className="bg-success/10 text-success">{label}</Badge>;
  }

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>
          <p className="font-semibold text-warning">{label}</p>
          <p className="mt-1 leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${value.toFixed(2)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}
