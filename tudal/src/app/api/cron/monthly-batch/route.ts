// PR1 — cron monthly-batch real path (omxy R1~R8 CONVERGED).
// B1+B11+B12+B15 fix: cron service-role client + orchestrator 내부 scheduler_fail alert + JSON 502 only.
// PR-D (ADR D-3): tier0Source = tier0_candidates_150 실 SELECT (mock 제거).
// PR-G (ADR 2026-05-31, cron 실 AI prep): callPersonaPanel/fetchFinancials 실 배선 (mock 제거).
//   실 cron AI는 env flag MONTHLY_BATCH_CRON_AI_ENABLED + CRON_SYSTEM_USER_ID(UUID + auth.users 존재) +
//   AI_COST_LOG_REAL_INSERT_ENABLED + ANTHROPIC_API_KEY 4종 충족 시에만 가동. default off → preflight가
//   callPersonaPanel(실 Anthropic) 전에 throw → cost 0 (merge-safe). PR5 PR5_CRON_AUTO_ENABLED step-0 패턴 정합.
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  acquireBatchLockCron,
  releaseBatchLockCron,
} from '@/lib/data/admin-batch-runs-cron';
import { recordSchedulerFailAlert } from '@/lib/data/admin-alerts-insert';
import { runMonthlyBatchOrchestrator } from '@/lib/screening/monthly-batch-orchestrator';
import { getTier0Candidates } from '@/lib/data/admin-tier0-candidates';
import { upsertShortList30 } from '@/lib/data/admin-shortlist-persist';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { makeCallPersonaPanel } from '@/lib/screening/persona-panel-adapter';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';
import { callPersona } from '@/lib/ai/anthropic-client';
import { fetchFinancialsSummary } from '@/lib/data/dart-financials';
import { isCostLoggingEnabled, preflightHardcap } from '@/lib/cost/cost-logger';
import type { Tier1Candidate } from '@/lib/screening/persona-eval';
import type { Tier1ScreeningResult } from '@/lib/screening/tier1-schema';

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
async function tier0SourceForCron(month: string): Promise<Tier1Candidate[]> {
  return getTier0Candidates({ month, client: createServiceRoleClient() });
}

// PR-G (ADR 2026-05-31) — cron 실 AI fail-closed preflight (실 Anthropic 호출 전 1회, spend 0).
//   orchestrator가 lock + tier0Source(150-invariant) 통과 후, callPersonaPanel 직전 본 preflight 1회 호출.
//   아래 4 게이트 중 하나라도 미충족이면 throw → callPersonaPanel 0회 → cost 0 (PR5 step-0 패턴 정합).
//   ⓐ MONTHLY_BATCH_CRON_AI_ENABLED off (default): cron 실 AI 비활성 = merge-safe. USER가 Vercel env true 설정 시 가동.
//   ⓑ cost-logging off: insertCostLog noop → getMonthlyTotal=0 → preflightHardcap fail-open(50만원 hardcap 무력화) 차단.
//   ⓒ ANTHROPIC_API_KEY 부재: 실 AI 불가.
//   ⓓ CRON_SYSTEM_USER_ID: cost_log.called_by FK(auth.users) — UUID 형식 + 실존 검증 (service-role admin API).
//   통과 시 preflightHardcap(service-role client — cron auth.uid()=null RLS bypass)로 50만원 hardcap 비용 가드.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function preflightCronRealAi(input: {
  month: string;
  callCount: number;
  client: SupabaseClient;
  cronSystemUserId: string;
}): Promise<void> {
  if (process.env.MONTHLY_BATCH_CRON_AI_ENABLED !== 'true') {
    throw new Error('monthly_batch_cron_ai_disabled');
  }
  if (!isCostLoggingEnabled()) {
    throw new Error('cost_logging_disabled');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ai_key_unavailable');
  }
  if (!UUID_RE.test(input.cronSystemUserId)) {
    throw new Error('cron_system_user_id_invalid');
  }
  const { data: userData, error: userErr } =
    await input.client.auth.admin.getUserById(input.cronSystemUserId);
  if (userErr || !userData?.user) {
    throw new Error('cron_system_user_not_found');
  }
  await preflightHardcap(
    { month: input.month, callCount: input.callCount },
    // STEP-2: cron service-role client → 직접 SELECT(RLS bypass) 유지. admin-only RPC 미경유.
    { client: input.client, callerKind: 'service-role' },
  );
}

// PR-E — commitBadgeOnly no-op (배지는 persist의 short_list_30.consensus_badge로 기록. 150/150 게이트
//   통과 시 selected는 전부 non-⚪이라 호출 0회). cron 실 AI 비활성 시 preflight 차단으로도 unreachable.
async function commitBadgeOnlyNoop(): Promise<void> {}

