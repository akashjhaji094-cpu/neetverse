// src/components/admin/TelegramBotManager.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function TelegramBotManager() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["telegram-bot-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_bot_settings").select("*").eq("id", true).maybeSingle();
      return data;
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["telegram-bot-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("telegram_post_log").select("*").order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      await supabase.from("telegram_bot_settings").update({ is_active: next }).eq("id", true);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["telegram-bot-settings"] }),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#229ED9]/10">
              <Send className="h-5 w-5 text-[#229ED9]" />
            </div>
            <div>
              <p className="font-semibold text-sm">Telegram Channel Bot</p>
              <p className="text-xs text-muted-foreground">
                Auto-posts a question every ~{settings?.question_interval_minutes || 90} min and a
                promo every ~{settings?.promotion_interval_minutes || 210} min, whenever the site has visitors.
              </p>
            </div>
          </div>
          <Switch
            checked={!!settings?.is_active}
            onCheckedChange={(v) => toggle.mutate(v)}
            disabled={toggle.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent Activity</p>
          {!recentLogs || recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No posts yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-2.5 text-sm py-1.5 border-b last:border-0">
                  {log.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <Badge variant="outline" className="text-[10px] capitalize">{log.type}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(log.created_at), "d MMM, h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
