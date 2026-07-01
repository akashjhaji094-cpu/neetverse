// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { EmailBlock, AudienceType, AudienceFilter, EmailCampaign } from "@/lib/email/types";

export function useCampaignHistory() {
  return useQuery({
    queryKey: ["email-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailCampaign[];
    },
  });
}

export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string; title: string; subject: string; blocks: EmailBlock[];
      audience_type: AudienceType; audience_filter: AudienceFilter;
    }) => {
      if (input.id) {
        const { error } = await supabase.from("email_campaigns")
          .update({ title: input.title, subject: input.subject, blocks: input.blocks as any,
            audience_type: input.audience_type, audience_filter: input.audience_filter as any,
            updated_at: new Date().toISOString() })
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase.from("email_campaigns")
        .insert({ title: input.title, subject: input.subject, blocks: input.blocks as any,
          audience_type: input.audience_type, audience_filter: input.audience_filter as any,
          status: "draft" })
        .select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-campaigns"] }),
  });
}

export function useDuplicateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaign: EmailCampaign) => {
      const { data, error } = await supabase.from("email_campaigns")
        .insert({
          title: `${campaign.title} (Copy)`, subject: campaign.subject,
          blocks: campaign.blocks as any, audience_type: campaign.audience_type,
          audience_filter: campaign.audience_filter as any, status: "draft",
        }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-campaigns"] }),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const token = session?.access_token;
      
      // यहाँ पर आपका नया Fetch और Error Handling लॉजिक लागू किया गया है
      const res = await fetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaignId }),
      });
      
      const text = await res.text();
      console.log("Status:", res.status);
      console.log("Response:", text);

      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Server returned: ${text}`);
      }

      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-campaigns"] }),
  });
}

export function useAudiencePreviewCount(audienceType: AudienceType, filter: AudienceFilter) {
  return useQuery({
    queryKey: ["audience-count", audienceType, filter],
    queryFn: async () => {
      if (audienceType === "single") return filter.email ? 1 : 0;
      if (audienceType === "selected") return filter.user_ids?.length || 0;

      if (audienceType === "all") {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        return count || 0;
      }

      // premium / free — based on active premium_access_keys
      const { data: activeKeys } = await supabase
        .from("premium_access_keys")
        .select("user_id, expires_at, is_active")
        .eq("is_active", true);
      const now = Date.now();
      const premiumIds = new Set(
        (activeKeys || [])
          .filter((k) => !k.expires_at || new Date(k.expires_at).getTime() > now)
          .map((k) => k.user_id)
      );
      const { count: totalUsers } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      return audienceType === "premium" ? premiumIds.size : (totalUsers || 0) - premiumIds.size;
    },
  });
}
