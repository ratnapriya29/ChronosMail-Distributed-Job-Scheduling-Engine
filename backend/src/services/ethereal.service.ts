import axios from 'axios';
import { env } from '../config/env.js';

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: false;
}

export class EtherealService {
  /**
   * Send an email through Resend Email API.
   *
   * The class name is kept as EtherealService so the existing
   * worker does not need to be changed.
   */
  static async sendEmail(
    options: SendEmailOptions
  ): Promise<SendEmailResult> {

    if (!env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          // Resend's default testing sender.
          // This avoids needing to verify a custom domain for the demo.
          from: 'ChronosMail <onboarding@resend.dev>',
          to: [options.to],
          subject: options.subject,
          text:
            options.text ||
            options.html?.replace(/<[^>]*>?/gm, '') ||
            '',
          html:
            options.html ||
            `<p>${options.text || ''}</p>`,
        },
        {
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      console.log(
        `[Resend] Email sent successfully. Message ID: ${response.data.id}`
      );

      return {
        messageId: response.data.id,
        previewUrl: false,
      };

    } catch (error: any) {
      const resendError =
        error?.response?.data?.message ||
        error?.response?.data?.name ||
        error?.message ||
        'Unknown Resend error';

      console.error('[Resend] Failed to send email:', resendError);

      throw new Error(`Resend email failed: ${resendError}`);
    }
  }
}
