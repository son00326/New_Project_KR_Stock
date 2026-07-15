export default function PrismLoading() {
  return (
    <div aria-busy="true" aria-label="프리즘 데이터를 불러오는 중" className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 max-w-xl animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-border/60 bg-card shadow-toss-sm"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-border/60 bg-card shadow-toss-sm" />
    </div>
  );
}
