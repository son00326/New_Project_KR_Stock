import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// PR-fix2 (D) — 어드민 허용목록은 의도적 dual-gate (코드 통일은 별도 설계 PR로 defer):
//   (1) 본 env ADMIN_EMAILS = 미들웨어 + 로그인(login/actions.ts)의 pre-session gate. DB 조회 없이 빠른 차단.
//   (2) DB admin_emails 테이블 + is_admin() RPC = RLS / server-action gate (행 단위 권한, anon client RLS 경계).
//   두 소스는 같은 어드민 집합을 가리켜야 한다 — 한쪽만 갱신 시 silent drift(인증 불일치) 위험.
//   ⚠ 운영 체크리스트: 어드민 추가/제거 시 Vercel env ADMIN_EMAILS + DB admin_emails 를 반드시 동시 갱신.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith("/admin");

  if (isAdminPath) {
    // 비인증 유저 → 로그인으로 리다이렉트 (`next` 쿼리로 원래 경로 전달)
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    // 인증은 됐지만 ADMIN_EMAILS allowlist에 없으면 홈으로 리다이렉트
    const email = user.email?.toLowerCase();
    if (!email || !ADMIN_EMAILS.includes(email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
