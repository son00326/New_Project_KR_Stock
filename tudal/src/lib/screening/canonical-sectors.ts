// tudal/src/lib/screening/canonical-sectors.ts
//
// SoT = `Document/Service/Report/ReportFramework.md §7.2 + §7.3` (v2.5, D21 52차)
// SoT = `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D21`
// SoT = `tudal/supabase/migrations/0019_commit_sector_personas.sql` (canonical 14 in-list 동기 — drift 방지)
//
// PR #4 (Tier 2 SoT): production import 0 (tests/만 활성).
// PR (Tier 2 implementation, 본 세션): production import 활성화 = persona-eval/writer/mock-fixture 3 파일 한정.
//
// 변경 시 별도 PR + 위 SoT 동시 갱신.

/**
 * canonical 14 sectors — JooPick 운영 UI taxonomy.
 * SoT = ReportFramework §7.3 첫 컬럼.
 */
export type CanonicalSector =
  | "바이오"
  | "반도체"
  | "건설"
  | "금융"
  | "2차전지"
  | "자동차"
  | "IT/SW"
  | "유통/소비재"
  | "에너지"
  | "엔터/미디어"
  | "통신"
  | "철강/소재"
  | "운송/물류"
  | "보험/증권";

export const CANONICAL_SECTORS: readonly CanonicalSector[] = [
  "바이오",
  "반도체",
  "건설",
  "금융",
  "2차전지",
  "자동차",
  "IT/SW",
  "유통/소비재",
  "에너지",
  "엔터/미디어",
  "통신",
  "철강/소재",
  "운송/물류",
  "보험/증권",
] as const;

/**
 * 10 base slot template (sector-agnostic). D21 §7.2 slot 1~10.
 */
export type BaseSlotRole =
  | "domestic_insider_1"
  | "domestic_insider_2"
  | "domestic_sector_analyst"
  | "domestic_special_expert"
  | "domestic_academic"
  | "global_sector_analyst_1"
  | "global_sector_analyst_2"
  | "global_industry_veteran"
  | "global_sector_investor"
  | "global_adjacent_expert";

export const BASE_SLOTS: readonly BaseSlotRole[] = [
  "domestic_insider_1",
  "domestic_insider_2",
  "domestic_sector_analyst",
  "domestic_special_expert",
  "domestic_academic",
  "global_sector_analyst_1",
  "global_sector_analyst_2",
  "global_industry_veteran",
  "global_sector_investor",
  "global_adjacent_expert",
] as const;

/**
 * Overlay slot kind. D21 §7.2 slot 11~14.
 *
 * 11·12 = primary overlay (canonical sector axis).
 * 13·14 = sub_tag overlay (sub_tags 매칭 시 활성화, 매칭 없으면 base axis backup).
 */
export type OverlaySlotKind =
  | "primary_overlay_1"
  | "primary_overlay_2"
  | "sub_tag_overlay_1"
  | "sub_tag_overlay_2";

export const OVERLAY_SLOTS: readonly OverlaySlotKind[] = [
  "primary_overlay_1",
  "primary_overlay_2",
  "sub_tag_overlay_1",
  "sub_tag_overlay_2",
] as const;

/**
 * D21 §7.3 primary overlay (slot 11·12) 표.
 * canonical sector → 2 primary overlay 역할 description.
 */
export const PRIMARY_OVERLAY_BY_SECTOR: Record<CanonicalSector, readonly [string, string]> = {
  "바이오": ["임상시험 통계학자", "FDA 정책 전문가"],
  "반도체": ["EUV/3nm 공정 전문가", "메모리 사이클 분석가"],
  "건설": ["PF 리스크 분석가", "인프라 PPP 전문가"],
  "금융": ["신용 분석가", "거시 금리 전문가"],
  "2차전지": ["LFP/NCM 공정 전문가", "EV 보급 모델러"],
  "자동차": ["ADAS 시스템", "OEM 글로벌 sourcing"],
  "IT/SW": ["클라우드 인프라", "SaaS 비즈니스 모델"],
  "유통/소비재": ["옴니채널 commerce", "DTC 브랜드 운영"],
  "에너지": ["신재생 grid", "전력 시장 design"],
  "엔터/미디어": ["OTT 비즈니스", "K-콘텐츠 글로벌 라이센싱"],
  "통신": ["5G/6G 표준", "통신 인프라 CAPEX 모델러"],
  "철강/소재": ["스프레드/원자재 trader", "글로벌 강재 수급"],
  "운송/물류": ["해운 BDI 분석가", "항공 cargo 시장"],
  "보험/증권": ["자산운용/AM IR 전문가", "보험상품 actuarial"],
};

