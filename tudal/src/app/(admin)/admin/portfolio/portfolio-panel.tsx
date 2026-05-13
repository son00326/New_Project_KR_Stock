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
import { acceptShortList, rejectShortList, raiseDispute } from "./actions";
import { isAcceptBlockedByDispute, DISPUTE_ERROR_REASON_TOO_SHORT } from "@/lib/portfolio/dispute";
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
}

type ModalKind = "accept" | "reject" | "dispute" | null;
type BannerState =
  | { kind: "accept_done" }
  | { kind: "reject_done"; reanalysisCount: number; portfolioHoldWarning?: boolean }
  | { kind: "dispute_done" }
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
}: PortfolioPanelProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalKind>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>(null);
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

  function handleDispute() {
    if (!finalApproval) return;
    setDisputeError(null);
    startTransition(async () => {
      const result = await raiseDispute({
        approvalId: finalApproval.id,
        adminId: "admin-001", // TODO(S3 hardening): 세션에서 주입
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

  return (
    <div className="space-y-4">
      {/* 경고 배너 — reanalysisCount >= 1: 전월 포트 유지 경고 */}
      {reanalysisCount >= 1 && !isAlreadyFinalized && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <div>
            <p className="font-semibold">
              Reject {reanalysisCount}회 — 전월 포트 유지 중 · CAP Months 미포함 경고
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              재분석 결과가 도착하면 다시 확정해 주세요. CAP Months 성과 집계에서 이 기간은 제외됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 결과 배너 */}
      {banner?.kind === "accept_done" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-semibold">{monthLabel} 포트가 확정되었습니다.</span>
        </div>
      )}

      {banner?.kind === "reject_done" && banner.portfolioHoldWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-400/50 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" aria-hidden />
          <div>
            <p className="font-semibold">Reject 2회 달성 — 전월 포트 유지 확정</p>
            <p className="mt-0.5 text-xs opacity-80">
              재분석 횟수(≤1) 초과. 이번 달은 전월 포트폴리오가 유지됩니다.
            </p>
          </div>
        </div>
      )}

      {banner?.kind === "reject_done" && !banner.portfolioHoldWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <div>
            <p className="font-semibold">
              Reject 완료 — 재분석 큐 추가됨 (재분석 {banner.reanalysisCount}회)
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              재분석 완료 후 다시 확정해 주세요. 전월 포트 유지 상태입니다.
            </p>
          </div>
        </div>
      )}

      {banner?.kind === "error" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{formatPortfolioActionError(banner.message)}</span>
        </div>
      )}

      {/* 이의 제기 완료 배너 */}
      {banner?.kind === "dispute_done" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-semibold">이의 제기가 접수되었습니다. 48h Hold가 시작됩니다.</span>
        </div>
      )}

      {/* 이의 제기 48h Hold 배너 — disputeBlocked=true 시 */}
      {disputeBlocked && disputeHoldExpiresAt && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-400/50 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900 dark:border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-200">
          ⏳ 이의 제기 48h Hold — 만료{" "}
          {disputeHoldExpiresAt.toLocaleString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

      {/* (b) 게이팅 상태 라벨 — allowed=false 시 표시 */}
      {!isAlreadyFinalized && !acceptAllowed && gateMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-400/50 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-200">
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
            Accept — 이번 달 포트 확정
          </Button>
          <Button
            variant="destructive"
            size="default"
            onClick={() => setModal("reject")}
            disabled={isPending || disputeBlocked}
          >
            Reject — 재분석 요청
          </Button>
        </div>
      )}

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
              이 Short List 30을 {monthLabel} 포트폴리오로 확정하시겠습니까?
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-center text-sm">
            <div>
              <div className="text-xs text-muted-foreground">신규 편입</div>
              <div className="mt-1 font-mono text-lg font-semibold" style={{ color: "var(--color-market-up)" }}>
                {newCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">유지</div>
              <div className="mt-1 font-mono text-lg font-semibold text-muted-foreground">
                {holdCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">제외</div>
              <div className="mt-1 font-mono text-lg font-semibold" style={{ color: "var(--color-market-down)" }}>
                {removedCount}
              </div>
            </div>
          </div>

          {/* 게이팅 차단 메시지 — 모달 내에도 표시 (오인 방지) */}
          {!acceptAllowed && gateMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-sky-400/50 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-200">
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
              Short List 30을 Reject하고 재분석을 요청합니다. 이번 달은 전월 포트가 유지됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="reject-reason" className="text-xs font-medium text-muted-foreground">
              Reject 사유 (선택 · 입력 시 기록됨)
            </label>
            <textarea
              id="reject-reason"
              rows={4}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-muted-foreground focus:ring-ring/50 focus-visible:ring-ring/50"
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
              {isPending ? "처리 중…" : "Reject"}
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
              확정된 포트폴리오에 이의를 제기합니다. 접수 후 48h Hold가 시작되며, 그 동안 Accept/Reject가 비활성화됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="dispute-reason" className="text-xs font-medium text-muted-foreground">
                이의 사유 (필수 · 20자 이상)
              </label>
              <span
                className={`text-xs font-mono ${
                  disputeReason.length >= DISPUTE_REASON_MIN_LENGTH
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                }`}
              >
                {disputeReason.length} / {DISPUTE_REASON_MIN_LENGTH}자
              </span>
            </div>
            <textarea
              id="dispute-reason"
              rows={4}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-muted-foreground focus:ring-ring/50 focus-visible:ring-ring/50"
              placeholder="이의 사유를 20자 이상 입력하세요..."
              value={disputeReason}
              onChange={(e) => {
                setDisputeReason(e.target.value);
                setDisputeError(null);
              }}
            />
            {disputeError && (
              <p className="text-xs text-red-500 dark:text-red-400">{disputeError}</p>
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
    </div>
  );
}

function formatMonthLabel(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${Number(m)}월`;
}
