// tudal/src/lib/screening/canonical-sectors.ts
//
// SoT = `Document/Service/Report/ReportFramework.md §7.2 + §7.3` (v2.5, D21 52차)
// SoT = `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D21`
//
// 본 PR 시점 production code import 0 (tests/만 활성).
// `commit_sector_personas` RPC + Section 8 partA render + mock fixture migration = Tier 2
// implementation 후속 PR OOS.
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
