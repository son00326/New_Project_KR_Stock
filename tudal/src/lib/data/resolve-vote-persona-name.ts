// resolve-vote-persona-name.ts — PR-fix1 (B) 섹터/코어 위원 투표 이름 해석.
//
// VoteList(report page)가 committee_votes의 personaId를 표시 이름으로 변환할 때 사용.
// 우선순위 (omxy 구현 락):
//   1) legacy roster name — 전환기 잔존 row(legacy id `sector-{s}-{1..5}` / core slug) 보존.
//   2) getPersonaById(personaId)?.label — canonical source. Tier2 실 votes(`sector-{s}-slot-{N}`,
//      `...-subtag-{tag}`)와 Core 11을 모두 해석 (getCanonicalSectorPersonas가 누락하는 subtag 포함).
//   3) raw personaId — 미해석 시 fallback (crash·빈칸 방지).
import { getPersonaById } from "@/lib/ai/prompts/personas";

export interface LegacyPersonaLike {
  id: string;
  name: string;
}

export function resolveVotePersonaName(
  personaId: string,
  legacyPersonas: readonly LegacyPersonaLike[],
): string {
  const legacy = legacyPersonas.find((p) => p.id === personaId);
  if (legacy) return legacy.name;
  return getPersonaById(personaId)?.label ?? personaId;
}
