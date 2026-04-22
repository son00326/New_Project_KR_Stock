"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertExchangeCredential } from "@/lib/credentials/exchange";
import { SecretInput } from "@/components/admin/credentials/secret-input";
import { Button } from "@/components/ui/button";

// /admin/settings/binance — Client Form island
// DQ-7 Session 2 · T10 · §5.3·§5.5·§5.7

interface ExchangeFormProps {
  isRep: boolean;
}

type Banner =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

export function ExchangeForm({ isRep }: ExchangeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnetMode, setTestnetMode] = useState(true);
  const [banner, setBanner] = useState<Banner>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);

    startTransition(async () => {
      const res = await upsertExchangeCredential({
        exchange: "binance_futures",
        label,
        apiKey,
        apiSecret,
        testnetMode,
      });

      if (res.success) {
        setBanner({ kind: "success", message: "저장되었습니다." });
        setLabel("");
        setApiKey("");
        setApiSecret("");
        setTestnetMode(true);
        router.refresh();
      } else {
        setBanner({ kind: "error", message: res.error });
      }
    });
  }

  const submitDisabled =
    isPending || !label.trim() || !apiKey || !apiSecret;

  return (
    <section aria-label="새 Binance 키 추가" className="rounded-lg border bg-card p-4">
      <h2 className="mb-4 text-sm font-semibold">새 Binance 키 추가</h2>

      {banner && (
        <div
          role="alert"
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            banner.kind === "success"
              ? "border-emerald-400/50 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-[var(--color-market-down)]/40 bg-[var(--color-market-down)]/10 text-[var(--color-market-down)]"
          }`}
        >
          {banner.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 거래소 (informational) */}
        <div className="space-y-1">
          <label
            htmlFor="exchange-display"
            className="text-xs font-medium text-muted-foreground"
          >
            거래소
          </label>
          <select
            id="exchange-display"
            disabled
            className="w-full rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          >
            <option>Binance USDT-M Futures (현재 유일)</option>
          </select>
        </div>

        {/* 라벨 */}
        <div className="space-y-1">
          <label
            htmlFor="binance-label"
            className="text-xs font-medium text-muted-foreground"
          >
            라벨 (1–40자)
          </label>
          <input
            id="binance-label"
            type="text"
            maxLength={40}
            placeholder="main-futures"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-1 ring-transparent placeholder:text-muted-foreground focus:ring-ring/50"
          />
          <span className="block text-right font-mono text-xs text-muted-foreground">
            ({label.length}/40)
          </span>
        </div>

        {/* API_KEY */}
        <div className="space-y-1">
          <label
            htmlFor="binance-api-key"
            className="text-xs font-medium text-muted-foreground"
          >
            API_KEY
          </label>
          <SecretInput
            id="binance-api-key"
            name="apiKey"
            value={apiKey}
            onValueChange={setApiKey}
            maxLength={64}
            placeholder="64자 영숫자"
            required
            ariaLabel="Binance API Key"
          />
        </div>

        {/* API_SECRET */}
        <div className="space-y-1">
          <label
            htmlFor="binance-api-secret"
            className="text-xs font-medium text-muted-foreground"
          >
            API_SECRET
          </label>
          <SecretInput
            id="binance-api-secret"
            name="apiSecret"
            value={apiSecret}
            onValueChange={setApiSecret}
            maxLength={64}
            placeholder="64자 영숫자"
            required
            ariaLabel="Binance API Secret"
          />
        </div>

        {/* 모드 */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted-foreground">
            모드
          </legend>
          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="testnetMode"
                checked={testnetMode}
                onChange={() => setTestnetMode(true)}
              />
              테스트넷 (testnet.binancefuture.com)
            </label>
            <label
              title={!isRep ? "대표 전용" : undefined}
              className={`flex items-center gap-2 text-sm ${!isRep ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name="testnetMode"
                checked={!testnetMode}
                onChange={() => setTestnetMode(false)}
                disabled={!isRep}
              />
              메인넷{" "}
              {!isRep && (
                <span className="text-muted-foreground">(대표 전용)</span>
              )}
            </label>
          </div>
        </fieldset>

        <Button type="submit" disabled={submitDisabled}>
          {isPending ? "저장 중…" : "저장"}
        </Button>
      </form>
    </section>
  );
}
