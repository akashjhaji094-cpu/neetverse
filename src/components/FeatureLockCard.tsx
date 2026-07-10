import { useEffect } from "react";
import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface FeatureLockCardProps {
  featureName: string;
  description: string;
  onMount?: () => void;
}

export function FeatureLockCard({ featureName, description, onMount }: FeatureLockCardProps) {
  const navigate = useNavigate();
  useEffect(() => { onMount?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <div className="p-4 rounded-2xl mb-4" style={{ background: "#FFF8E1" }}>
        <Lock className="h-10 w-10" style={{ color: "#D4AF37" }} />
      </div>
      <h2 className="text-xl font-bold mb-2">{featureName} is a Premium Feature</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
      <Button
        onClick={() => navigate("/premium")}
        className="gap-2 border-none"
        style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)", color: "#1A1A1A" }}
      >
        <Crown className="h-4 w-4" /> Upgrade to Premium
      </Button>
    </div>
  );
}
