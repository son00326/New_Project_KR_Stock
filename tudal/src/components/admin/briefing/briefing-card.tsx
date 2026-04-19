import type { BriefingLog } from "@/types/admin";

// /admin 상단 모닝 브리핑 카드 (M11, S5a T5a.2).
// mock fixture `LATEST_BRIEFING`을 Server Component로 렌더.
// briefing.viewed 기록은 실데이터 전환 시 Server Action으로 추가.

interface BriefingCardProps {
  briefing: BriefingLog | undefined;
}

export function BriefingCard({ briefing }: BriefingCardProps) {
  if (!briefing) {
    return (
      <section
        aria-label="모닝 브리핑"
        className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-4 text-sm text-muted-foreground"
      >
        오늘 브리핑이 아직 생성되지 않았습니다 (매일 08:00 KST 자동 생성).
      </section>
    );
  }

  if (briefing.generationFailed) {
    return (
      <section
        aria-label="모닝 브리핑 실패"
        className="rounded-lg border border-[var(--color-market-down)]/40 bg-[var(--color-market-down)]/10 p-4 text-sm"
      >
        <div className="font-semibold text-[var(--color-market-down)]">
          ⚠ {briefing.date} 모닝 브리핑 생성 실패
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {briefing.contentSummary}
        </p>
        <p className="mt-2 text-xs">
          <a
            href="/admin/settings/health"
            className="underline underline-offset-2"
          >
            파이프라인 헬스 확인 →
          </a>
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="모닝 브리핑"
      className="rounded-lg border bg-card p-4 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">
          📅 {briefing.date} 모닝 브리핑
        </h2>
        <span className="text-xs text-muted-foreground">
          {briefing.sentChannels.length > 0
            ? `발송: ${briefing.sentChannels.join(" · ")}`
            : "발송 대기"}
        </span>
      </header>
      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {briefing.contentSummary}
      </p>
      <footer className="mt-3 text-xs text-muted-foreground">
        생성: {new Date(briefing.generatedAt).toLocaleString("ko-KR")}
        {briefing.viewEvents.length > 0 ? ` · 열람 ${briefing.viewEvents.length}회` : ""}
      </footer>
    </section>
  );
}
