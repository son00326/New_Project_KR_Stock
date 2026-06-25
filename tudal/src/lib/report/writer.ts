import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getPersonaById } from '@/lib/ai/prompts/personas';
import type { CallPersonaResult } from '@/lib/ai/anthropic-client';
import type { ConsensusBadge } from '@/lib/screening/consensus';
import {
  type CanonicalSector,
  SECTOR_PERSONA_COUNT,
  resolveSlotTemplate,
} from '@/lib/screening/canonical-sectors';
import type { Section8 } from './section-8-schema';

interface ParsedPersonaResponse {
  vote: 'BUY' | 'HOLD' | 'SELL';
  one_line: string;
  argument_excerpt: string;
}

function parseContent(content: string): ParsedPersonaResponse {
  try {
    const parsed = JSON.parse(content);
    return {
      vote: parsed.vote,
      one_line: parsed.one_line,
      argument_excerpt: parsed.argument_excerpt,
    };
  } catch {
    return { vote: 'HOLD', one_line: 'parse failed', argument_excerpt: content.slice(0, 200) };
  }
}

// ── B-PARTB: Section 8 Part B (쟁점) 실제 issue-extraction ─────────────────────
// SoT spec = docs/superpowers/specs/2026-06-25-section8-partB-issue-extraction.md (CONVERGED).
// 페르소나 11 응답(vote + one_line + argument_excerpt)에서 의견 대립이 큰 쟁점 3~5개를
// 결정론적 휴리스틱으로 추출 (LLM 추가 호출 없음 — pure builder). Date/random 미사용.
// 동일 입력 → deep-equal 출력.

// IssueDebateExcerpt 타입은 section-8-schema.ts issueDebateExcerptSchema z.infer 재사용 (재정의 금지).
type IssueDebateExcerpt = Section8['partB'][number];

// module-scope immutable 상수 (한 번만 정의, mutate 금지)
const VOTE_RANK: Record<'BUY' | 'HOLD' | 'SELL', number> = { BUY: 2, HOLD: 1, SELL: 0 };
const CAUTION_KEYWORDS = [
  '리스크', '우려', '다만', '그러나', '단서', '부담', '주의', '변동성', '둔화', '불확실', '하방', '약점',
] as const;
const CON_SENTINEL = '반대 의견 없음 (위원 의견 수렴)';
const ZERO_SENTINEL = '평가 데이터 부족 — 위원 응답 파싱/검증 실패';

// 테마 카탈로그 (고정 순서 = 결정론 우선순위). 매칭 = matchText.includes(keyword).
// keyword는 소문자, 모두 ≥2자 (한국어 substring 오탐 최소화). title은 curated → quote-safe 미적용.
const THEME_CATALOG: ReadonlyArray<{ title: string; keywords: readonly string[] }> = [
  { title: '밸류에이션', keywords: ['밸류', '가치평가', 'per', 'pbr', 'ev/', '고평가', '저평가', '비싸', '멀티플', '할인', '프리미엄', '목표주가', '적정주가', '주가수준'] },
  { title: '실적·성장 모멘텀', keywords: ['실적', '성장', '매출', '영업이익', '순이익', '모멘텀', '가이던스', '수주', '턴어라운드', '증익', '마진', '수익성', '흑자', '적자'] },
  { title: '재무 건전성', keywords: ['부채', '차입', '현금', '유동성', '재무', '자본', '잉여현금', 'fcf', '부채비율', '이자보상', '신용'] },
  { title: '사업 해자·경쟁력', keywords: ['해자', '경쟁', '점유율', '진입장벽', '독점', '과점', '기술력', '특허', '브랜드', '공급망', 'hbm', '지배력'] },
  { title: '성장 동력·혁신', keywords: ['혁신', '신사업', '신제품', 'tam', '시장확대', '디스럽션', '파괴적', '신약', '파이프라인', '플랫폼', '신기술'] },
  { title: '거버넌스·자본배분', keywords: ['경영진', '거버넌스', '지배구조', '배당', '자사주', '주주환원', '대주주', '오너', '자본배분', '인수', 'm&a'] },
  { title: '거시·리스크', keywords: ['거시', '매크로', '금리', '환율', '규제', '경기', '사이클', '변동성', '불확실', '리스크', '지정학', '수요둔화', '침체', '하방'] },
] as const;

