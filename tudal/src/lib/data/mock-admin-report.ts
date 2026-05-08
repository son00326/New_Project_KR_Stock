import type { StockReport } from "@/types/admin";
import { MOCK_ADMIN_SHORTLIST } from "@/lib/data/mock-admin-shortlist";

// S2 mock — E2 StockReport 풀 리포트 (BL-4 옵션 B: codegen 인라인).
// 대표 5종(005930·000660·012450·196170·373220) Section 0~8 상세, 나머지 25종 템플릿 반복.
// 구조: ServicePlan-Admin.md §4.2 E2 (section_0 ~ section_8 + appendix). jsonb shape.

const MONTH = "2026-04-01";
const GENERATED_AT = "2026-04-01T00:05:00.000Z";

// ─── Section content 타입 (mock 내부 shape) ─────────────────────────────────
// 실 스키마는 jsonb — 타입은 mock UI 렌더 편의용만.
export type ReportSection0 = {
  headline: string;
  thesis: string[]; // 3줄 투자 서사
  conviction: number; // 0-100
  committeeMini: {
    core: { approve: number; reject: number; abstain: number };
    sector: { approve: number; reject: number; abstain: number };
  };
  priceBands: { bear: string; base: string; bull: string };
};
export type ReportSection1 = {
  description: string;
  segments: { name: string; share: string }[];
  keyFacts: { label: string; value: string }[];
};
export type ReportSection2 = {
  summary: string;
  revenue: { fy: string; value: string; yoy: string }[];
  margins: { operating: string; net: string };
  balance: { debtRatio: string; cash: string };
};
export type ReportSection3 = {
  summary: string;
  multiples: { metric: string; value: string; peer: string }[];
};
export type ReportSection4 = {
  summary: string;
  drivers: string[];
  tam: string;
};
export type ReportSection5 = {
  summary: string;
  risks: { title: string; severity: "high" | "medium" | "low"; detail: string }[];
};
export type ReportSection6 = {
  summary: string;
  signals: { name: string; state: "on" | "watch" | "off"; note: string }[];
  axis: { trend: number; momentum: number; volatility: number };
  divergencePct: number;
};
export type ReportSection7 = {
  summary: string;
  triggers: string[];
  alternatives: { label: string; detail: string }[];
};
export type ReportSection8 = {
  conclusion: string;
  recommendation: string; // "주목할 만" / "관망" 등 — "매수/매도" 금지 (법적)
  keyQuotes: { side: "pro" | "con" | "neutral"; quote: string }[];
};
export type ReportAppendix = {
  technicals: { name: string; value: string }[];
  dataSources: string[];
};

// ─── 대표 5종 상세 섹션 ──────────────────────────────────────────────────────
type Detailed = {
  section_0: ReportSection0;
  section_1: ReportSection1;
  section_2: ReportSection2;
  section_3: ReportSection3;
  section_4: ReportSection4;
  section_5: ReportSection5;
  section_6?: Partial<ReportSection6>; // axis/divergence는 shortlist에서 병합
  section_7: ReportSection7;
  section_8: ReportSection8;
  appendix: ReportAppendix;
};

