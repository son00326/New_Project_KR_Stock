interface AdminReportPageProps {
  params: Promise<{ ticker: string }>;
}

export default async function AdminReportPage({
  params,
}: AdminReportPageProps) {
  const { ticker } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">풀 리포트 — {ticker}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        S2 풀 리포트·투심위에서 구현 예정 (M2 Section 0~8 Sticky Nav + M3 투심위 패널).
      </p>
    </div>
  );
}
