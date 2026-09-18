import nodemailer from 'nodemailer';
import { getTransporter } from '../config/ethereal.js';

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export class EtherealService {
  /**
   * Send an email via Ethereal fake SMTP and return preview URL
   */
  static async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const transporter = await getTransporter();

    const mailOptions = {
      from: options.from || 'ReachInbox Demo <sender@reachinbox.ai>',
      to: options.to,
      subject: options.subject,
      text: options.text || options.html?.replace(/<[^>]*>?/gm, '') || '',
      html: options.html || `<p>${options.text || ''}</p>`,
    };

    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl || false,
    };
  }
}
