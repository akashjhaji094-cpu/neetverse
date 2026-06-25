import { useState, useEffect } from "react";
import { Crown, X, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function PremiumWelcomePopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("nv_welcome_v1")) {
      const t = setTimeout(() => setOpen(true), 1800);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem("nv_welcome_v1", "1");
    setOpen(false);
  };

  const getPremium = () => {
    window.open("https://t.me/Neetverseowner_bot?text=I%20want%20subscription", "_blank");
    close();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden gap-0"
        style={{ border: "2px solid #D4AF37", borderRadius: "16px" }}
      >
        {/* Gold header */}
        <div
          className="relative px-6 pt-7 pb-5 text-center"
          style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)" }}
        >
          <button
            onClick={close}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X className="w-4 h-4" style={{ color: "#1A1A1A" }} />
          </button>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown   className="w-7 h-7" style={{ color: "#1A1A1A" }} />
            <Sparkles className="w-5 h-5" style={{ color: "#1A1A1A" }} />
          </div>
          <h2 className="text-xl font-black" style={{ color: "#1A1A1A" }}>
            🎉 Welcome to NEETVerse!
          </h2>
          <p className="text-sm mt-1 font-semibold" style={{ color: "rgba(26,26,26,0.72)" }}>
            ✨ Your free trial is now active!
          </p>
        </div>

        {/* White body */}
        <div className="px-6 py-6 text-center" style={{ background: "#fff" }}>
          <p className="text-sm mb-5" style={{ color: "#555" }}>
            Explore all features. Upgrade to{" "}
            <strong style={{ color: "#D4AF37" }}>Premium</strong> anytime for
            just <strong>₹199/month</strong> — early bird price for first{" "}
            <strong>999 students</strong>.
          </p>

          <button
            onClick={getPremium}
            className="w-full py-3 rounded-xl font-bold mb-3 flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-md"
            style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)", color: "#1A1A1A" }}
          >
            <Crown className="w-4 h-4" />
            Get Premium 👑
          </button>

          <button
            onClick={close}
            className="w-full py-2.5 rounded-xl font-semibold text-sm border-2 hover:bg-yellow-50 transition-colors"
            style={{ borderColor: "#D4AF37", color: "#B8860B" }}
          >
            Explore Free →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