interface UsablePersona {
  label: string;
  vote: 'BUY' | 'HOLD' | 'SELL';
  voteRank: number;
  oneLine: string;       // trimmed, quote-safe, non-empty
  matchText: string;     // (oneLine + ' ' + argument).toLowerCase() — 테마 매칭 전용
  oneLineLower: string;  // oneLine.toLowerCase() — caution 판정 전용
  idx: number;           // personaIds 내 위치 = 결정론 tie-break 키
}

// JSON/stub 누출 방지. one_line만 인용으로 노출되므로 JSON-ish/stub 토큰을 배제.
function isQuoteSafe(s: string): boolean {
  const t = s.trim();
  return (
    !s.includes('{') &&
    !s.includes('"vote"') &&
    !s.includes('"one_line"') &&
    t.toLowerCase() !== 'stub'
  );
}

// strict validation — lenient parseContent에 의존하지 않음 (vote/타입 미검증이라 부적합).
// usable이 아닌 응답은 인용 후보에서 완전 제외 → raw JSON/stub 누출 원천 차단.
function buildUsablePersonas(
  personaResults: CallPersonaResult[],
  personaIds: string[],
): UsablePersona[] {
  const usable: UsablePersona[] = [];
  for (let i = 0; i < personaResults.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(personaResults[i].content);
    } catch {
      continue;
    }
    if (parsed === null || typeof parsed !== 'object') continue;
    const record = parsed as Record<string, unknown>;
    const vote = record.vote;
    if (vote !== 'BUY' && vote !== 'HOLD' && vote !== 'SELL') continue;
    const ol = record.one_line;
    if (typeof ol !== 'string') continue; // non-string ⇒ unusable, .trim()/.toLowerCase() 미호출
    const oneLine = ol.trim();
    if (oneLine.length === 0) continue; // whitespace-only ⇒ unusable
    if (!isQuoteSafe(oneLine)) continue; // JSON/stub 누출 가드
    const ax = record.argument_excerpt;
    const argument = typeof ax === 'string' ? ax.trim() : ''; // 비-string ⇒ '' (테마 매칭 전용)
    const label = getPersonaById(personaIds[i])?.label ?? personaIds[i];
    usable.push({
      label,
      vote,
      voteRank: VOTE_RANK[vote],
      oneLine,
      matchText: `${oneLine} ${argument}`.toLowerCase(),
      oneLineLower: oneLine.toLowerCase(),
      idx: i,
    });
  }
  return usable;
}

function oneLineHasCaution(p: UsablePersona): boolean {
  return CAUTION_KEYWORDS.some((kw) => p.oneLineLower.includes(kw));
}

function matchersForTheme(usable: UsablePersona[], themeIdx: number): UsablePersona[] {
  const kws = THEME_CATALOG[themeIdx].keywords;
  return usable.filter((p) => kws.some((kw) => p.matchText.includes(kw)));
}

function quote(p: UsablePersona): string {
  return `${p.label}: ${p.oneLine}`;
}

// pro = voteRank 최대 (가장 강세). tie → idx 오름차순.
function pickPro(matchers: UsablePersona[]): UsablePersona {
  let best = matchers[0];
  for (const p of matchers) {
    if (p.voteRank > best.voteRank || (p.voteRank === best.voteRank && p.idx < best.idx)) {
      best = p;
    }
  }
  return best;
}

// con (Tier-1 polarity) = voteRank 최소. tie → idx 내림차순 (pro와 다른 페르소나 우선).
// pro≠con은 호출부 clash=-1 가드가 구조적으로 보장 (단일 matcher 테마는 Tier-1 탈락).
function pickConTier1(matchers: UsablePersona[]): UsablePersona {
  let worst = matchers[0];
  for (const p of matchers) {
    if (p.voteRank < worst.voteRank || (p.voteRank === worst.voteRank && p.idx > worst.idx)) {
      worst = p;
    }
  }
  return worst;
}

// con (Tier-2/Tier-3 fallback) = quote 문자열 반환 (페르소나 아님 — pro 재사용 사고 차단).
//   ① pro보다 엄격히 낮은 voteRank matcher (idx asc) → quote
//   ② else one_line에 caution 키워드 포함한 다른 matcher (idx asc) → quote
//   ③ else CON_SENTINEL
function pickConFallback(matchers: UsablePersona[], pro: UsablePersona): string {
  const notPro = matchers.filter((p) => p.idx !== pro.idx);
  const lower = notPro
    .filter((p) => p.voteRank < pro.voteRank)
    .sort((a, b) => a.idx - b.idx);
  if (lower.length > 0) return quote(lower[0]);
  const caution = notPro
    .filter((p) => oneLineHasCaution(p))
    .sort((a, b) => a.idx - b.idx);
  if (caution.length > 0) return quote(caution[0]);
  return CON_SENTINEL;
}

