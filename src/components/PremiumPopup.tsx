import { Crown, MessageCircle, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PremiumPopupProps {
  open: boolean;
  onClose: () => void;
}

export function PremiumPopup({ open, onClose }: PremiumPopupProps) {
  const upgrade = () => {
    window.open("https://t.me/Neetverseowner_bot?text=I%20want%20subscription", "_blank");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
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
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors"
          >
            <X className="w-4 h-4" style={{ color: "#1A1A1A" }} />
          </button>
          <Crown className="w-10 h-10 mx-auto mb-2" style={{ color: "#1A1A1A" }} />
          <h2 className="text-xl font-black" style={{ color: "#1A1A1A" }}>
            Premium Feature ⭐
          </h2>
        </div>

        {/* White body */}
        <div className="px-6 py-6 text-center" style={{ background: "#fff" }}>
          <p className="text-sm mb-5" style={{ color: "#555" }}>
            Upgrade to <strong>NEETVerse Premium</strong> to unlock this
            feature and many more benefits!
          </p>

          {/* Price */}
          <div className="flex items-end justify-center gap-2 mb-6">
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
