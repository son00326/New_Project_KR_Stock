// PR1 B1+B11+B17 fix — server-only service-role Supabase client.
// B11 (omxy R3): `import "server-only"` 강제 — Next.js 빌드타임에 client import 차단.
// B17 (omxy R5): 사용 boundary는 cron + cron lock helper에 한정.
//   허용 (cron route 직접 import + DI seam helpers를 통한 간접 사용):
//     - tudal/src/app/api/cron/monthly-batch/** (PR1 B17 원본)
//     - tudal/src/app/api/cron/silent-health/** (Step 2.7a, 2026-05-28)
//     - tudal/src/app/api/cron/news-sweep/** (Step 2.7b.1, 2026-05-28)
//     - tudal/src/app/api/cron/morning-briefing/** (Step 2.7b.1, 2026-05-28)
//     - tudal/src/lib/data/admin-batch-runs-cron.ts (PR1 B17 원본)
//   허용 (DI seam을 통한 cron 호출자 service-role 주입 — admin pages는 session client 유지):
//     - tudal/src/lib/data/admin-news.ts (Step 2.7a: options.client?)
//     - tudal/src/lib/data/admin-alerts.ts (Step 2.7a: options.client?)
//     - tudal/src/lib/data/admin-pipeline-health.ts (Step 2.5 기존 options.client?)
//   금지 (DI-only 패턴 사용):
//     - tudal/src/lib/data/admin-alerts-insert.ts (supabase: SupabaseClient를 인자로 받음)
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
