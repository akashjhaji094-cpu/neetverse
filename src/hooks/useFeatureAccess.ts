import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const TRIAL_DAYS = 7;

export function useFeatureAccess() {
  const { user, isGuest } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["feature-access", user?.id],
    queryFn: async () => {
      if (!user) return { hasKey: false, createdAt: null as string | null };
      const [{ data: keys }, { data: profile }] = await Promise.all([
        supabase.from("premium_access_keys").select("id, expires_at").eq("user_id", user.id).eq("is_active", true),
        supabase.from("profiles").select("created_at").eq("id", user.id).single(),
      ]);
      const activeKey = (keys || []).find((k) => !k.expires_at || new Date(k.expires_at) > new Date());
      return { hasKey: !!activeKey, createdAt: profile?.created_at ?? null };
    },
    enabled: !!user && !isGuest,
    staleTime: 1000 * 60,
  });

  const trialDaysLeft = data?.createdAt
    ? TRIAL_DAYS - Math.floor((Date.now() - new Date(data.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isTrialActive = !data?.hasKey && trialDaysLeft > 0;

  return {
    isLoading,
    hasAccess: !!data?.hasKey || isTrialActive,
    isPremium: !!data?.hasKey,
    isTrialActive,
    trialDaysLeft: Math.max(0, trialDaysLeft),
  };
}
