import type { NewsEvent, Severity } from "@/types/admin";

// ---------------------------------------------------------------------------
// 뉴스 심각도 분류기 (M12, S5a T5a.3)
// ref: ServicePlan-Admin §3.10 R3.10-1~3
//
// 3티어 분류: Critical / Warning / Info (+ 근거 1줄).
// 규칙 기반 MVP — GPT 프롬프트는 S5 실데이터 연결 시 compose 로직에 끼워 넣음.
//   · Critical: Exit 트리거 키워드(실적 쇼크, 경영진 부정, 규제 현실화, 매크로 충격)
//   · Warning : 전망 하향 / 지연 / 외국인 수급 경고 / 지분 이벤트
//   · Info    : 기타 일반 보도
// 동일 title+source pair 존재 시 fetchedAt 갱신만(중복 방지).
// ---------------------------------------------------------------------------

export interface NewsCandidate {
  ticker: string | null;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface ClassificationResult {
  severity: Severity;
  reason: string;
}

interface RuleMatcher {
  pattern: RegExp;
  severity: Severity;
  reason: string;
}

// 순서대로 평가. 첫 매칭 규칙이 결과가 됨.
const RULES: RuleMatcher[] = [
  // ── Critical ──────────────────────────────────────────────────────────────
  {
    pattern: /(가동\s*지연|공장\s*지연|파운드리\s*지연)/,
    severity: "critical",
    reason: "핵심 사업 지연 — Exit 트리거 매칭",
  },
  {
    pattern: /(부적절\s*발언|횡령|분식|배임|내부자\s*거래)/,
    severity: "critical",
    reason: "경영진 부정 키워드 — 신뢰도 하락 트리거",
  },
  {
    pattern: /(과징금|제재|행정처분|영업정지)/,
    severity: "critical",
    reason: "규제 리스크 현실화",
  },
  {
    pattern: /(연준|Fed|기준금리).*?(인상|인하)/,
    severity: "critical",
    reason: "매크로 방향 전환 — 시장 전체 영향",
  },
  {
    pattern: /(실적\s*쇼크|어닝\s*쇼크|대규모\s*손실)/,
    severity: "critical",
    reason: "실적 쇼크 — Exit 트리거 매칭",
  },
  // ── Warning ───────────────────────────────────────────────────────────────
  {
    pattern: /(전망\s*하향|가이던스\s*하향|하향\s*조정)/,
    severity: "warning",
    reason: "전망 하향 — 즉시성 낮음",
  },
  {
    pattern: /(재조정|연기|검토)/,
    severity: "warning",
    reason: "일정/계획 변경 — 중장기 영향",
  },
  {
    pattern: /외국인\s*.*순매도/,
    severity: "warning",
    reason: "매크로 수급 경고",
  },
  {
    pattern: /(리콜|FDA\s*심사)/,
    severity: "warning",
    reason: "규제/품질 지연 경고",
  },
  {
    pattern: /(스톡옵션|지분\s*변동|임원\s*매도)/,
    severity: "warning",
    reason: "거버넌스·지분 변동 경고",
  },
];

export function classifyNews(title: string): ClassificationResult {
  for (const rule of RULES) {
    if (rule.pattern.test(title)) {
      return { severity: rule.severity, reason: rule.reason };
    }
  }
  return { severity: "info", reason: "중립 — 일반 이벤트" };
}

// 후보 → NewsEvent 구조로 변환. id는 호출자가 생성(UUID/seed 등).
export function toNewsEvent(
  candidate: NewsCandidate,
  id: string,
  classification: ClassificationResult = classifyNews(candidate.title),
): NewsEvent {
  return {
    id,
    ticker: candidate.ticker,
    severity: classification.severity,
    title: candidate.title,
    source: candidate.source,
    url: candidate.url,
    publishedAt: candidate.publishedAt,
    fetchedAt: new Date().toISOString(),
    classificationReason: classification.reason,
  };
}

// 동일 URL 기준 dedupe — news_event UNIQUE(url) 제약 매칭.
export function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}
