// PR1 legacy — cron monthly-batch single-shot selector.
// W2a wiring audit: this old path is superseded by /api/cron/monthly-batch/selection-worker.
// It used to run the synchronous orchestrator with track='midlong' (20 selected) and then call
// the old 30-row writer, so enabling it could spend real AI cost and fail persistence. Keep the
// cron endpoint auth-compatible but make it a clean no-op before service-role/orchestrator/AI load.
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONTHLY_BATCH_SINGLE_SHOT_DEPRECATED =
  'monthly_batch_single_shot_deprecated';

// MF4 fix (3-track deep-review W2 + #10): production-like env에서는 CRON_SECRET 강제 (NODE_ENV 단독 의존 차단).
// VERCEL_ENV production/preview + NEXT_PUBLIC_APP_ENV production은 모두 fail-closed.
function isProductionLikeForAuth(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.NEXT_PUBLIC_APP_ENV === 'production'
  );
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // dev only: secret 미설정 시 통과. production-like 환경은 fail-closed.
    return !isProductionLikeForAuth();
  }
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const reason =
    process.env.MONTHLY_BATCH_CRON_AI_ENABLED === 'true'
      ? MONTHLY_BATCH_SINGLE_SHOT_DEPRECATED
      : 'monthly_batch_cron_ai_disabled';

  return NextResponse.json(
    { ok: true, skipped: true, reason },
    { status: 200 },
  );
}
