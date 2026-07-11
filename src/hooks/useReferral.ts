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
  { count: 15, reward: "6 Months Free Premium" },
  { count: 30, reward: "1 Year Free Premium" },
];

const PENDING_REFERRAL_KEY = "neetverse_pending_referral";

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
      const { data } = await supabase.from("referrals").select("status").eq("referrer_id", user.id);
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
 * Call right after signup with the ?ref= code from the URL.
 *
 * signUp() requires email confirmation, so there's no active session yet —
 * auth.uid() is null and every write below gets silently rejected by RLS.
 * This still tries immediately (in case confirmation is off for you), but
 * ALSO stashes the code in localStorage so applyPendingReferralIfAny() can
 * finish the job once the user has a real, confirmed session.
 */
export async function applyReferralCode(referralCode: string, newUserId: string) {
  if (!referralCode) return;

  try {
    localStorage.setItem(PENDING_REFERRAL_KEY, JSON.stringify({ code: referralCode, userId: newUserId }));
  } catch {
    /* storage blocked — immediate attempt below is the only shot */
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", referralCode.toUpperCase())
      .maybeSingle();

    if (referrer && referrer.id !== newUserId) {
      const { error: updateErr } = await supabase.from("profiles").update({ referred_by: referrer.id }).eq("id", newUserId);
      const { error: insertErr } = await supabase.from("referrals").insert({
        referrer_id: referrer.id,
        referred_id: newUserId,
        status: "pending",
      });
      if (!updateErr && !insertErr) {
        try { localStorage.removeItem(PENDING_REFERRAL_KEY); } catch { /* ignore */ }
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * Wired into DashboardLayout (every authenticated page) via
 * useResolvePendingReferral — runs once a confirmed session exists.
 */
export async function applyPendingReferralIfAny(currentUserId: string) {
  let stored: { code: string; userId: string } | null = null;
  try {
    const raw = localStorage.getItem(PENDING_REFERRAL_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    return;
  }
  if (!stored || stored.userId !== currentUserId) return;
  await applyReferralCode(stored.code, currentUserId);
}

/** Safe to call repeatedly — DB function only rewards once. */
export async function tryCompleteReferral(userId: string) {
  await supabase.rpc("complete_referral_for_user", { p_user_id: userId });
}
