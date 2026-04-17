// AI 투심위 페르소나 로스터 (mock). 실 페르소나는 S5 AI 엔진 연결 시 대체.
// 출처: ReportFramework.md §6 Core 11 + §7 Sector Board 원칙 (축약).
//
// Core 11: 전 섹터 공통 참여. 철학적 다양성 확보 (가치·성장·매크로·리스크·퀀트 등).
// Sector Board: 섹터별 10인 (MVP에서는 섹터당 5인 lean 로스터 채택).

export type PersonaLayer = "core" | "sector";

export interface CommitteePersona {
  id: string;
  name: string;
  layer: PersonaLayer;
  archetype: string; // "Quality+Value" 등
  bio: string; // 1줄 배경
  sector?: string; // sector layer만
}

// ─── Core Committee (전 리포트 공통) ─────────────────────────────────────────
export const CORE_PERSONAS: CommitteePersona[] = [
  {
    id: "core-1",
    name: "가치파 알파",
    layer: "core",
    archetype: "Deep Value",
    bio: "장부가·PBR 하위 분위수 선호. 모든 성장 프리미엄에 회의적.",
  },
  {
    id: "core-2",
    name: "성장파 베타",
    layer: "core",
    archetype: "Growth",
    bio: "매출·이익 복합 성장률 상위 종목 선호. 밸류에이션은 2순위.",
  },
  {
    id: "core-3",
    name: "매크로 감마",
    layer: "core",
    archetype: "Macro",
    bio: "금리·환율·유동성 사이클로 종목을 거르는 톱다운 관점.",
  },
  {
    id: "core-4",
    name: "퀀트 델타",
    layer: "core",
    archetype: "Quant",
    bio: "통계적 이상치·팩터 노출도로만 판단. 서사는 신뢰하지 않음.",
  },
  {
    id: "core-5",
    name: "퀄리티 엡실론",
    layer: "core",
    archetype: "Quality",
    bio: "ROIC·FCF 마진·부채비율 3지표로 우량주만 선별.",
  },
  {
    id: "core-6",
    name: "리스크 제타",
    layer: "core",
    archetype: "Risk-off",
    bio: "하방 시나리오·MDD·꼬리 리스크에 과도할 정도로 집중.",
  },
  {
    id: "core-7",
    name: "모멘텀 에타",
    layer: "core",
    archetype: "Momentum",
    bio: "m5·m20·m60 추세 일치 + 거래량 확인. 반등주는 회의.",
  },
  {
    id: "core-8",
    name: "역발상 세타",
    layer: "core",
    archetype: "Contrarian",
    bio: "컨센서스 반대편·피로한 섹터·바닥 시그널 선호.",
  },
  {
    id: "core-9",
    name: "배당·현금흐름 이오타",
    layer: "core",
    archetype: "Dividend",
    bio: "주주환원·배당 지속성·잉여현금흐름 중심.",
  },
  {
    id: "core-10",
    name: "스토리텔러 카파",
    layer: "core",
    archetype: "Thematic",
    bio: "거대 테마·10년 서사·산업 재편에 베팅.",
  },
  {
    id: "core-11",
    name: "트레이더 람다",
    layer: "core",
    archetype: "Tactical",
    bio: "단기 포지션·기술적 돌파·이벤트 드리븐 취향.",
  },
];

