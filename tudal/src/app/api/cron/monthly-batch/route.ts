// PR1 — cron monthly-batch real path (omxy R1~R8 CONVERGED).
// B1+B11+B12+B15 fix: cron service-role client + orchestrator 내부 scheduler_fail alert + JSON 502 only.
// PR-D (ADR D-3): tier0Source = tier0_candidates_150 실 SELECT (mock 제거). 나머지(callPersonaPanel/
//   commitBadgeOnly)는 실 LLM 호출 PR(PR-E) 까지 stub throw → orchestrator 내부 catch →
//   recordSchedulerFailAlert + release failed. route catch는 JSON 502만 반환 (alert 중복 호출 차단).
import { NextResponse, type NextRequest } from 'next/server';
import {
  acquireBatchLockCron,
  releaseBatchLockCron,
} from '@/lib/data/admin-batch-runs-cron';
import { recordSchedulerFailAlert } from '@/lib/data/admin-alerts-insert';
import { runMonthlyBatchOrchestrator } from '@/lib/screening/monthly-batch-orchestrator';
import { getTier0Candidates } from '@/lib/data/admin-tier0-candidates';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Tier1Candidate } from '@/lib/screening/persona-eval';
import type { PersonaScore, Tier1ScreeningResult } from '@/lib/screening/tier1-schema';

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

// PR-D (ADR D-3): Tier 0 source 실 SELECT — tier0_candidates_150 (Python --emit-candidates 시드).
// service-role client 주입 (cron auth.uid()=null → RLS bypass). 해당 월 시드 부재 시 0건 →
// orchestrator가 `tier1_candidates_must_be_150 (got 0)` throw → 내부 catch → recordSchedulerFailAlert
// + release failed → route catch JSON 502 (정상 degraded — 운영자가 Python 시드 후 재실행).
//
// ⚠️ 운영 순서 게이트 (PR-E 선행 필수 — deep-review MED clobber 위험 박제):
//   PR-D는 tier0Source만 un-stub. callPersonaPanel은 PR-E까지 stub throw → 본 cron이 150 시드를 만나면
//   runTier1Screening 전부 degraded(⚪) → orchestrator가 persist(30 ⚪) 호출 후 commitBadgeOnly stub에서 throw.
//   이 persist는 upsertShortList30이 name/sector를 안 채워(PR-E가 매핑 수정) production short_list_30(canonical 30)을
//   sector-less ⚪ 30으로 덮어쓴다. 따라서 **PR-E 머지 전에는 tier0_candidates_150 시드 + cron 활성화 금지**.
//   (자동 재현 불가 — cron dormant(PR5_CRON_AUTO_ENABLED off) + admin trigger UI caller 0 = USER 게이트.)
async function tier0SourceForCron(month: string): Promise<Tier1Candidate[]> {
  return getTier0Candidates({ month, client: createServiceRoleClient() });
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

// PR-D guard: callPersonaPanel/commitBadgeOnly가 stub인 중간 상태에서는 runTier1Screening이
// 150개 전부 ⚪ degraded로 selected를 만들 수 있다. 실제 PR-E panel+persist mapping 전까지는
// short_list_30 쓰기를 코드 레벨에서 차단해 production 30 rows clobber를 방지한다.
async function persistBlockedUntilPrE(
  month: string,
  selected: Tier1ScreeningResult['selected'],
): Promise<void> {
  void month;
  void selected;
  throw new Error('tier1_persist_blocked_until_pr_e');
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
      tier0Source: () => tier0SourceForCron(month),
      callPersonaPanel: mockCallPersonaPanel,
      fetchFinancials: mockFetchFinancials,
      lock: {
        acquire: acquireBatchLockCron,
        release: releaseBatchLockCron,
      },
      persist: persistBlockedUntilPrE,
      commitBadgeOnly: commitBadgeOnlyPlaceholder,
      recordSchedulerFailAlert: recordSchedulerFailAlertForCron,
    });
    return NextResponse.json({ ok: true, outcome }, { status: 200 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ ok: false, error: code }, { status: 502 });
  }
}
