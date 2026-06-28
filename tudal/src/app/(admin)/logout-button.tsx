import { signOutAction } from "@/app/(auth)/login/actions";

// 어드민 헤더 우측 로그아웃 버튼. Server Action form으로 POST + redirect.
export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        로그아웃
      </button>
    </form>
  );
}
