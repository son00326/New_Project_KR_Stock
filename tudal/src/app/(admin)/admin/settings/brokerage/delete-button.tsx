"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBrokerageCredential } from "@/lib/credentials/brokerage";
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

interface DeleteButtonProps {
  id: string;
  accountNoMasked: string;
}

export function DeleteButton({ id, accountNoMasked }: DeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteBrokerageCredential(id);
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
            <DialogTitle>KIS 계좌 삭제 확인</DialogTitle>
            <DialogDescription>
              계좌 {accountNoMasked}의 키·시크릿을 영구 삭제합니다. 복구 불가.
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
