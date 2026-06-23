// tudal/src/lib/screening/shadow-arm-logger.ts
//
// Track 1 PR-A2 — forward-shadow arm logger (production logShadowArms 구현).
//   finalizeSelection의 finalized 경로에서 DI로 주입된다(default OFF). computeArmSelections(PR-A1)로
//   4 arm을 산출 → 각 arm을 upsert_shadow_arm_log RPC(0038)로 service-role write.
//
// SoT: docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md §2.2/§3.3/§3.5/§7/§10(PR-A2).
//
// 불변(§1): money-path 무결합(post-persist·shadow table only), production_k=0, LLM 호출 0(이미 지불한
//   panel/judge 결과만 — computeArmSelections는 pure). shadow 실패는 finalize/money-path를 절대 차단 못 함
//   (seam이 try/catch로 best-effort 처리; 여기 logger는 실패 시 throw하고 seam이 흡수).
//
// 기본 OFF: FORWARD_SHADOW_ENABLED !== 'true' → createShadowArmLoggerFromEnv가 undefined 반환 → seam no-op.
// sector/regime hypothesis는 env 기반(운영자가 period 시작 전 설정). default = absent(모든 arm == production
//   = plumbing). 잘못된 config(non-canonical sector / asOf ≥ period start / bad K)는 computeArmSelections가
//   ShadowArmInputError throw → seam이 shadow_arm_log_failed로 흡수(money-path 무영향).

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeArmSelections,
  type ArmSelectionResult,
  type ComputeArmSelectionsResult,
  ShadowArmInputError,
  type ShadowRegime,
  type ShadowRegimeStage,
  type ShadowSectorView,
} from './shadow-harness-arms';
import type { CanonicalSector } from './canonical-sectors';
import type {
  SelectionTrack,
  Tier1ScreeningResult,
  Timeframe,
} from './tier1-schema';
import type { Tier1Candidate } from './persona-eval';

export interface LogShadowArmsInput {
  month: string;
  track: SelectionTrack;
  periodKey: string;
  runId: string;
  /** track-scoped production Tier1 결과(money-path SoT의 immutable 입력 복제 — seam이 structuredClone). */
  productionResult: Tier1ScreeningResult;
  /** fresh ∪ incumbents worker pool. */
  candidates: readonly Tier1Candidate[];
  incumbentTickers: ReadonlySet<string>;
  judgeScoresByTicker: Record<string, Record<Timeframe, number>>;
  /** service-role client (RPC upsert_shadow_arm_log EXECUTE는 service_role 전용). */
  client: SupabaseClient;
}

export type LogShadowArms = (input: LogShadowArmsInput) => Promise<void>;

interface ShadowEnvConfig {
  sectorView: ShadowSectorView;
  regime?: ShadowRegime;
  shadowEvalK: number;
  configError?: string;
}

/**
 * env → shadow hypothesis config. 파싱만 — 의미 검증(canonical sector / asOf<period / int K)은
 * computeArmSelections가 수행한다(잘못되면 ShadowArmInputError throw, seam이 흡수). default absent.
 */
