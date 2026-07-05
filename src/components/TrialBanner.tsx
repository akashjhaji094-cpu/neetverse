import { useAuth } from "@/hooks/useAuth";
import { useMockLimits } from "@/hooks/useMockLimits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const TRIAL_DAYS = 7;

export function TrialBanner() {
  const { user } = useAuth();
  const { limits } = useMockLimits();

  const { data: createdAt } = useQuery({
    queryKey: ["profile-created-at", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("created_at").eq("id", user.id).single();
      return data?.created_at ?? null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 60,
  });

  if (!user || !createdAt || limits?.plan !== "free") return null;

  const daysSinceSignup = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = TRIAL_DAYS - daysSinceSignup;

  if (daysLeft <= 0) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white text-center"
      style={{ background: "linear-gradient(90deg,#F97316,#FB923C)" }}
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      <span>
        {daysLeft === 1 ? "Last day" : `${daysLeft} days left`} of your free trial —{" "}
        <Link to="/premium" className="underline font-bold">upgrade to keep full access</Link>
      </span>
    </div>
  );
}
