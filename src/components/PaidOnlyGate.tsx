import { ReactNode } from "react";
import { Lock, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

/**
 * Hard paywall — trial users do NOT get through this gate, only a real
 * (non-trial) active premium key does.
 */
export function PaidOnlyGate({ featureName, description, children }: {
  featureName: string;
  description: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { isLoading, isPaid } = useFeatureAccess();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-10 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (isPaid) return <>{children}</>;

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center text-center py-20 px-4">
        <div className="p-4 rounded-2xl mb-4" style={{ background: "#FFF8E1" }}>
          <Lock className="h-10 w-10" style={{ color: "#D4AF37" }} />
        </div>
        <h2 className="text-xl font-bold mb-2">{featureName} is Premium-only</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-2">{description}</p>
        <p className="text-xs text-muted-foreground max-w-md mb-6">
          Not included in the free trial — a paid Premium plan is required.
        </p>
        <Button
          onClick={() => navigate("/premium")}
          className="gap-2 border-none"
          style={{ background: "linear-gradient(135deg,#D4AF37,#F5C842)", color: "#1A1A1A" }}
        >
          <Crown className="h-4 w-4" /> Get Premium — ₹499
        </Button>
      </div>
    </DashboardLayout>
  );
}