import { Crown, MessageCircle, X, Gift, AlertCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import type { PlanTier } from "@/hooks/useMockLimits";

interface PremiumPopupProps {
  open: boolean;
  onClose: () => void;
  /** Pass the user's current plan so a PAYING user who simply hit their
   *  weekly cap sees "you're out of quota", not "buy premium" again. */
  plan?: PlanTier;
  /** Which limit triggered this popup, for a more specific message. */
  limitType?: "online" | "offline";
}

export function PremiumPopup({ open, onClose, plan = "free", limitType }: PremiumPopupProps) {
  const upgrade = () => {
    window.open("https://t.me/Neetverseowner_bot?text=I%20want%20subscription", "_blank");
    onClose();
  };

  // Already paying — they just hit their weekly cap. Never show a buy pitch here.
  if (plan === "premium" || plan === "coaching") {
    const label = limitType === "online" ? "online mock" : limitType === "offline" ? "offline mock" : "mock test";
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-sm p-0 overflow-hidden gap-0" style={{ border: "2px solid #EF4444", borderRadius: "16px" }}>
          <div className="relative px-6 pt-7 pb-5 text-center bg-red-50 dark:bg-red-950/30">
            <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors">
              <X className="w-4 h-4 text-red-600" />
            </button>
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-600" />
            <h2 className="text-xl font-black text-red-600">You've Reached Your Limit</h2>
          </div>
          <div className="px-6 py-6 text-center bg-white dark:bg-background">
            <p className="text-sm mb-1 text-muted-foreground">
              You've used all your {label} attempts for this week.
            </p>
            <p className="text-sm mb-5 text-muted-foreground">
              Your quota refreshes on a rolling 7-day basis — check back in a few days.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold border hover:bg-muted transition-colors"
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Free user — show the upgrade pitch, with the free (referral) path front and center too.
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden gap-0"
        style={{ border: "2px solid #D4AF37", borderRadius: "16px" }}
      >
        <div className="relative px-6 pt-7 pb-5 text-center" style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)" }}>
          <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors">
            <X className="w-4 h-4" style={{ color: "#1A1A1A" }} />
          </button>
          <Crown className="w-10 h-10 mx-auto mb-2" style={{ color: "#1A1A1A" }} />
          <h2 className="text-xl font-black" style={{ color: "#1A1A1A" }}>
            Premium Feature ⭐
          </h2>
        </div>

        <div className="px-6 py-6 text-center" style={{ background: "#fff" }}>
          <p className="text-sm mb-5" style={{ color: "#555" }}>
            {limitType
              ? `You've used your free ${limitType} mock quota this week. Upgrade for more!`
              : <>Upgrade to <strong>NEETVerse Premium</strong> to unlock this feature and many more benefits!</>}
          </p>

          <div className="flex items-end justify-center gap-2 mb-5">
            <span className="text-xl line-through font-semibold" style={{ color: "#EF4444" }}>₹499</span>
            <span className="text-5xl font-black leading-none" style={{ color: "#D4AF37" }}>₹199</span>
            <span className="text-sm mb-1" style={{ color: "#999" }}>/month</span>
          </div>

          <button
            onClick={upgrade}
            className="w-full py-3 rounded-xl font-bold mb-3 flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-md"
            style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)", color: "#1A1A1A" }}
          >
            <MessageCircle className="w-4 h-4" />
            Upgrade — ₹199/month
          </button>

          <Link
            to="/account"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm border flex items-center justify-center gap-1.5 mb-3 hover:bg-amber-50 transition-colors"
            style={{ borderColor: "#D4AF37", color: "#B8860B" }}
          >
            <Gift className="w-3.5 h-3.5" />
            Or get it FREE — refer 3 friends
          </Link>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm border hover:bg-gray-50 transition-colors"
            style={{ borderColor: "#E0E0E0", color: "#777" }}
          >
            Maybe Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
