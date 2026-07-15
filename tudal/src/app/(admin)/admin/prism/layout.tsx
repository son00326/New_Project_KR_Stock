import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function PrismLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
