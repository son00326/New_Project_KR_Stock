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

export const CORE_11_PERSONAS: PersonaContract[] = [
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

export function getPersonaById(id: string): PersonaContract | undefined {
  return CORE_11_PERSONAS.find((p) => p.id === id);
}
