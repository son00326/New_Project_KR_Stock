"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SubscriptionTier } from "@/types/stock";

interface SubscriptionGateProps {
  requiredTier: "standard" | "pro";
  currentTier?: SubscriptionTier;
  featureName: string;
  children: React.ReactNode;
}

const TIER_LABEL = {
  standard: "Standard",
  pro: "Pro",
};

export function SubscriptionGate({
  requiredTier,
  currentTier = "free",
  featureName,
  children,
}: SubscriptionGateProps) {
  const tierOrder: SubscriptionTier[] = ["free", "standard", "pro"];
  const hasAccess =
    tierOrder.indexOf(currentTier) >= tierOrder.indexOf(requiredTier);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* 블러 처리된 콘텐츠 미리보기 */}
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* 오버레이 */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">{featureName}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            이 기능은{" "}
            <Badge variant="outline" className="mx-1">
              {TIER_LABEL[requiredTier]}
            </Badge>
            이상에서 이용 가능합니다
          </p>
          <Link href="/pricing">
            <Button size="sm">업그레이드하기</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
