import Link from "next/link";
import { Button } from "@/components/ui/button";
import { JoopickMark } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="flex justify-center mb-6 opacity-30">
          <JoopickMark size={64} />
        </div>
        <h1 className="text-4xl font-bold tracking-tight tabular-nums mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-6">
          페이지를 찾을 수 없습니다
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
          <Link href="/macro">
            <Button variant="outline">매크로 현황판 보기</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
