"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// 라이트↔다크 토글 (토스 — 큰 탭타깃 icon 사이즈).
// 아이콘은 next-themes가 paint 전 <html>에 주입하는 `.dark` 클래스에 CSS로 반응하므로
// mount-state 가드 없이 hydration-safe (서버/클라 마크업 동일 — sun/moon 둘 다 렌더, CSS가 토글).
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="다크/라이트 모드 전환"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden />
      <Moon className="block h-5 w-5 dark:hidden" aria-hidden />
    </Button>
  );
}