/**
 * FE render-time sector lens summary (provenance framing for Section 8 Part A panel).
 *
 * 각 값 = SECTOR_PHILOSOPHIES (sector-persona-builder.ts)의 `핵심 판단:` 축을 ≤30자로 압축
 *   (표준 약어·동의어 허용 — 예: 보험/증권 "ROE" = 핵심판단 축 "자기자본수익률").
 * 저장 데이터 아님 — 렌더 시점 파생. report page 헤더에 "AI 섹터 관점"으로 1회 표시.
 * 회사명·실제 인물명 0 (정보제공·자문 아님 제약). Record로 14 sector exhaustive 강제.
 */
export const SECTOR_LENS_SUMMARY: Record<CanonicalSector, string> = {
  "바이오": "파이프라인 단계·FDA 일정·현금 소진",
  "반도체": "메모리 가격·CAPEX·재고 사이클",
  "건설": "미분양·PF 잔액·원자재 전가력",
  "금융": "연체율·BIS·디지털 전환·예금",
  "2차전지": "셀 mix·OEM 분산·원가·전고체",
  "자동차": "EV 비중·자율주행·중국·반도체 공급",
  "IT/SW": "ARR 성장·NRR·플랫폼 락인",
  "유통/소비재": "매장당 매출·이커머스·재고 회전",
  "에너지": "신재생 capacity·전력가·정책·CAPEX",
  "엔터/미디어": "글로벌 라이센스·IP 다양성·계약 안정성",
  "통신": "5G/6G 회수·B2B·MVNO 위협",
  "철강/소재": "강재 수급·중국 정책·고부가 비중",
  "운송/물류": "운임 사이클·선대 규모·연료비",
  "보험/증권": "운용자산·계약유지율·ROE·디지털",
};

/**
 * D21 cost guard 상수. Tier 2 implementation PR (52차) 박제.
 *
 * SECTOR_PERSONA_COUNT = base 10 + primary overlay 2 + sub_tag overlay 2 = 14 (canonical/sector).
 * TIER2_CALLS_PER_TICKER = Core 11 + Sector 14 = 25 (chair = Core 11 마지막 위원, 별도 추가 X).
 *
 * cost worst-case = 30 stocks × 25 = 750 calls/month (M17 hardcap 400k KRW 내).
 * regen 2× = 1,500 calls/month worst-case ≈ 33만원 cache-off.
 *
 * 본 상수는 production 검증 게이트 박제 (canonical-sectors.test.ts에서 `monthlyCalls === 750`
 * 단정 + chair separation 미적용 verify) — chair 별도 추가는 OOS.
 */
export const SECTOR_PERSONA_COUNT = 14 as const;
export const TIER2_CALLS_PER_TICKER = 25 as const;

/**
 * Sub-tag crosswalk (운영 UI taxonomy proxy).
 *
 * primary = canonical sector resolution. sub_tags secondary는 sub_tag overlay (slot 13·14)
 * 활성화 lookup 키. 매핑 사유는 ReportFramework §7.3 crosswalk 표.
 *
 * **개념 정합이 아니라 운영 분류 목적**. canonical 14 sector 확장 시 신규 D-decision으로 supersede.
 */
export interface SubTagMapping {
  primary: CanonicalSector;
  secondary?: CanonicalSector;
  rationale: string;
}

