import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Circle,
  FileText,
  TrendingUp,
} from "lucide-react";
import {
  deriveBucketNeighbors,
  getReportByTicker,
  type ReportSection0,
  type ReportSection1,
  type ReportSection2,
  type ReportSection3,
  type ReportSection4,
  type ReportSection5,
  type ReportSection6,
  type ReportSection7,
  type ReportSection8,
  type ReportAppendix,
} from "@/lib/data/admin-reports";
import {
  partCToCommitteeAgg,
  type ReportSection8Modern,
  type ReportSection8Legacy,
} from "@/lib/data/report-section-schemas";
import {
  aggregateVotes,
  getVotesByReportId,
} from "@/lib/data/admin-committee";
import {
  CORE_PERSONAS,
  getSectorPersonas,
} from "@/lib/data/mock-admin-committee-personas";
import {
  getDistinctViewerCountForReport,
  getViewersForReport,
} from "@/lib/data/admin-report-view-log";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { recordReportView } from "@/app/(admin)/admin/report/[ticker]/record-view";
import type { CommitteeVote, ConsensusBadge } from "@/types/admin";

// PR3b STEP-1 — 5종 합의 배지 한국어 라벨 (shortlist-row.tsx BADGE_LABEL 미러; 그쪽은 non-export private).
const BADGE_LABEL: Record<ConsensusBadge, string> = {
  "🟢": "강한 합의",
  "🔵": "숫자 우세",
  "🟣": "AI 우세",
  "🟡": "관망",
  "⚪": "AI 분석 대기",
};

// PR3b STEP-1 — AI 미평가 판정 단일 출처 (shortlist-row.tsx isAiPending 미러). null/undefined/⚪ = Tier 0 fallback.
function isAiPending(badge?: ConsensusBadge | null): boolean {
  return badge == null || badge === "⚪";
}

interface AdminReportPageProps {
  params: Promise<{ ticker: string }>;
}

// Sticky Side Nav 항목 정의 (T2.2)
const SECTION_LIST = [
  { id: "section-0", label: "0 · 투자 요약", defaultOpen: true },
  { id: "section-1", label: "1 · 기업 개요", defaultOpen: false },
  { id: "section-2", label: "2 · 재무 분석", defaultOpen: false },
  { id: "section-3", label: "3 · 밸류에이션", defaultOpen: false },
  { id: "section-4", label: "4 · 성장성", defaultOpen: false },
  { id: "section-5", label: "5 · 리스크", defaultOpen: false },
  { id: "section-6", label: "6 · 모멘텀 (5-Signal·3축)", defaultOpen: false },
  { id: "section-7", label: "7 · Exit 조건", defaultOpen: false },
  { id: "section-8", label: "8 · 최종 의견 + 투심위", defaultOpen: true },
  { id: "appendix", label: "Appendix", defaultOpen: false },
] as const;

