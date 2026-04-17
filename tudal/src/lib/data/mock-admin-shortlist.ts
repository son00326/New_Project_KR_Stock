import type { ShortListItem } from "@/types/admin";

// MVP용 mock 데이터 — 추후 pykrx·DART·자체 분석엔진 결과로 교체 (S1 Short List 30 홈)
// E1 ShortList30 (월간 Short List). 월 1회 배치 (매월 1일 09:00 KST, M10 스케줄러).
//
// 2026-04 스냅샷 (BL-3 옵션 C, 2026-04-17 확정):
//   - Claude가 backtest/full_system_backtest_v6.py v6 FINAL 알고리즘 로직 관점에서 정성 생성
//   - 30종 = 단기 상승 예상 10 + 중기 10 + 장기 10 (bucket = 상승 예상 기간)
//   - 실 ticker: KOSPI/KOSDAQ 실제 종목 (2026-04 기준 공개 정보)
//   - Delta 뷰 테스트를 위해 REMOVED 3종 (전월 포함) 추가 — 총 33행
//   - v2 AI agent 엔진 교체 경로는 Document/Build/Slices/Deferred-AIAgent-Selection.md 참조
//
// 점수 체계:
//   - compositeScore 0~100 = bucket별 v6 가중치 적용 선정 강도
//   - trendScore·momentumScore·volatilityScore 0~100 (높을수록 긍정, vol은 Quality 환산)
//   - suggestedWeight = fraction (0.04 = 4%). axis weight 합: long 0.30 + mid 0.40 + short 0.30
//   - divergencePct = m60 이동평균 대비 괴리율 (% — 양수는 MA 상방)
//   - sparkline7d = 최근 7 거래일 종가 (표시 전용, 데이터 shape 가상)
//   - createdAt = month 1일 09:00 KST (M10 스케줄러 가상 시각)

const MONTH = "2026-04-01";
const CREATED_AT = "2026-04-01T00:00:00.000Z"; // 09:00 KST ≈ UTC 00:00

type SeedRow = Omit<
  ShortListItem,
  "id" | "month" | "createdAt" | "divergencePct" | "sparkline7d"
>;

