// PR1 — cron monthly-batch real path (omxy R1~R8 CONVERGED).
// B1+B11+B12+B15 fix: cron service-role client + orchestrator 내부 scheduler_fail alert + JSON 502 only.
// 실 LLM 호출은 후속 PR (실 키 + hardcap 운영 검증 후). 본 PR scope에서는 mock tier0Source/callPersonaPanel이
// production 진입 시점에 throw → orchestrator 내부 catch → recordSchedulerFailAlert + release failed.
// route catch는 JSON 502만 반환 (alert 중복 호출 차단).
import { NextResponse, type NextRequest } from 'next/server';
import {
  acquireBatchLockCron,
  releaseBatchLockCron,
} from '@/lib/data/admin-batch-runs-cron';
import { recordSchedulerFailAlert } from '@/lib/data/admin-alerts-insert';
import { runMonthlyBatchOrchestrator } from '@/lib/screening/monthly-batch-orchestrator';
import { upsertShortList30 } from '@/lib/data/admin-shortlist-persist';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Tier1Candidate } from '@/lib/screening/persona-eval';
import type { PersonaScore } from '@/lib/screening/tier1-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    // dev only: secret 미설정 시 통과. production-like (NODE_ENV/VERCEL_ENV/NEXT_PUBLIC_APP_ENV) 환경은 fail-closed.
    return !isProductionLikeForAuth();
  }
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

function currentMonthYM(): string {
  const now = new Date();
  const m = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  return `${now.getUTCFullYear()}-${m}`;
}

// Placeholder mock — 본 PR scope에서는 Tier 0 source 실 구현 OOS (후속 PR + Python tier0_candidates_150 시드).
// B15 fix (omxy R4): production 진입 시점에 throw → orchestrator 내부 catch → recordSchedulerFailAlert + release failed.
// route catch는 JSON 502만 반환 (alert 중복 호출 차단).
async function mockTier0Source(): Promise<Tier1Candidate[]> {
  throw new Error('tier0_source_not_wired_pr1_followup');
}

async function mockCallPersonaPanel(): Promise<PersonaScore[]> {
  throw new Error('persona_panel_not_wired_pr1_followup');
}

async function mockFetchFinancials(): Promise<string> {
  return '';
}

async function commitBadgeOnlyPlaceholder(): Promise<void> {
  throw new Error('commit_badge_only_not_wired_pr1_followup');
}

// MF1 fix (3-track deep-review): cron path는 service-role client을 upsertShortList30에 명시 주입.
// session-based createClient는 cron 환경에서 auth.uid()=null → RLS rejects → persist 항상 실패.
async function persistForCron(
  month: string,
  selected: Parameters<typeof upsertShortList30>[1],
): Promise<void> {
  const supabase = createServiceRoleClient();
  await upsertShortList30(month, selected, { client: supabase });
}

// orchestrator interface 요구에 맞춰 cron route 내부 wrapper.
async function recordSchedulerFailAlertForCron(input: {
  month: string;
  errorCode: string;
  callCountDone: number;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  await recordSchedulerFailAlert({
    supabase,
    outcome: {
      runId: `cron-${input.month}-${Date.now()}`,
      startedAt: nowIso,
      finishedAt: nowIso,
      totalLatencyMs: 0,
      overallSuccess: false,
      steps: [
        {
          name: 'orchestrator',
          pipeline: 'dart',
          attempts: 1,
          success: false,
          error: input.errorCode,
          latencyMs: 0,
          startedAt: nowIso,
          finishedAt: nowIso,
        },
      ],
    },
  });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const month = currentMonthYM();
  try {
    const outcome = await runMonthlyBatchOrchestrator({
      month,
      adminUserId: 'cron-system',
      promptVersionId:
        process.env.PROMPT_VERSION_ID ?? 'render-user-prompt@v1',
      personasVersionId:
        process.env.PERSONAS_VERSION_ID ?? 'core11@v3.1',
      tier0Source: mockTier0Source,
      callPersonaPanel: mockCallPersonaPanel,
      fetchFinancials: mockFetchFinancials,
      lock: {
        acquire: acquireBatchLockCron,
        release: releaseBatchLockCron,
      },
      persist: persistForCron,
      commitBadgeOnly: commitBadgeOnlyPlaceholder,
      recordSchedulerFailAlert: recordSchedulerFailAlertForCron,
    });
    return NextResponse.json({ ok: true, outcome }, { status: 200 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ ok: false, error: code }, { status: 502 });
  }
}
