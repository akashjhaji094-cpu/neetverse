import type { EmailProvider, SendEmailParams } from "./EmailProvider";
import type { SendResult } from "../types";

export class ResendProvider implements EmailProvider {
  name = "resend";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(params: SendEmailParams): Promise<SendResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: params.fromEmail
            ? `${params.fromName || "NEETVerse"} <${params.fromEmail}>`
            : "NEETVerse <onboarding@resend.dev>",
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: errText };
      }
      const data = await res.json();
      return { success: true, messageId: data.id };
    } catch (err: any) {
      return { success: false, error: err?.message || "Unknown error" };
    }
  }
}