// arbiter (optional) = HOLD, pro/con과 다른 페르소나. chair(id label 무관 — idx) 먼저? spec은
//   "chair(id==='chair') 우선" 이나 UsablePersona엔 label만 보존 → label==='의장' 류 환경의존 회피 위해
//   결정론 idx MIN HOLD로만 선택 (spec §3.3 "없으면 idx 최소 HOLD"; chair-우선은 idx로 흡수).
function pickArbiter(
  matchers: UsablePersona[],
  pro: UsablePersona,
  con: UsablePersona,
): UsablePersona | undefined {
  const holds = matchers
    .filter((p) => p.vote === 'HOLD' && p.idx !== pro.idx && p.idx !== con.idx)
    .sort((a, b) => a.idx - b.idx);
  return holds[0];
}

interface ThemeRecord {
  themeIdx: number;
  title: string;
  matchers: UsablePersona[];
  pro: UsablePersona | undefined;
  con: UsablePersona | undefined;
  clash: number; // -1 = pro===con or no matchers
}

export function extractIssueDebates(
  personaResults: CallPersonaResult[],
  personaIds: string[],
): IssueDebateExcerpt[] {
  const usable = buildUsablePersonas(personaResults, personaIds);

  // 0. zero-usable 안전망 — fallback이 pro source 없어 3을 못 채움 → 정직 sentinel 3 issue.
  if (usable.length === 0) {
    return [0, 1, 2].map((t) => ({
      issue: THEME_CATALOG[t].title,
      pro_quote: ZERO_SENTINEL,
      con_quote: ZERO_SENTINEL,
    }));
  }

  // 테마별 record (고정 index 0..6)
  const records: ThemeRecord[] = THEME_CATALOG.map((theme, themeIdx) => {
    const matchers = matchersForTheme(usable, themeIdx);
    if (matchers.length === 0) {
      return { themeIdx, title: theme.title, matchers, pro: undefined, con: undefined, clash: -1 };
    }
    const pro = pickPro(matchers);
    const con = pickConTier1(matchers);
    const clash = pro.idx !== con.idx ? pro.voteRank - con.voteRank : -1;
    return { themeIdx, title: theme.title, matchers, pro, con, clash };
  });

  // 1. Tier-1: 진짜 양면 쟁점 (clash ≥ 1 → pro≠con 보장).
  const tier1 = records
    .filter((r) => r.clash >= 1)
    .sort((a, b) => {
      if (b.clash !== a.clash) return b.clash - a.clash;
      if (b.matchers.length !== a.matchers.length) return b.matchers.length - a.matchers.length;
      return a.themeIdx - b.themeIdx;
    });

  const selected: IssueDebateExcerpt[] = [];
  const used = new Set<string>();
  for (const r of tier1) {
    if (selected.length >= 5) break;
    const pro = r.pro!;
    const con = r.con!;
    const arbiter = pickArbiter(r.matchers, pro, con);
    const issue: IssueDebateExcerpt = {
      issue: r.title,
      pro_quote: quote(pro),
      con_quote: quote(con),
    };
    if (arbiter) issue.arbiter_quote = quote(arbiter);
    selected.push(issue);
    used.add(r.title);
  }

  // 2. Tier-2: one-sided 테마 (selected < 3 일 때만).
  if (selected.length < 3) {
    const cand = records
      .filter((r) => r.matchers.length >= 1 && !used.has(r.title))
      .sort((a, b) => {
        if (b.matchers.length !== a.matchers.length) return b.matchers.length - a.matchers.length;
        return a.themeIdx - b.themeIdx;
      });
    for (const r of cand) {
      if (selected.length >= 3) break;
      const pro = pickPro(r.matchers);
      const conQuote = pickConFallback(r.matchers, pro);
      selected.push({ issue: r.title, pro_quote: quote(pro), con_quote: conQuote });
      used.add(r.title);
    }
  }

  // 3. Tier-3: degenerate pad (그래도 < 3 일 때만). 카탈로그 7 title로 항상 3 distinct 확보.
  if (selected.length < 3) {
    const proGlobal = pickPro(usable);
    for (let t = 0; t < THEME_CATALOG.length; t++) {
      if (selected.length >= 3) break;
      const title = THEME_CATALOG[t].title;
      if (used.has(title)) continue;
      const conQuote = pickConFallback(usable, proGlobal);
      selected.push({ issue: title, pro_quote: quote(proGlobal), con_quote: conQuote });
      used.add(title);
    }
  }

  return selected.slice(0, 5);
}

