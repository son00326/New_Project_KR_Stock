// PR1 B1+B11+B17 fix — server-only service-role Supabase client.
// B11 (omxy R3): `import "server-only"` 강제 — Next.js 빌드타임에 client import 차단.
// B17 (omxy R5): 사용 boundary는 cron/monthly-batch/ + cron lock helper에 한정.
//   허용:
//     - tudal/src/app/api/cron/monthly-batch/**
//     - tudal/src/lib/data/admin-batch-runs-cron.ts
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
