import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { applyPendingReferralIfAny, tryCompleteReferral } from "@/hooks/useReferral";

export function useResolvePendingReferral() {
  const { user } = useAuth();
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || ranFor.current === user.id) return;
    ranFor.current = user.id;
    applyPendingReferralIfAny(user.id);
    tryCompleteReferral(user.id);
  }, [user?.id]);
}
