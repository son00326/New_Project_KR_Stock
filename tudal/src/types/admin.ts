// 주픽 어드민 서비스 전용 도메인 타입 (S0 T0.7)
// 출처: Document/Service/Planning/ServicePlan-Admin.md §4.2 (E1~E9)
// 주의: subscription/tier 개념 없음. 멤버 페이지 타입은 별도 파일로 분리.

// ---------------------------------------------------------------------------
// 공용 enum·유틸 타입
// ---------------------------------------------------------------------------

export type BucketKind = "short" | "mid" | "long";
export type DeltaStatus = "new" | "hold" | "removed";
export type PersonaLayer = "core" | "sector";
export type VoteKind = "approve" | "reject" | "abstain";
export type ApprovalType = "accept" | "reject";
export type AlertType =
  | "exit_signal"
  | "news_critical"
  | "news_warning" // S5a M12: Warning 티어 뉴스 (즉시 알림 X, /admin/alerts 대시보드만)
  | "price_anomaly"
  | "intraday_anomaly" // S5b M13: 장중 ±5%/거래량 3배 감지
  | "briefing"
  | "briefing_failed" // S5a M11: 브리핑 생성 실패 시 어드민 대시보드 배지
  | "scheduler_fail"
  | "gating_auto_relief" // S3 BL-20 A: 7일 연속 단일 접속 감지 시 자동 바이패스 로그
  | "cost_warning" // S6 M17: 35만 경보 (40만 hardcap 직전)
  | "cost_hardcap" // S6 M17: 40만 hardcap 도달 시 재생성 차단 로그
  | "heartbeat_missing"; // S6 M19: 일간 하트비트 2채널 모두 발송 실패 (D10 catch-up 후)
export type Severity = "critical" | "warning" | "info";
export type ExitDecision = "sell_all" | "partial_sell" | "hold";
export type BrokerageScope = "manual" | "auto" | "both";

// ---------------------------------------------------------------------------
// E1. ShortList30 — 월간 Short List
// ---------------------------------------------------------------------------
export interface ShortListItem {
  id: string;
  month: string; // YYYY-MM-01
  ticker: string;
  name: string;
  sector: string;
  bucket: BucketKind;
  rank: number;
  compositeScore: number;
  trendScore: number;
  momentumScore: number;
  volatilityScore: number; // 낮을수록 실제 변동성↑ (Crisis 경보는 <60)
  divergencePct: number; // m60 이동평균 대비 괴리율 (%)
  sparkline7d: number[]; // 최근 7 거래일 종가 (길이 7)
  signalLabel: string;
  deltaStatus: DeltaStatus;
  deltaReason: string;
  summary3Line: string;
  suggestedWeight: number;
  createdAt: string;
}

// M1/M4/M6 UI 파생 상수
export const CRISIS_VOL_THRESHOLD = 60; // volatilityScore 미만 → Crisis 배지
export const SHORTLIST_TARGET_COUNT = 30;

// T1.6 30종 미달 원인 구분
export type ShortageReason = "screening" | "scheduler_fail" | "none";

// ---------------------------------------------------------------------------
// E2. StockReport — 종목 풀 리포트 (jsonb sections)
// ---------------------------------------------------------------------------
export interface StockReportSections {
  section_0?: unknown; // 투자 요약 + Conviction + 투심위 미니바
  section_1?: unknown; // 기업 개요
  section_2?: unknown; // 재무 분석
  section_3?: unknown; // 밸류에이션
  section_4?: unknown; // 성장성
  section_5?: unknown; // 리스크
  section_6?: unknown; // 모멘텀 (5-Signal + 3축)
  section_7?: unknown; // Exit 조건
  section_8?: unknown; // 최종 의견 + 투심위 투표 요약
  appendix?: unknown;
}

