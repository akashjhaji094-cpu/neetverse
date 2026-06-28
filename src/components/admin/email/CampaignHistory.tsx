import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCampaignHistory, useDuplicateCampaign } from "@/hooks/useEmailCampaigns";
import { format } from "date-fns";
import { Copy, Loader2 } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  draft: "secondary", scheduled: "outline", sending: "default", sent: "default", failed: "destructive",
};

export function CampaignHistory({ onEdit }: { onEdit: (id: string) => void }) {
  const { data, isLoading } = useCampaignHistory();
  const duplicate = useDuplicateCampaign();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No campaigns yet.</p>;

  return (
    <div className="space-y-2">
      {data.map((c) => (
        <Card key={c.id}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-sm truncate">{c.title}</p>
                <Badge variant={STATUS_COLOR[c.status] as any} className="text-[10px] capitalize">{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {c.audience_type} • {c.sent_count}/{c.total_recipients} sent
                {c.failed_count > 0 && <span className="text-destructive"> • {c.failed_count} failed</span>}
                {" • "}{format(new Date(c.created_at), "d MMM, h:mm a")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(c.id)}>Open</Button>
              <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(c)}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
