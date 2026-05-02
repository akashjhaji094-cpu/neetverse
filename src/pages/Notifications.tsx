import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Megaphone } from "lucide-react";

const Notifications = () => {
  const { data: broadcasts, isLoading } = useQuery({
    queryKey: ["user-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">Announcements from the NEETVerse team</p>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (!broadcasts || broadcasts.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No notifications yet.
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {broadcasts?.map((b) => (
            <Card key={b.id} className={b.is_active ? "border-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{b.title}</span>
                  {b.is_active && <Badge>Active</Badge>}
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {new Date(b.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{b.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
