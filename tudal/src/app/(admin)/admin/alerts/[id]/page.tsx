interface AlertDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminAlertDetailPage({
  params,
}: AlertDetailPageProps) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-2xl font-semibold">알림 상세 — {id}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        S5 스케줄러·알림에서 구현 예정 (Exit 대안 시나리오 + §7 Exit 대조).
      </p>
    </div>
  );
}
