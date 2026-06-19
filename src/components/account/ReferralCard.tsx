import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Copy, Check, Users } from "lucide-react";
import { useReferralCode, REFERRAL_TIERS } from "@/hooks/useReferral";
import { toast } from "sonner";

export function ReferralCard() {
  const { code, referralLink, stats, isLoading } = useReferralCode();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return null;

  const completed = stats?.completed ?? 0;
  const nextTier = stats?.nextTier;
  const progressPct = nextTier ? Math.min(100, (completed / nextTier.count) * 100) : 100;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Refer & Earn Free Premium
        </CardTitle>
        <CardDescription>Invite friends — no payment ever needed</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Link */}
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg border bg-muted px-3 py-2.5 text-sm font-mono truncate">
            {referralLink || "Generating your link..."}
          </div>
          <Button size="icon" variant="outline" onClick={handleCopy} disabled={!referralLink}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        {/* Progress to next tier */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {completed} friend{completed === 1 ? "" : "s"} joined
            </span>
            {nextTier && (
              <span className="font-medium text-primary">
                {nextTier.count - completed} more → {nextTier.reward}
              </span>
            )}
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Tier list */}
        <div className="grid grid-cols-2 gap-2">
          {REFERRAL_TIERS.map((tier) => {
            const unlocked = completed >= tier.count;
            return (
              <div
                key={tier.count}
                className={`rounded-lg border p-2.5 text-center transition-colors ${
                  unlocked ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"
                }`}
              >
                <div className={`text-sm font-bold ${unlocked ? "text-primary" : "text-muted-foreground"}`}>
                  {tier.count} {unlocked && "✓"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{tier.reward}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
