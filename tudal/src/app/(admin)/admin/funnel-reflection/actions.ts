"use server";

import { revalidatePath } from "next/cache";
import { decideFunnelReflection } from "@/lib/data/admin-funnel-reflection";

// G1 funnel reflection 제안 승인/거절 — **status 기록만**(funnel/production 무변경, 자동 적용 영구 금지).
export async function decideFunnelReflectionProposal(input: {
  id: string;
  decision: "approved" | "rejected";
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!input || typeof input !== "object") {
    return { success: false, error: "invalid_input" };
  }
  if (input.decision !== "approved" && input.decision !== "rejected") {
    return { success: false, error: "invalid_decision" };
  }
  if (typeof input.id !== "string" || !input.id.trim()) {
    return { success: false, error: "invalid_input" };
  }
  const res = await decideFunnelReflection(input.id, input.decision);
  if (!res.success) {
    return { success: false, error: res.error ?? "funnel_reflection_decide_failed" };
  }
  revalidatePath("/admin/funnel-reflection");
  return { success: true };
}
