import type { AlertEvent } from "@/types/admin";

// MVP용 mock — S5 실데이터 연결 시 alert_event 테이블 SELECT로 교체.
// S5a에서 news_critical·scheduler_fail·briefing_failed 샘플 추가 (M12·M18·M11 연계).
// S5b에서 exit_signal·price_anomaly 샘플 추가 예정.

export const MOCK_ADMIN_ALERTS: AlertEvent[] = [
  // news_critical — M12 Critical 분류 시 즉시 발행
  {
    id: "alert-nc-001",
    alertType: "news_critical",
    ticker: "005930",
    severity: "critical",
    triggerReason:
      "삼성전자 美 파운드리 가동 지연 — Exit 트리거 매칭 (연합뉴스 08:12)",
    signalSentAt: "2026-04-19T08:15:30+09:00",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: false,
  },
  {
    id: "alert-nc-002",
    alertType: "news_critical",
    ticker: "000660",
    severity: "critical",
    triggerReason:
      "SK하이닉스 CFO 부적절 발언 — 경영진 부정 키워드 (매일경제 07:45)",
    signalSentAt: "2026-04-19T07:50:12+09:00",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: true,
  },
  {
    id: "alert-nc-003",
    alertType: "news_critical",
    ticker: null,
    severity: "critical",
    triggerReason: "美 연준 50bp 인상 시그널 — 매크로 방향 전환 (한국경제 06:20)",
    signalSentAt: "2026-04-19T06:25:48+09:00",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: true,
  },
  {
    id: "alert-nc-004",
    alertType: "news_critical",
    ticker: "035420",
    severity: "critical",
    triggerReason:
      "NAVER 공정위 과징금 3,200억 — 규제 리스크 현실화 (조선비즈 18:40)",
    signalSentAt: "2026-04-18T18:45:02+09:00",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: true,
  },
  // scheduler_fail — M10 배치 3회 재시도 실패
  {
    id: "alert-sf-001",
    alertType: "scheduler_fail",
    ticker: null,
    severity: "critical",
    triggerReason:
      "월간 배치 3회 재시도 실패 (2026-04-01 00:05 KST · DART API 응답 없음). 전월 유지 + 수동 트리거 대기.",
    signalSentAt: "2026-04-01T00:05:30+09:00",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: true,
  },
  // briefing_failed — M11 브리핑 생성 실패 (ai 파이프라인 타임아웃)
  {
    id: "alert-bf-001",
    alertType: "briefing_failed",
    ticker: null,
    severity: "warning",
    triggerReason:
      "모닝 브리핑 생성 실패 (2026-04-17 08:00 KST · GPT-4 타임아웃 3회). dashboard 배지 노출.",
    signalSentAt: "2026-04-17T08:03:10+09:00",
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
    isRead: true,
  },
];