const DETAILED: Record<string, Detailed> = {
  "000660": {
    section_0: {
      headline: "HBM 독점 포지션 + AI 메모리 슈퍼사이클 한가운데",
      thesis: [
        "HBM3E·HBM4 사실상 독점으로 AI 서버 수요의 주 수혜주.",
        "m60 상위·m20 우상향, 장기 추세 재개 국면.",
        "CAPEX 확대 국면이지만 ROIC 방어, Quality·모멘텀 동시 만족.",
      ],
      conviction: 92,
      committeeMini: {
        core: { approve: 10, reject: 0, abstain: 1 },
        sector: { approve: 5, reject: 0, abstain: 0 },
      },
      priceBands: { bear: "180k", base: "230k", bull: "280k" },
    },
    section_1: {
      description:
        "SK하이닉스는 국내 2위 메모리 반도체 기업으로 HBM(고대역폭 메모리)에서 글로벌 선두 포지션을 점유한다. 엔비디아 H100·B200 공급의 핵심 벤더이며 HBM3E 12단 양산을 2024년 주도했다.",
      segments: [
        { name: "DRAM", share: "64%" },
        { name: "NAND", share: "30%" },
        { name: "HBM(DRAM 내)", share: "22% ↑" },
      ],
      keyFacts: [
        { label: "2026F 매출", value: "78조원 (YoY +28%)" },
        { label: "2026F 영익", value: "24조원 (OPM 31%)" },
        { label: "HBM 점유율", value: "53% (2026E)" },
      ],
    },
    section_2: {
      summary:
        "2025 회복 구간을 지나 2026 AI 메모리 본격 성장. HBM 프리미엄으로 blended ASP·마진 급등.",
      revenue: [
        { fy: "2024", value: "61조", yoy: "+42%" },
        { fy: "2025", value: "65조", yoy: "+7%" },
        { fy: "2026F", value: "78조", yoy: "+28%" },
      ],
      margins: { operating: "31%", net: "24%" },
      balance: { debtRatio: "28%", cash: "12조원" },
    },
    section_3: {
      summary: "Forward PER 8배 수준으로 과거 사이클 대비 여전히 저평가. 글로벌 피어 대비 15~20% 할인.",
      multiples: [
        { metric: "Forward PER", value: "8.2x", peer: "Micron 11.5x" },
        { metric: "EV/EBITDA", value: "4.8x", peer: "Micron 6.2x" },
        { metric: "PBR", value: "1.9x", peer: "Samsung Electronics 1.4x" },
      ],
    },
    section_4: {
      summary: "HBM 수요 향후 3년간 CAGR 60%+. AI 서버 구축 투자 지속, 수요 초과 상태.",
      drivers: ["HBM3E 12단·HBM4 출시", "엔비디아 Blackwell·Rubin 공급", "하이퍼스케일러 CAPEX 확대"],
      tam: "글로벌 HBM 시장 2026 28조원 → 2028 50조원 (CAGR ~34%).",
    },
    section_5: {
      summary: "공급 과잉·AI CAPEX 피크아웃·기술 경쟁 심화 3개 리스크.",
      risks: [
        {
          title: "2027~28 공급 과잉",
          severity: "medium",
          detail: "HBM 공급 확대 + 수요 둔화 시 사이클 전환 가능. 모니터링 필요.",
        },
        {
          title: "AI CAPEX 둔화",
          severity: "medium",
          detail: "메타·MS·구글 설비 투자 속도 둔화 신호 경계.",
        },
        {
          title: "기술 경쟁 (삼성·Micron)",
          severity: "low",
          detail: "단기적으로 시장 점유율 리더 유지 가능.",
        },
      ],
    },
    section_7: {
      summary: "목표가 도달·m20 이탈·HBM 공급 과잉 시그널 3개 Exit 조건.",
      triggers: [
        "Composite 0→장 base 시나리오 달성 (230k 도달)",
        "m20 이탈 + 거래량 급감 시 단기 조정 경계",
        "HBM 스팟 가격 하락 + 엔비디아 CAPEX 가이던스 하향",
      ],
      alternatives: [
        { label: "매도 전량", detail: "Exit 조건 3개 중 2개 이상 동시 만족 시 고려" },
        { label: "분할매도", detail: "Base 도달 후 Bull 시나리오 추가 검증 전까지 50% 분할" },
        { label: "홀딩", detail: "중장기 3년 관점 유지, 단기 변동성 무시" },
      ],
    },
    section_8: {
      conclusion:
        "HBM 독점 + AI 수요 + 밸류에이션 3박자 동시 충족. Core 11명 중 10명 approve, 섹터 보드 5인 만장일치 approve.",
      recommendation: "주목할 만함 (High Conviction)",
      keyQuotes: [
        {
          side: "pro",
          quote: "퀄리티 엡실론: ROIC 22%·FCF 마진 18% 유지되는 한 프리미엄 정당화.",
        },
        {
          side: "pro",
          quote: "섹터 HBM 스페셜리스트: 2027년까지 HBM3E 12단 경쟁사 따라잡기 어려움.",
        },
        {
          side: "con",
          quote: "리스크 제타: 사이클 후반 진입·Capex 집중 시기 주의 필요.",
        },
        {
          side: "neutral",
          quote: "매크로 감마: AI CAPEX 둔화 시나리오 대비 헤지 필요.",
        },
      ],
    },
    appendix: {
      technicals: [
        { name: "52w range", value: "145k ~ 241k" },
        { name: "RSI(14)", value: "62" },
        { name: "MACD", value: "+Divergence (bull)" },
        { name: "Bollinger(20,2)", value: "middle~upper band" },
      ],
      dataSources: ["pykrx (OHLCV)", "DART (공시)", "회사 IR (매출·이익 공시)", "Bloomberg (피어 비교)"],
    },
  },
  "005930": {
    section_0: {
      headline: "삼성전자 · Quality·추세 동시 상위, HBM 턴어라운드 가세",
      thesis: [
        "HBM3E 본격 양산·엔비디아 공급 확대로 장기 추세 재개.",
        "파운드리 2나노·3나노 가동률 회복 시그널.",
        "밸류업 + 자사주 매입·소각으로 주주환원 가속.",
      ],
      conviction: 88,
      committeeMini: {
        core: { approve: 10, reject: 0, abstain: 1 },
        sector: { approve: 5, reject: 0, abstain: 0 },
      },
      priceBands: { bear: "72k", base: "95k", bull: "115k" },
    },
    section_1: {
      description:
        "삼성전자는 글로벌 1위 메모리·파운드리 동시 보유 종합 반도체 업체. AI 서버·스마트폰·가전 전 영역 포트폴리오.",
      segments: [
        { name: "DS(반도체)", share: "50%" },
        { name: "MX(모바일)", share: "28%" },
        { name: "VD·DA(가전)", share: "15%" },
        { name: "Harman·기타", share: "7%" },
      ],
      keyFacts: [
        { label: "2026F 매출", value: "340조 (YoY +14%)" },
        { label: "HBM 점유율", value: "40% (2026E)" },
        { label: "자사주 소각", value: "2025~26 10조 규모" },
      ],
    },
    section_2: {
      summary: "메모리 회복 + 파운드리 턴어라운드 + 모바일 안정. 영업이익 40조대 회복 구간.",
      revenue: [
        { fy: "2024", value: "294조", yoy: "+18%" },
        { fy: "2025", value: "308조", yoy: "+5%" },
        { fy: "2026F", value: "340조", yoy: "+10%" },
      ],
      margins: { operating: "14%", net: "11%" },
      balance: { debtRatio: "12%", cash: "86조" },
    },
    section_3: {
      summary: "Forward PER 12배, PBR 1.4배. HBM 모멘텀 반영 중이나 피어 Micron 대비 할인.",
      multiples: [
        { metric: "Forward PER", value: "11.8x", peer: "TSMC 18x" },
        { metric: "PBR", value: "1.4x", peer: "SK하이닉스 1.9x" },
        { metric: "Dividend Yield", value: "2.3%", peer: "업종 평균 1.8%" },
      ],
    },
    section_4: {
      summary: "HBM·파운드리·AP(모바일 AP) 3대 엔진 동시 가동. 밸류업 + 주주환원 가속.",
      drivers: ["HBM3E 점유율 확대", "파운드리 2나노 가동률 상승", "모바일 AP(엑시노스) 경쟁력 회복"],
      tam: "글로벌 반도체 2026 670조원. 삼성 커버리지 전영역.",
    },
    section_5: {
      summary: "파운드리 적자 지속·HBM 후발·지정학 리스크 3개.",
      risks: [
        {
          title: "파운드리 적자",
          severity: "high",
          detail: "TSMC 대비 경쟁력 격차. 2026년 BEP 도달이 관건.",
        },
        {
          title: "HBM 후발",
          severity: "medium",
          detail: "엔비디아 승인 타임라인 SK하이닉스 대비 늦음.",
        },
        {
          title: "지정학(미·중)",
          severity: "medium",
          detail: "중국 수출 규제 장기 지속 시 중국 매출 구조적 하락.",
        },
      ],
    },
    section_7: {
      summary: "95k 도달·HBM 점유율 후퇴·파운드리 BEP 지연 3개 Exit 조건.",
      triggers: [
        "Base 95k 도달 후 추가 모멘텀 부재",
        "HBM 점유율 30% 이하 하락",
        "파운드리 2026 BEP 미달성",
      ],
      alternatives: [
        { label: "매도 전량", detail: "Exit 조건 2개 이상 동시 충족 시" },
        { label: "분할매도", detail: "Base 도달 후 시장 반응 확인" },
        { label: "홀딩", detail: "배당 + 자사주 소각 지속되면 장기 유지" },
      ],
    },
    section_8: {
      conclusion: "Quality·배당·모멘텀 복합 포지션. Core 11 중 9 approve.",
      recommendation: "주목할 만함 (Medium-High Conviction)",
      keyQuotes: [
        { side: "pro", quote: "성장파 베타: HBM+파운드리 복합 성장 엔진 과소평가." },
        { side: "pro", quote: "배당·현금흐름 이오타: 소각+배당 조합 매력적." },
        { side: "con", quote: "리스크 제타: 파운드리 적자 구조 해소 시간 필요." },
      ],
    },
    appendix: {
      technicals: [
        { name: "52w range", value: "71k ~ 98k" },
        { name: "RSI(14)", value: "58" },
        { name: "m60 위치", value: "above (+4%)" },
      ],
      dataSources: ["pykrx", "DART", "삼성전자 IR"],
    },
  },
  "012450": {
    section_0: {
      headline: "방산 슈퍼사이클의 주도주 — 폴란드·중동 파이프라인 확장",
      thesis: [
        "폴란드 K9·천무 수출 + 중동 사우디·UAE 파이프라인 확장 지속.",
        "m20·m60 우상향 견고, 모멘텀 상위 유지.",
        "수주 잔고 20조원+ · 향후 3~4년 실적 가시성.",
      ],
      conviction: 92,
      committeeMini: {
        core: { approve: 10, reject: 0, abstain: 1 },
        sector: { approve: 5, reject: 0, abstain: 0 },
      },
      priceBands: { bear: "210k", base: "290k", bull: "360k" },
    },
    section_1: {
      description:
        "한화에어로스페이스는 한화그룹의 방산 핵심 계열사로, K9 자주포·천무·차세대 다연장 등 지상 화력 플랫폼 주도.",
      segments: [
        { name: "지상 방산 (K9·천무)", share: "58%" },
        { name: "항공엔진·우주", share: "25%" },
        { name: "기타(ITS·보안)", share: "17%" },
      ],
      keyFacts: [
        { label: "수주 잔고", value: "23조원 (2026Q1)" },
        { label: "2026F 매출", value: "12조 (YoY +35%)" },
        { label: "폴란드 계약 총액", value: "약 20조원 (단계별)" },
      ],
    },
    section_2: {
      summary: "방산 슈퍼사이클 정점 구간. OPM 두 자릿수 회복.",
      revenue: [
        { fy: "2024", value: "7.5조", yoy: "+58%" },
        { fy: "2025", value: "9.0조", yoy: "+20%" },
        { fy: "2026F", value: "12.0조", yoy: "+33%" },
      ],
      margins: { operating: "11%", net: "8%" },
      balance: { debtRatio: "42%", cash: "2.1조" },
    },
    section_3: {
      summary: "Forward PER 18배. 글로벌 방산 피어(록히드·GD) 대비 프리미엄 타당.",
      multiples: [
        { metric: "Forward PER", value: "18.2x", peer: "Lockheed 17x" },
        { metric: "EV/EBITDA", value: "12.5x", peer: "GD 13x" },
      ],
    },
    section_4: {
      summary: "유럽 재무장·중동 수요·북미 MRO까지 3개 동시 성장 동인.",
      drivers: ["폴란드 K9·천무 2차 계약", "중동 사우디 천무 FMS", "미국 MRO 진출"],
      tam: "글로벌 방산 시장 2,400조원. 한국 수출 비중 5%→15% 목표.",
    },
    section_5: {
      summary: "지정학 리스크 해소·계약 일정 지연·환율 3개 리스크.",
      risks: [
        {
          title: "우크라전 종전",
          severity: "medium",
          detail: "종전 시 유럽 재무장 수요 급감 가능.",
        },
        {
          title: "수주 일정 지연",
          severity: "low",
          detail: "국가 간 협상 지연 리스크.",
        },
        {
          title: "환율(USD·PLN)",
          severity: "low",
          detail: "장기 계약 헤지 운영으로 상대적 낮음.",
        },
      ],
    },
    section_7: {
      summary: "Base 290k 도달·우크라 종전·수주 잔고 감소 3개 Exit 조건.",
      triggers: ["Base 290k 도달 후 추가 모멘텀 부재", "우크라 종전 공식화", "수주 잔고 20조 이하 하락"],
      alternatives: [
        { label: "매도 전량", detail: "Exit 조건 2개 이상 동시 만족 시" },
        { label: "분할매도", detail: "Base 도달 후 일부 익절" },
        { label: "홀딩", detail: "중기 12~18개월 관점 유지" },
      ],
    },
    section_8: {
      conclusion: "방산 슈퍼사이클 주도주. 거의 만장일치 approve.",
      recommendation: "주목할 만함 (High Conviction)",
      keyQuotes: [
        { side: "pro", quote: "스토리텔러 카파: 한국 방산 글로벌 지위 재평가 초입." },
        { side: "pro", quote: "섹터 수출 파이프 트래커: 폴란드 2차·중동 신규 동시 진행." },
        { side: "con", quote: "리스크 제타: 밸류에이션 부담 있음." },
      ],
    },
    appendix: {
      technicals: [
        { name: "52w range", value: "145k ~ 305k" },
        { name: "RSI(14)", value: "66" },
        { name: "거래량", value: "평균 대비 +30%" },
      ],
      dataSources: ["pykrx", "DART", "한화그룹 IR", "SIPRI 방산 통계"],
    },
  },
  "196170": {
    section_0: {
      headline: "알테오젠 · SC 제형 변환 플랫폼, 머크 키트루다 상용화 가시",
      thesis: [
        "머크 키트루다 SC 제형 상용화 가시화 — 2026H2 FDA 승인 예상.",
        "KOSDAQ 시총 1위 안정화 + m5·m10 급등 모멘텀 상위.",
        "ALT-B4 하이브로자임 플랫폼 업프런트·로열티 구조 장기 수익화.",
      ],
      conviction: 95,
      committeeMini: {
        core: { approve: 10, reject: 0, abstain: 1 },
        sector: { approve: 5, reject: 0, abstain: 0 },
      },
      priceBands: { bear: "280k", base: "420k", bull: "580k" },
    },
    section_1: {
      description:
        "알테오젠은 피하주사(SC) 제형 변환 플랫폼 하이브로자임을 보유한 바이오 기술 회사. 머크·다이이찌·BMS 등 글로벌 제약과 기술 수출.",
      segments: [
        { name: "하이브로자임 라이선스 (업프런트·마일스톤)", share: "40%" },
        { name: "로열티 (매출 연동)", share: "35%" },
        { name: "바이오시밀러·자체 파이프라인", share: "25%" },
      ],
      keyFacts: [
        { label: "2026F 매출", value: "3,500억 (YoY +85%)" },
        { label: "키트루다 SC FDA", value: "2026H2 예상" },
        { label: "라이선스 계약", value: "7건 (머크·BMS·다이이찌 등)" },
      ],
    },
    section_2: {
      summary: "업프런트·마일스톤 인식 구간. 2027 로열티 인식 본격화.",
      revenue: [
        { fy: "2024", value: "1,200억", yoy: "+110%" },
        { fy: "2025", value: "1,900억", yoy: "+58%" },
        { fy: "2026F", value: "3,500억", yoy: "+85%" },
      ],
      margins: { operating: "35%", net: "28%" },
      balance: { debtRatio: "8%", cash: "6,000억" },
    },
    section_3: {
      summary: "Forward PSR 40배. 키트루다 SC 로열티 NPV 모형으로 정당화.",
      multiples: [
        { metric: "Forward PSR", value: "40x", peer: "Halozyme 12x" },
        { metric: "Forward PER", value: "85x", peer: "Halozyme 35x" },
      ],
    },
    section_4: {
      summary: "SC 제형 시장 급성장 + 키트루다 단일 제품 매출 20조원 + 로열티 2~5% 구조.",
      drivers: ["키트루다 SC 상용화", "다이이찌 ALT-B4 추가 계약", "바이오시밀러 파이프라인 (허셉틴·아일리아)"],
      tam: "글로벌 SC 제형 변환 시장 2030년 90조원.",
    },
    section_5: {
      summary: "임상·승인 지연, 로열티 정산 불확실성, 경쟁 플랫폼 3개.",
      risks: [
        { title: "FDA 승인 지연", severity: "medium", detail: "2026H2 → 2027H1 지연 리스크" },
        { title: "로열티율 재협상", severity: "low", detail: "계약 구조 공개 제한" },
        { title: "경쟁 플랫폼", severity: "low", detail: "Halozyme ENHANZE 시장 선점 경쟁" },
      ],
    },
    section_7: {
      summary: "Base 420k·FDA 지연·경쟁사 승인 3개 Exit 조건.",
      triggers: ["Base 420k 도달 후 상용화 이벤트 완료", "FDA 승인 2027H2 이후 지연", "Halozyme 경쟁 제형 FDA 우선 승인"],
      alternatives: [
        { label: "매도 전량", detail: "승인 지연 확정 시" },
        { label: "분할매도", detail: "Base 도달 후 50% 익절, 나머지 로열티 인식 기다림" },
        { label: "홀딩", detail: "중장기 3년 관점 로열티 안정화 기다림" },
      ],
    },
    section_8: {
      conclusion: "바이오 최상위 Conviction. 섹터 만장일치 approve.",
      recommendation: "주목할 만함 (Highest Conviction · KOSDAQ 1위)",
      keyQuotes: [
        { side: "pro", quote: "섹터 CDMO 분석가: 라이선스 구조는 장기 캐시카우." },
        { side: "pro", quote: "스토리텔러 카파: SC 제형 변환은 10년 서사." },
        { side: "con", quote: "리스크 제타: 단일 이벤트(FDA) 의존도 과다." },
      ],
    },
    appendix: {
      technicals: [
        { name: "52w range", value: "175k ~ 465k" },
        { name: "RSI(14)", value: "71 (overbought watch)" },
        { name: "거래량", value: "평균 대비 +85% (집중)" },
      ],
      dataSources: ["pykrx", "DART", "알테오젠 IR", "ClinicalTrials.gov"],
    },
  },
  "373220": {
    section_0: {
      headline: "LG에너지솔루션 · 북미 IRA 수혜 + m60 양전환, 장기 재편입",
      thesis: [
        "북미 IRA 수혜 지속 + 애리조나·미시간 가동 본격화.",
        "2차전지 업황 바닥 탈출, m60 양전환 확인.",
        "ESS·중형 LFP 진입으로 포트폴리오 다각화.",
      ],
      conviction: 78,
      committeeMini: {
        core: { approve: 6, reject: 3, abstain: 2 },
        sector: { approve: 3, reject: 1, abstain: 1 },
      },
      priceBands: { bear: "280k", base: "380k", bull: "460k" },
    },
    section_1: {
      description: "LG에너지솔루션은 글로벌 Top 3 2차전지 셀 업체. GM·Ford·Stellantis와 JV 운영.",
      segments: [
        { name: "EV 셀", share: "72%" },
        { name: "ESS", share: "18%" },
        { name: "소형전지", share: "10%" },
      ],
      keyFacts: [
        { label: "2026F 매출", value: "32조 (YoY +18%)" },
        { label: "북미 CAPA", value: "180GWh (2026)" },
        { label: "IRA AMPC", value: "연 2.5조 수혜 추정" },
      ],
    },
    section_2: {
      summary: "2024 바닥 → 2025 회복 → 2026 성장 전환. OPM 한 자릿수 후반 목표.",
      revenue: [
        { fy: "2024", value: "25조", yoy: "-10%" },
        { fy: "2025", value: "27조", yoy: "+8%" },
        { fy: "2026F", value: "32조", yoy: "+18%" },
      ],
      margins: { operating: "8%", net: "5%" },
      balance: { debtRatio: "48%", cash: "3.5조" },
    },
    section_3: {
      summary: "Forward PER 25배. 2차전지 피어 평균 수준이나 북미 CAPA 프리미엄 근거.",
      multiples: [
        { metric: "Forward PER", value: "25x", peer: "CATL 22x" },
        { metric: "EV/EBITDA", value: "10.5x", peer: "Samsung SDI 9.5x" },
      ],
    },
    section_4: {
      summary: "IRA 수혜 + 북미 수요 회복 + ESS 성장. 단 EV 수요 속도가 관건.",
      drivers: ["GM·Ford JV 가동", "IRA AMPC 수혜", "ESS·LFP 진입"],
      tam: "글로벌 2차전지 2030 300조원.",
    },
    section_5: {
      summary: "EV 수요 둔화·중국 LFP 공습·IRA 정치 리스크 3개.",
      risks: [
        { title: "EV 수요 둔화", severity: "medium", detail: "북미 EV 성장률 둔화 시 직접 충격." },
        { title: "중국 LFP 경쟁", severity: "medium", detail: "CATL·BYD LFP 북미 우회 진입 위협." },
        { title: "IRA 정치 리스크", severity: "medium", detail: "미 대선 결과에 따른 IRA 수정 가능성." },
      ],
    },
    section_7: {
      summary: "Base 380k·EV 수요 급감·IRA 축소 3개 Exit 조건.",
      triggers: ["Base 380k 도달", "북미 EV 판매 YoY -10% 전환", "IRA AMPC 축소 법안 통과"],
      alternatives: [
        { label: "매도 전량", detail: "IRA 축소 확정 시" },
        { label: "분할매도", detail: "Base 도달 후 30% 익절" },
        { label: "홀딩", detail: "중기 회복 기다림" },
      ],
    },
    section_8: {
      conclusion: "턴어라운드 초입. Core 8 approve · 2 reject (수요 회의론).",
      recommendation: "주목할 만함 (Medium Conviction · 턴어라운드)",
      keyQuotes: [
        { side: "pro", quote: "섹터 IRA·EV 수요 관찰자: 북미 2026 성장 재개." },
        { side: "con", quote: "역발상 세타: 컨센서스 과낙관 우려." },
        { side: "neutral", quote: "퀀트 델타: 팩터상 모멘텀 턴 시그널." },
      ],
    },
    appendix: {
      technicals: [
        { name: "52w range", value: "245k ~ 408k" },
        { name: "m60", value: "양전환 확인 (2026-03)" },
        { name: "거래량", value: "평균 대비 +15%" },
      ],
      dataSources: ["pykrx", "DART", "LG에너지솔루션 IR", "EV-volumes.com"],
    },
  },
};

