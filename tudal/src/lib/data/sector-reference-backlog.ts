// PR3c — sector_reference_backlog helper (Group G Level A lazy 추적).
// SoT = plan v6, omxy R6 CONVERGED.
//
// B16 fix (omxy R3): canonical 14 sector check + trim.
// B20 fix (omxy R5): Level A 보유 sector (바이오·반도체) 호출 시 early return (backlog 오염 차단).
// 사용자 lock-in §1.7: Level A 보유 = 바이오·반도체 (2/12), 부족 = 12 sectors (lazy).

import { createClient } from '@/lib/supabase/server';
import {
  isCanonicalSector,
  type CanonicalSector,
} from '@/lib/screening/canonical-sectors';

// B20 fix (omxy R5): Level A body reference 보유 sector.
// SoT = ServicePlan-Admin §1A.5 D22 + ReportFramework §9.2.0 Level A 표 (2/12).
// drift catch: missing 12 invariant test (canonical 14 - LEVEL_A_SECTORS_WITH_BODY 2 = 12).
// 미래 본문 작성 진척 시 본 Set에 sector 추가 (e.g., 건설 본문 작성 후).
export const LEVEL_A_SECTORS_WITH_BODY: ReadonlySet<CanonicalSector> = new Set<CanonicalSector>([
  '바이오',
  '반도체',
]);

export function hasLevelABodyReference(sector: string): boolean {
  return LEVEL_A_SECTORS_WITH_BODY.has(sector as CanonicalSector);
}

/**
 * Sector reference backlog INSERT-or-BUMP (atomic RPC).
 *
 * Validation (helper-level + DB-level 양쪽):
 *  1. trim + empty check
 *  2. canonical 14 check (isCanonicalSector)
 *  3. Level A 보유 sector early return (B20 — backlog 오염 차단)
 *  4. RPC `insert_or_bump_sector_backlog` 호출 (DB-level race-safe ON CONFLICT)
 */
export async function insertOrBumpBacklog(sector: string): Promise<void> {
  const trimmed = sector.trim();
  if (trimmed === '') {
    throw new Error('sector_reference_backlog_invalid_sector:empty');
  }
  if (!isCanonicalSector(trimmed)) {
    throw new Error('sector_reference_backlog_invalid_sector:not_canonical');
  }
  // B20 fix (omxy R5): Level A 보유 sector는 backlog INSERT skip.
  if (hasLevelABodyReference(trimmed)) {
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('insert_or_bump_sector_backlog', { p_sector: trimmed });
  if (error) {
    throw new Error(`sector_reference_backlog_rpc_failed:${error.code ?? 'unknown'}`);
  }
}

/**
 * Backlog list — admin 대시보드 등에서 사용. RLS는 is_admin().
 */
export async function listBacklog() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sector_reference_backlog')
    .select('*')
    .order('request_count', { ascending: false });
  if (error) {
    throw new Error(`sector_reference_backlog_list_failed:${error.code ?? 'unknown'}`);
  }
  return data;
}
