import { createClient } from "@/lib/supabase/server";
import { listExchangeCredentials } from "@/lib/credentials/exchange";
import { Button } from "@/components/ui/button";
import { ExchangeForm } from "./form";
import { DeleteButton } from "./delete-button";

// /admin/settings/binance — Server Component
// DQ-7 Session 2 · T10 · §5.1·§5.5·§5.6

export default async function BinancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isRep = Boolean(
    user?.email &&
      process.env.ADMIN_REP_EMAIL &&
      user.email === process.env.ADMIN_REP_EMAIL,
  );

  const rows = await listExchangeCredentials();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">
          거래소 키 (Binance USDT-M Futures)
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          바이낸스 USDT-M 선물 API 키 저장. 각 어드민 본인 계정만 조회·저장·삭제
          가능합니다.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ※ 메인넷 등록은 대표 1인만 가능 · 테스트넷 키는 전원 가능 · 실 API
          ping은 S8에서 활성화
        </p>
      </header>

      <section aria-label="등록된 Binance 키">
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            등록된 Binance 키 없음. 아래에서 추가하세요.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={
                          row.testnetMode
                            ? {
                                background: "var(--muted)",
                                color: "var(--muted-foreground)",
                              }
                            : {
                                background:
                                  "color-mix(in srgb, var(--color-market-up) 15%, transparent)",
                                color: "var(--color-market-up)",
                              }
                        }
                      >
                        {row.testnetMode
                          ? "Binance USDT-M 테스트넷"
                          : "Binance USDT-M 메인넷"}
                      </span>
                      <span className="text-sm font-medium">{row.label}</span>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.apiKeyMasked} · 시크릿 저장됨 ✓
                    </p>
                    <p className="text-xs text-muted-foreground">
                      등록:{" "}
                      {new Date(row.createdAt).toLocaleString("ko-KR")}
                      {" "}· 마지막:{" "}
                      {row.lastUsedAt
                        ? new Date(row.lastUsedAt).toLocaleString("ko-KR")
                        : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="S8에서 활성화됩니다"
                    >
                      🔌 테스트
                    </Button>
                    <DeleteButton id={row.id} label={row.label} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExchangeForm isRep={isRep} />
    </div>
  );
}