// ─── 템플릿 Section 생성기 (나머지 25종) ─────────────────────────────────────
function makeTemplateSections(
  row: (typeof MOCK_ADMIN_SHORTLIST)[number],
): Detailed {
  const direction =
    row.deltaStatus === "new"
      ? "신규 편입"
      : row.compositeScore >= 85
        ? "상위 보유"
        : "유지";
  return {
    section_0: {
      headline: `${row.name} (${row.sector}) · ${row.signalLabel}`,
      thesis: row.summary3Line.split("\n").filter(Boolean),
      conviction: row.compositeScore,
      committeeMini: {
        core: deriveCoreVoteCounts(row.compositeScore),
        sector: deriveSectorVoteCounts(row.compositeScore),
      },
      priceBands: { bear: "-", base: "-", bull: "-" },
    },
    section_1: {
      description: `${row.name}은(는) ${row.sector} 섹터의 주요 상장사. bucket = ${row.bucket} (상승 예상 기간). ${direction}.`,
      segments: [{ name: row.sector, share: "100% (mock)" }],
      keyFacts: [
        { label: "티커", value: row.ticker },
        { label: "Composite", value: String(row.compositeScore) },
        { label: "제안 비중", value: `${(row.suggestedWeight * 100).toFixed(1)}%` },
      ],
    },
    section_2: {
      summary: `상세 재무는 실데이터 연결(S5 M10) 후 자동 생성. 본 mock은 구조 검증용.`,
      revenue: [],
      margins: { operating: "-", net: "-" },
      balance: { debtRatio: "-", cash: "-" },
    },
    section_3: {
      summary: "섹터 피어 대비 밸류에이션은 실데이터 연결 후 채워집니다.",
      multiples: [],
    },
    section_4: {
      summary: `${row.signalLabel} · ${row.deltaReason}. 구체 TAM/성장 동인은 실데이터 연결 후.`,
      drivers: [row.deltaReason],
      tam: "-",
    },
    section_5: {
      summary: "섹터 공통 리스크 + 종목 특유 리스크는 실데이터 연결 후 자동 생성.",
      risks: [
        {
          title: "데이터 공백",
          severity: "low",
          detail: "S5 M10 스케줄러 연결 전까지 본 섹션은 템플릿.",
        },
      ],
    },
    section_7: {
      summary: `Exit 조건 3종: 목표가 도달 · m20 이탈 · 악재 발생.`,
      triggers: ["목표가 도달 후 추가 모멘텀 부재", "m20 이탈 + 거래량 급감", "섹터 악재 발생"],
      alternatives: [
        { label: "매도 전량", detail: "Exit 조건 2개 이상 동시 만족 시" },
        { label: "분할매도", detail: "목표가 도달 후 50% 익절" },
        { label: "홀딩", detail: `${row.bucket === "long" ? "장기" : row.bucket === "mid" ? "중기" : "단기"} 관점 유지` },
      ],
    },
    section_8: {
      conclusion: `Composite ${row.compositeScore} · Delta ${row.deltaStatus}. 상세 논거는 실데이터 연결 후.`,
      recommendation:
        row.compositeScore >= 85
          ? "주목할 만함 (High)"
          : row.compositeScore >= 75
            ? "주목할 만함 (Medium)"
            : "관망",
      keyQuotes: [
        {
          side: "pro",
          quote: `섹터 전문가: ${row.deltaReason}`,
        },
        {
          side: row.volatilityScore < 60 ? "con" : "neutral",
          quote:
            row.volatilityScore < 60
              ? `리스크 제타: 변동성 ${row.volatilityScore}, Crisis 경계 필요.`
              : `퀄리티 엡실론: Quality 수준 적정.`,
        },
      ],
    },
    appendix: {
      technicals: [
        { name: "Trend", value: String(row.trendScore) },
        { name: "Momentum", value: String(row.momentumScore) },
        { name: "Volatility(Quality)", value: String(row.volatilityScore) },
        { name: "m60 괴리율", value: `${row.divergencePct}%` },
      ],
      dataSources: ["(mock · S5 M10 연결 후 실데이터 교체)"],
    },
  };
}

