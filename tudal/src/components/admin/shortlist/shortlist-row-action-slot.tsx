"use client";

import type { ReactNode } from "react";

// Issue 1 fix (58차 mock-cleanup Step 1, omxy Mill HIGH + Cicero 강찬성):
// shortlist-row.tsx는 Server Component인데 onClick={(e)=>e.stopPropagation()}를
// host <div>에 직접 attach하면 Next.js 16 RSC throw → /admin/portfolio (action 주입)에서만 발현.
// action wrapper만 별도 'use client' 컴포넌트로 분리하여 ShortlistRow Server Component 보존 +
// client bundle scope 최소화 (B43 패턴, surgical).
export function ShortlistRowActionSlot({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex shrink-0 items-center border-l px-3"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
