import type { EmailProvider, SendEmailParams } from "./EmailProvider";
import type { SendResult } from "../types";

export class ManualProvider implements EmailProvider {
  name = "manual";

  async send(params: SendEmailParams): Promise<SendResult> {
    console.log(`[ManualProvider] Would send to ${params.to} — subject: "${params.subject}"`);
    return { success: true, messageId: `manual-${Date.now()}` };
  }
}