export function readShadowConfigFromEnv(env: Record<string, string | undefined> = process.env): ShadowEnvConfig {
  const configErrors: string[] = [];
  const rawSectorSource = env.SHADOW_SECTOR_SOURCE ?? 'absent';
  const sectorSource = rawSectorSource === 'manual_pre_registered' || rawSectorSource === 'absent'
    ? rawSectorSource
    : 'absent';
  if (rawSectorSource !== 'manual_pre_registered' && rawSectorSource !== 'absent') {
    configErrors.push(`bad SHADOW_SECTOR_SOURCE: ${rawSectorSource}`);
  }
  const leadingSectors = (env.SHADOW_LEADING_SECTORS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as CanonicalSector[];
  const sectorView: ShadowSectorView =
    sectorSource === 'manual_pre_registered'
      ? { source: 'manual_pre_registered', leadingSectors, asOf: env.SHADOW_SECTOR_ASOF ?? '' }
      : { source: 'absent', leadingSectors };

  const rawRegimeSource = env.SHADOW_REGIME_SOURCE ?? 'absent';
  const regimeSource = rawRegimeSource === 'manual_pre_registered' || rawRegimeSource === 'absent'
    ? rawRegimeSource
    : 'absent';
  if (rawRegimeSource !== 'manual_pre_registered' && rawRegimeSource !== 'absent') {
    configErrors.push(`bad SHADOW_REGIME_SOURCE: ${rawRegimeSource}`);
  }
  const regime: ShadowRegime =
    regimeSource === 'manual_pre_registered'
      ? {
          source: 'manual_pre_registered',
          stage: (env.SHADOW_REGIME_STAGE ?? '') as ShadowRegimeStage,
          asOf: env.SHADOW_REGIME_ASOF ?? '',
        }
      : { source: 'absent' };

  const rawShadowEvalK = env.SHADOW_EVAL_K ?? '0';
  let shadowEvalK = 0;
  if (/^[0-9]+$/.test(rawShadowEvalK)) {
    shadowEvalK = Number(rawShadowEvalK);
    if (!Number.isSafeInteger(shadowEvalK)) {
      configErrors.push(`bad SHADOW_EVAL_K: ${rawShadowEvalK}`);
      shadowEvalK = 0;
    }
  } else {
    configErrors.push(`bad SHADOW_EVAL_K: ${rawShadowEvalK}`);
  }

  return {
    sectorView,
    regime,
    shadowEvalK,
    configError: configErrors.length > 0 ? configErrors.join('; ') : undefined,
  };
}

/** per-arm shadow_eval_k: production-snapshot=0 / soft-reserve=effectiveK / regime=regimeEffectiveK / hard-gate=0. */
function shadowEvalKForArm(arm: ArmSelectionResult['arm'], result: ComputeArmSelectionsResult): number {
  if (arm === 'sector-soft-reserve') return result.effectiveK;
  if (arm === 'regime-sector-soft-reserve') return result.regimeEffectiveK;
  return 0; // production-snapshot / candidate-pool-hard-gate
}

/** arm 결과 → 0038 upsert_shadow_arm_log payload(jsonb). selected는 SelectedRow[](RPC가 ticker/tf/count 검증). */
function buildArmPayload(
  input: LogShadowArmsInput,
  arm: ArmSelectionResult,
  result: ComputeArmSelectionsResult,
  config: ShadowEnvConfig,
): Record<string, unknown> {
  return {
    month: input.month,
    period_key: input.periodKey,
    track: input.track,
    arm: arm.arm,
    run_id: input.runId,
    status: arm.status,
    sector_view: config.sectorView,
    regime_context: config.regime ?? { source: 'absent' },
    production_k: 0,
    shadow_eval_k: shadowEvalKForArm(arm.arm, result),
    selected: arm.selected,
    reserve_picks: arm.reservePicks,
    counterfactual_cut: arm.counterfactualCut,
    sector_distribution: arm.sectorDistribution,
    error: arm.error,
  };
}

/**
 * production logShadowArms: computeArmSelections(pure) → 각 arm을 upsert_shadow_arm_log RPC로 기록.
 * 실패(잘못된 config의 ShadowArmInputError, RPC error) 시 throw → seam이 best-effort 흡수.
 * config 기본 OFF는 createShadowArmLoggerFromEnv가 담당(여기 도달 = 이미 enabled).
 */
export async function logShadowArmsWithConfig(
  input: LogShadowArmsInput,
  config: ShadowEnvConfig,
): Promise<void> {
  if (config.configError) {
    throw new ShadowArmInputError(config.configError);
  }
  const result = computeArmSelections({
    track: input.track,
    periodKey: input.periodKey,
    productionResult: input.productionResult,
    candidates: input.candidates,
    judgeScoresByTicker: input.judgeScoresByTicker,
    sectorView: config.sectorView,
    regime: config.regime,
    shadowEvalK: config.shadowEvalK,
  });

  for (const arm of result.arms) {
    const payload = buildArmPayload(input, arm, result, config);
    const { error } = await input.client.rpc('upsert_shadow_arm_log', { p_payload: payload });
    if (error) {
      throw new Error(`shadow_arm_log_upsert_failed:${arm.arm}:${error.code ?? 'unknown'}`);
    }
  }
}

/**
 * env 기반 logger factory. FORWARD_SHADOW_ENABLED !== 'true' → undefined(seam no-op = production effect 0).
 * route가 RunTier1SelectionChunkInput.logShadowArms에 주입한다.
 */
export function createShadowArmLoggerFromEnv(
  env: Record<string, string | undefined> = process.env,
): LogShadowArms | undefined {
  if (env.FORWARD_SHADOW_ENABLED !== 'true') return undefined;
  const config = readShadowConfigFromEnv(env);
  return (input: LogShadowArmsInput) => logShadowArmsWithConfig(input, config);
}