export default async function AdminReportPage({ params }: AdminReportPageProps) {
  const { ticker } = await params;
  // T7e.3 — report·committee_votes·shortlist 모두 Supabase 실 SELECT 전환.
  // active shortlist의 month를 기준으로 report를 조회해야 여러 월의 is_latest
  // 리포트가 동시에 존재해도 Supabase maybeSingle() 다중 행 오류가 나지 않는다.
  const shortlist = await getActiveShortList();
  const shortListRow = shortlist.find((r) => r.ticker === ticker);
  if (!shortListRow) notFound();

  // 실 stock_reports/short_list_30 시드는 S7a(AI 키 ✅) 또는 T7e.8(Tier 0)이 채움.
  // shortlist만 있고 report가 아직 없으면 notFound()로 일관 동작.
  const report = await getReportByTicker(ticker, { month: shortListRow.month });
  if (!report) notFound();

  // T2.4 report_view_log INSERT — Mock cleanup Step 1.3 (58차): real Supabase upsert
  // (1일 1회 dedupe via UNIQUE constraint, best-effort).
  await recordReportView(report.id, ticker);

  const votes = await getVotesByReportId(report.id);
  const voteAgg = aggregateVotes(votes);
  // Mock cleanup Step 1.3: mock-admin-report-view-log → real report_view_log SELECT.
  const viewers = await getViewersForReport(report.id);
  const viewerCount = await getDistinctViewerCountForReport(report.id);
  const neighbors = deriveBucketNeighbors(ticker, shortlist);

  // PR3a — getReportByTicker returns ValidatedStockReport. 각 section은
  // zod safeParse 결과로 ReportSectionX | null. 미구현 본문은 fallback UI 렌더.
  const section0 = report.section_0;
  const section1 = report.section_1;
  const section2 = report.section_2;
  const section3 = report.section_3;
  const section4 = report.section_4;
  const section5 = report.section_5;
  const section6 = report.section_6;
  const section7 = report.section_7;
  const section8 = report.section_8;
  const appendix = report.appendix;

  return (
    <div className="flex flex-col-reverse gap-6 md:flex-row md:gap-8">
      {/* T2.2 Sticky Side Nav — 좌측 */}
      <aside className="shrink-0 text-sm md:sticky md:top-20 md:h-fit md:w-52">
        <Link
          href="/admin"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Short List 30
        </Link>
        <nav aria-label="리포트 섹션">
          <ul className="space-y-0.5 border-l">
            {SECTION_LIST.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block border-l-2 border-transparent px-3 py-1.5 hover:border-foreground hover:bg-muted/40"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* D15 R3.3-8 2인 열람 게이팅 카운터 */}
        <div className="mt-4 rounded-md border bg-muted/30 p-2.5 text-xs">
          <div className="mb-0.5 font-semibold">열람 게이팅</div>
          <div className="tabular-nums">
            {viewerCount}/2명 열람 완료
            {viewerCount >= 2 ? (
              <span className="ml-1 text-[color:var(--color-market-up)]">✓</span>
            ) : null}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            D15 R3.3-8 · S3 Accept 활성 조건
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 space-y-4">
        {/* Header */}
        <header className="border-b pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{report.month.slice(0, 7)} 리포트 · v{report.version}</span>
            <span>·</span>
            <span>{shortListRow.sector}</span>
            <span>·</span>
            <span>bucket {shortListRow.bucket}</span>
            <span>·</span>
            <span>rank {shortListRow.rank}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <h1 className="flex flex-wrap items-baseline gap-3 text-2xl font-semibold">
              <span className="font-mono">{ticker}</span>
              <span>{shortListRow.name}</span>
              <span className="text-base font-normal text-muted-foreground">
                · {shortListRow.signalLabel}
              </span>
            </h1>
            <Link
              href={`/admin/report/${ticker}/regenerate`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
              리포트 재생성
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span>
              Composite{" "}
              <b className="font-mono tabular-nums">{shortListRow.compositeScore}</b>
            </span>
            <span>
              Conviction{" "}
              <b className="font-mono tabular-nums">
                {section0?.conviction ?? "—"}
              </b>
            </span>
            <DeltaPill status={shortListRow.deltaStatus} />
          </div>
          {/* PR3b STEP-1 (c) — Tier 1 AI 요약 1행: 🔢 숫자 + 🤖 AI + 합의 배지. persist된 값 렌더만 (추가 fetch 0). */}
          <ReportSummaryAiRow
            compositeScore={shortListRow.compositeScore}
            aiScore={shortListRow.aiScore}
            consensusBadge={shortListRow.consensusBadge}
          />
        </header>

        {/* T2.3 Section 0~8 accordion 렌더러 */}
        {SECTION_LIST.map((s) => (
          <ReportSectionAccordion
            key={s.id}
            id={s.id}
            title={s.label}
            defaultOpen={s.defaultOpen}
          >
            {renderSection(s.id, {
              section0,
              section1,
              section2,
              section3,
              section4,
              section5,
              section6,
              section7,
              section8,
              appendix,
              sector: shortListRow.sector,
              coreAgg: voteAgg.core,
              sectorAgg: voteAgg.sector,
              votes,
              viewers: viewers.length,
            })}
          </ReportSectionAccordion>
        ))}

        {/* T2.5 이전/다음 내비 */}
        <nav
          aria-label="버킷 내 이전/다음 종목"
          className="flex items-center justify-between gap-3 border-t pt-4 text-sm"
        >
          {neighbors.prev ? (
            <Link
              href={`/admin/report/${neighbors.prev.ticker}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:bg-muted/40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="text-xs text-muted-foreground">이전</span>
              <span className="font-mono">{neighbors.prev.ticker}</span>
              <span className="hidden sm:inline">{neighbors.prev.name}</span>
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            버킷 <b>{shortListRow.bucket}</b> 내 순서
          </span>
          {neighbors.next ? (
            <Link
              href={`/admin/report/${neighbors.next.ticker}`}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 hover:bg-muted/40"
            >
              <span className="hidden sm:inline">{neighbors.next.name}</span>
              <span className="font-mono">{neighbors.next.ticker}</span>
              <span className="text-xs text-muted-foreground">다음</span>
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>
    </div>
  );
}

// ─── 섹션 디스패처 ───────────────────────────────────────────────────────────
interface SectionBag {
  section0: ReportSection0 | null;
  section1: ReportSection1 | null;
  section2: ReportSection2 | null;
  section3: ReportSection3 | null;
  section4: ReportSection4 | null;
  section5: ReportSection5 | null;
  section6: ReportSection6 | null;
  section7: ReportSection7 | null;
  section8: ReportSection8 | null;
  appendix: ReportAppendix | null;
  sector: string;
  coreAgg: { approve: number; reject: number; abstain: number };
  sectorAgg: { approve: number; reject: number; abstain: number };
  votes: CommitteeVote[];
  viewers: number;
}

function renderSection(id: string, bag: SectionBag) {
  switch (id) {
    case "section-0":
      return <Section0View data={bag.section0} />;
    case "section-1":
      return <Section1View data={bag.section1} />;
    case "section-2":
      return <Section2View data={bag.section2} />;
    case "section-3":
      return <Section3View data={bag.section3} />;
    case "section-4":
      return <Section4View data={bag.section4} />;
    case "section-5":
      return <Section5View data={bag.section5} />;
    case "section-6":
      return <Section6View data={bag.section6} />;
    case "section-7":
      return <Section7View data={bag.section7} />;
    case "section-8":
      return (
        <Section8View
          data={bag.section8}
          coreAgg={bag.coreAgg}
          sectorAgg={bag.sectorAgg}
          sector={bag.sector}
          votes={bag.votes}
        />
      );
    case "appendix":
      return <AppendixView data={bag.appendix} viewers={bag.viewers} />;
    default:
      return null;
  }
}

// ─── 공통 Accordion wrapper ──────────────────────────────────────────────────
function ReportSectionAccordion({
  id,
  title,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="scroll-mt-24 rounded-lg border bg-card"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
        <Circle className="h-2 w-2 fill-current" aria-hidden />
        {title}
      </summary>
      <div className="border-t px-4 py-3 text-sm leading-relaxed">{children}</div>
    </details>
  );
}

// PR3b STEP-1 (c) — Section 0 요약 AI 1행. 🔢 숫자(compositeScore) + 🤖 AI(aiScore) + 합의 배지.
//   aiScore null(=AI 평가 대기, Tier 0 fallback) → 🤖 영역 'AI 대기'. consensusBadge null/⚪ → ⚪ AI 분석 대기.
//   persist된 값 렌더만 — 추가 fetch 금지(STEP-1 원칙).
function ReportSummaryAiRow({
  compositeScore,
  aiScore,
  consensusBadge,
}: {
  compositeScore: number;
  aiScore?: number | null;
  consensusBadge?: ConsensusBadge | null;
}) {
  const pending = isAiPending(consensusBadge);
  const badge: ConsensusBadge = consensusBadge ?? "⚪";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>🔢</span>
        <span className="text-muted-foreground">숫자</span>
        <b className="font-mono tabular-nums">{compositeScore}</b>
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden>🤖</span>
        <span className="text-muted-foreground">AI</span>
        {pending || aiScore == null ? (
          <span className="text-muted-foreground">AI 대기</span>
        ) : (
          <b className="font-mono tabular-nums">{aiScore}</b>
        )}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
        title={pending ? "AI 분석 대기 (Tier 0 지표만)" : `합의 배지 ${BADGE_LABEL[badge]}`}
        aria-label={pending ? "AI 분석 대기" : `합의 배지 ${BADGE_LABEL[badge]}`}
      >
        <span aria-hidden>{badge}</span>
        <span>{BADGE_LABEL[badge]}</span>
      </span>
    </div>
  );
}

// PR3b MERGED (cf68731) — writer Section 0~7 본문 구현 완료. 이 fallback은 더 이상 '미구현' 상태가 아니라
//   해당 섹션 jsonb가 비어 있거나(아직 미생성) zod validation 실패 시의 degraded UI다.
function SectionFallback({ sectionId }: { sectionId: string }) {
  return (
    <div className="rounded border border-dashed bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
      <div className="font-medium">본문 미작성</div>
      <p className="mt-1 text-xs">
        {sectionId} 본문이 아직 생성되지 않았거나 validation에 실패했습니다.
        DB에 해당 섹션 jsonb가 비어 있거나 형식 검증을 통과하지 못한 상태입니다.
      </p>
    </div>
  );
}

// ─── 섹션별 렌더러 ───────────────────────────────────────────────────────────

function Section0View({ data }: { data: ReportSection0 | null }) {
  if (!data) return <SectionFallback sectionId="0 · 투자 요약" />;
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{data.headline}</h3>
      <ol className="list-decimal space-y-1.5 pl-5">
        {data.thesis.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-3">
        <ConvictionGauge value={data.conviction} />
        <MiniBar label="Core 11" agg={data.committeeMini.core} />
        <MiniBar label="Sector" agg={data.committeeMini.sector} />
      </div>
      <div className="rounded border bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground">목표가 시나리오</span>
        <div className="mt-1 flex gap-4 font-mono tabular-nums">
          <span>
            Bear <b>{data.priceBands.bear}</b>
          </span>
          <span>
            Base <b>{data.priceBands.base}</b>
          </span>
          <span>
            Bull <b>{data.priceBands.bull}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function Section1View({ data }: { data: ReportSection1 | null }) {
  if (!data) return <SectionFallback sectionId="1 · 기업 개요" />;
  return (
    <div className="space-y-3">
      <p>{data.description}</p>
      {data.segments.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold text-muted-foreground">사업 구성</div>
          <ul className="space-y-0.5 text-xs">
            {data.segments.map((s) => (
              <li key={s.name} className="flex justify-between gap-4">
                <span>{s.name}</span>
                <span className="font-mono tabular-nums">{s.share}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.keyFacts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-3">
          {data.keyFacts.map((f) => (
            <div
              key={f.label}
              className="flex justify-between gap-2 rounded border bg-muted/20 px-2 py-1"
            >
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="font-mono tabular-nums">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Section2View({ data }: { data: ReportSection2 | null }) {
  if (!data) return <SectionFallback sectionId="2 · 재무 분석" />;
  if (data.revenue.length === 0) {
    return (
      <div className="space-y-2">
        <p>{data.summary}</p>
        <p className="text-xs text-muted-foreground">
          ※ 재무 상세는 실데이터 연결(S5 M10) 후 자동 채워집니다.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p>{data.summary}</p>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="py-1 text-left">FY</th>
            <th className="py-1 text-right">매출</th>
            <th className="py-1 text-right">YoY</th>
          </tr>
        </thead>
        <tbody>
          {data.revenue.map((r) => (
            <tr key={r.fy} className="border-b last:border-0">
              <td className="py-1">{r.fy}</td>
              <td className="text-right font-mono tabular-nums">{r.value}</td>
              <td className="text-right font-mono tabular-nums">{r.yoy}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-4 text-xs">
        <span>
          OPM <b className="font-mono">{data.margins.operating}</b>
        </span>
        <span>
          NPM <b className="font-mono">{data.margins.net}</b>
        </span>
        <span>
          부채비율 <b className="font-mono">{data.balance.debtRatio}</b>
        </span>
        <span>
          현금 <b className="font-mono">{data.balance.cash}</b>
        </span>
      </div>
    </div>
  );
}

function Section3View({ data }: { data: ReportSection3 | null }) {
  if (!data) return <SectionFallback sectionId="3 · 밸류에이션" />;
  return (
    <div className="space-y-3">
      <p>{data.summary}</p>
      {data.multiples.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 text-left">지표</th>
              <th className="py-1 text-right">값</th>
              <th className="py-1 text-right">피어</th>
            </tr>
          </thead>
          <tbody>
            {data.multiples.map((m) => (
              <tr key={m.metric} className="border-b last:border-0">
                <td className="py-1">{m.metric}</td>
                <td className="text-right font-mono tabular-nums">{m.value}</td>
                <td className="text-right font-mono tabular-nums text-muted-foreground">
                  {m.peer}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Section4View({ data }: { data: ReportSection4 | null }) {
  if (!data) return <SectionFallback sectionId="4 · 성장성" />;
  return (
    <div className="space-y-2">
      <p>{data.summary}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm">
        {data.drivers.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      <div className="text-xs text-muted-foreground">TAM: {data.tam}</div>
    </div>
  );
}

function Section5View({ data }: { data: ReportSection5 | null }) {
  if (!data) return <SectionFallback sectionId="5 · 리스크" />;
  return (
    <div className="space-y-2">
      <p>{data.summary}</p>
      <ul className="space-y-1.5">
        {data.risks.map((r, i) => (
          <li key={i} className="rounded border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SeverityDot severity={r.severity} />
              {r.title}
              <span className="ml-auto text-[10px] uppercase text-muted-foreground">
                {r.severity}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section6View({ data }: { data: ReportSection6 | null }) {
  if (!data) return <SectionFallback sectionId="6 · 모멘텀 (5-Signal·3축)" />;
  return (
    <div className="space-y-3">
      <p>{data.summary}</p>

      {/* T2.7 3축 게이지 — S1 shortlist-row의 AxisBar 패턴 재사용 */}
      <div className="space-y-1.5">
        <AxisRow label="추세 (Trend)" value={data.axis.trend} />
        <AxisRow label="모멘텀 (Momentum)" value={data.axis.momentum} />
        <AxisRow label="변동성 Quality" value={data.axis.volatility} />
      </div>

      {/* 5-Signal 상태 */}
      <div className="grid grid-cols-2 gap-1.5 text-xs md:grid-cols-5">
        {data.signals.map((s) => (
          <div key={s.name} className="rounded border px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <SignalLed state={s.state} />
              <span className="font-mono">{s.name}</span>
            </div>
            <div className="mt-0.5 text-muted-foreground">{s.note}</div>
          </div>
        ))}
      </div>

      <div className="text-xs">
        <TrendingUp className="-mt-0.5 mr-1 inline h-3.5 w-3.5" aria-hidden />
        m60 괴리율 <b className="font-mono tabular-nums">{data.divergencePct}%</b>
      </div>
    </div>
  );
}

function Section7View({ data }: { data: ReportSection7 | null }) {
  if (!data) return <SectionFallback sectionId="7 · Exit 조건" />;
  return (
    <div className="space-y-3">
      <p>{data.summary}</p>
      <div>
        <div className="mb-1 text-xs font-semibold text-muted-foreground">Exit 트리거</div>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {data.triggers.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-muted-foreground">대안 시나리오 3종</div>
        <div className="grid gap-2 md:grid-cols-3">
          {data.alternatives.map((a, i) => (
            <div key={i} className="rounded border bg-muted/20 px-3 py-2">
              <div className="text-sm font-semibold">{a.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{a.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section8View({
  data,
  coreAgg,
  sectorAgg,
  sector,
  votes,
}: {
  data: ReportSection8 | null;
  coreAgg: { approve: number; reject: number; abstain: number };
  sectorAgg: { approve: number; reject: number; abstain: number };
  sector: string;
  votes: CommitteeVote[];
}) {
  // PR3b STEP-1 (b) — report row는 존재(page line 76 notFound 가드 통과)하나 section_8 부재/null.
  //   투심위(Section 8) 미생성 또는 validation 실패 상태. D11 운용 검증 acceptance gate UI.
  //   section_8 존재 시(modern/legacy) 이 pill은 렌더되지 않음.
  if (!data) {
    return (
      <div className="rounded border border-dashed bg-muted/10 px-3 py-4 text-sm">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground"
          title="Tier 1 합의 평가 대기 (투심위 미생성 또는 validation 실패)"
          aria-label="Tier 1 평가 대기"
        >
          <span aria-hidden>🤖</span>
          Tier 1 평가 대기
        </span>
        <p className="mt-2 text-xs text-muted-foreground">
          최종 의견·투심위(Section 8)가 아직 생성되지 않았거나 validation에 실패했습니다.
          AI 합의 평가 이후 정상 jsonb가 저장되면 채워집니다.
        </p>
      </div>
    );
  }
  if (data.shape === "modern") {
    return (
      <Section8ModernView
        data={data.data}
        coreAgg={coreAgg}
        sectorAgg={sectorAgg}
        sector={sector}
        votes={votes}
      />
    );
  }
  return (
    <Section8LegacyView
      data={data.data}
      coreAgg={coreAgg}
      sectorAgg={sectorAgg}
      sector={sector}
      votes={votes}
    />
  );
}

// PR3a — modern (writer.ts 신규 출력) 렌더러.
// B3 정정: partC.core_revote + partC.sector_aggregate 가 authoritative.
// 외부 committee_votes aggregation (coreAgg/sectorAgg)은 별도 audit 패널로
// 분리해 drift 위험 표면화 (정상 시 partC와 일치; lag/empty 시 partC 우선).
function Section8ModernView({
  data,
  coreAgg,
  sectorAgg,
  sector,
  votes,
}: {
  data: ReportSection8Modern;
  coreAgg: { approve: number; reject: number; abstain: number };
  sectorAgg: { approve: number; reject: number; abstain: number };
  sector: string;
  votes: CommitteeVote[];
}) {
  const coreVotes = votes.filter((v) => v.personaLayer === "core");
  const sectorVotes = votes.filter((v) => v.personaLayer === "sector");
  const verdictLabel =
    data.partC.verdict === "BUY"
      ? "매수"
      : data.partC.verdict === "SELL"
        ? "매도"
        : "관망";

  // B3 + testing T#5 정정 — partC authoritative aggregate.
  // 매핑 (BUY→approve / HOLD→abstain / SELL→reject) = RPC commit_persona_eval과 동일.
  // 매핑 convention drift 시 partCToCommitteeAgg unit test가 즉시 catch.
  const partCCoreAgg = partCToCommitteeAgg(data.partC.core_revote);
  const partCSectorAgg = partCToCommitteeAgg(data.partC.sector_aggregate);

  return (
    <div className="space-y-4">
      <div className="rounded border bg-muted/20 px-3 py-2">
        <div className="mb-0.5 text-xs font-semibold text-muted-foreground">
          최종 판정 (Part C — 합의 패널)
        </div>
        <p className="font-medium">{verdictLabel}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {data.partC.rationale.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <div className="mt-1 text-xs text-muted-foreground">
          Core 11 재투표: 찬성 {data.partC.core_revote.buy} · 관망{" "}
          {data.partC.core_revote.hold} · 반대 {data.partC.core_revote.sell}
          {data.partC.co_chair_unanimous ? " · 위원장 만장일치" : ""}
        </div>
      </div>

      {/* B3 정정 — partC authoritative 집계 */}
      <div className="grid gap-3 md:grid-cols-2">
        <VoteAggCard title="Core Committee (Part C 재투표)" agg={partCCoreAgg} />
        <VoteAggCard
          title={`Sector Board — ${sector} (Part C 집계)`}
          agg={partCSectorAgg}
        />
      </div>

      {/* PR4 Task 4 (PR3a OOS RT#1): partA 14 rows 렌더 (Tier 2 active 시).
          schema (section-8-schema.ts:48) refine: partA.length must be 0 (B scope) or 14.
          14 = Tier 2 active (섹터 14인 패널) / 0 = B scope (Core 11 only). 1~13은 invalid. */}
      {data.partA.length === 14 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
            섹터 14인 패널 의견 (Part A)
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.partA.map((p) => (
              <li
                key={p.persona_id}
                className="rounded border bg-muted/10 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{p.label}</span>
                  <PersonaVoteChip vote={p.vote} />
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {p.background}
                </div>
                <div className="mt-1 text-xs">{p.one_line}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.partA.length === 0 && (
        <div className="rounded border border-dashed bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
          섹터 14인 패널 미활성 — Tier 2 cost gate OFF 또는 ⚪ 케이스. Core 11 평가만 표시.
        </div>
      )}

      {data.partB.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
            쟁점 (Part B)
          </div>
          <ul className="space-y-1.5">
            {data.partB.map((b, i) => (
              <li
                key={i}
                className="rounded border bg-muted/10 px-3 py-2 text-sm"
              >
                <div className="font-medium">{b.issue}</div>
                <div className="mt-1 text-xs">
                  <span className="text-[color:var(--color-market-up)]">
                    찬:
                  </span>{" "}
                  {b.pro_quote}
                </div>
                <div className="text-xs">
                  <span className="text-[color:var(--color-market-down)]">
                    반:
                  </span>{" "}
                  {b.con_quote}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* B3 정정 — committee_votes 외부 집계는 audit 패널로 분리. drift 시 사용자 확인. */}
      <details className="rounded border bg-muted/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
          ▸ committee_votes audit ({coreVotes.length + sectorVotes.length}건 / Part C와 일치 시 정상)
        </summary>
        <div className="grid gap-3 border-t px-3 py-2 md:grid-cols-2">
          <VoteAggCard title="Core (committee_votes 집계)" agg={coreAgg} />
          <VoteAggCard
            title={`Sector — ${sector} (committee_votes 집계)`}
            agg={sectorAgg}
          />
        </div>
        <div className="grid gap-3 border-t px-3 py-2 md:grid-cols-2">
          <VoteList title="Core" votes={coreVotes} personas={CORE_PERSONAS} />
          <VoteList
            title={`Sector — ${sector}`}
            votes={sectorVotes}
            personas={getSectorPersonas(sector)}
          />
        </div>
      </details>
    </div>
  );
}

// PR3a — legacy shape (전환기 잔존 row) 렌더러. 기존 Section8View 본문 보존.
function Section8LegacyView({
  data,
  coreAgg,
  sectorAgg,
  sector,
  votes,
}: {
  data: ReportSection8Legacy;
  coreAgg: { approve: number; reject: number; abstain: number };
  sectorAgg: { approve: number; reject: number; abstain: number };
  sector: string;
  votes: CommitteeVote[];
}) {
  const coreVotes = votes.filter((v) => v.personaLayer === "core");
  const sectorVotes = votes.filter((v) => v.personaLayer === "sector");
  return (
    <div className="space-y-4">
      <div className="rounded border bg-muted/20 px-3 py-2">
        <div className="mb-0.5 text-xs font-semibold text-muted-foreground">최종 의견</div>
        <p className="font-medium">{data.recommendation}</p>
        <p className="mt-1 text-sm">{data.conclusion}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <VoteAggCard title="Core Committee (11명)" agg={coreAgg} />
        <VoteAggCard
          title={`Sector Board — ${sector} (${sectorVotes.length}명)`}
          agg={sectorAgg}
        />
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">핵심 논거 인용</div>
        <ul className="space-y-1.5">
          {data.keyQuotes.map((q, i) => (
            <li
              key={i}
              className="rounded border-l-2 bg-muted/10 py-1.5 pl-3 pr-2 text-sm"
              style={{
                borderLeftColor:
                  q.side === "pro"
                    ? "var(--color-market-up)"
                    : q.side === "con"
                      ? "var(--color-market-down)"
                      : "var(--color-market-neutral)",
              }}
            >
              <span className="mr-1 text-[10px] font-semibold uppercase text-muted-foreground">
                {q.side === "pro" ? "찬성" : q.side === "con" ? "반대" : "중립"}
              </span>
              {q.quote}
            </li>
          ))}
        </ul>
      </div>

      <details className="rounded border bg-muted/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">
          ▸ 위원별 개별 투표 보기 ({coreVotes.length + sectorVotes.length}건)
        </summary>
        <div className="grid gap-3 border-t px-3 py-2 md:grid-cols-2">
          <VoteList title="Core" votes={coreVotes} personas={CORE_PERSONAS} />
          <VoteList
            title={`Sector — ${sector}`}
            votes={sectorVotes}
            personas={getSectorPersonas(sector)}
          />
        </div>
      </details>
    </div>
  );
}

function AppendixView({
  data,
  viewers,
}: {
  data: ReportAppendix | null;
  viewers: number;
}) {
  if (!data) return <SectionFallback sectionId="Appendix" />;
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-xs font-semibold text-muted-foreground">기술적 지표</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs md:grid-cols-3">
          {data.technicals.map((t) => (
            <div key={t.name} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t.name}</dt>
              <dd className="font-mono tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-muted-foreground">데이터 출처</div>
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {data.dataSources.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
      <div className="rounded border bg-muted/20 px-3 py-2 text-xs">
        <FileText className="-mt-0.5 mr-1 inline h-3.5 w-3.5" aria-hidden />
        리포트 열람 로그: 총 {viewers}건 (1일 1회 dedupe · BL-5 B · G-5 B)
      </div>
    </div>
  );
}

// ─── 보조 UI ────────────────────────────────────────────────────────────────

function ConvictionGauge({ value }: { value: number }) {
  return (
    <div className="rounded border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
        Conviction
      </div>
      <div className="mt-1 flex items-baseline gap-1 font-mono">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function MiniBar({
  label,
  agg,
}: {
  label: string;
  agg: { approve: number; reject: number; abstain: number };
}) {
  const total = agg.approve + agg.reject + agg.abstain || 1;
  const approvePct = (agg.approve / total) * 100;
  const rejectPct = (agg.reject / total) * 100;
  return (
    <div className="rounded border bg-card px-3 py-2">
      {label && (
        <div className="text-[10px] font-semibold uppercase text-muted-foreground">
          {label}
        </div>
      )}
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full"
          style={{
            width: `${approvePct}%`,
            backgroundColor: "var(--color-market-up)",
          }}
        />
        <div
          className="h-full"
          style={{
            width: `${rejectPct}%`,
            backgroundColor: "var(--color-market-down)",
          }}
        />
      </div>
      <div className="mt-1 grid grid-cols-3 text-[10px] font-mono tabular-nums">
        <span style={{ color: "var(--color-market-up)" }}>{agg.approve}</span>
        <span
          className="text-center"
          style={{ color: "var(--color-market-down)" }}
        >
          {agg.reject}
        </span>
        <span className="text-right text-muted-foreground">{agg.abstain}</span>
      </div>
    </div>
  );
}

// PR4 Task 4 (PR3a OOS RT#1): partA 14 rows 카드용 BUY/HOLD/SELL chip.
// section-8-schema.ts coreVoteRowSchema/sectorVoteRowSchema vote = z.enum(['BUY','HOLD','SELL']).
function PersonaVoteChip({ vote }: { vote: 'BUY' | 'HOLD' | 'SELL' }) {
  if (vote === 'BUY') {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        매수
      </span>
    );
  }
  if (vote === 'SELL') {
    return (
      <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
        매도
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      관망
    </span>
  );
}

function VoteAggCard({
  title,
  agg,
}: {
  title: string;
  agg: { approve: number; reject: number; abstain: number };
}) {
  const total = agg.approve + agg.reject + agg.abstain;
  return (
    <div className="rounded border bg-card px-3 py-2">
      <div className="mb-1.5 text-xs font-semibold">{title}</div>
      <MiniBar label="" agg={agg} />
      <div className="mt-1 text-[10px] text-muted-foreground">
        총 {total}표 · 찬성률 {total ? Math.round((agg.approve / total) * 100) : 0}%
      </div>
    </div>
  );
}

function VoteList({
  title,
  votes,
  personas,
}: {
  title: string;
  votes: CommitteeVote[];
  personas: { id: string; name: string; archetype: string }[];
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-0.5 text-xs">
        {votes.map((v) => {
          const p = personas.find((per) => per.id === v.personaId);
          return (
            <li key={v.id} className="flex items-start gap-2">
              <span className="w-14 shrink-0 text-center" style={voteStyle(v.vote)}>
                {v.vote === "approve" ? "찬성" : v.vote === "reject" ? "반대" : "기권"}
              </span>
              <span className="w-28 shrink-0 truncate">{p?.name ?? v.personaId}</span>
              <span className="flex-1 text-muted-foreground">{v.argumentExcerpt}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function voteStyle(vote: "approve" | "reject" | "abstain"): React.CSSProperties {
  if (vote === "approve")
    return { color: "var(--color-market-up)", fontWeight: 600 };
  if (vote === "reject")
    return { color: "var(--color-market-down)", fontWeight: 600 };
  return { color: "var(--color-market-neutral)" };
}

function AxisRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/60"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono tabular-nums">{value}</span>
    </div>
  );
}

function SignalLed({ state }: { state: "on" | "watch" | "off" }) {
  const color =
    state === "on"
      ? "var(--color-market-up)"
      : state === "watch"
        ? "var(--color-market-neutral)"
        : "var(--color-market-down)";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function SeverityDot({ severity }: { severity: "high" | "medium" | "low" }) {
  const color =
    severity === "high"
      ? "var(--color-market-down)"
      : severity === "medium"
        ? "var(--color-market-neutral)"
        : "var(--color-market-up)";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function DeltaPill({ status }: { status: "new" | "hold" | "removed" }) {
  if (status === "new") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[color:var(--color-market-up)]/15 px-2 py-0.5 text-xs font-semibold text-[color:var(--color-market-up)]">
        NEW · 신규 편입
      </span>
    );
  }
  if (status === "removed") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[color:var(--color-market-down)]/15 px-2 py-0.5 text-xs font-semibold text-[color:var(--color-market-down)]">
        <ArrowLeftRight className="h-3 w-3" aria-hidden />
        REMOVED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      HOLD
    </span>
  );
}