export interface CommitTickerReportInput {
  month: string;
  ticker: string;
  personaResults: CallPersonaResult[]; // length 11, persona order matches personaIds
  personaIds: string[]; // length 11
  badge: Exclude<ConsensusBadge, '⚪'>; // 🟢🔵🟣🟡 only (Plan R3 BLOCKER 7 — ⚪는 commit_badge_only)
}

export interface BuiltSection8 {
  section8: Section8;
  votes: Array<{
    persona_id: string;
    persona_layer: 'core';
    vote: 'BUY' | 'HOLD' | 'SELL';
    argument_excerpt: string;
  }>;
}

// P2 (PR5b) — PURE builder: personaResults(11) + personaIds(11) → Section8 + committee_votes payload.
//   no client / no I/O. commitTickerReport(admin session)와 commitTickerReportCron(service-role) 공용.
export function buildSection8AndVotes(
  personaResults: CallPersonaResult[],
  personaIds: string[],
): BuiltSection8 {
  if (personaResults.length !== 11 || personaIds.length !== 11) {
    throw new Error('writer_persona_count_mismatch');
  }

  // Part D (Core 11) 생성
  const partD = personaIds.map((id, i) => {
    const persona = getPersonaById(id);
    const parsed = parseContent(personaResults[i].content);
    return {
      persona_id: id,
      label: persona?.label ?? id,
      philosophy: persona?.philosophy ?? '',
      vote: parsed.vote,
      one_line: parsed.one_line,
    };
  });

  // Part B (issue debates) — B-PARTB: 페르소나 11 응답에서 의견 대립이 큰 쟁점 3~5개를
  // 결정론적 휴리스틱으로 추출 (extractIssueDebates). raw JSON/stub/빈문자열 누출 0.
  const partB = extractIssueDebates(personaResults, personaIds);

  // Part C (최종 합의 패널)
  const voteCounts = partD.reduce(
    (acc, v) => {
      acc[v.vote]++;
      return acc;
    },
    { BUY: 0, HOLD: 0, SELL: 0 },
  );
  const verdict: 'BUY' | 'HOLD' | 'SELL' =
    voteCounts.BUY > voteCounts.HOLD && voteCounts.BUY > voteCounts.SELL
      ? 'BUY'
      : voteCounts.SELL > voteCounts.HOLD
        ? 'SELL'
        : 'HOLD';
  // MANDATED DEVIATION: schema requires lowercase keys for core_revote
  const partC = {
    sector_aggregate: { buy: 0, hold: 0, sell: 0 }, // Tier 2 미활성
    core_revote: { buy: voteCounts.BUY, hold: voteCounts.HOLD, sell: voteCounts.SELL },
    co_chair_unanimous: false, // 본 PR은 단순 다수결, 만장일치 판정 후속
    verdict,
    rationale: [
      `Core 11 중 BUY ${voteCounts.BUY}표, HOLD ${voteCounts.HOLD}표, SELL ${voteCounts.SELL}표`,
      `위원장 의견: ${parseContent(personaResults[10].content).one_line}`,
      `최종 판정: ${verdict}`,
    ],
  };

  const section8: Section8 = {
    partA: [], // B 범위 — Tier 2 deferred
    partB,
    partC,
    partD,
  };

  // committee_votes payload (RPC가 INSERT) — BUY/HOLD/SELL literal 그대로 (DB enum 매핑은 RPC 내부 책임)
  const votes = partD.map((v) => ({
    persona_id: v.persona_id,
    persona_layer: 'core' as const,
    vote: v.vote,
    argument_excerpt: parseContent(personaResults[personaIds.indexOf(v.persona_id)].content).argument_excerpt,
  }));

  return { section8, votes };
}

