import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Download } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PremiumAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccessGranted: () => void;
}

interface Planner {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
}

export const PremiumAccessDialog = ({
  open,
  onOpenChange,
  onAccessGranted,
}: PremiumAccessDialogProps) => {
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [planners, setPlanners] = useState<Planner[]>([]);

  const verifyAccessKey = async () => {
    if (!accessKey.trim()) {
      toast.error("Please enter an access key");
      return;
    }

    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    // Verify access key
    const { data: keyData, error: keyError } = await supabase
      .from("premium_access_keys")
      .select("*")
      .eq("access_key", accessKey)
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .single();

    if (keyError || !keyData) {
      toast.error("Invalid or inactive access key");
      setLoading(false);
      return;
    }

    // Fetch planners
    const { data: plannersData, error: plannersError } = await supabase
      .from("premium_planners")
      .select("*")
      .eq("access_key", accessKey)
      .order("created_at", { ascending: false });

    if (plannersError) {
      console.error(plannersError);
    }

    setHasAccess(true);
    setPlanners(plannersData || []);
    toast.success("Access verified! You can now access premium tests.");
    setLoading(false);
  };

  const handleContinue = () => {
    onAccessGranted();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Premium Test Access
          </DialogTitle>
          <DialogDescription>
            Enter your premium access key to unlock exclusive test content.
          </DialogDescription>
        </DialogHeader>

        {!hasAccess ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-key">Access Key</Label>
              <Input
                id="access-key"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="PRM-XXXX-XXXXXXX"
                className="font-mono"
              />
            </div>
            <Button onClick={verifyAccessKey} disabled={loading} className="w-full">
              <Key className="h-4 w-4 mr-2" />
              Verify Access
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                ✓ Access Verified Successfully
              </p>
            </div>

            {planners.length > 0 && (
              <div className="space-y-2">
                <Label>Available Test Planners</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {planners.map((planner) => (
                    <Card key={planner.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{planner.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {new Date(planner.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(planner.file_url, "_blank")}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleContinue} className="w-full">
              Continue to Premium Tests
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
