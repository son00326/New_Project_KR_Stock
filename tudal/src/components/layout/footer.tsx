import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { JoopickLogo } from "@/components/layout/logo";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* 브랜드 */}
          <div className="space-y-4">
            <JoopickLogo size="md" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              똑똑한 주식 픽
              <br />
              AI 기반 주식 분석 플랫폼
            </p>
          </div>

          {/* 서비스 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">서비스</h4>
            <nav className="flex flex-col gap-2">
              <Link href="/stock" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                종목 분석
              </Link>
              <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                요금제
              </Link>
            </nav>
          </div>

          {/* 고객 지원 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">고객 지원</h4>
            <nav className="flex flex-col gap-2">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                자주 묻는 질문
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                문의하기
              </Link>
            </nav>
          </div>

          {/* 법적 고지 */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">법적 고지</h4>
            <nav className="flex flex-col gap-2">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                이용약관
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                개인정보처리방침
              </Link>
            </nav>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; 2026 주픽(JooPick). All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground text-center md:text-right leading-relaxed">
            주픽에서 제공하는 정보는 투자 참고용이며, 투자 판단의 최종 책임은 이용자 본인에게 있습니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