export const SUB_TAG_CROSSWALK: Record<string, SubTagMapping> = {
  "조선": {
    primary: "운송/물류",
    rationale: "운송장비 (선박) proxy. KRX 분류는 별도이나 JooPick 14 내에서 운송 산업과 최인접.",
  },
  "방산": {
    primary: "철강/소재",
    rationale: "산업재 sector 부재로 인한 proxy. 한화에어로/LIG넥스원의 중공업·금속 가공 측면.",
  },
  "화학": {
    primary: "철강/소재",
    rationale: "소재 통합. LG화학/SK이노가 한국 GICS에 소재로 분류.",
  },
  "게임": {
    primary: "IT/SW",
    secondary: "엔터/미디어",
    rationale: "software primary, IP/콘텐츠 secondary. 게임은 코드 + IP 양면 — primary IT/SW로 결정, sub_tag overlay에 엔터/미디어 활용.",
  },
  "가전": {
    primary: "유통/소비재",
    rationale: "consumer product 측면. LG전자/삼성전자 가전부문 소비재 성격.",
  },
  "제약": {
    primary: "바이오",
    rationale: "한미약품·셀트리온 등 인접 (개념 정합).",
  },
  "부동산": {
    primary: "건설",
    rationale: "REITs/디벨로퍼 인접 (개념 정합).",
  },
};

/**
 * D21 §7.3 sub_tag overlay (slot 13·14) 표.
 * sub_tag → 2 sub_tag overlay 역할 description (해당 sub_tag 활성 시 slot 13·14에 활성화).
 *
 * canonical sector 매칭 시 SubTagMapping.primary로 routing 한 후 본 표에서 overlay role 결정.
 */
export const SUB_TAG_OVERLAY_ROLES: Record<string, readonly [string, string]> = {
  "조선": ["조선 PE/PC 엔지니어", "조선 finance/수주 분석가"],
  "방산": ["방산 system integrator", "국방 export 정책 전문가"],
  "화학": ["정유 마진 분석가", "화학 capacity 모델러"],
  "게임": ["게임 PD", "IP/콘텐츠 라이센싱"],
  "가전": ["가전 디스플레이/스마트홈 전문가", "가전 소비자 신뢰지수 분석가"],
  "제약": ["제약 R&D 임원", "GMP 규제 전문가"],
  "부동산": ["REITs 운용역", "도시 디벨로퍼"],
};

/**
 * canonical sector 활성화 여부.
 * SUB_TAG_CROSSWALK 외 sub_tag string이 들어와도 silently false 반환.
 */
export function isCanonicalSector(value: string): value is CanonicalSector {
  return (CANONICAL_SECTORS as readonly string[]).includes(value);
}

/**
 * Legacy mock normalization only.
 *
 * production code는 이 map을 import하지 않는다 (tests/ 전용).
 * canonical 판단 (primary sector 확정)은 이 map에 의존하면 안 된다 — mock fixture string을
 * canonical로 normalize하는 정확한 용도로만 사용.
 *
 * "전기전자" broad alias는 명시적 미지정 (LG전자=가전/모바일/디스플레이, 삼성전자=반도체/가전/
 * 모바일 혼재로 single canonical 할당 불가). 개별 ticker level에서 sub_tags로 분기는 후속 PR.
 */
export const LEGACY_ALIAS_MAP: Record<string, CanonicalSector> = {
  "의약품": "바이오",
  "운수장유": "자동차",
  "원전": "에너지",
  "전력기기": "에너지",
  "서비스업": "IT/SW",
  "인터넷플랫폼": "IT/SW",
  "지주/건설": "건설",
};

/**
 * SubTagMapping 조회. crosswalk에 없으면 null.
 */
export function resolveSubTag(sub_tag: string): SubTagMapping | null {
  return SUB_TAG_CROSSWALK[sub_tag] ?? null;
}

/**
 * sub_tag가 주어진 sector에 허용되는지 검증 (shared SoT, omxy R3 답변 f drift 방지).
 *
 * 허용 조건:
 *   1. sub_tag가 SUB_TAG_OVERLAY_ROLES에 정의됨 (known overlay)
 *   2. SUB_TAG_CROSSWALK[sub_tag].primary === sector
 *   3. 또는 SUB_TAG_CROSSWALK[sub_tag].secondary === sector
 *
 * 본 helper는 resolveSlotTemplate + builder parseSectorPersonaId + buildSectorPersonaContract에서
 * 공통 사용 — sub_tag validity 검증 로직을 single SoT로 통합.
 */
export function isSubTagAllowedForSector(
  sub_tag: string,
  sector: CanonicalSector,
): boolean {
  if (!(sub_tag in SUB_TAG_OVERLAY_ROLES)) return false;
  const mapping = SUB_TAG_CROSSWALK[sub_tag];
  if (mapping === undefined) return false;
  return mapping.primary === sector || mapping.secondary === sector;
}