// ─── Sector Board (섹터별 5인 lean, MVP) ─────────────────────────────────────
// fixture 31종이 쓰는 섹터만 채워둠. 그 외 섹터는 빈 배열.
const SECTOR_ROSTER: Record<string, { name: string; archetype: string; bio: string }[]> = {
  반도체: [
    { name: "HBM 스페셜리스트", archetype: "Memory", bio: "D램/HBM 공급·수요 사이클 전문." },
    { name: "파운드리 프로", archetype: "Foundry", bio: "TSMC·삼파 공정 로드맵 분석가." },
    { name: "장비 퀀트", archetype: "Equipment", bio: "ASML·램리서치 CapEx 트래커." },
    { name: "설계 IP 리드", archetype: "Design", bio: "ARM·RISC-V·AI칩 IP 전문." },
    { name: "후공정 관찰자", archetype: "Backend", bio: "OSAT·테스트소켓 수요 민감." },
  ],
  바이오: [
    { name: "CDMO 분석가", archetype: "CDMO", bio: "4·5공장 가동·수주 백로그 트래킹." },
    { name: "신약 파이프 전문가", archetype: "Pipeline", bio: "임상 1·2·3상 확률 해석." },
    { name: "규제·FDA 관찰자", archetype: "Regulatory", bio: "FDA·MFDS 승인 타임라인 민감." },
    { name: "바이오시밀러 프로", archetype: "Biosimilar", bio: "짐펜트라·유플라이마 등 침투율." },
    { name: "섹터 밸류에이션 리드", archetype: "Valuation", bio: "Forward PER·EV/Sales 비교." },
  ],
  방산: [
    { name: "수출 파이프 트래커", archetype: "Export", bio: "폴란드·중동·미국 파이프라인." },
    { name: "지정학 리스크 분석가", archetype: "Geopolitics", bio: "유럽 전장·MRO 수요 민감." },
    { name: "중기 방산 대표", archetype: "MidCap", bio: "K2·천궁·FA-50 등 플랫폼." },
    { name: "Defense Quality", archetype: "Quality", bio: "잔고·마진·캐시플로우 중시." },
    { name: "조선·특수선 겸", archetype: "Shipyard", bio: "LNG선·해양플랜트 연계 관찰." },
  ],
  조선: [
    { name: "조선 빅3 애널", archetype: "Big3", bio: "HD현중·삼중·한화오션 수주 잔고." },
    { name: "LNG선 스페셜", archetype: "LNG", bio: "카타르·Mozambique 발주 민감." },
    { name: "해양플랜트 리드", archetype: "Offshore", bio: "FPSO·FLNG 고마진 수주." },
    { name: "원가·Steel 관찰자", archetype: "Cost", bio: "후판 가격·환율 민감도." },
    { name: "중소 조선 겸", archetype: "MidSmall", bio: "특수선·미국 MRO 기회." },
  ],
  원전: [
    { name: "SMR 리드", archetype: "SMR", bio: "NuScale·한국 SMR 로드맵." },
    { name: "원전 대형 애널", archetype: "LargeReactor", bio: "국내·체코·폴란드 파이프라인." },
    { name: "전력·에너지 전문가", archetype: "Energy", bio: "재생에너지 vs 원전 믹스." },
    { name: "두산·현대 관찰자", archetype: "Vendor", bio: "두산에너빌리티·한전기술 밸류체인." },
    { name: "규제·정책 리드", archetype: "Policy", bio: "원전 정책·탈원전 리스크." },
  ],
  전력기기: [
    { name: "송배전 설비 리드", archetype: "T&D", bio: "변압기·GIS·송전망 투자." },
    { name: "북미 수출 트래커", archetype: "NorthAm", bio: "미국 송배전 노후화·IRA." },
    { name: "효성·HD현대 애널", archetype: "KRVendor", bio: "HD현대일렉·효성중공업·LS." },
    { name: "데이터센터·AI 겸", archetype: "DataCenter", bio: "AI 전력 수요 확장." },
    { name: "실적 서프 관찰자", archetype: "EarningsSurprise", bio: "연속 서프라이즈 패턴 포착." },
  ],
  "2차전지": [
    { name: "양극재 리드", archetype: "Cathode", bio: "에코프로·포스코퓨처엠 판가 민감." },
    { name: "셀 빅3 애널", archetype: "Cell", bio: "LGES·SDI·SK온 수주·가동률." },
    { name: "리튬·원재료 전문가", archetype: "RawMat", bio: "리튬·니켈 가격 바닥 판독." },
    { name: "IRA·EV 수요 관찰자", archetype: "Policy", bio: "북미 EV 수요·IRA 수혜 구분." },
    { name: "전해질·분리막 겸", archetype: "Electrolyte", bio: "천보·SKIET 등 소재 밸류체인." },
  ],
  엔터: [
    { name: "K-pop 글로벌 리드", archetype: "KPop", bio: "BTS·뉴진스·아이브 등 팬덤 데이터." },
    { name: "음원·스트리밍 분석가", archetype: "Streaming", bio: "스포티파이·멜론 매출 기여." },
    { name: "일본·미국 데뷔 관찰자", archetype: "Debut", bio: "일본·미국 신인 데뷔 성공률." },
    { name: "콘텐츠 제작 리드", archetype: "Content", bio: "투어·굿즈·MD 수익 다각화." },
    { name: "엔터 밸류에이션 겸", archetype: "Valuation", bio: "이익 흐름 기반 밸류 재평가." },
  ],
  자동차: [
    { name: "HEV·EV 리드", archetype: "Powertrain", bio: "현대·기아 HEV·EV 점유율." },
    { name: "글로벌 판매 트래커", archetype: "GlobalSales", bio: "북미·유럽·중국 판매 월별 데이터." },
    { name: "배당·환원 관찰자", archetype: "Shareholder", bio: "자사주·배당·밸류업 연동." },
    { name: "밸류업 지수 겸", archetype: "Valuation", bio: "밸류업 지수 편입 수혜 분석." },
    { name: "부품·모비스 리드", archetype: "Parts", bio: "현대모비스·만도·한온시스템." },
  ],
  자동차부품: [
    { name: "전동화 부품 리드", archetype: "EV Parts", bio: "모터·인버터·BMS 수요." },
    { name: "현대모비스 분석가", archetype: "Mobis", bio: "HEV·EV 수혜 핵심 밴더." },
    { name: "글로벌 OEM 트래커", archetype: "OEM", bio: "GM·Ford·VW 물량 민감." },
    { name: "밸류업 겸", archetype: "Valuation", bio: "자사주·배당·PER 재평가." },
    { name: "공급망 리스크 관찰자", archetype: "Supply", bio: "반도체·부품 수급 이슈." },
  ],
  철강: [
    { name: "철강 가격 리드", archetype: "SteelPrice", bio: "후판·열연 가격·중국 감산." },
    { name: "리튬·수직계열화 관찰자", archetype: "Lithium", bio: "POSCO 리튬 밸류체인." },
    { name: "조선·건설 수요 겸", archetype: "Demand", bio: "조선·건설 후판 수요." },
    { name: "밸류업 리드", archetype: "Valuation", bio: "철강 PBR 0.6 이하 밸류 플레이." },
    { name: "글로벌 공급 분석가", archetype: "GlobalSupply", bio: "중국·일본·한국 공급 균형." },
  ],
  인터넷플랫폼: [
    { name: "광고·커머스 리드", archetype: "AdsCommerce", bio: "네이버·카카오 광고·커머스 매출." },
    { name: "AI 검색 관찰자", archetype: "AISearch", bio: "Cue·Gen-AI 검색 재편." },
    { name: "밸류에이션 겸", archetype: "Valuation", bio: "플랫폼 PER·PSR 비교." },
    { name: "규제·공정위 리스크 리드", archetype: "Regulation", bio: "공정위·개보법 리스크." },
    { name: "콘텐츠·IP 겸", archetype: "Content", bio: "웹툰·음원·게임 IP." },
  ],
  금융: [
    { name: "은행 밸류업 리드", archetype: "BankValue", bio: "주주환원율·배당 지속성." },
    { name: "금리·NIM 분석가", archetype: "NIM", bio: "기준금리·순이자마진 민감도." },
    { name: "자본비율·자본건전성 리드", archetype: "Capital", bio: "CET1·LCR·NSFR." },
    { name: "증권·카드 겸", archetype: "NonBank", bio: "증권·카드 계열 실적." },
    { name: "규제 관찰자", archetype: "Regulation", bio: "금감원·바젤 III 리스크." },
  ],
  소비재: [
    { name: "필수소비재 리드", archetype: "Defensive", bio: "KT&G·오리온 등 방어주." },
    { name: "NGP·해외 관찰자", archetype: "NGP", bio: "궐련형 전자담배 글로벌 성장." },
    { name: "배당·환원 분석가", archetype: "Dividend", bio: "고배당 + 자사주 소각." },
    { name: "원가·환율 겸", archetype: "Cost", bio: "원재료·환율 민감도." },
    { name: "밸류에이션 리드", archetype: "Valuation", bio: "방어주 저변동성 프리미엄." },
  ],
  반도체부품: [
    { name: "테스트 소켓 리드", archetype: "Socket", bio: "리노공업·ISC 등 고부가." },
    { name: "AI 반도체 수혜 관찰자", archetype: "AIBenefit", bio: "엔비디아·AMD 패키징 수요." },
    { name: "중소 성장주 겸", archetype: "SmallCap", bio: "고PER Quality 중소형." },
    { name: "재무·현금흐름 리드", archetype: "Quality", bio: "FCF·ROE 프리미엄 검증." },
    { name: "글로벌 고객사 트래커", archetype: "Customer", bio: "엔비디아·퀄컴·인텔 물량." },
  ],
  의료기기: [
    { name: "미용기기 리드", archetype: "Aesthetic", bio: "슈링크·볼뉴머 등 플랫폼." },
    { name: "해외 침투 관찰자", archetype: "Global", bio: "브라질·러시아·동남아 확장." },
    { name: "실적 서프 겸", archetype: "Surprise", bio: "분기 실적 서프라이즈 패턴." },
    { name: "경쟁사 겸", archetype: "Competition", bio: "이루다·하이로닉·비올 등 비교." },
    { name: "규제·허가 리스크 리드", archetype: "Regulation", bio: "FDA·CE 인증 타임라인." },
  ],
  "2차전지소재": [
    { name: "전해질·리튬염 리드", archetype: "Electrolyte", bio: "천보·엔켐 등 판가 민감." },
    { name: "분리막 관찰자", archetype: "Separator", bio: "SKIET·WCP 수요." },
    { name: "원재료 가격 겸", archetype: "RawMat", bio: "리튬·니켈 바닥 시그널." },
    { name: "Crisis 관찰자", archetype: "Crisis", bio: "2차전지 소재 변동성 경계." },
    { name: "EV 수요 리드", archetype: "Demand", bio: "북미·유럽 EV 수요 추이." },
  ],
  뷰티: [
    { name: "미국 아마존 리드", archetype: "Amazon", bio: "Top seller 랭킹·리뷰 데이터." },
    { name: "글로벌 채널 관찰자", archetype: "Channel", bio: "아마존·Sephora·올영 확장." },
    { name: "실적 서프 겸", archetype: "Surprise", bio: "상장 후 실적 서프라이즈." },
    { name: "밸류에이션 리드", archetype: "Valuation", bio: "고PER 성장주 재평가." },
    { name: "경쟁사·카테고리 관찰자", archetype: "Competition", bio: "아이폴·티르티르 등 비교." },
  ],
  게임: [
    { name: "MMORPG 리드", archetype: "MMORPG", bio: "나혼자만 레벨업·리니지 매출." },
    { name: "글로벌 출시 관찰자", archetype: "GlobalLaunch", bio: "일본·중국·동남아 매출." },
    { name: "파이프라인 겸", archetype: "Pipeline", bio: "차기작 출시 일정 추적." },
    { name: "마진·현금흐름 리드", archetype: "Quality", bio: "개발비·마케팅비 vs 매출." },
    { name: "경쟁사 관찰자", archetype: "Competition", bio: "엔씨·크래프톤·넥슨 비교." },
  ],
  해운: [
    { name: "컨테이너 운임 리드", archetype: "Container", bio: "SCFI·BDI 운임 지수." },
    { name: "노선·수급 관찰자", archetype: "RouteSupply", bio: "아시아·유럽·미주 노선 수급." },
    { name: "HMM 분석가", archetype: "HMM", bio: "매각·주주환원·현금 포지션." },
    { name: "유가·환율 겸", archetype: "Cost", bio: "벙커유·환율 민감도." },
    { name: "지정학 리스크 리드", archetype: "Geopolitics", bio: "홍해·파나마 운하·수에즈." },
  ],
  "지주/건설": [
    { name: "지주 밸류업 리드", archetype: "HoldingValue", bio: "NAV 디스카운트·자사주." },
    { name: "건설·플랜트 관찰자", archetype: "Construction", bio: "해외 수주·주택 수주." },
    { name: "바이오·지분가치 겸", archetype: "BioValue", bio: "삼바·셀트리온 지분 재평가." },
    { name: "실적·배당 리드", archetype: "Dividend", bio: "배당 지속성·주주환원." },
    { name: "원가·환율 관찰자", archetype: "Cost", bio: "해외 프로젝트 환율 민감." },
  ],
};

export const SECTOR_PERSONAS: CommitteePersona[] = Object.entries(SECTOR_ROSTER).flatMap(
  ([sector, list]) =>
    list.map((p, i) => ({
      id: `sector-${sector}-${i + 1}`,
      name: `${sector} · ${p.name}`,
      layer: "sector" as const,
      archetype: p.archetype,
      bio: p.bio,
      sector,
    })),
);

export function getSectorPersonas(sector: string): CommitteePersona[] {
  return SECTOR_PERSONAS.filter((p) => p.sector === sector);
}
