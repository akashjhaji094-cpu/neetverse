import { Crown, X, Lock } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface FeatureLockedPopupProps {
  open: boolean;
  onClose: () => void;
  featureName: string;
}

export function FeatureLockedPopup({ open, onClose, featureName }: FeatureLockedPopupProps) {
  const upgrade = () => {
    window.open("https://t.me/Neetverseowner_bot?text=I%20want%20subscription", "_blank");
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0" style={{ border: "2px solid #D4AF37", borderRadius: "16px" }}>
        <div className="relative px-6 pt-7 pb-5 text-center" style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)" }}>
          <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-black/10 transition-colors">
            <X className="w-4 h-4" style={{ color: "#1A1A1A" }} />
          </button>
          <Lock className="w-10 h-10 mx-auto mb-2" style={{ color: "#1A1A1A" }} />
          <h2 className="text-lg font-black" style={{ color: "#1A1A1A" }}>Premium Feature</h2>
        </div>
        <div className="px-6 py-6 text-center bg-white dark:bg-background">
          <p className="text-sm mb-5 text-muted-foreground">
            You are not a Premium user and can't access <strong>{featureName}</strong>. Upgrade to unlock it — or refer 3 friends for a free month.
          </p>
          <button
            onClick={upgrade}
            className="w-full py-3 rounded-xl font-bold mb-3 flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-md"
            style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)", color: "#1A1A1A" }}
          >
            <Crown className="w-4 h-4" /> Upgrade — ₹199/month
          </button>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm border hover:bg-gray-50 transition-colors" style={{ borderColor: "#E0E0E0", color: "#777" }}>
            Maybe Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
