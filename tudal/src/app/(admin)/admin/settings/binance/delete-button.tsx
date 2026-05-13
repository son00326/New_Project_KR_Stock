"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExchangeCredential } from "@/lib/credentials/exchange";
import { Button } from "@/components/ui/button";
import { formatErrorMessage } from "@/lib/admin/format-error";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// /admin/settings/binance — Delete confirm dialog
// DQ-7 Session 2 · T10 · §5.6

interface DeleteButtonProps {
  id: string;
  label: string;
}

export function DeleteButton({ id, label }: DeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteExchangeCredential(id);
      if (res.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        🗑 삭제
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Binance 키 삭제 확인</DialogTitle>
            <DialogDescription>
              라벨 &quot;{label}&quot;의 키·시크릿을 영구 삭제합니다. 복구 불가.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-[var(--color-market-down)]/40 bg-[var(--color-market-down)]/10 px-3 py-2 text-sm text-[var(--color-market-down)]"
            >
              {formatErrorMessage(error)}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              취소
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "삭제 중…" : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
