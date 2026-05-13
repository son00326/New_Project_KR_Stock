import Link from "next/link";
import { Button } from "@/components/ui/button";

// FixPlan-46 §P1.3 G-2-FE — /admin 라우트 그룹 공통 404 boundary.
// /admin/* 미존재 경로에 진입할 때 표시. 한국어 + 어드민 컨텍스트.
export default function AdminNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">관리자 페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-muted-foreground">
          잘못된 경로이거나 권한이 없는 메뉴일 수 있습니다.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/admin">
          <Button>관리자 홈으로</Button>
        </Link>
        <Link href="/admin/portfolio">
          <Button variant="outline">포트폴리오</Button>
        </Link>
      </div>
    </div>
  );
}
