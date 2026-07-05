import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanTier = "free" | "premium" | "coaching";

const LIMITS: Record<PlanTier, { online: number; offline: number }> = {
  free:     { online: 3, offline: 1 },
  premium:  { online: Infinity, offline: 6 },
  // coaching tier not wired up yet — once a `batch_members` table exists,
  // detect membership in the queryFn below and switch plan to "coaching".
  coaching: { online: Infinity, offline: 15 },
};

export interface MockLimits {
  plan: PlanTier;
  onlineUsed: number;
  offlineUsed: number;
  onlineLimit: number;
  offlineLimit: number;
  onlineRemaining: number;
  offlineRemaining: number;
  canTakeOnline: boolean;
  canTakeOffline: boolean;
}

/**
 * Rolling 7-day window (not calendar week) — fairer, no Sunday-midnight gaming.
 */
export function useMockLimits() {
  const { user, isGuest } = useAuth();

  const query = useQuery({
    queryKey: ["mock-limits", user?.id],
    queryFn: async (): Promise<MockLimits> => {
      if (!user) {
        return {
          plan: "free", onlineUsed: 0, offlineUsed: 0,
          onlineLimit: 0, offlineLimit: 0,
          onlineRemaining: 0, offlineRemaining: 0,
          canTakeOnline: false, canTakeOffline: false,
        };
      }

      // 1. Determine plan — premium if ANY active, non-expired key exists.
      //    FIX: fetch as an array, not .single()/.maybeSingle() — a user can
      //    legitimately end up with more than one active row (e.g. one
      //    admin-granted key + one referral-granted key). Using single()
      //    there would throw instead of just picking "is any of them valid".
      const { data: premiumRows } = await supabase
        .from("premium_access_keys")
        .select("expires_at, is_active")
        .eq("user_id", user.id)
        .eq("is_active", true);

      const isPremiumActive = (premiumRows || []).some(
        (r) => !r.expires_at || new Date(r.expires_at) > new Date()
      );

      const plan: PlanTier = isPremiumActive ? "premium" : "free";

      // 2. Count mocks taken in the rolling last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentMocks } = await supabase
        .from("attempts")
        .select("config")
        .eq("user_id", user.id)
        .eq("type", "mock")
        .gte("started_at", sevenDaysAgo);

      let onlineUsed = 0;
      let offlineUsed = 0;
      (recentMocks || []).forEach((row) => {
        const mode = (row.config as any)?.mode;
        if (mode === "offline") offlineUsed++;
        else onlineUsed++; // legacy rows with no mode tag count as online
      });

      const limits = LIMITS[plan];

      return {
        plan,
        onlineUsed,
        offlineUsed,
        onlineLimit: limits.online,
        offlineLimit: limits.offline,
        onlineRemaining: limits.online === Infinity ? Infinity : Math.max(0, limits.online - onlineUsed),
        offlineRemaining: Math.max(0, limits.offline - offlineUsed),
        canTakeOnline: limits.online === Infinity || onlineUsed < limits.online,
        canTakeOffline: offlineUsed < limits.offline,
      };
    },
    enabled: !!user && !isGuest,
    staleTime: 30_000,
  });

  return { limits: query.data, isLoading: query.isLoading, refetch: query.refetch };
}