// PR-E — cron persist (service-role + commentsByTicker 라우팅). 150/150 게이트 통과 시에만 도달.
//   preflightCronRealAi 4 게이트(flag/cost/key/cron-user) 통과 후 실 AI 30선정 → 본 경로로 short_list_30 기록.
async function persistForCron(
  month: string,
  selected: Tier1ScreeningResult['selected'],
  commentsByTicker?: Tier1ScreeningResult['commentsByTicker'],
): Promise<void> {
  const supabase = createServiceRoleClient();
  await upsertShortList30(month, selected, { client: supabase, commentsByTicker });
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

  // PR-fix1 (A) — dormant 게이트 (route 초입, lock/tier0/150-invariant/preflight 前).
  //   실 AI 경로가 비활성(default)이면 orchestrator에 진입하지 않고 200 skip.
  //   종전: flag off라도 orchestrator가 lock + tier0(150-invariant) 후 preflight throw →
  //   catch에서 recordSchedulerFailAlert(critical) + 502를 매월 1일 cron마다 발생시켜 가짜 알림.
  //   report-worker PR5_CRON_AUTO_ENABLED step-0 패턴 정합 (dormant ≠ failure → 200, spend 0).
  //   USER가 Vercel env로 MONTHLY_BATCH_CRON_AI_ENABLED=true + ANTHROPIC_API_KEY 충족 시 실 30선정 가동.
  //   ※ preflightCronRealAi(route-local)에도 동일 flag 체크가 있으나 본 게이트가 그 앞단이라 cron 경로에선
  //     사실상 redundant secondary guard(게이트 우회/리팩터 대비 fail-closed로만 유지). admin 수동 트리거
  //     (portfolio/actions.ts triggerMonthlyBatch)는 preflightCronRealAi 미사용 + 이 flag 미체크 — 별도 inline preflight.
  if (process.env.MONTHLY_BATCH_CRON_AI_ENABLED !== 'true') {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'monthly_batch_cron_ai_disabled' },
      { status: 200 },
    );
  }

  const month = currentMonthYM();
  try {
    // service-role client (cron auth.uid()=null → RLS bypass). createServiceRoleClient는 캐시 →
    //   tier0SourceForCron/persistForCron/recordSchedulerFailAlertForCron과 동일 인스턴스.
    const serviceClient = createServiceRoleClient();
    const cronSystemUserId = process.env.CRON_SYSTEM_USER_ID ?? '';
    const outcome = await runMonthlyBatchOrchestrator({
      month,
      // W2a Task 4 — 단발 orchestrator track 필수화. 단발 경로는 NON-VIABLE(W2a chunk worker로 대체 예정);
      //   기존 내부 하드코드값('midlong') 보존으로 동기 유지.
      track: 'midlong',
      // adminUserId는 orchestrator 미사용(vestigial). 실 cost_log.called_by는 makeCallPersonaPanel의 adminUserId.
      adminUserId: 'cron-system',
      promptVersionId:
        process.env.PROMPT_VERSION_ID ?? 'render-user-prompt@v1',
      personasVersionId:
        process.env.PERSONAS_VERSION_ID ?? 'core11@v3.1',
      tier0Source: () => tier0SourceForCron(month),
      // PR-G — 실 fail-closed 비용/가동 가드 (4 게이트 미충족 시 callPersonaPanel 전에 throw → cost 0).
      preflight: ({ month: m, callCount }) =>
        preflightCronRealAi({
          month: m,
          callCount,
          client: serviceClient,
          cronSystemUserId,
        }),
      // PR-G — 실 Core 11 panel (PR-C 어댑터). costClient=service-role → callPersona가 cost_log INSERT 가능.
      //   adminUserId=CRON_SYSTEM_USER_ID(검증된 UUID) → cost_log.called_by FK 통과. preflight off면 미도달.
      callPersonaPanel: makeCallPersonaPanel({
        callPersona,
        personas: CORE_11_PERSONAS,
        reflectionContext: '',
        adminUserId: cronSystemUserId,
        costClient: serviceClient,
      }),
      // PR-G — 실 재무 요약 (dart_financial_cache, service-role). 미캐시 ticker는 빈/부분 문자열.
      fetchFinancials: (ticker) =>
        fetchFinancialsSummary(ticker, { client: serviceClient }),
      lock: {
        acquire: acquireBatchLockCron,
        release: releaseBatchLockCron,
      },
      persist: persistForCron,
      commitBadgeOnly: commitBadgeOnlyNoop,
      recordSchedulerFailAlert: recordSchedulerFailAlertForCron,
    });
    return NextResponse.json({ ok: true, outcome }, { status: 200 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json({ ok: false, error: code }, { status: 502 });
  }
}
