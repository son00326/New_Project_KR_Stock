export interface PersonaContract {
  id: string;
  label: string;
  version: string; // 'YYYY-MM-DD'
  philosophy: string; // Section 8 Part D 한 줄 (Q3 schema 1:1)
  systemPrompt: string; // immutable cache breakpoint 후보
  userPromptTemplate: string; // {{TICKER}} {{FINANCIALS}} {{REFLECTION_CONTEXT}} placeholders
}

import { warrenBuffett } from './warren-buffett';
import { stanleyDruckenmiller } from './stanley-druckenmiller';
import { cathieWood } from './cathie-wood';
import { peterLynch } from './peter-lynch';
import { charlieMunger } from './charlie-munger';
import { philFisher } from './phil-fisher';
import { rakeshJhunjhunwala } from './rakesh-jhunjhunwala';
import { mohnishPabrai } from './mohnish-pabrai';
import { michaelBurry } from './michael-burry';
import { nassimTaleb } from './nassim-taleb';
import { chair } from './chair';
import { applyKevinV31Rubric } from '../kevin-v31-rubric';

// 53차 §2 Layer (f) — Core 11 inject Kevin v3.1 rubric.
// persona individuality wrapper 원칙 (Layer a R3 catch vi 박제):
//   - 각 persona 파일의 systemPrompt = corePrincipleText (Buffett 4 buckets, Lynch 이해 등) 보존
//   - applyKevinV31Rubric이 KEVIN_V31_RUBRIC_INSTRUCTION을 후단 inject (답변 방식·근거 품질·환각 방지)
// 결과 = corePrinciple + "\n\n" + KEVIN_V31_RUBRIC_INSTRUCTION
function applyRubricToPersona(p: PersonaContract): PersonaContract {
  return {
    ...p,
    systemPrompt: applyKevinV31Rubric(p.systemPrompt),
  };
}

const RAW_CORE_11: PersonaContract[] = [
  warrenBuffett,
  stanleyDruckenmiller,
  cathieWood,
  peterLynch,
  charlieMunger,
  philFisher,
  rakeshJhunjhunwala,
  mohnishPabrai,
  michaelBurry,
  nassimTaleb,
  chair,
];

export const CORE_11_PERSONAS: PersonaContract[] = RAW_CORE_11.map(applyRubricToPersona);

// D21 Tier 2 (53차+) — sector persona IDs는 dynamic resolution (sector-persona-builder).
// Core 11 lookup 실패 시 fallback. 미정의 패턴이면 undefined.
import { resolveSectorPersona } from "./sector-persona-builder";

export function getPersonaById(id: string): PersonaContract | undefined {
  const core = CORE_11_PERSONAS.find((p) => p.id === id);
  if (core !== undefined) return core;
  const sector = resolveSectorPersona(id);
  return sector ?? undefined;
}
