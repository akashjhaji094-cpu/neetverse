export type EmailBlock =
  | { type: "headline"; text: string }
  | { type: "subheading"; text: string }
  | { type: "text"; html: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "button"; text: string; url: string; style?: "primary" | "secondary" }
  | { type: "featureCard"; icon?: string; title: string; description: string }
  | { type: "coloredSection"; bgColor: string; blocks: EmailBlock[] }
  | { type: "divider" }
  | { type: "footer"; socials?: { telegram?: string; website?: string } };

export type AudienceType = "all" | "premium" | "free" | "selected" | "single";

export interface AudienceFilter {
  user_ids?: string[];
  email?: string;
}

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export interface EmailCampaign {
  id: string;
  title: string;
  subject: string;
  blocks: EmailBlock[];
  audience_type: AudienceType;
  audience_filter: AudienceFilter;
  status: CampaignStatus;
  trigger_type: string;
  provider_used: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  sent_by: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  blocks: EmailBlock[];
  is_builtin: boolean;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
