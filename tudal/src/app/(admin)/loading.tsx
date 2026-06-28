// FixPlan-46 §P1.3 G-2-FE — /admin 라우트 그룹 공통 로딩 boundary.
// Next.js 16 App Router: 같은 세그먼트의 비동기 Server Component 데이터 페치 중 표시.
export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <header>
        <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded-lg bg-muted/60" />
      </header>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border bg-muted/30"
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">관리자 페이지를 불러오는 중입니다…</p>
    </div>
  );
}
