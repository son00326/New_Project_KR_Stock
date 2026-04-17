interface AdminReportRegeneratePageProps {
  params: Promise<{ ticker: string }>;
}

export default async function AdminReportRegeneratePage({
  params,
}: AdminReportRegeneratePageProps) {
  const { ticker } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">리포트 재생성 — {ticker}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        S4 성과·Decision Tree에서 구현 예정 (M9 재생성 cap 가드: auto ≤ 1 / manual ≤ 2).
      </p>
    </div>
  );
}