/**
 * D21 slot template — canonical sector + (옵션) sub_tags → 14 persona slot 메타 list 반환.
 *
 * slot 1~10 = base (sector-agnostic role)
 * slot 11~12 = primary overlay (sector primary axis — PRIMARY_OVERLAY_BY_SECTOR)
 * slot 13~14 = sub_tag overlay (sub_tag 매칭 시 SUB_TAG_OVERLAY_ROLES, 매칭 없으면 base axis backup)
 *
 * 매칭 sub_tag가 여러 개일 경우 첫번째 매칭 sub_tag만 사용 (deterministic).
 * "게임" sub_tag는 secondary "엔터/미디어"가 있지만 본 함수에서는 primary sector 기준 slot만 결정 —
 * secondary canonical은 별도 routing이 필요한 경우 SubTagMapping.secondary 사용.
 */
export interface SlotMeta {
  slot_index: number;        // 1~14
  slot_type: "base" | "primary_overlay" | "sub_tag_overlay";
  role: string;              // 슬롯 역할 description
  sub_tag?: string;          // sub_tag overlay 활성 시 매칭 sub_tag (slot 13·14)
}

const BASE_SLOT_ROLES: Record<BaseSlotRole, string> = {
  domestic_insider_1: "국내 산업 내부자 (경영자/CTO 출신) #1",
  domestic_insider_2: "국내 산업 내부자 (경영자/CTO 출신) #2",
  domestic_sector_analyst: "국내 섹터 전문 애널리스트",
  domestic_special_expert: "국내 섹터 특수 전문가",
  domestic_academic: "국내 학술/연구 전문가",
  global_sector_analyst_1: "해외 글로벌 섹터 애널리스트 #1",
  global_sector_analyst_2: "해외 글로벌 섹터 애널리스트 #2",
  global_industry_veteran: "해외 업계 경험자",
  global_sector_investor: "해외 산업 투자 전문가",
  global_adjacent_expert: "해외 인접 분야 전문가",
};

export function resolveSlotTemplate(
  sector: CanonicalSector,
  sub_tags: readonly string[] = [],
): readonly SlotMeta[] {
  const slots: SlotMeta[] = [];

  // slot 1~10 = base
  BASE_SLOTS.forEach((role, idx) => {
    slots.push({
      slot_index: idx + 1,
      slot_type: "base",
      role: BASE_SLOT_ROLES[role],
    });
  });

  // slot 11·12 = primary overlay
  const primaryRoles = PRIMARY_OVERLAY_BY_SECTOR[sector];
  slots.push({ slot_index: 11, slot_type: "primary_overlay", role: primaryRoles[0] });
  slots.push({ slot_index: 12, slot_type: "primary_overlay", role: primaryRoles[1] });

  // slot 13·14 = sub_tag overlay (첫 매칭 sub_tag deterministic — 매칭 없거나 sector mismatch 시 base axis backup)
  // omxy R3 BLOCKER D 정정: 단순 "tag in SUB_TAG_OVERLAY_ROLES"만 체크하면 cross-sector mismatch (예: 바이오 + 조선)도 활성화 → invalid persona IDs.
  // isSubTagAllowedForSector로 sector compatibility까지 검증.
  const activeSubTag = sub_tags.find((tag) => isSubTagAllowedForSector(tag, sector));
  if (activeSubTag !== undefined) {
    const subRoles = SUB_TAG_OVERLAY_ROLES[activeSubTag];
    slots.push({
      slot_index: 13,
      slot_type: "sub_tag_overlay",
      role: subRoles[0],
      sub_tag: activeSubTag,
    });
    slots.push({
      slot_index: 14,
      slot_type: "sub_tag_overlay",
      role: subRoles[1],
      sub_tag: activeSubTag,
    });
  } else {
    // sub_tag 없으면 base axis backup (primary overlay와 다른 generic role)
    slots.push({ slot_index: 13, slot_type: "sub_tag_overlay", role: "섹터 quant/data 전문가 backup" });
    slots.push({ slot_index: 14, slot_type: "sub_tag_overlay", role: "섹터 글로벌 관점 backup" });
  }

  if (slots.length !== SECTOR_PERSONA_COUNT) {
    throw new Error(`resolveSlotTemplate produced ${slots.length} slots, expected ${SECTOR_PERSONA_COUNT}`);
  }

  return slots;
}
