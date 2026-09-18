import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from './env.js';

let transporter: Transporter | null = null;
let testAccountCredentials: { user: string; pass: string } | null = null;

export const initEtherealTransporter = async (): Promise<Transporter> => {
  if (transporter) return transporter;

  try {
    let user = env.ETHEREAL.user;
    let pass = env.ETHEREAL.pass;

    if (!user || !pass) {
      console.log('[Ethereal] Generating new ethereal test SMTP account...');
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      testAccountCredentials = { user, pass };
      console.log(`[Ethereal] Test Account created: ${user}`);
    }

    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    console.log('[Ethereal] SMTP Transporter ready');
    return transporter;
  } catch (error: any) {
    console.error('[Ethereal] Failed to initialize transporter:', error.message);
    throw error;
  }
};

export const getTransporter = async (): Promise<Transporter> => {
  if (!transporter) {
    return await initEtherealTransporter();
  }
  return transporter;
};

export const getEtherealCredentials = () => testAccountCredentials;