const SEED: SeedRow[] = [
  // ─────────────────────────────────────────── 🟦 장기 (long) 10종
  {
    ticker: "005930",
    name: "삼성전자",
    sector: "반도체",
    bucket: "long",
    rank: 2,
    compositeScore: 88,
    trendScore: 85,
    momentumScore: 78,
    volatilityScore: 92,
    signalLabel: "Quality+추세",
    deltaStatus: "hold",
    deltaReason: "KOSPI 벤치마크 핵심·추세 유지",
    summary3Line:
      "HBM3E 본격 양산·엔비디아 공급 확대.\nAI 서버 수요로 장기 추세 재개.\nQuality·Trend 최상위, m60 견고.",
    suggestedWeight: 0.04,
  },
  {
    ticker: "000660",
    name: "SK하이닉스",
    sector: "반도체",
    bucket: "long",
    rank: 1,
    compositeScore: 92,
    trendScore: 90,
    momentumScore: 88,
    volatilityScore: 80,
    signalLabel: "HBM 모멘텀+Quality",
    deltaStatus: "hold",
    deltaReason: "HBM 독점·m60 상위 유지",
    summary3Line:
      "HBM3E·HBM4 사실상 독점 포지션.\nAI 메모리 초과 수요 지속.\nm60 상위·m20 우상향 유지.",
    suggestedWeight: 0.045,
  },
  {
    ticker: "207940",
    name: "삼성바이오로직스",
    sector: "바이오",
    bucket: "long",
    rank: 3,
    compositeScore: 87,
    trendScore: 85,
    momentumScore: 75,
    volatilityScore: 90,
    signalLabel: "Quality 최상위",
    deltaStatus: "hold",
    deltaReason: "CDMO 실적 우상향·Quality 안정",
    summary3Line:
      "CDMO 4공장 풀가동 실적 우상향.\n5공장 증설·수주 파이프라인 견고.\n낮은 변동성·Quality 최상위.",
    suggestedWeight: 0.035,
  },
  {
    ticker: "373220",
    name: "LG에너지솔루션",
    sector: "2차전지",
    bucket: "long",
    rank: 10,
    compositeScore: 78,
    trendScore: 72,
    momentumScore: 70,
    volatilityScore: 80,
    signalLabel: "턴어라운드",
    deltaStatus: "new",
    deltaReason: "북미 수요 회복·m60 양전환, 장기 재편입",
    summary3Line:
      "북미 IRA 수혜 지속·생산 재개.\n2차전지 바닥 탈출 초기 시그널.\n장기 추세 반전, 신규 편입.",
    suggestedWeight: 0.025,
  },
  {
    ticker: "005380",
    name: "현대차",
    sector: "자동차",
    bucket: "long",
    rank: 4,
    compositeScore: 85,
    trendScore: 82,
    momentumScore: 75,
    volatilityScore: 88,
    signalLabel: "배당+모멘텀",
    deltaStatus: "hold",
    deltaReason: "HEV 점유율 확대·배당 매력",
    summary3Line:
      "HEV 글로벌 점유율 확대·EV 재편.\n배당 매력 + 밸류업 지수 편입.\n저변동성·안정 모멘텀 유지.",
    suggestedWeight: 0.03,
  },
  {
    ticker: "035420",
    name: "NAVER",
    sector: "인터넷플랫폼",
    bucket: "long",
    rank: 8,
    compositeScore: 80,
    trendScore: 78,
    momentumScore: 72,
    volatilityScore: 85,
    signalLabel: "턴어라운드",
    deltaStatus: "hold",
    deltaReason: "광고 회복·m60 턴어라운드 초입",
    summary3Line:
      "광고·커머스 매출 회복 국면.\nAI 검색 Cue: 전면 개편 반영.\nm60 턴어라운드 초입.",
    suggestedWeight: 0.02,
  },
  {
    ticker: "005490",
    name: "POSCO홀딩스",
    sector: "철강",
    bucket: "long",
    rank: 7,
    compositeScore: 82,
    trendScore: 80,
    momentumScore: 75,
    volatilityScore: 82,
    signalLabel: "모멘텀+Quality",
    deltaStatus: "hold",
    deltaReason: "철강 반등·리튬 수직계열화",
    summary3Line:
      "철강 가격 반등·중국 감산 수혜.\n리튬 수직계열화 장기 그림.\nQuality·모멘텀 복합 우위.",
    suggestedWeight: 0.025,
  },
  {
    ticker: "012330",
    name: "현대모비스",
    sector: "자동차부품",
    bucket: "long",
    rank: 6,
    compositeScore: 83,
    trendScore: 80,
    momentumScore: 72,
    volatilityScore: 90,
    signalLabel: "Quality+안정 모멘텀",
    deltaStatus: "hold",
    deltaReason: "전동화 성장·자사주 매입 지속",
    summary3Line:
      "전동화 부품·HEV 수혜 지속.\n자사주 매입·소각 주주환원.\n낮은 vol + 안정 모멘텀.",
    suggestedWeight: 0.025,
  },
  {
    ticker: "055550",
    name: "신한지주",
    sector: "금융",
    bucket: "long",
    rank: 5,
    compositeScore: 84,
    trendScore: 82,
    momentumScore: 70,
    volatilityScore: 92,
    signalLabel: "배당+밸류업",
    deltaStatus: "hold",
    deltaReason: "주주환원율 20%+ 밸류업 수혜",
    summary3Line:
      "밸류업 대응 자사주 매입 본격화.\n배당 + 주주환원율 20% 초과.\n금리 안정화 구간 Quality 우수.",
    suggestedWeight: 0.03,
  },
  {
    ticker: "033780",
    name: "KT&G",
    sector: "소비재",
    bucket: "long",
    rank: 9,
    compositeScore: 80,
    trendScore: 78,
    momentumScore: 65,
    volatilityScore: 95,
    signalLabel: "방어+배당",
    deltaStatus: "hold",
    deltaReason: "글로벌 NGP·고배당 방어주",
    summary3Line:
      "글로벌 NGP 성장 지속.\n고배당 + 방어주 성격.\nm60 견고·변동성 최저 구간.",
    suggestedWeight: 0.025,
  },

  // ─────────────────────────────────────────── 🟨 중기 (mid) 10종
  {
    ticker: "012450",
    name: "한화에어로스페이스",
    sector: "방산",
    bucket: "mid",
    rank: 1,
    compositeScore: 92,
    trendScore: 90,
    momentumScore: 92,
    volatilityScore: 75,
    signalLabel: "방산 슈퍼사이클",
    deltaStatus: "hold",
    deltaReason: "폴란드·중동 수출 파이프 확대",
    summary3Line:
      "폴란드·중동 수출 파이프 지속.\n방산 슈퍼사이클 주도주.\nm20·m60 우상향 견고.",
    suggestedWeight: 0.05,
  },
  {
    ticker: "329180",
    name: "HD현대중공업",
    sector: "조선",
    bucket: "mid",
    rank: 2,
    compositeScore: 90,
    trendScore: 88,
    momentumScore: 88,
    volatilityScore: 78,
    signalLabel: "조선 슈퍼사이클",
    deltaStatus: "hold",
    deltaReason: "LNG선·특수선 수주 잔고 역대급",
    summary3Line:
      "LNG선·특수선 수주 잔고 역대급.\n조선 슈퍼사이클 중기 구간.\n모멘텀+Quality 균형.",
    suggestedWeight: 0.045,
  },
  {
    ticker: "042660",
    name: "한화오션",
    sector: "조선",
    bucket: "mid",
    rank: 4,
    compositeScore: 88,
    trendScore: 85,
    momentumScore: 88,
    volatilityScore: 72,
    signalLabel: "조선 모멘텀",
    deltaStatus: "hold",
    deltaReason: "미국 MRO·고마진 특수선 점화",
    summary3Line:
      "미국 MRO 진출 본격화.\n고마진 특수선 수주 증가.\n중기 모멘텀 점화 국면.",
    suggestedWeight: 0.045,
  },
  {
    ticker: "034020",
    name: "두산에너빌리티",
    sector: "원전",
    bucket: "mid",
    rank: 5,
    compositeScore: 87,
    trendScore: 85,
    momentumScore: 85,
    volatilityScore: 75,
    signalLabel: "원전 모멘텀",
    deltaStatus: "hold",
    deltaReason: "SMR·대형 원전 수주 기대 지속",
    summary3Line:
      "SMR·대형 원전 수주 기대.\n원전 르네상스 테마 지속.\nm60 상위·변동성 다소 높음.",
    suggestedWeight: 0.04,
  },
  {
    ticker: "267260",
    name: "HD현대일렉트릭",
    sector: "전력기기",
    bucket: "mid",
    rank: 3,
    compositeScore: 89,
    trendScore: 88,
    momentumScore: 90,
    volatilityScore: 68,
    signalLabel: "전력기기 모멘텀",
    deltaStatus: "hold",
    deltaReason: "북미 송배전 수요·실적 연속 서프",
    summary3Line:
      "북미 송배전 설비 수요 급증.\n실적 서프라이즈 연속 발표.\n변동성 있으나 Quality 우수.",
    suggestedWeight: 0.045,
  },
  {
    ticker: "028260",
    name: "삼성물산",
    sector: "지주/건설",
    bucket: "mid",
    rank: 8,
    compositeScore: 82,
    trendScore: 80,
    momentumScore: 72,
    volatilityScore: 90,
    signalLabel: "밸류업+Quality",
    deltaStatus: "hold",
    deltaReason: "바이오 지분가치+밸류업 수혜",
    summary3Line:
      "바이오 지분가치+지주 디스카운트 해소.\n밸류업 최대 수혜 지속.\n저변동성·중기 모멘텀 양호.",
    suggestedWeight: 0.035,
  },
  {
    ticker: "068270",
    name: "셀트리온",
    sector: "바이오",
    bucket: "mid",
    rank: 9,
    compositeScore: 80,
    trendScore: 75,
    momentumScore: 78,
    volatilityScore: 78,
    signalLabel: "턴어라운드",
    deltaStatus: "hold",
    deltaReason: "짐펜트라 미국 침투 가시화",
    summary3Line:
      "짐펜트라 미국 침투 가시화.\n램시마SC·유플라이마 실적 기여.\nm20~m60 턴어라운드 구간.",
    suggestedWeight: 0.03,
  },
  {
    ticker: "006400",
    name: "삼성SDI",
    sector: "2차전지",
    bucket: "mid",
    rank: 10,
    compositeScore: 76,
    trendScore: 70,
    momentumScore: 72,
    volatilityScore: 75,
    signalLabel: "바닥 반전",
    deltaStatus: "hold",
    deltaReason: "GM 북미 합작 가동·업황 바닥",
    summary3Line:
      "GM 북미 합작 공장 본격 가동.\n2차전지 업황 바닥 형성.\n중기 모멘텀 전환 초입.",
    suggestedWeight: 0.03,
  },
  {
    ticker: "064350",
    name: "현대로템",
    sector: "방산",
    bucket: "mid",
    rank: 6,
    compositeScore: 86,
    trendScore: 85,
    momentumScore: 90,
    volatilityScore: 70,
    signalLabel: "방산 신규 편입",
    deltaStatus: "new",
    deltaReason: "K2 폴란드 2차 협상·중기 신규 편입",
    summary3Line:
      "K2 폴란드 2차 협상 진행.\n방산 중형주 수출 파이프라인.\nm5·m20 급등 모멘텀, 신규 편입.",
    suggestedWeight: 0.04,
  },
  {
    ticker: "010140",
    name: "삼성중공업",
    sector: "조선",
    bucket: "mid",
    rank: 7,
    compositeScore: 84,
    trendScore: 82,
    momentumScore: 85,
    volatilityScore: 72,
    signalLabel: "조선 신규 편입",
    deltaStatus: "new",
    deltaReason: "FLNG·해양플랜트 수주·조선 3사 동반",
    summary3Line:
      "FLNG·해양플랜트 수주 연속.\n조선 3사 중 레버리지 효과.\n중기 모멘텀 신규 편입.",
    suggestedWeight: 0.04,
  },

  // ─────────────────────────────────────────── 🟥 단기 (short) 10종
  {
    ticker: "196170",
    name: "알테오젠",
    sector: "바이오",
    bucket: "short",
    rank: 1,
    compositeScore: 95,
    trendScore: 92,
    momentumScore: 98,
    volatilityScore: 55,
    signalLabel: "바이오 급등",
    deltaStatus: "hold",
    deltaReason: "키트루다 SC 상용화 가시·KOSDAQ 1위",
    summary3Line:
      "머크 키트루다 SC 제형 상용화 가시.\nKOSDAQ 시총 1위 안정화.\nm5·m10 급등·거래량 집중.",
    suggestedWeight: 0.045,
  },
  {
    ticker: "247540",
    name: "에코프로비엠",
    sector: "2차전지",
    bucket: "short",
    rank: 9,
    compositeScore: 78,
    trendScore: 72,
    momentumScore: 82,
    volatilityScore: 50,
    signalLabel: "반등 시그널",
    deltaStatus: "hold",
    deltaReason: "양극재 판가 바닥·거래량 급증",
    summary3Line:
      "양극재 판가 바닥·재고 정상화.\n2차전지 단기 반등 시그널.\n거래량 급증, Crisis 경계 구간.",
    suggestedWeight: 0.02,
  },
  {
    ticker: "079550",
    name: "LIG넥스원",
    sector: "방산",
    bucket: "short",
    rank: 2,
    compositeScore: 90,
    trendScore: 88,
    momentumScore: 92,
    volatilityScore: 65,
    signalLabel: "방산 탄력",
    deltaStatus: "hold",
    deltaReason: "천궁-II 수출 파이프 확대",
    summary3Line:
      "천궁-II 수출 파이프라인 확대.\n방산 단기 탄력 구간.\nm5·m10 모멘텀 상위.",
    suggestedWeight: 0.04,
  },
  {
    ticker: "352820",
    name: "하이브",
    sector: "엔터",
    bucket: "short",
    rank: 6,
    compositeScore: 85,
    trendScore: 82,
    momentumScore: 88,
    volatilityScore: 60,
    signalLabel: "K-pop 급등",
    deltaStatus: "new",
    deltaReason: "BTS 완전체 복귀·뉴진스 정상화",
    summary3Line:
      "BTS 완전체 복귀·뉴진스 정상화.\nK-pop 섹터 회복 주도.\n신규 편입·m10 급등.",
    suggestedWeight: 0.03,
  },
  {
    ticker: "035900",
    name: "JYP Ent.",
    sector: "엔터",
    bucket: "short",
    rank: 7,
    compositeScore: 82,
    trendScore: 80,
    momentumScore: 85,
    volatilityScore: 62,
    signalLabel: "K-pop 모멘텀",
    deltaStatus: "hold",
    deltaReason: "일본·미국 신인 데뷔 연속",
    summary3Line:
      "일본·미국 신인 데뷔 연속.\nKOSDAQ 엔터 단기 모멘텀.\nm5·m20 양호.",
    suggestedWeight: 0.025,
  },
  {
    ticker: "058470",
    name: "리노공업",
    sector: "반도체부품",
    bucket: "short",
    rank: 3,
    compositeScore: 88,
    trendScore: 85,
    momentumScore: 88,
    volatilityScore: 70,
    signalLabel: "반도체 부품 탄력",
    deltaStatus: "hold",
    deltaReason: "테스트 소켓 AI 반도체 수혜",
    summary3Line:
      "테스트 소켓 AI 반도체 수혜.\n고Quality 중소형 성장주.\nm5·m10 우위 유지.",
    suggestedWeight: 0.035,
  },
  {
    ticker: "214150",
    name: "클래시스",
    sector: "의료기기",
    bucket: "short",
    rank: 5,
    compositeScore: 86,
    trendScore: 85,
    momentumScore: 85,
    volatilityScore: 68,
    signalLabel: "의료기기 급등",
    deltaStatus: "hold",
    deltaReason: "슈링크 유니버스 글로벌 침투",
    summary3Line:
      "슈링크 유니버스 글로벌 침투.\n실적 서프라이즈 연속 발표.\nm20 상위·변동성 적정.",
    suggestedWeight: 0.03,
  },
  {
    ticker: "278280",
    name: "천보",
    sector: "2차전지소재",
    bucket: "short",
    rank: 10,
    compositeScore: 72,
    trendScore: 68,
    momentumScore: 78,
    volatilityScore: 48,
    signalLabel: "2차전지 반전",
    deltaStatus: "new",
    deltaReason: "리튬염 바닥·전해질 수요 회복",
    summary3Line:
      "리튬염 가격 바닥·전해질 수요 회복.\n2차전지 단기 반전 초기 시그널.\n신규 편입, Crisis 0.48 경계.",
    suggestedWeight: 0.015,
  },
  {
    ticker: "278470",
    name: "에이피알",
    sector: "뷰티",
    bucket: "short",
    rank: 4,
    compositeScore: 87,
    trendScore: 85,
    momentumScore: 92,
    volatilityScore: 55,
    signalLabel: "뷰티 급등",
    deltaStatus: "hold",
    deltaReason: "미국 아마존 Top seller 실적",
    summary3Line:
      "미국 아마존 Top seller 실적.\n상장 이후 강한 추세 유지.\nm5·m10 급등, 변동성 유의.",
    suggestedWeight: 0.035,
  },
  {
    ticker: "251270",
    name: "넷마블",
    sector: "게임",
    bucket: "short",
    rank: 8,
    compositeScore: 80,
    trendScore: 78,
    momentumScore: 82,
    volatilityScore: 62,
    signalLabel: "게임 탄력",
    deltaStatus: "hold",
    deltaReason: "나혼자만 레벨업 매출 지속",
    summary3Line:
      "나혼자만 레벨업 매출 지속.\n차기작 파이프라인 회복.\n단기 모멘텀 탄력 구간.",
    suggestedWeight: 0.025,
  },

  // ─────────────────────────────────────────── ⬛ REMOVED (전월 포함, 이번 달 제외) 3종
  {
    ticker: "035720",
    name: "카카오",
    sector: "인터넷플랫폼",
    bucket: "long",
    rank: 99,
    compositeScore: 72,
    trendScore: 70,
    momentumScore: 62,
    volatilityScore: 85,
    signalLabel: "플랫폼 약세",
    deltaStatus: "removed",
    deltaReason: "m20·m60 음전환·Composite 72, 장기 제외",
    summary3Line:
      "플랫폼 섹터 약세 지속.\nm20·m60 음전환 확정.\n전월 대비 Short List 제외.",
    suggestedWeight: 0,
  },
  {
    ticker: "011200",
    name: "HMM",
    sector: "해운",
    bucket: "mid",
    rank: 99,
    compositeScore: 70,
    trendScore: 65,
    momentumScore: 60,
    volatilityScore: 75,
    signalLabel: "해운 조정",
    deltaStatus: "removed",
    deltaReason: "운임 조정·m20 하락 전환, 중기 제외",
    summary3Line:
      "해운 단기 피크아웃 시그널.\n운임 조정·m20 하락 전환.\n전월 대비 Short List 제외.",
    suggestedWeight: 0,
  },
  {
    ticker: "105560",
    name: "KB금융",
    sector: "금융",
    bucket: "long",
    rank: 99,
    compositeScore: 73,
    trendScore: 75,
    momentumScore: 65,
    volatilityScore: 88,
    signalLabel: "금융 교체",
    deltaStatus: "removed",
    deltaReason: "밸류업 피크 아웃·신한지주로 대표 교체",
    summary3Line:
      "밸류업 피크 아웃 시그널.\n신한지주로 금융주 대표 교체.\n전월 대비 Short List 제외.",
    suggestedWeight: 0,
  },
];

