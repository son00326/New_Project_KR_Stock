import { listBrokerageCredentials } from "@/lib/credentials/brokerage";
import { describeCredentialListError } from "@/lib/credentials/errors";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { BrokerageForm } from "./form";
import { DeleteButton } from "./delete-button";

export default async function BrokeragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isRep = Boolean(
    user?.email &&
      process.env.ADMIN_REP_EMAIL &&
      user.email === process.env.ADMIN_REP_EMAIL,
  );

  let rows: Awaited<ReturnType<typeof listBrokerageCredentials>> = [];
  let loadError: ReturnType<typeof describeCredentialListError> | null = null;
  try {
    rows = await listBrokerageCredentials();
  } catch (err) {
    console.warn("[settings:brokerage] credential list unavailable", err);
    loadError = describeCredentialListError(err);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">증권사 키 (KIS)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          한국투자증권 OpenAPI 키 저장. 각 어드민 본인 계좌만 조회·저장·삭제
          가능합니다.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          ※ 실계좌 등록은 대표 1인만 가능 · 모의투자 키는 전원 가능 · 실 API
          ping은 S8에서 활성화
        </p>
      </header>

      <section aria-label="등록된 KIS 계좌">
        {loadError ? (
          <p
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100"
          >
            {loadError.message}
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            등록된 KIS 계좌 없음. 아래에서 추가하세요.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-toss-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    {/* 모드 배지 */}
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={
                        row.mockMode
                          ? {
                              background: "var(--muted)",
                              color: "var(--muted-foreground)",
                            }
                          : {
                              background: "color-mix(in srgb, var(--market-up) 15%, transparent)",
                              color: "var(--market-up)",
                            }
                      }
                    >
                      {row.mockMode ? "KIS 모의투자" : "KIS 실계좌"}
                    </span>

                    {/* 상세 정보 */}
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                      <dt className="text-muted-foreground">계좌</dt>
                      <dd className="font-mono">{row.accountNoMasked}</dd>

                      <dt className="text-muted-foreground">키</dt>
                      <dd className="font-mono">
                        {row.appKeyMasked} · 시크릿 저장됨 ✓
                      </dd>

                      <dt className="text-muted-foreground">전략</dt>
                      <dd>{row.strategyLabel ?? "—"}</dd>

                      <dt className="text-muted-foreground">등록</dt>
                      <dd>
                        {new Date(row.createdAt).toLocaleString("ko-KR")}
                      </dd>

                      <dt className="text-muted-foreground">마지막</dt>
                      <dd>
                        {row.lastUsedAt
                          ? new Date(row.lastUsedAt).toLocaleString("ko-KR")
                          : "—"}
                      </dd>
                    </dl>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      title="S8에서 활성화됩니다"
                    >
                      🔌 테스트
                    </Button>
                    <DeleteButton
                      id={row.id}
                      accountNoMasked={row.accountNoMasked}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BrokerageForm isRep={isRep} />
    </div>
  );
}
