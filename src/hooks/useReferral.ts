import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function generateCode(seed: string) {
  const base = (seed || "NEET").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 4) || "NEET";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${rand}`;
}

export const REFERRAL_TIERS = [
  { count: 3,  reward: "1 Month Free Premium" },
  { count: 7,  reward: "3 Months Free Premium" },
  { count: 15, reward: "Till NEET 2027 Free" },
  { count: 30, reward: "Next 2 NEETs Free" },
];

/** Use inside Account page / a ReferralCard to show code + stats */
export function useReferralCode() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["referral-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, name, referral_code")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Auto-generate a referral code the first time we see this user has none
  useEffect(() => {
    if (!user || !profile || profile.referral_code) return;

    const code = generateCode(profile.name || user.email || "NEET");
    supabase
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", user.id)
      .then(() => qc.invalidateQueries({ queryKey: ["referral-profile", user.id] }));
  }, [user, profile, qc]);

  const { data: stats } = useQuery({
    queryKey: ["referral-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("referrals")
        .select("status")
        .eq("referrer_id", user.id);

      const completed = (data || []).filter((r) => r.status === "completed").length;
      const pending = (data || []).filter((r) => r.status === "pending").length;
      const nextTier = REFERRAL_TIERS.find((t) => completed < t.count) ?? null;

      return { completed, pending, nextTier };
    },
    enabled: !!user,
  });

  const referralLink = profile?.referral_code
    ? `${window.location.origin}/auth?ref=${profile.referral_code}`
    : null;

  return {
    code: profile?.referral_code ?? null,
    referralLink,
    stats: stats ?? { completed: 0, pending: 0, nextTier: REFERRAL_TIERS[0] },
    isLoading: profileLoading,
  };
}

/**
 * Call ONCE right after a brand-new signup, passing the ?ref= code from the URL.
 * Retries briefly in case the new user's `profiles` row hasn't been created yet
 * by the DB trigger.
 */
export async function applyReferralCode(referralCode: string, newUserId: string) {
  if (!referralCode) return;

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", referralCode.toUpperCase())
      .maybeSingle();

    if (referrer && referrer.id !== newUserId) {
      await supabase.from("profiles").update({ referred_by: referrer.id }).eq("id", newUserId);
      await supabase.from("referrals").insert({
        referrer_id: referrer.id,
        referred_id: newUserId,
        status: "pending",
      });
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * Call after ANY mock-related action completes (online submit, or offline paper
 * generated). Safe to call repeatedly — the DB function only rewards once.
 */
export async function tryCompleteReferral(userId: string) {
  await supabase.rpc("complete_referral_for_user", { p_user_id: userId });
}