// Vote count 유도 (Core 11)
function deriveCoreVoteCounts(composite: number) {
  if (composite >= 88) return { approve: 10, reject: 0, abstain: 1 };
  if (composite >= 80) return { approve: 8, reject: 1, abstain: 2 };
  if (composite >= 72) return { approve: 6, reject: 3, abstain: 2 };
  return { approve: 4, reject: 4, abstain: 3 };
}

// Sector board (5인) vote count
function deriveSectorVoteCounts(composite: number) {
  if (composite >= 88) return { approve: 5, reject: 0, abstain: 0 };
  if (composite >= 80) return { approve: 4, reject: 1, abstain: 0 };
  if (composite >= 72) return { approve: 3, reject: 1, abstain: 1 };
  return { approve: 2, reject: 2, abstain: 1 };
}

// ─── 활성 30종만 리포트 보유 (REMOVED 3종 제외) ──────────────────────────────
const ACTIVE = MOCK_ADMIN_SHORTLIST.filter((r) => r.deltaStatus !== "removed");

export const MOCK_ADMIN_REPORTS: StockReport[] = ACTIVE.map((row) => {
  const detailed = DETAILED[row.ticker];
  const sections = detailed ?? makeTemplateSections(row);
  // Section 6은 모든 종목이 shortlist의 축 점수를 받음 (공통)
  const section_6: ReportSection6 = {
    summary: detailed
      ? "5-Signal · 3축 축 분화 확인."
      : `Trend ${row.trendScore}·Momentum ${row.momentumScore}·Volatility(Q) ${row.volatilityScore} · 괴리율 ${row.divergencePct}%.`,
    signals: [
      {
        name: "m5",
        state: row.momentumScore >= 80 ? "on" : row.momentumScore >= 65 ? "watch" : "off",
        note: "단기 모멘텀",
      },
      {
        name: "m20",
        state: row.trendScore >= 80 ? "on" : row.trendScore >= 70 ? "watch" : "off",
        note: "중기 추세",
      },
      {
        name: "m60",
        state: row.trendScore >= 75 ? "on" : "watch",
        note: "장기 추세",
      },
      {
        name: "Crisis",
        state: row.volatilityScore < 60 ? "watch" : "off",
        note: "변동성 경계",
      },
      {
        name: "Quality",
        state: row.volatilityScore >= 85 ? "on" : row.volatilityScore >= 70 ? "watch" : "off",
        note: "Quality 점수",
      },
    ],
    axis: {
      trend: row.trendScore,
      momentum: row.momentumScore,
      volatility: row.volatilityScore,
    },
    divergencePct: row.divergencePct,
  };

  return {
    id: `rpt-${MONTH}-${row.ticker}`,
    ticker: row.ticker,
    month: MONTH,
    version: 1,
    schemaVersion: 1,
    isLatest: true,
    section_0: sections.section_0,
    section_1: sections.section_1,
    section_2: sections.section_2,
    section_3: sections.section_3,
    section_4: sections.section_4,
    section_5: sections.section_5,
    section_6,
    section_7: sections.section_7,
    section_8: sections.section_8,
    appendix: sections.appendix,
    regenAutoCount: 0,
    regenManualCount: 0,
    generatedAt: GENERATED_AT,
  };
});

export function getReportByTicker(ticker: string): StockReport | undefined {
  return MOCK_ADMIN_REPORTS.find((r) => r.ticker === ticker);
}

// 이전/다음 내비를 위한 bucket 내 정렬 리스트
export function getBucketNeighbors(ticker: string): {
  prev?: { ticker: string; name: string };
  next?: { ticker: string; name: string };
} {
  const current = ACTIVE.find((r) => r.ticker === ticker);
  if (!current) return {};
  const bucketMembers = ACTIVE.filter((r) => r.bucket === current.bucket).sort(
    (a, b) => a.rank - b.rank,
  );
  const idx = bucketMembers.findIndex((r) => r.ticker === ticker);
  return {
    prev: idx > 0 ? { ticker: bucketMembers[idx - 1].ticker, name: bucketMembers[idx - 1].name } : undefined,
    next:
      idx < bucketMembers.length - 1
        ? { ticker: bucketMembers[idx + 1].ticker, name: bucketMembers[idx + 1].name }
        : undefined,
  };
}
