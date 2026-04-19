import type { BriefingLog } from "@/types/admin";

// MVP용 mock — S5 M11 08:00 KST 배치 생성으로 교체. E7 BriefingLog (briefing_log 테이블).
// 최근 5일치 샘플. generationFailed 1건 포함(2026-04-17).

export const MOCK_ADMIN_BRIEFINGS: BriefingLog[] = [
  {
    id: "bf-20260419",
    date: "2026-04-19",
    contentSummary:
      "어제 포트 +0.42% (KOSPI +0.18%, alpha +0.24pp). 주의 종목 2건: 삼성전자(-1.2% · 실적 발표 전 변동성), NAVER(공정위 과징금 확정). 핵심 뉴스 3건: ① 연준 50bp 인상 시그널(매크로), ② 삼성 파운드리 지연(005930 Critical), ③ NAVER 과징금 3,200억(035420 Critical).",
    generatedAt: "2026-04-19T08:00:05+09:00",
    sentChannels: ["telegram", "email", "dashboard"],
    viewEvents: [
      {
        adminId: "mock-admin-1",
        channel: "dashboard",
        viewedAt: "2026-04-19T08:04:21+09:00",
      },
      {
        adminId: "mock-admin-2",
        channel: "telegram",
        viewedAt: "2026-04-19T08:11:52+09:00",
      },
    ],
    generationFailed: false,
  },
  {
    id: "bf-20260418",
    date: "2026-04-18",
    contentSummary:
      "어제 포트 -0.08% (KOSPI +0.21%, alpha -0.29pp). 주의 종목 1건: 셀트리온(FDA 추가 심사 요청). 핵심 뉴스 3건: ① 외국인 4일 연속 순매도, ② 현대차 EV 리콜 확대 검토, ③ 카카오 임원 스톡옵션.",
    generatedAt: "2026-04-18T08:00:07+09:00",
    sentChannels: ["telegram", "email", "dashboard"],
    viewEvents: [
      {
        adminId: "mock-admin-1",
        channel: "email",
        viewedAt: "2026-04-18T08:20:11+09:00",
      },
    ],
    generationFailed: false,
  },
  {
    id: "bf-20260417",
    date: "2026-04-17",
    contentSummary:
      "[생성 실패] briefing_compose 단계에서 GPT-4 API 타임아웃 (3회 재시도 실패). /admin/settings/health에서 ai 파이프라인 상태 확인.",
    generatedAt: "2026-04-17T08:00:00+09:00",
    sentChannels: [],
    viewEvents: [],
    generationFailed: true,
  },
  {
    id: "bf-20260416",
    date: "2026-04-16",
    contentSummary:
      "어제 포트 +1.15% (KOSPI +0.62%, alpha +0.53pp). 주의 종목 0건. 핵심 뉴스 3건: ① KOSPI 2,480 돌파, ② LG엔솔 폴란드 공장 안전 점검 완료, ③ 현대차 1분기 국내 판매 소폭 증가.",
    generatedAt: "2026-04-16T08:00:03+09:00",
    sentChannels: ["telegram", "email", "dashboard"],
    viewEvents: [
      {
        adminId: "mock-admin-1",
        channel: "dashboard",
        viewedAt: "2026-04-16T08:05:40+09:00",
      },
      {
        adminId: "mock-admin-2",
        channel: "dashboard",
        viewedAt: "2026-04-16T08:07:12+09:00",
      },
      {
        adminId: "mock-admin-3",
        channel: "telegram",
        viewedAt: "2026-04-16T08:40:05+09:00",
      },
    ],
    generationFailed: false,
  },
  {
    id: "bf-20260415",
    date: "2026-04-15",
    contentSummary:
      "어제 포트 +0.31% (KOSPI +0.44%, alpha -0.13pp). 주의 종목 1건: SK하이닉스(세미나 후원 뉴스 중립). 핵심 뉴스 3건: ① 셀트리온 R&D 확대, ② 삼성바이오로직스 ESG A등급, ③ LG엔솔 폴란드 공장 업데이트.",
    generatedAt: "2026-04-15T08:00:02+09:00",
    sentChannels: ["telegram", "email", "dashboard"],
    viewEvents: [
      {
        adminId: "mock-admin-1",
        channel: "email",
        viewedAt: "2026-04-15T09:10:00+09:00",
      },
    ],
    generationFailed: false,
  },
];

export const LATEST_BRIEFING: BriefingLog | undefined = MOCK_ADMIN_BRIEFINGS[0];
