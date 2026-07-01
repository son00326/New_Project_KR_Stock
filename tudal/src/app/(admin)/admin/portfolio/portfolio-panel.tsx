"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  acceptShortList,
  rejectShortList,
  raiseDispute,
  resolveDispute,
  triggerMonthlyBatch,
  triggerReportWorkerChunk,
  proposePortfolio,
} from "./actions";
import { ProposalDisplay } from "./proposal-display";
import {
  enrichProposalPositions,
  computeProposalSummary,
  type ShortlistNameItem,
} from "@/lib/portfolio/proposal-view";
import type { PortfolioProposal } from "@/lib/ai/portfolio-proposal-client";
import type { PersistedPortfolioProposal } from "@/lib/data/admin-proposals";
import {
  DISPUTE_ERROR_REASON_TOO_SHORT,
  isAcceptBlockedByDispute,
} from "@/lib/portfolio/dispute";
import { DISPUTE_REASON_MIN_LENGTH } from "@/types/admin";

import type { AcceptGateReason } from "@/lib/portfolio/gating";
import type { PortfolioApproval } from "@/types/admin";

interface PortfolioPanelProps {
  month: string; // "2026-04-01"
  shortlistGeneratedAt: string;
  newCount: number;
  holdCount: number;
  removedCount: number;
  reanalysisCount: number; // 현재 pending 월의 누적 Reject 수
  isAlreadyFinalized: boolean; // 이번 달 Accept 완료 여부
  // Wave 4: 게이팅 상태 (T3.6)
  acceptAllowed: boolean;
  gateMessage: string | null;
  gateReason: AcceptGateReason | null;
  // Wave 5 (T3.7): 이의 제기 — 현재 월 확정 approval
  finalApproval?: PortfolioApproval | null;
  // W3b-3: AI 포트 제안 — 영속 제안(read-only 표시) + 종목 이름 조인용 view model(직렬화 안전).
  persistedProposal?: PersistedPortfolioProposal | null;
  shortlistView?: ShortlistNameItem[];
  portfolioProposalEnabled: boolean;
  reportBatchEnabled: boolean;
}

type ModalKind = "accept" | "reject" | "dispute" | "propose" | null;
type BannerState =
  | { kind: "accept_done" }
  | { kind: "reject_done"; reanalysisCount: number; portfolioHoldWarning?: boolean }
  | { kind: "dispute_done" }
  | { kind: "dispute_resolved" }
  // PR-H scope 1a — 30 재선정(triggerMonthlyBatch) 결과 배너.
  | { kind: "reanalyze_done"; selectedCount: number }
  // PR-H scope 4 — report-worker chunk 결과 배너.
  | { kind: "report_worker_done"; processed: number; remaining: number; aborted: string | null }
  | { kind: "report_worker_skipped" }
  | { kind: "report_worker_not_ready"; reason: string }
  // W3b-3 — AI 포트 제안 생성 결과 배너.
  | { kind: "propose_done" }
  | { kind: "error"; message: string }
  | null;

// FixPlan-46 §P1.1: 한국어 매핑은 src/lib/admin/format-error.ts로 일원화.
// 기존 formatPortfolioActionError는 미매핑 4건만 다뤘으나, 통합 helper로 invalid_*/auth_unavailable/
// approval_lookup_failed/accept_gate_blocked:* 등 누락 코드까지 한국어로 표시한다.
// 기존 export 이름은 테스트 호환을 위해 alias로 유지.
import { formatErrorMessage } from "@/lib/admin/format-error";
export const formatPortfolioActionError = formatErrorMessage;

