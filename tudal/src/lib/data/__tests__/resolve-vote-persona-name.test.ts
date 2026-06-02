// resolve-vote-persona-name.test.ts — PR-fix1 (B) 섹터 위원 이름 해석 invariant.
//
// 종전 버그: report page VoteList가 getSectorPersonas(legacy roster, id=`sector-{s}-{1..5}`)로만
//   이름을 찾았으나, Tier2 실 committee_votes는 canonical id(`sector-{s}-slot-{N}` / `...-subtag-{tag}`)로
//   저장됨 → id 불일치로 섹터 위원 이름이 전부 raw personaId로 노출(AI 켜는 순간 PR-I).
// fix: legacy roster name → getPersonaById().label(canonical, slot+subtag) → raw personaId 순 fallback.
import { describe, it, expect } from "vitest";
import { getPersonaById } from "@/lib/ai/prompts/personas";
import { resolveVotePersonaName } from "@/lib/data/resolve-vote-persona-name";

describe("resolveVotePersonaName (PR-fix1 B)", () => {
  it("legacy roster hit → legacy name (전환기 잔존 row 우선)", () => {
    const legacy = [{ id: "warren-buffett", name: "레거시 워런" }];
    expect(resolveVotePersonaName("warren-buffett", legacy)).toBe("레거시 워런");
  });

  it("canonical sector slot id (legacy 미존재) → getPersonaById().label", () => {
    const id = "sector-반도체-slot-1";
    const expectedLabel = getPersonaById(id)?.label;
    expect(expectedLabel).toBeTruthy(); // 전제: canonical base slot은 resolve됨
    expect(resolveVotePersonaName(id, [])).toBe(expectedLabel);
  });

  it("canonical slot은 legacy roster(sector-{s}-{N})로 resolve 불가 → getPersonaById fallback으로 복원", () => {
    // 종전 버그 재현 방지: legacy roster에 canonical id가 없어도 raw 노출이 아니라 label 복원.
    const legacyRoster = [{ id: "sector-반도체-1", name: "레거시 5인 #1" }];
    const id = "sector-반도체-slot-3";
    const label = getPersonaById(id)?.label;
    expect(label).toBeTruthy();
    expect(resolveVotePersonaName(id, legacyRoster)).toBe(label);
    expect(resolveVotePersonaName(id, legacyRoster)).not.toBe(id);
  });

  it("subtag overlay slot id도 getPersonaById 경로로 resolve (getCanonicalSectorPersonas는 누락하는 케이스)", () => {
    // omxy 구현 락: subtag suffix(slot 13·14)는 getCanonicalSectorPersonas가 못 잡지만 getPersonaById는 잡는다.
    const id = "sector-운송/물류-slot-13-subtag-조선";
    const label = getPersonaById(id)?.label;
    expect(label).toBeTruthy();
    expect(resolveVotePersonaName(id, [])).toBe(label);
  });

  it("미해석 id (legacy 미존재 + canonical 미해석) → raw personaId fallback (crash 방지)", () => {
    expect(resolveVotePersonaName("nonsense-xyz", [])).toBe("nonsense-xyz");
  });
});
