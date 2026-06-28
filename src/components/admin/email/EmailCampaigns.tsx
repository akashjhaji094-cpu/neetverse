import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Save, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudienceSelector } from "@/components/admin/email/AudienceSelector";
import { CampaignBuilder } from "@/components/admin/email/CampaignBuilder";
import { EmailPreview } from "@/components/admin/email/EmailPreview";
import { TemplateLibrary } from "@/components/admin/email/TemplateLibrary";
import { CampaignHistory } from "@/components/admin/email/CampaignHistory";
import { useSaveDraft, useSendCampaign, useCampaignHistory } from "@/hooks/useEmailCampaigns";
import type { EmailBlock, AudienceType, AudienceFilter } from "@/lib/email/types";

export default function EmailCampaigns() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"compose" | "templates" | "history">("compose");
  const [campaignId, setCampaignId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>({});

  const saveDraft = useSaveDraft();
  const sendCampaign = useSendCampaign();
  const { data: history } = useCampaignHistory();

  const handleSave = async () => {
    if (!title || !subject) { toast({ title: "Title and subject are required", variant: "destructive" }); return; }
    const id = await saveDraft.mutateAsync({ id: campaignId, title, subject, blocks, audience_type: audienceType, audience_filter: audienceFilter });
    setCampaignId(id);
    toast({ title: "Draft saved" });
  };

  const handleSend = async () => {
    if (!campaignId) { await handleSave(); }
    const id = campaignId;
    if (!id) return;
    try {
      const result = await sendCampaign.mutateAsync(id);
      toast({ title: "Campaign sent!", description: `${result.sent}/${result.total} delivered via ${result.provider}.` });
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    }
  };

  const loadFromHistory = (id: string) => {
    const c = history?.find((h) => h.id === id);
    if (!c) return;
    setCampaignId(c.id);
    setTitle(c.title);
    setSubject(c.subject);
    setBlocks(c.blocks);
    setAudienceType(c.audience_type);
    setAudienceFilter(c.audience_filter);
    setTab("compose");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ background: "rgba(201,162,39,0.12)" }}>
          <Mail className="h-6 w-6" style={{ color: "#9C7E1A" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold">Email Campaigns</h2>
          <p className="text-sm text-muted-foreground">Compose, preview, and send announcements to your users</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Internal title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. June Premium Push" />
              </div>
              <div className="space-y-1.5">
                <Label>Email subject line</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What recipients see in their inbox" />
              </div>
            </CardContent>
          </Card>

          <AudienceSelector audienceType={audienceType} filter={audienceFilter} onChange={(t, f) => { setAudienceType(t); setAudienceFilter(f); }} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CampaignBuilder blocks={blocks} onChange={setBlocks} />
            <EmailPreview blocks={blocks} subject={subject} />
          </div>

          <div className="flex gap-2 justify-end sticky bottom-0 bg-background pt-3 pb-1">
            <Button variant="outline" onClick={handleSave} disabled={saveDraft.isPending}>
              {saveDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
            <Button onClick={handleSend} disabled={sendCampaign.isPending || blocks.length === 0}>
              {sendCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Now
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplateLibrary onUse={(b, name) => { setBlocks(b); setTitle(name); setCampaignId(undefined); setTab("compose"); }} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <CampaignHistory onEdit={loadFromHistory} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
