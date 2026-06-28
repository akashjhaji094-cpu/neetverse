import type { SendResult } from "../types";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
}

export interface EmailProvider {
  name: string;
  send(params: SendEmailParams): Promise<SendResult>;
}