export async function commitTickerReport(input: CommitTickerReportInput): Promise<{ reportId: string }> {
  const { section8, votes } = buildSection8AndVotes(input.personaResults, input.personaIds);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('commit_persona_eval', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_section_8: section8,
    p_votes: votes,
    p_consensus_badge: input.badge, // Plan R3 BLOCKER 7
  });

  if (error) {
    throw new Error(`commit_persona_eval_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('commit_persona_eval_failed:no_success');
  }
  return { reportId: data.report_id };
}

// P2 (PR5b, omxy R4 BLOCKER 1) — service-role-DI 변형. cron/worker 경로(auth.uid()=null)에서
//   commit_persona_eval_cron(0036, p_called_by=cron-system user) 호출. 원 admin commitTickerReport 무변경.
export async function commitTickerReportCron(
  input: CommitTickerReportInput,
  options: { client: SupabaseClient; calledBy: string },
): Promise<{ reportId: string }> {
  const { section8, votes } = buildSection8AndVotes(input.personaResults, input.personaIds);

  const { data, error } = await options.client.rpc('commit_persona_eval_cron', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_section_8: section8,
    p_votes: votes,
    p_consensus_badge: input.badge,
    p_called_by: options.calledBy,
  });

  if (error) {
    throw new Error(`commit_persona_eval_cron_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('commit_persona_eval_cron_failed:no_success');
  }
  return { reportId: data.report_id };
}

export async function commitBadgeOnly(input: { month: string; ticker: string }): Promise<{ ok: true }> {
  // Plan R3 BLOCKER 7: tier1Available=false 케이스 ⚪ persistence
  const supabase = await createClient();
  const { error } = await supabase.rpc('commit_badge_only', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_consensus_badge: '⚪',
  });
  if (error) throw new Error(`commit_badge_only_failed:${error.code ?? 'unknown'}`);
  return { ok: true };
}

// Tier 2 implementation (52차 D21) — Sector Board 14 personas commit.
// SoT = ServicePlan-Admin §1A.5 D21 + ReportFramework §7.2/§7.3 v2.5 + 마이그 0019.
// omxy R1~R3 CONVERGED + 4 acceptance details + subagent gsd BLOCKERS.
//
// 호출 조건: Core 11 (commitTickerReport) 성공 후 + Tier 2 degraded 아님 (persona-eval 결정).
// degraded 케이스 = 본 함수 호출 자체 skip (R2 B1 + R3 acc#4 — committee_votes 오염 0).
// caller wiring (cron/admin server action)은 별도 PR (R1 #7 OOS).

export interface CommitSectorReportInput {
  month: string;                               // 'YYYY-MM'
  ticker: string;                              // 6자리 KRX
  sector: CanonicalSector;                     // canonical 14 (canonical-sectors.ts)
  sub_tags?: readonly string[];                // 운영 UI sub_tags (D21 crosswalk)
  sectorPersonaResults: CallPersonaResult[];   // length 14 happy-path만 (degraded면 caller가 skip)
  sectorPersonaIds: string[];                  // length 14, slot_index 1~14 순서
}

// omxy final R1 B-final-3: malformed AI content가 HOLD stub으로 RPC persist되는 risk 차단.
// parseContent(catch) → {vote:'HOLD', one_line:'parse failed'} 패턴이 commit_sector_personas로
// 흘러가는 것을 strict parser로 차단. JSON parse 실패 / vote enum 불일치 / 필수 필드 누락 시
// sector_writer_invalid_persona_content throw + RPC not called.
//
// Core 11 path(commitTickerReport)는 기존 parseContent 유지 — degraded 정책 차이 (Core 11은
// HOLD stub 허용, Sector는 R2 B1 "persist 금지").
function parseSectorContentStrict(
  content: string,
): { vote: 'BUY' | 'HOLD' | 'SELL'; one_line: string; argument_excerpt: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('sector_writer_invalid_persona_content:parse_failed');
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('sector_writer_invalid_persona_content:not_object');
  }
  const record = parsed as Record<string, unknown>;
  const vote = record.vote;
  const one_line = record.one_line;
  const argument_excerpt = record.argument_excerpt;
  if (vote !== 'BUY' && vote !== 'HOLD' && vote !== 'SELL') {
    throw new Error('sector_writer_invalid_persona_content:invalid_vote');
  }
  if (typeof one_line !== 'string' || one_line.length === 0) {
    throw new Error('sector_writer_invalid_persona_content:invalid_one_line');
  }
  if (typeof argument_excerpt !== 'string' || argument_excerpt.length === 0) {
    throw new Error('sector_writer_invalid_persona_content:invalid_argument_excerpt');
  }
  return { vote, one_line, argument_excerpt };
}

