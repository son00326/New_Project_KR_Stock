// PR1 B1+B11+B17 fix — server-only service-role Supabase client.
// B11 (omxy R3): `import "server-only"` 강제 — Next.js 빌드타임에 client import 차단.
// B17 (omxy R5): 사용 boundary는 cron + cron lock helper에 한정.
//   허용 (cron route 직접 import + DI seam helpers를 통한 간접 사용):
//     - tudal/src/app/api/cron/monthly-batch/** (PR1 B17 원본 + PR5 report-worker/** 하위)
//     - tudal/src/lib/report/full-report-batch-worker.ts (PR5: report 생성 chunk driver, service-role 주입)
//     - tudal/src/app/api/cron/silent-health/** (Step 2.7a SELECT + Step 2.7b.2 INSERT)
//     - tudal/src/app/api/cron/news-sweep/** (Step 2.7b.1 SELECT + Step 2.7b.2 INSERT)
//     - tudal/src/app/api/cron/morning-briefing/** (Step 2.7b.1 SELECT + Step 2.7b.3 INSERT)
//     - tudal/src/app/api/cron/funnel-reflection/** (G1 D-5: FUNNEL_REFLECTION_ENABLED 게이트 후
//       로더 SELECT[tier1_selection_run/tier0_candidates_150] + tier0_funnel_reflection 제안 INSERT)
//     - tudal/src/app/api/cron/reflection-job/** (PR-K D32 — pre-existing 소비자, 2026-07-04 allowlist sweep 추가)
//     - tudal/src/app/api/cron/exit-signal/** (S7c — pre-existing 소비자, 동 sweep)
//     - tudal/src/app/api/cron/exit-outcome/** (S7c — pre-existing 소비자, 동 sweep)
//     - tudal/src/lib/data/admin-batch-runs-cron.ts (PR1 B17 원본)
//   허용 (DI seam을 통한 cron 호출자 service-role 주입 — admin pages는 session client 유지):
//     - tudal/src/lib/data/admin-news.ts (Step 2.7a: options.client? SELECT + Step 2.7b.2 INSERT)
//     - tudal/src/lib/data/admin-alerts.ts (Step 2.7a: options.client?)
//     - tudal/src/lib/data/admin-pipeline-health.ts (Step 2.5 기존 options.client?)
//     - tudal/src/lib/data/admin-heartbeat-log.ts (Step 2.7b.2: options.client? INSERT)
//     - tudal/src/lib/data/admin-alerts-insert.ts (Step 2.7b.3: insertAlertEvents options.client? INSERT — recordSchedulerFailAlert DI-only 보존)
//     - tudal/src/lib/data/admin-briefing-log.ts (Step 2.7b.3: options.client? INSERT)
//     - tudal/src/lib/data/admin-shortlist.ts (PR5: getActiveShortList options.client? SELECT)
//     - tudal/src/lib/data/admin-tier0-candidates.ts (PR-D: getTier0Candidates options.client? SELECT — cron service-role / admin session)
//     - tudal/src/lib/data/admin-reports.ts (PR5: reportExistsAndCompleteForMonth options.client? SELECT)
//     - tudal/src/lib/data/admin-pipeline-health-insert.ts (PR5: insertPipelineHealth options.client? INSERT)
//     - tudal/src/lib/data/admin-cost-alerts.ts (PR5: emitCostAlert → insertAlertEvents options.client? INSERT)
//   금지 (DI-only 패턴 사용):
//     - tudal/src/app/(admin)/admin/portfolio/actions.ts (session-based createClient만)
// 절대 client component / browser에서 import 금지 (SUPABASE_SERVICE_ROLE_KEY 노출).
import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function createServiceRoleClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('supabase_url_missing');
  if (!key) throw new Error('service_role_key_missing');
  cached = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

// 테스트용 reset (vitest beforeEach에서 호출)
export function __resetServiceRoleClientForTests(): void {
  cached = null;
}
