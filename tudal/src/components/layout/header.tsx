"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { StockSearch } from "@/components/stock/stock-search";
import { JoopickLogo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* 로고 */}
        <Link href="/" className="shrink-0">
          <JoopickLogo size="md" />
        </Link>

        {/* 검색바 (데스크탑) */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <StockSearch variant="header" />
        </div>

        {/* 네비게이션 (데스크탑) */}
        <nav className="hidden md:flex items-center gap-6 shrink-0">
          <Link
            href="/macro"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            매크로 현황판
          </Link>
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">
              로그인
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">무료 시작하기</Button>
          </Link>
        </nav>

        {/* 모바일 메뉴 */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger
              className="inline-flex items-center justify-center rounded-lg p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col gap-6 mt-8">
                <StockSearch variant="header" placeholder="종목명 검색" />
                <nav className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href="/macro"
                      className="text-sm font-medium hover:text-foreground transition-colors"
                    >
                      매크로 현황판
                    </Link>
                    <ThemeToggle />
                  </div>
                  <Link href="/login">
                    <Button variant="ghost" className="w-full justify-start">
                      로그인
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button className="w-full">무료 시작하기</Button>
                  </Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
