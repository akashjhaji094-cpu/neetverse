import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, Loader2, Trash2, Archive } from "lucide-react";

export function BroadcastManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("Announcement");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: broadcasts, isLoading } = useQuery({
    queryKey: ["admin-broadcasts-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const handleSend = async () => {
    if (!body.trim()) {
      toast.error("Message body cannot be empty");
      return;
    }
    if (!user) return;
    setSending(true);
    const { error } = await supabase.from("admin_broadcasts").insert({
      title: title.trim() || "Announcement",
      body: body.trim(),
      created_by: user.id,
      is_active: true,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Broadcast sent! All users will see it on next visit.");
    setBody("");
    qc.invalidateQueries({ queryKey: ["admin-broadcasts-list"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("admin_broadcasts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-broadcasts-list"] });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Broadcast Message</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Sending a new message will replace the current active one. Older messages move to the user's notifications.
          </p>

          <div className="space-y-3">
            <div>
              <Label htmlFor="bc-title">Title</Label>
              <Input
                id="bc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement"
              />
            </div>
            <div>
              <Label htmlFor="bc-body">Message</Label>
              <Textarea
                id="bc-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type the message users will see when they open the app…"
                rows={5}
              />
            </div>
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              Send Broadcast
            </Button>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Recent broadcasts
          </h3>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && (!broadcasts || broadcasts.length === 0) && (
            <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
          )}
          <div className="space-y-2">
            {broadcasts?.map((b) => (
              <div key={b.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{b.title}</span>
                    {b.is_active && <Badge>Active</Badge>}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(b.created_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{b.body}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