export function PortfolioPanel({
  month,
  shortlistGeneratedAt,
  newCount,
  holdCount,
  removedCount,
  reanalysisCount,
  isAlreadyFinalized,
  acceptAllowed,
  gateMessage,
  // gateReason reserved for T3.7 server-side re-validation display
  finalApproval,
  persistedProposal = null,
  shortlistView = [],
  portfolioProposalEnabled,
  reportBatchEnabled,
}: PortfolioPanelProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
  // W3b-3 — proposePortfolio 성공 시 반환 proposal을 로컬 보관해 즉시 Dialog 표시.
  const [generatedProposal, setGeneratedProposal] =
    useState<PortfolioProposal | null>(null);
  const [isPending, startTransition] = useTransition();

  // 이의 제기 48h Hold 판정
  const now = new Date();
  const disputeBlocked = finalApproval
    ? isAcceptBlockedByDispute(
        finalApproval.disputeRaisedAt,
        finalApproval.disputeResolvedAt,
        now,
      )
    : false;

  // 48h Hold 만료 시각 계산 (배너 표시용)
  const disputeHoldExpiresAt =
    finalApproval?.disputeRaisedAt && disputeBlocked
      ? new Date(
          new Date(finalApproval.disputeRaisedAt).getTime() +
            48 * 60 * 60 * 1000,
        )
      : null;

  const monthLabel = formatMonthLabel(month);

  function closeModal() {
    setModal(null);
    setRejectReason("");
    setDisputeReason("");
    setDisputeError(null);
  }

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptShortList({ month, shortlistGeneratedAt });
      if (result.success) {
        setBanner({ kind: "accept_done" });
        closeModal();
        router.refresh();
      } else {
        setBanner({ kind: "error", message: result.error });
        closeModal();
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectShortList({
        month,
        reason: rejectReason.trim() || undefined,
      });
      if (result.success) {
        setBanner({
          kind: "reject_done",
          reanalysisCount: result.data.reanalysisCount,
          portfolioHoldWarning: result.data.portfolioHoldWarning,
        });
        closeModal();
        router.refresh();
      } else {
        setBanner({ kind: "error", message: result.error });
        closeModal();
      }
    });
  }

  // PR-H scope 1a — 30 재선정 (실 AI 재실행). reject(=거부 기록, cost 0)와 분리 — reject 자동
  //   재선정 트리거 금지(silent cost burn 방지). 명시 버튼 + flag-off면 action 내부 fail-closed = cost 0.
  function handleReanalyze() {
    startTransition(async () => {
      const result = await triggerMonthlyBatch({ month: month.slice(0, 7) });
      if (result.success) {
        setBanner({ kind: "reanalyze_done", selectedCount: result.data.selectedCount });
        router.refresh();
      } else {
        setBanner({ kind: "error", message: result.error });
      }
    });
  }

  // W3b-3 — AI 포트 제안 생성 트리거. 실 동작은 백엔드 게이트(flag/key/admin/cost)가 결정 —
  //   flag-off면 proposal_disabled 안내만(cost 0). 성공 시 결과를 Dialog로 즉시 표시 + router.refresh()로
  //   영속 read-only 카드 갱신. money-path 무접촉(생성·표시만, Accept는 별개).
  function handlePropose() {
    startTransition(async () => {
      setGeneratedProposal(null); // 직전 결과 stale 방지 — 성공 시에만 새 proposal 채움.
      const result = await proposePortfolio({ month });
      if (result.success) {
        setGeneratedProposal(result.data.proposal);
        setModal("propose");
        setBanner({ kind: "propose_done" });
        router.refresh();
      } else {
        setBanner({ kind: "error", message: result.error });
      }
    });
  }

  // PR-H scope 4 — report-worker chunk 트리거 (30 풀리포트 생성, 1 chunk). 실 가동은 USER flag
  //   (PR5_CRON_AUTO_ENABLED). flag-off면 worker step0 abort = cost 0.
  function handleReportWorker() {
    startTransition(async () => {
      const result = await triggerReportWorkerChunk({ month: month.slice(0, 7) });
      if (!result.success) {
        setBanner({ kind: "error", message: result.error });
        return;
      }
      if ("skipped" in result) {
        setBanner({ kind: "report_worker_skipped" });
      } else if ("notReady" in result) {
        setBanner({ kind: "report_worker_not_ready", reason: result.notReady.reason });
      } else {
        setBanner({
          kind: "report_worker_done",
          processed: result.data.processed,
          remaining: result.data.remaining,
          aborted: result.data.aborted,
        });
      }
      router.refresh();
    });
  }

  function handleDispute() {
    if (!finalApproval) return;
    setDisputeError(null);
    startTransition(async () => {
      const result = await raiseDispute({
        approvalId: finalApproval.id,
        reason: disputeReason,
      });
      if (result.success) {
        setBanner({ kind: "dispute_done" });
        closeModal();
        router.refresh();
      } else {
        if (result.error === DISPUTE_ERROR_REASON_TOO_SHORT) {
          setDisputeError("이의 사유를 20자 이상 입력해 주세요.");
        } else {
          setDisputeError(formatErrorMessage(result.error));
        }
      }
    });
  }

  function handleResolveDispute() {
    if (!finalApproval) return;
    setDisputeError(null);
    startTransition(async () => {
      const result = await resolveDispute({ approvalId: finalApproval.id });
      if (result.success) {
        setBanner({ kind: "dispute_resolved" });
        router.refresh();
      } else {
        setBanner({ kind: "error", message: result.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* 경고 배너 — reanalysisCount >= 1: 전월 포트 유지 경고 */}
      {reanalysisCount >= 1 && !isAlreadyFinalized && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning shadow-toss-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-semibold">
              재분석 요청 {reanalysisCount}회 — 전월 포트 유지 중 · 성과 집계 미포함 경고
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              재분석 결과가 도착하면 다시 확정해 주세요. 이 기간은 성과 집계에서 제외됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 결과 배너 */}
      {banner?.kind === "accept_done" && (
        <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success shadow-toss-sm">
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-semibold">{monthLabel} 포트가 확정되었습니다.</span>
        </div>
      )}

      {banner?.kind === "reject_done" && banner.portfolioHoldWarning && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning shadow-toss-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-semibold">재분석 요청 2회 달성 — 전월 포트 유지 확정</p>
            <p className="mt-0.5 text-xs opacity-80">
              재분석 횟수(≤1) 초과. 이번 달은 전월 포트폴리오가 유지됩니다.
            </p>
          </div>
        </div>
      )}

      {banner?.kind === "reject_done" && !banner.portfolioHoldWarning && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning shadow-toss-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-semibold">
              재분석 요청 기록 완료 (요청 {banner.reanalysisCount}회)
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              정기 선정 배치가 다시 추천을 생성할 때까지 기다립니다. 확정 전까지 전월 포트 유지 상태입니다.
            </p>
          </div>
        </div>
      )}

      {banner?.kind === "propose_done" && (
        <div className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info shadow-toss-sm">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden />
          <span>AI 포트 제안이 생성되었습니다. 결과 창에서 확인하세요.</span>
        </div>
      )}

      {banner?.kind === "error" && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-toss-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{formatPortfolioActionError(banner.message)}</span>
        </div>
      )}

      {/* PR-H scope 1a — 30 재선정 완료 배너 */}
      {banner?.kind === "reanalyze_done" && (
        <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success shadow-toss-sm">
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-semibold">
            30 재선정 완료 — {banner.selectedCount}종목 선정. 표를 새로고침합니다.
          </span>
        </div>
      )}

      {/* PR-H scope 4 — report-worker chunk 결과 배너 */}
      {banner?.kind === "report_worker_done" && (
        <div className="flex items-start gap-3 rounded-2xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info shadow-toss-sm">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              리포트 배치 처리 {banner.processed}건
              {banner.aborted ? " · 중단됨" : ""}
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {banner.remaining > 0
                ? `남은 ${banner.remaining}건 — 잠시 후 다시 실행하거나 다음 정기 실행을 기다려 주세요.`
                : "남은 작업 없음."}
            </p>
          </div>
        </div>
      )}

      {banner?.kind === "report_worker_skipped" && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning shadow-toss-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>리포트 배치가 이미 진행 중입니다. 잠시 후 다시 시도해 주세요.</span>
        </div>
      )}

      {banner?.kind === "report_worker_not_ready" && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning shadow-toss-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>이번 달 추천 종목이 아직 30개가 아닙니다. 추천 목록이 완성된 뒤 다시 시도해 주세요.</span>
        </div>
      )}

      {/* 이의 제기 완료 배너 */}
      {banner?.kind === "dispute_done" && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning shadow-toss-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-semibold">이의 제기가 접수되었습니다. 48시간 대기가 시작됩니다.</span>
        </div>
      )}

      {banner?.kind === "dispute_resolved" && (
        <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success shadow-toss-sm">
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-semibold">이의가 해결되었습니다. 확정 가능 시점을 다시 계산합니다.</span>
        </div>
      )}

      {/* 이의 제기 48h Hold 배너 — disputeBlocked=true 시 */}
      {disputeBlocked && disputeHoldExpiresAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning shadow-toss-sm">
          <span>
            이의 제기 48시간 대기 — 만료{" "}
            {disputeHoldExpiresAt.toLocaleString("ko-KR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResolveDispute}
            disabled={isPending}
          >
            이의 해결
          </Button>
        </div>
      )}

      {/* (b) 게이팅 상태 라벨 — allowed=false 시 표시 */}
      {!isAlreadyFinalized && !acceptAllowed && gateMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-info shadow-toss-sm">
          <span>{gateMessage}</span>
        </div>
      )}

      {/* 액션 버튼 영역 */}
      {!isAlreadyFinalized && banner?.kind !== "accept_done" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="default"
            onClick={() => setModal("accept")}
            disabled={isPending || !acceptAllowed || disputeBlocked}
            title={!acceptAllowed && gateMessage ? gateMessage : undefined}
          >
            이번 달 포트폴리오 확정
          </Button>
          <Button
            variant="destructive"
            size="default"
            onClick={() => setModal("reject")}
            disabled={isPending || disputeBlocked}
          >
            재분석 요청
          </Button>
        </div>
      )}

      {/* AI 포트 제안 — 주요 액션(운영 동선). 실 동작은 백엔드 게이트 결정(flag-off=안내, cost 0). */}
      {!isAlreadyFinalized && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePropose}
            disabled={isPending || !portfolioProposalEnabled}
            title={
              portfolioProposalEnabled
                ? "이번 달 추천 30 종목으로 AI가 편입·비중·현금을 제안합니다."
                : "현재 준비 중입니다."
            }
          >
            {portfolioProposalEnabled ? "AI 포트 제안 받기" : "AI 포트 제안 준비 중"}
          </Button>
        </div>
      )}

      {/* 고급 — 일괄 작업. 기본 동선 아님(접힘). 30 재선정 단발은 현재 비활성(disabled). */}
      {!isAlreadyFinalized && (
        <details className="border-t pt-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            고급 — 일괄 작업
          </summary>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled
              title="단발 재선정은 현재 사용할 수 없습니다. 정기 선정 배치를 이용하세요."
            >
              30 재선정 (준비 중)
            </Button>
            <Button
            variant="outline"
            size="sm"
            onClick={handleReportWorker}
              disabled={isPending || !reportBatchEnabled}
              title={
                reportBatchEnabled
                  ? "추천 30 종목의 리포트를 한 번에 생성합니다."
                  : "현재 준비 중입니다."
              }
            >
              {reportBatchEnabled ? "리포트 한 번에 생성" : "리포트 일괄 생성 준비 중"}
            </Button>
          </div>
        </details>
      )}

      {/* W3b-3 — 영속된 AI 제안 read-only 카드 (page.tsx getProposalByMonth 로드분). */}
      {persistedProposal ? (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          {(() => {
            const summary = computeProposalSummary(persistedProposal.proposal);
            return (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  저장된 AI 제안 ({summary.positionCount}종목 · 현금{" "}
                  {summary.cashPct.toFixed(1)}%)
                </span>
                <span className="text-xs text-muted-foreground">
                  저장됨
                </span>
              </div>
            );
          })()}
          <ProposalDisplay
            positions={enrichProposalPositions(
              persistedProposal.proposal.positions,
              shortlistView,
            )}
            cashWeight={persistedProposal.proposal.cashWeight}
            rationale={persistedProposal.proposal.rationale_kr}
          />
        </div>
      ) : null}

      {/* 확정 배너 + 이의 제기 버튼 — is_final=true 시 */}
      {isAlreadyFinalized && banner?.kind !== "accept_done" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            이번 달 포트가 이미 확정되었습니다.
          </p>
          {finalApproval && !disputeBlocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModal("dispute")}
              disabled={isPending}
            >
              이의 제기
            </Button>
          )}
        </div>
      )}

      {/* Accept 모달 */}
      <Dialog open={modal === "accept"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>포트 확정 — {monthLabel}</DialogTitle>
            <DialogDescription>
              이번 달 추천 30을 {monthLabel} 포트폴리오로 확정하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-center text-sm">
            <div>
              <div className="text-xs text-muted-foreground">신규 편입</div>
              <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-market-up">
                {newCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">유지</div>
              <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-muted-foreground">
                {holdCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">제외</div>
              <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-market-down">
                {removedCount}
              </div>
            </div>
          </div>

          {/* 게이팅 차단 메시지 — 모달 내에도 표시 (오인 방지) */}
          {!acceptAllowed && gateMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-info/30 bg-info/10 px-3 py-2 text-xs text-info">
              <span>{gateMessage}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            확정 후에는 취소가 불가합니다. 가상 포트 성과 측정이 시작됩니다.
          </p>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              취소
            </DialogClose>
            <Button onClick={handleAccept} disabled={isPending}>
              {isPending ? "처리 중…" : "확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject 모달 */}
      <Dialog open={modal === "reject"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>재분석 요청 — {monthLabel}</DialogTitle>
            <DialogDescription>
              이번 달 추천 30에 대해 재분석을 요청합니다. 이번 달은 전월 포트가 유지됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="reject-reason" className="text-xs font-medium text-muted-foreground">
              재분석 사유 (선택 · 입력 시 기록됨)
            </label>
            <textarea
              id="reject-reason"
              rows={4}
              className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-muted-foreground focus:ring-ring/50 focus-visible:ring-ring/50"
              placeholder="재분석이 필요한 이유를 입력하세요 (선택)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              취소
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending}
            >
              {isPending ? "처리 중…" : "재분석 요청"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 이의 제기 모달 */}
      <Dialog open={modal === "dispute"} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>이의 제기 — {monthLabel}</DialogTitle>
            <DialogDescription>
              확정된 포트폴리오에 이의를 제기합니다. 접수 후 48시간 대기가 시작되며, 그 동안 확정과 재분석 요청이 비활성화됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="dispute-reason" className="text-xs font-medium text-muted-foreground">
                이의 사유 (필수 · 20자 이상)
              </label>
              <span
                className={`text-xs font-mono tabular-nums ${
                  disputeReason.length >= DISPUTE_REASON_MIN_LENGTH
                    ? "text-success"
                    : "text-destructive"
                }`}
              >
                {disputeReason.length} / {DISPUTE_REASON_MIN_LENGTH}자
              </span>
            </div>
            <textarea
              id="dispute-reason"
              rows={4}
              className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-muted-foreground focus:ring-ring/50 focus-visible:ring-ring/50"
              placeholder="이의 사유를 20자 이상 입력하세요..."
              value={disputeReason}
              onChange={(e) => {
                setDisputeReason(e.target.value);
                setDisputeError(null);
              }}
            />
            {disputeError && (
              <p className="text-xs text-destructive">{disputeError}</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              취소
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDispute}
              disabled={isPending || disputeReason.length < DISPUTE_REASON_MIN_LENGTH}
            >
              {isPending ? "처리 중…" : "이의 제기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* W3b-3 — AI 포트 제안 결과 모달 (생성 직후 표시). */}
      <Dialog
        open={modal === "propose"}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>AI 포트 제안 — {monthLabel}</DialogTitle>
            <DialogDescription>
              AI가 제안한 편입 종목·비중·현금입니다. 확정하려면 “이번 달 포트폴리오 확정”을 사용하세요.
            </DialogDescription>
          </DialogHeader>
          {generatedProposal ? (
            <ProposalDisplay
              positions={enrichProposalPositions(
                generatedProposal.positions,
                shortlistView,
              )}
              cashWeight={generatedProposal.cashWeight}
              rationale={generatedProposal.rationale_kr}
            />
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>닫기</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatMonthLabel(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}