// 순수 payload 조립 — admin(commitSectorReport)과 cron(commitSectorReportCron) 공용 (buildSection8AndVotes 패턴).
//   count 가드 + strict parse + partA(14) + sector_aggregate + votes(14)를 한 곳에서 산출해 RPC drift 방지.
function composeSectorReportPayload(input: CommitSectorReportInput): {
  partA: Array<{ persona_id: string; label: string; background: string; vote: 'BUY' | 'HOLD' | 'SELL'; one_line: string }>;
  sectorAggregate: { buy: number; hold: number; sell: number };
  votes: Array<{ persona_id: string; persona_layer: string; vote: 'BUY' | 'HOLD' | 'SELL'; argument_excerpt: string }>;
} {
  // R2 B2 + R3 acc#3: length=14 가드
  if (
    input.sectorPersonaResults.length !== SECTOR_PERSONA_COUNT ||
    input.sectorPersonaIds.length !== SECTOR_PERSONA_COUNT
  ) {
    throw new Error('sector_writer_persona_count_mismatch');
  }

  const slotTemplate = resolveSlotTemplate(input.sector, input.sub_tags ?? []);

  // omxy final R1 B-final-3: strict parse 먼저 — 14 중 하나라도 malformed면 RPC 호출 자체 차단
  const parsedRows = input.sectorPersonaResults.map((r) => parseSectorContentStrict(r.content));

  // partA = 14 sectorVoteRow (writer composes rich labels from canonical-sectors.ts crosswalk)
  const partA = input.sectorPersonaIds.map((id, i) => {
    const parsed = parsedRows[i];
    const slot = slotTemplate[i];
    return {
      persona_id: id,
      label: slot.role,
      background:
        slot.slot_type === 'sub_tag_overlay' && slot.sub_tag !== undefined
          ? `${slot.role} (sub_tag: ${slot.sub_tag})`
          : slot.role,
      vote: parsed.vote,
      one_line: parsed.one_line,
    };
  });

  // sector_aggregate = vote 카운트 (R3 acc#1 exact keys)
  const sectorAggregate = partA.reduce(
    (acc, row) => {
      if (row.vote === 'BUY') acc.buy++;
      else if (row.vote === 'HOLD') acc.hold++;
      else if (row.vote === 'SELL') acc.sell++;
      return acc;
    },
    { buy: 0, hold: 0, sell: 0 },
  );

  // committee_votes payload — persona_layer='sector', slim
  const votes = input.sectorPersonaIds.map((id, i) => {
    const parsed = parsedRows[i];
    return {
      persona_id: id,
      persona_layer: 'sector',
      vote: parsed.vote,
      argument_excerpt: parsed.argument_excerpt,
    };
  });

  return { partA, sectorAggregate, votes };
}

export async function commitSectorReport(
  input: CommitSectorReportInput,
): Promise<{ reportId: string; votesInserted: number }> {
  const { partA, sectorAggregate, votes } = composeSectorReportPayload(input);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('commit_sector_personas', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_sector: input.sector,
    p_part_a: partA,
    p_sector_aggregate: sectorAggregate,
    p_votes: votes,
  });

  if (error) {
    throw new Error(`commit_sector_personas_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('commit_sector_personas_failed:no_success');
  }
  return { reportId: data.report_id, votesInserted: data.votes_inserted };
}

// PR-T2a (Tier 2 → live 리포트 경로) — service-role-DI 변형. cron/worker(auth.uid()=null)에서
//   commit_sector_personas_cron(0040, p_called_by=cron-system user) 호출. 원 admin commitSectorReport 무변경.
//   commitTickerReportCron(Core-11)과 동일 패턴.
export async function commitSectorReportCron(
  input: CommitSectorReportInput,
  options: { client: SupabaseClient; calledBy: string },
): Promise<{ reportId: string; votesInserted: number }> {
  const { partA, sectorAggregate, votes } = composeSectorReportPayload(input);

  const { data, error } = await options.client.rpc('commit_sector_personas_cron', {
    p_month: input.month,
    p_ticker: input.ticker,
    p_sector: input.sector,
    p_part_a: partA,
    p_sector_aggregate: sectorAggregate,
    p_votes: votes,
    p_called_by: options.calledBy,
  });

  if (error) {
    throw new Error(`commit_sector_personas_cron_failed:${error.code ?? 'unknown'}`);
  }
  if (!data?.success) {
    throw new Error('commit_sector_personas_cron_failed:no_success');
  }
  return { reportId: data.report_id, votesInserted: data.votes_inserted };
}
