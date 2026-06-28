import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || ""; // optional — falls back to ManualProvider if unset

function renderEmailHtmlServer(blocks: any[], subject = ""): string {
  // Lightweight inline copy of the renderer so this serverless file has no
  // build-time dependency on the frontend src/ tree. Keep in sync with
  // src/lib/email/renderEmailHtml.ts if you add new block types.
  const FONT = "Arial, Helvetica, sans-serif";
  const GOLD = "#C9A227", GOLD_DARK = "#9C7E1A", INK = "#1A1A1A", MUTED = "#6B6B6B", BORDER = "#EDEDED";
  const esc = (s: string) => String(s || "").replace(/"/g, "&quot;");

  const renderBlock = (b: any): string => {
    switch (b.type) {
      case "headline": return `<tr><td style="padding:24px 32px 8px;font-family:${FONT};font-size:26px;font-weight:700;color:${INK};">${b.text}</td></tr>`;
      case "subheading": return `<tr><td style="padding:0 32px 16px;font-family:${FONT};font-size:15px;color:${MUTED};">${b.text}</td></tr>`;
      case "text": return `<tr><td style="padding:0 32px 16px;font-family:${FONT};font-size:15px;line-height:1.7;color:${INK};">${b.html}</td></tr>`;
      case "image": return `<tr><td style="padding:0 32px 16px;"><img src="${esc(b.url)}" alt="${esc(b.alt||"")}" width="536" style="width:100%;max-width:536px;height:auto;display:block;border:0;border-radius:8px;"/></td></tr>`;
      case "button": {
        const bg = b.style === "secondary" ? "#FFFFFF" : GOLD;
        const color = b.style === "secondary" ? GOLD_DARK : "#FFFFFF";
        const border = b.style === "secondary" ? `border:2px solid ${GOLD};` : "";
        return `<tr><td style="padding:8px 32px 16px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background-color:${bg};${border}"><a href="${esc(b.url)}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:${color};text-decoration:none;border-radius:8px;">${b.text}</a></td></tr></table></td></tr>`;
      }
      case "featureCard": return `<tr><td style="padding:0 32px 12px;"><table role="presentation" width="100%" style="border:1px solid ${BORDER};border-radius:8px;"><tr><td style="padding:16px 18px;">${b.icon?`<div style="font-size:20px;margin-bottom:6px;">${b.icon}</div>`:""}<div style="font-family:${FONT};font-size:15px;font-weight:700;color:${INK};margin-bottom:4px;">${b.title}</div><div style="font-family:${FONT};font-size:13.5px;color:${MUTED};">${b.description}</div></td></tr></table></td></tr>`;
      case "coloredSection": return `<tr><td style="background-color:${esc(b.bgColor)};"><table role="presentation" width="100%">${(b.blocks||[]).map(renderBlock).join("")}</table></td></tr>`;
      case "divider": return `<tr><td style="padding:8px 32px;"><div style="border-top:1px solid ${BORDER};"></div></td></tr>`;
      case "footer": {
        const tg = b.socials?.telegram, web = b.socials?.website;
        return `<tr><td style="padding:24px 32px;background-color:#FAFAFA;border-top:1px solid ${BORDER};"><table role="presentation" width="100%"><tr><td style="font-family:${FONT};font-size:12px;color:${MUTED};">NEETVerse — Your Universe of NEET Preparation<br/>${web?`<a href="${esc(web)}" style="color:${GOLD_DARK};text-decoration:none;">${web.replace(/^https?:\/\//,"")}</a>`:""}${tg?` &nbsp;•&nbsp; <a href="${esc(tg)}" style="color:${GOLD_DARK};text-decoration:none;">Telegram</a>`:""}</td></tr></table></td></tr>`;
      }
      default: return "";
    }
  };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${subject}</title></head>
  <body style="margin:0;padding:0;background-color:#F4F4F4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
  <tr><td style="padding:24px 32px 0;border-bottom:3px solid ${GOLD};"><table role="presentation" width="100%"><tr><td style="padding-bottom:16px;"><span style="font-family:${FONT};font-size:18px;font-weight:800;color:${INK};">NEET<span style="color:${GOLD_DARK};">Verse</span></span></td></tr></table></td></tr>
  ${blocks.map(renderBlock).join("")}
  </table></td></tr></table></body></html>`;
}

async function sendViaProvider(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log(`[ManualProvider] Would send to ${to} — "${subject}"`);
    return { success: true, provider: "manual" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "NEETVerse <onboarding@resend.dev>", to: [to], subject, html }),
    });
    if (!res.ok) return { success: false, provider: "resend", error: await res.text() };
    return { success: true, provider: "resend" };
  } catch (err: any) {
    return { success: false, provider: "resend", error: err?.message };
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Sign in required." });
  const token = authHeader.replace("Bearer ", "");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Server not configured." });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Session expired." });
  const userId = userData.user.id;

  // Admin-only — same role check used everywhere else in the Admin panel.
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["superadmin", "content_admin"]);
  if (!roles || roles.length === 0) return res.status(403).json({ error: "Admin access required." });

  const { campaignId } = req.body || {};
  if (!campaignId) return res.status(400).json({ error: "campaignId is required" });

  const { data: campaign, error: campErr } = await admin.from("email_campaigns").select("*").eq("id", campaignId).single();
  if (campErr || !campaign) return res.status(404).json({ error: "Campaign not found" });

  await admin.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);

  // ---- Resolve audience -> list of { user_id, email } ----
  let recipients: { user_id: string | null; email: string }[] = [];

  if (campaign.audience_type === "single") {
    recipients = [{ user_id: null, email: campaign.audience_filter?.email }];
  } else if (campaign.audience_type === "selected") {
    const ids: string[] = campaign.audience_filter?.user_ids || [];
    const { data: profiles } = await admin.from("profiles").select("id, email").in("id", ids);
    recipients = (profiles || []).map((p) => ({ user_id: p.id, email: p.email }));
  } else {
    const { data: profiles } = await admin.from("profiles").select("id, email");
    if (campaign.audience_type === "all") {
      recipients = (profiles || []).map((p) => ({ user_id: p.id, email: p.email }));
    } else {
      const { data: activeKeys } = await admin.from("premium_access_keys").select("user_id, expires_at, is_active").eq("is_active", true);
      const now = Date.now();
      const premiumIds = new Set((activeKeys || []).filter((k) => !k.expires_at || new Date(k.expires_at).getTime() > now).map((k) => k.user_id));
      recipients = (profiles || [])
        .filter((p) => (campaign.audience_type === "premium" ? premiumIds.has(p.id) : !premiumIds.has(p.id)))
        .map((p) => ({ user_id: p.id, email: p.email }));
    }
  }
  recipients = recipients.filter((r) => r.email);

  const html = renderEmailHtmlServer(campaign.blocks || [], campaign.subject);

  // Pre-create recipient rows as 'pending'
  const recipientRows = recipients.map((r) => ({
    campaign_id: campaignId, user_id: r.user_id, email: r.email, status: "pending",
  }));
  if (recipientRows.length > 0) {
    await admin.from("email_campaign_recipients").insert(recipientRows);
  }

  let sentCount = 0, failedCount = 0, providerUsed = "manual";

  for (const r of recipients) {
    const result = await sendViaProvider(r.email, campaign.subject, html);
    providerUsed = result.provider;
    if (result.success) sentCount++; else failedCount++;
    await admin.from("email_campaign_recipients")
      .update({ status: result.success ? "sent" : "failed", error_message: (result as any).error || null, sent_at: new Date().toISOString() })
      .eq("campaign_id", campaignId).eq("email", r.email);
  }

  await admin.from("email_campaigns").update({
    status: failedCount === recipients.length && recipients.length > 0 ? "failed" : "sent",
    sent_at: new Date().toISOString(),
    sent_by: userId,
    provider_used: providerUsed,
    total_recipients: recipients.length,
    sent_count: sentCount,
    failed_count: failedCount,
  }).eq("id", campaignId);

  return res.status(200).json({ total: recipients.length, sent: sentCount, failed: failedCount, provider: providerUsed });
             }