export interface StockReport extends StockReportSections {
  id: string;
  ticker: string;
  month: string;
  version: number;
  schemaVersion: number;
  isLatest: boolean;
  regenAutoCount: number; // ≤ 1
  regenManualCount: number; // ≤ 2
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// E3. CommitteeVote — 투심위 투표 기록
// ---------------------------------------------------------------------------
export interface CommitteeVote {
  id: string;
  reportId: string;
  personaId: string;
  personaLayer: PersonaLayer;
  sector?: string; // sector layer만
  vote: VoteKind;
  argumentExcerpt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// E4. PortfolioApproval — 승인 이벤트 (D15 게이팅 필드 포함)
// v1.2 (2026-04-17 S2 [G-5] B): reportViewCount 제거. 2인 열람 게이팅은 E10
// ReportViewLog에서 `COUNT(DISTINCT admin_id)` 집계로 판정.
// v1.3 (2026-04-17 S3 BL-7·BL-20·T3.4):
//   + disputeReason (min 20자) · disputeRaisedBy
//   + gatingAutoReliefActive (7일 연속 단일 접속 자동 바이패스)
//   + reanalysisCount (≤ 1: Reject 후 재분석 1회)
// ---------------------------------------------------------------------------
export interface PortfolioApproval {
  id: string;
  month: string;
  adminId: string;
  approvalType: ApprovalType;
  approvedAt: string;
  isFinal: boolean; // 월당 1건만 true
  prevPortfolioHeld: boolean;
  shortlistGeneratedAt: string; // D15 R3.3-7 24h Hold 계산 기준
  disputeRaisedAt: string | null;
  disputeRaisedBy: string | null; // BL-7 A
  disputeReason: string | null; // BL-7 A: 자유 텍스트 min 20자
  disputeResolvedAt: string | null;
  gatingAutoReliefActive: boolean; // BL-20 A
  reanalysisCount: number; // T3.4: ≤ 1
}

// S3 이의 제기 사유 최소 길이 (BL-7 A)
export const DISPUTE_REASON_MIN_LENGTH = 20;

// ---------------------------------------------------------------------------
// E5. PortfolioSnapshot — 가상 포트 일별 스냅샷 (D11: 가상 트래킹 전용)
// ---------------------------------------------------------------------------
export interface PortfolioSnapshot {
  id: string;
  date: string;
  month: string;
  ticker: string | null; // null = 포트 전체 행
  entryPrice: number;
  currentPrice: number;
  weight: number;
  isCash: boolean;
  dailyReturn: number;
  totalReturn: number;
  kospiReturn: number;
  alpha: number;
  sharpe: number;
}

// ---------------------------------------------------------------------------
// E6. AlertEvent — 알림 이벤트
// ---------------------------------------------------------------------------
export interface AlertEvent {
  id: string;
  alertType: AlertType;
  ticker: string | null;
  severity: Severity;
  triggerReason: string;
  signalSentAt: string;
  outcomeAt: string | null; // T+7일 (exit_signal만)
  t7PriceChange: number | null; // IM-3 입력
  decisionRecorded: ExitDecision | null;
  decisionMemo: string | null;
  isRead: boolean;
}

// ---------------------------------------------------------------------------
// E7. BriefingLog — 모닝 브리핑 발송 기록
// ---------------------------------------------------------------------------
export interface BriefingLog {
  id: string;
  date: string;
  contentSummary: string;
  generatedAt: string;
  sentChannels: string[]; // telegram·dashboard 등
  viewEvents: BriefingViewEvent[]; // IM-4 참여율 측정
  generationFailed: boolean;
}

export interface BriefingViewEvent {
  adminId: string;
  channel: string;
  viewedAt: string;
}

// ---------------------------------------------------------------------------
// E8. RegenCounter — 재생성 카운터
// ---------------------------------------------------------------------------
export interface RegenCounter {
  id: string;
  ticker: string;
  month: string;
  autoCount: number; // ≤ 1
  manualCount: number; // ≤ 2
  resetAt: string; // 매월 1일 00:00 KST
}

// ---------------------------------------------------------------------------
// §S5a 신설 — pipeline_health (M18) · NewsEvent (M12)
// 0006_s5a_automation.sql 참조. ServicePlan-Admin §4.2 반영은 S6 문서 정비 시점.
// ---------------------------------------------------------------------------
export type PipelineKind = "dart" | "news" | "price" | "ai" | "alert";
export type PipelineStatus = "success" | "warning" | "failed";

export interface PipelineHealth {
  id: string;
  runId: string | null;
  pipeline: PipelineKind;
  status: PipelineStatus;
  startedAt: string;
  finishedAt: string | null;
  latencyMs: number | null;
  error: string | null;
}

// M18 집계 결과 — /admin/settings/health 카드 렌더용
export interface PipelineHealthSummary {
  pipeline: PipelineKind;
  total24h: number;
  success24h: number;
  failed24h: number;
  successRate: number; // 0~1
  avgLatencyMs: number | null;
  lastRun: PipelineHealth | null;
  severity: Severity; // successRate 기반 (<0.95 critical · <0.99 warning · >=0.99 info)
}

// M18 임계치 상수 (R3.12-4)
export const PIPELINE_HEALTH_CRITICAL_THRESHOLD = 0.95;
export const PIPELINE_HEALTH_WARNING_THRESHOLD = 0.99;
export const PIPELINE_HEALTH_WINDOW_HOURS = 24;

export interface NewsEvent {
  id: string;
  ticker: string | null; // null = 시장 전체
  severity: Severity;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  classificationReason: string | null;
}

// ---------------------------------------------------------------------------
// §S5b 신설 — M13 장중 이상 감지 + M14 종목 토글
// 0007_s5b_notifications.sql 참조.
// ---------------------------------------------------------------------------
export type IntradayTriggerType = "price_spike" | "price_drop" | "volume_spike";

export interface IntradayAnomalyEvent {
  id: string;
  ticker: string;
  triggerType: IntradayTriggerType;
  priceChangePct: number | null; // e.g., -5.23 = -5.23%
  volumeRatio: number | null; // e.g., 3.15 = 20일 평균 대비 3.15배
  lastPrice: number | null;
  detectedAt: string;
  dedupKey: string;
}

// M13 임계치 상수 (R3.10-8·R3.5-2)
export const INTRADAY_PRICE_SPIKE_THRESHOLD = 0.05; // ±5%
export const INTRADAY_VOLUME_MULTIPLIER_THRESHOLD = 3; // 20일 평균 × 3
export const INTRADAY_BADGE_RECENT_WINDOW_MS = 15 * 60 * 1000; // 최근 15분 내만 홈 배지 노출

// ---------------------------------------------------------------------------
// 어드민 설정 — 상시 모니터링 모드 등 (M13 gate)
// ---------------------------------------------------------------------------
export interface AdminSettings {
  adminId: string;
  intradayMode: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// M14 종목별 알림 토글 — admin × ticker
// enabled=false면 장중 이상 감지·news_critical 비즉시 경로 차단.
// Exit 시그널(§3.5 R3.5-5)은 이 토글과 무관하게 항상 발송.
// ---------------------------------------------------------------------------
export interface TickerAlertPref {
  id: string;
  adminId: string;
  ticker: string;
  enabled: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// E9. BrokerageConnection — 증권사/거래소 API 연결 (D12)
// D11·D12: §1A.0 매뉴얼·자동매매 실체결 레이어. 가상 포트(E5)와 분리.
// 보안: 본인 admin_id만 접근. api_key_ref는 Vault 참조 키만(평문 금지).
// ---------------------------------------------------------------------------
export interface BrokerageConnection {
  id: string;
  adminId: string;
  broker: string; // KIS·Kiwoom·Samsung·KB·Mirae·Upbit·Binance ...
  accountNo: string; // 마스킹: "12-***-5678"
  apiKeyRef: string; // Vault/Secrets 참조 키
  strategyLabel: string; // 자유 텍스트 ("단기 모멘텀" 등)
  scope: BrokerageScope;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

// ---------------------------------------------------------------------------
// E10. ReportViewLog — 리포트 열람 로그 (S2 [G-5] B, 2026-04-17 신설)
// D15 R3.3-8 2인 열람 게이팅을 `COUNT(DISTINCT admin_id)` 집계로 판정.
// UNIQUE(admin_id, report_id, view_date)로 1일 1회 dedupe (BL-5 B).
// ---------------------------------------------------------------------------
export interface ReportViewLog {
  id: string;
  adminId: string;
  reportId: string;
  viewDate: string; // YYYY-MM-DD (KST)
  viewedAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// §S6 신설 — M17 cost_log 확장 + M19 heartbeat_log
// 0008_s6_hardening.sql 참조. ServicePlan-Admin §4.2 반영은 추후 정비.
// ---------------------------------------------------------------------------

// CostLog (BL-16 A): Anthropic /messages 응답 usage 실시간 파싱 + per-persona/section 태깅
export type CostPurpose =
  | "shortlist" // 월간 Short List 30 선정
  | "report" // Section 0~8 본문 생성
  | "committee" // 투심위 페르소나 투표
  | "briefing" // 모닝 브리핑 요약
  | "regenerate" // 수동·자동 재생성
  | "other";

export interface CostLog {
  id: string;
  ts: string;
  month: string; // YYYY-MM-01
  model: string; // 'claude-opus-4-7' · 'claude-sonnet-4-6' 등
  purpose: CostPurpose;
  ticker: string | null; // briefing 등 종목 무관 시 null
  personaId: string | null; // committee 외 null
  section: string | null; // 'section_0'~'section_8'·'short_list'·'briefing' 등
  tokensPrompt: number;
  tokensCompletion: number;
  costKrw: number;
}

// M17 월간 집계 (R3.12-1)
export interface CostMonthlySummary {
  month: string;
  totalKrw: number;
  warningThresholdKrw: number; // 350,000
  hardcapKrw: number; // 400,000
  warningTriggered: boolean; // total >= 350,000
  hardcapTriggered: boolean; // total >= 400,000
  remainingKrw: number; // hardcap - total (음수 가능)
  byPurpose: Array<{ purpose: CostPurpose; costKrw: number; share: number }>; // share 0~1
  topContributors: Array<{
    label: string; // "report · 005930 · section_3" 등
    costKrw: number;
    tokensTotal: number;
  }>;
}

// M17 임계치 상수 (R3.12-1·R3.12-2)
export const COST_WARNING_THRESHOLD_KRW = 350_000;
export const COST_HARDCAP_KRW = 400_000;
export const COST_USD_TO_KRW = 1430; // BL-18 견적 환율 (보수적)

// HeartbeatLog (M19 R3.12-7~8)
export type HeartbeatStatus = "ok" | "red_alert";

export interface HeartbeatLog {
  id: string;
  date: string; // YYYY-MM-DD (KST)
  status: HeartbeatStatus;
  generatedAt: string;
  pipelineSummary: Array<{
    pipeline: PipelineKind;
    successRate: number;
    severity: Severity;
  }>;
  criticalAlertCount: number;
  warningAlertCount: number;
  sentChannels: string[]; // 'telegram'·'email'·'dashboard'
  sendFailed: boolean;
  message: string;
}

// M19 임계치 (R3.12-7) — red_alert 전환 조건
export const HEARTBEAT_RED_ALERT_CRITICAL_MIN = 1; // critical 1+ → red_alert
export const HEARTBEAT_RED_ALERT_WARNING_MIN = 5; // warning 5+ → red_alert
