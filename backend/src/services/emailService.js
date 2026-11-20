import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (env.smtp.host && env.smtp.user && env.smtp.pass) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const activeTransporter = getTransporter();
  if (activeTransporter) {
    await activeTransporter.sendMail({
      from: env.smtp.from,
      to,
      subject,
      text,
      html,
    });
    return { delivered: true, mode: 'smtp' };
  }

  if (!env.isTest) {
    console.info(`\n[DEV EMAIL PREVIEW] To: ${to} | Subject: ${subject}\n${text}\n`);
  }
  return { delivered: true, mode: 'dev-preview' };
}

export async function sendVerificationEmail(user, rawToken) {
  const verifyUrl = `${env.clientUrl}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(user.email)}`;
  const subject = 'Verify your IdeaSpark account';
  const text = `Hi ${user.name},\n\nWelcome to IdeaSpark! Please verify your email by opening:\n${verifyUrl}\n\nThis link expires in 24 hours.`;
  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="color: #6E05F2; margin-bottom: 8px;">Welcome to IdeaSpark</h2>
      <p>Hi ${user.name},</p>
      <p>Verify your email address to start sharing ideas and collaborating safely.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background: #6E05F2; color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Verify Email Address
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">Or copy this link: ${verifyUrl}</p>
    </div>
  `;
  const result = await sendEmail({ to: user.email, subject, text, html });
  return { ...result, verifyUrl: env.isProd ? undefined : verifyUrl };
}

export async function sendPasswordResetEmail(user, rawToken) {
  const resetUrl = `${env.clientUrl}/forgot-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(user.email)}`;
  const subject = 'Reset your IdeaSpark password';
  const text = `Hi ${user.name},\n\nA password reset was requested for your IdeaSpark account. Reset your password at:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can safely ignore this message.`;
  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #171717;">
      <h2 style="color: #6E05F2; margin-bottom: 8px;">Password Reset Request</h2>
      <p>Hi ${user.name},</p>
      <p>Click the button below to choose a new password. This link expires in 30 minutes.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #2057E8; color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Reset Password
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">If you didn't request this reset, no changes have been made to your account.</p>
    </div>
  `;
  const result = await sendEmail({ to: user.email, subject, text, html });
  return { ...result, resetUrl: env.isProd ? undefined : resetUrl };
}

