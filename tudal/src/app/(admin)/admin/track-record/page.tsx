// T4.3 — /admin/track-record
// PR4 Task 3 (Group A + F 해소): 누적 vs 월별 아카이브 탭 분리.
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 3.2.3 (page.tsx Server Component).
//
// Server Component (no "use client"). 누적 + 아카이브 데이터 동시 fetch → TrackRecordTabs(client island)에 props 주입.
// 모든 UI 렌더링은 TrackRecordTabs로 위임 (page.tsx는 페이지 헤더만 보유).

import { fetchTrackRecordCumulative, fetchTrackRecordArchive } from './actions';
import { TrackRecordTabs } from './track-record-tabs';

export default async function AdminTrackRecordPage() {
  const [cumulative, archives] = await Promise.all([
    fetchTrackRecordCumulative(),
    fetchTrackRecordArchive(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Track Record</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          누적 성과 (포트폴리오 통계) · 월별 아카이브 (풀 리포트 + 승인 결과)
        </p>
      </header>

      <TrackRecordTabs cumulative={cumulative} archives={archives} />
    </div>
  );
}
