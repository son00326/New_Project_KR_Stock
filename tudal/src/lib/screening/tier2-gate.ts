// Tier 2 cost gate (omxy 53차 §3 R3 D6 cost gate (1) — env flag single safety gate).
//
// **billing 신호일 뿐 billing 가능 자체 보장 아님** (omxy D4 R1 non-blocker note 박제) —
// Anthropic SDK 호출 실패는 runSectorEval 자체에서 degradedCount++로 처리.
//
// ⚪ 케이스는 Core 11 자체 미진입 → Tier 2도 무의미.
//
// PR4 Task 3 분리 (Next.js 16 'use server' 제약 — actions.ts에서 sync export 차단):
//   "Server Actions must be async functions" — sync helper는 별도 module로 격리.
//   기존 caller (`actions.ts triggerMonthlyPersonaEvalAction` + `actions.test.ts`)는
//   본 module 경로로 import 변경. 동작 변동 0.

import type { ConsensusBadge } from '@/lib/screening/consensus';

export function shouldRunTier2(badge: ConsensusBadge): boolean {
  if (badge === '⚪') return false;
  // strict 'true' literal match — 'TRUE' / '1' / 'yes' / ' true ' (case+whitespace) do NOT enable.
  // Vercel env vars are exposed verbatim; operator는 정확히 'true' string으로 세팅 필요.
  return process.env.AI_COST_LOG_REAL_INSERT_ENABLED === 'true';
}
