import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const TRIAL_DAYS = 7;

export function useFeatureAccess() {
  const { user, isGuest } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["feature-access", user?.id],
    queryFn: async () => {
      if (!user) return { hasKey: false, hasPaidKey: false, createdAt: null as string | null };
      const [{ data: keys }, { data: profile }] = await Promise.all([
        supabase
          .from("premium_access_keys")
          .select("id, access_key, expires_at")
          .eq("user_id", user.id)
          .eq("is_active", true),
        supabase.from("profiles").select("created_at").eq("id", user.id).single(),
      ]);
      const active = (keys || []).filter((k) => !k.expires_at || new Date(k.expires_at) > new Date());
      // Auto-granted trial keys ("TRIAL-…") are NOT a paid plan — they expire
      // 7 days after signup and never unlock paid-only features.
      const paid = active.filter((k) => !String(k.access_key ?? "").startsWith("TRIAL-"));
      return { hasKey: active.length > 0, hasPaidKey: paid.length > 0, createdAt: profile?.created_at ?? null };
    },
    enabled: !!user && !isGuest,
    staleTime: 1000 * 60,
  });

  const trialDaysLeft = data?.createdAt
    ? TRIAL_DAYS - Math.floor((Date.now() - new Date(data.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isTrialActive = !data?.hasPaidKey && trialDaysLeft > 0;

  return {
    isLoading,
    hasAccess: !!data?.hasPaidKey || isTrialActive,
    /** Real, paid (non-trial) premium. Use this for paid-only features. */
    isPaid: !!data?.hasPaidKey,
    isPremium: !!data?.hasPaidKey,
    isTrialActive,
    trialDaysLeft: Math.max(0, trialDaysLeft),
  };
}
