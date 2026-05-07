import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

interface Broadcast {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

/**
 * Shows the latest active admin broadcast as a modal overlay
 * once per user per message. Dismissal records a read in user_broadcast_reads.
 */
export function BroadcastOverlay() {
  const { user } = useAuth();
  const [active, setActive] = useState<Broadcast | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      // Fetch latest active broadcast
      const { data: bc } = await supabase
        .from("admin_broadcasts")
        .select("id, title, body, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || !bc) return;

      // Show on every refresh until user explicitly confirms (this tab session).
      // We intentionally do NOT check user_broadcast_reads so that the announcement
      // re-appears after every page reload until "Got it" is clicked in that session.
      const dismissedKey = `broadcast_dismissed_${bc.id}`;
      if (sessionStorage.getItem(dismissedKey)) return;

      setActive(bc);
      setOpen(true);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleDismiss = async () => {
    if (!user || !active) return;
    // Mark dismissed for this tab session only — next refresh will show it again
    // unless the admin deactivates the broadcast.
    sessionStorage.setItem(`broadcast_dismissed_${active.id}`, "1");
    // Also record in DB for analytics (best-effort, ignore errors)
    supabase
      .from("user_broadcast_reads")
      .insert({ user_id: user.id, broadcast_id: active.id })
      .then(() => {});
    setOpen(false);
  };

  if (!active) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Megaphone className="h-5 w-5" />
            {active.title}
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm whitespace-pre-wrap py-2">{active.body}</div>
        <p className="text-[11px] text-muted-foreground">
          From Admin · {new Date(active.created_at).toLocaleString("en-IN")}
        </p>
        <DialogFooter>
          <Button onClick={handleDismiss} className="w-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
