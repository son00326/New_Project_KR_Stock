"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBrokerageCredential } from "@/lib/credentials/brokerage";
import { SecretInput } from "@/components/admin/credentials/secret-input";
import { Button } from "@/components/ui/button";
import { formatErrorMessage } from "@/lib/admin/format-error";

interface BrokerageFormProps {
  isRep: boolean;
}

type Banner = { kind: "success" | "error"; message: string } | null;

export function BrokerageForm({ isRep }: BrokerageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [banner, setBanner] = useState<Banner>(null);

  const [accountNo, setAccountNo] = useState("");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [strategyLabel, setStrategyLabel] = useState("");
  const [mockMode, setMockMode] = useState(true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    startTransition(async () => {
      const res = await upsertBrokerageCredential({
        broker: "kis",
        accountNo,
        appKey,
        appSecret,
        mockMode,
        strategyLabel: strategyLabel.trim() ? strategyLabel.trim() : null,
      });
      if (res.success) {
        setBanner({ kind: "success", message: "저장되었습니다." });
        setAccountNo("");
        setAppKey("");
        setAppSecret("");
        setStrategyLabel("");
        setMockMode(true);
        router.refresh();
      } else {
        setBanner({ kind: "error", message: formatErrorMessage(res.error) });
      }
    });
  }

  return (
    <section aria-label="새 KIS 계좌 추가" className="rounded-2xl border border-border/60 bg-card p-5 shadow-toss-sm">
      <h2 className="mb-4 text-base font-semibold">새 KIS 계좌 추가</h2>

      {banner && (
        <div
          role="alert"
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            banner.kind === "success"
              ? "border-success/40 bg-success/10 text-success"
              : "border-market-down/40 bg-market-down/10 text-market-down"
          }`}
        >
          {banner.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 증권사 (informational only) */}
        <div className="space-y-1">
          <label htmlFor="broker-select" className="block text-sm font-medium">
            증권사
          </label>
          <select
            id="broker-select"
            disabled
            className="w-full rounded-xl border bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            <option>KIS (현재 유일)</option>
          </select>
        </div>

        {/* 계좌번호 */}
        <div className="space-y-1">
          <label htmlFor="account-no" className="block text-sm font-medium">
            계좌번호
          </label>
          <input
            id="account-no"
            type="text"
            inputMode="numeric"
            pattern="\d{8}-\d{2}"
            placeholder="12345678-01"
            required
            value={accountNo}
            onChange={(e) => setAccountNo(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm outline-none ring-1 ring-transparent placeholder:text-muted-foreground focus:ring-ring/50"
          />
        </div>

        {/* APP_KEY */}
        <div className="space-y-1">
          <label htmlFor="app-key" className="block text-sm font-medium">
            APP_KEY
          </label>
          <SecretInput
            id="app-key"
            name="appKey"
            value={appKey}
            onValueChange={setAppKey}
            maxLength={36}
            placeholder="36자리 영숫자"
            required
            ariaLabel="KIS APP_KEY"
          />
        </div>

        {/* APP_SECRET */}
        <div className="space-y-1">
          <label htmlFor="app-secret" className="block text-sm font-medium">
            APP_SECRET
          </label>
          <SecretInput
            id="app-secret"
            name="appSecret"
            value={appSecret}
            onValueChange={setAppSecret}
            maxLength={180}
            placeholder="180자리"
            required
            ariaLabel="KIS APP_SECRET"
          />
        </div>

        {/* 모드 */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">모드</legend>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="mockMode"
                checked={mockMode}
                onChange={() => setMockMode(true)}
                className="h-4 w-4 accent-primary"
              />
              모의투자
            </label>
            <label
              title={!isRep ? "대표 전용" : undefined}
              className="inline-flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="mockMode"
                checked={!mockMode}
                onChange={() => setMockMode(false)}
                disabled={!isRep}
                className="h-4 w-4 accent-primary"
              />
              실계좌{" "}
              {!isRep && (
                <span className="text-muted-foreground">(대표 전용)</span>
              )}
            </label>
          </div>
        </fieldset>

        {/* 전략 라벨 */}
        <div className="space-y-1">
          <label htmlFor="strategy-label" className="block text-sm font-medium">
            전략 라벨 <span className="text-muted-foreground">(선택)</span>
          </label>
          <input
            id="strategy-label"
            type="text"
            maxLength={40}
            placeholder="단기 모멘텀"
            value={strategyLabel}
            onChange={(e) => setStrategyLabel(e.target.value)}
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-muted-foreground focus:ring-ring/50"
          />
        </div>

        <Button
          type="submit"
          disabled={isPending || !accountNo || !appKey || !appSecret}
        >
          {isPending ? "저장 중…" : "저장"}
        </Button>
      </form>
    </section>
  );
}