// m60 괴리율·7일 스파크라인은 점수에서 결정적으로 유도 (mock 표시 전용).
// 실데이터 전환(S5 M10) 시 pykrx 실가격으로 자연 대체.
function deriveVisual(row: SeedRow): {
  divergencePct: number;
  sparkline7d: number[];
} {
  const { trendScore, momentumScore, volatilityScore, deltaStatus } = row;

  // REMOVED는 음(-) 괴리, 그 외는 trend·momentum 기반 양(+) 괴리
  const divergenceRaw =
    deltaStatus === "removed"
      ? -((100 - momentumScore) * 0.08 + 1)
      : (trendScore - 60) * 0.14 + (momentumScore - 70) * 0.06;
  const divergencePct = Math.round(divergenceRaw * 10) / 10;

  // 7일 종가: 모멘텀이 슬로프, (100-vol)이 진폭
  const slope = (momentumScore - 70) / 30; // ≈ [-2.3, +1.0]
  const amp = Math.max(0.3, (100 - volatilityScore) / 25);
  const seed = trendScore * 31 + momentumScore * 17 + volatilityScore * 7;
  const base = 100;
  const sparkline7d = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const wiggle = Math.sin(seed * 0.013 + i * 1.1) * amp;
    const value = base + slope * 3 * t + wiggle;
    return Math.round(value * 100) / 100;
  });

  return { divergencePct, sparkline7d };
}

export const MOCK_ADMIN_SHORTLIST: ShortListItem[] = SEED.map((row) => ({
  id: `sl-${MONTH}-${row.ticker}`,
  month: MONTH,
  createdAt: CREATED_AT,
  ...row,
  ...deriveVisual(row),
}));

// Delta 뷰 집계 (M5 배너) — 홈에서 한 번 더 reduce 하는 대신 export
export const MOCK_ADMIN_SHORTLIST_DELTA = {
  month: MONTH,
  newCount: MOCK_ADMIN_SHORTLIST.filter((r) => r.deltaStatus === "new").length,
  holdCount: MOCK_ADMIN_SHORTLIST.filter((r) => r.deltaStatus === "hold").length,
  removedCount: MOCK_ADMIN_SHORTLIST.filter((r) => r.deltaStatus === "removed").length,
};
