import nodemailer from "nodemailer";

import { env } from "../../config/env.js";

let transporter = null;

const getTransporter = () => {
  if (!env.emailEnabled) return null;
  if (!transporter) {
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
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Sends an email. Returns { delivered: boolean, reason?: string }.
 * Never throws — a mail outage must not fail the originating request.
 */
export const sendMail = async ({ to, subject, text, html }) => {
  if (!env.emailEnabled) {
    return { delivered: false, reason: "smtp_not_configured" };
  }

  try {
    await getTransporter().sendMail({ from: env.smtp.from, to, subject, text, html });
    return { delivered: true };
  } catch (error) {
    console.error("[mail] send failed:", error.message);
    return { delivered: false, reason: error.message };
  }
};

export const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const subject = "Reset your ForgeNet password";

  const text = [
    `Hi ${name},`,
    "",
    "We received a request to reset your ForgeNet password.",
    "Open the link below to choose a new password:",
    "",
    resetUrl,
    "",
    `This link expires in ${Math.round(env.passwordResetTokenTtlMs / 60000)} minutes.`,
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2328;max-width:520px">
      <h2 style="font-size:18px;margin:0 0 12px">Reset your ForgeNet password</h2>
      <p style="font-size:14px;line-height:1.5">Hi ${escapeHtml(name)},</p>
      <p style="font-size:14px;line-height:1.5">We received a request to reset your ForgeNet password.</p>
      <p style="margin:20px 0">
        <a href="${escapeHtml(resetUrl)}"
           style="background:#1f6feb;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px;font-weight:600;display:inline-block">
          Reset password
        </a>
      </p>
      <p style="font-size:12px;color:#59636e;line-height:1.5">
        Or paste this link into your browser:<br />
        <span style="word-break:break-all">${escapeHtml(resetUrl)}</span>
      </p>
      <p style="font-size:12px;color:#59636e;line-height:1.5">
        This link expires in ${Math.round(env.passwordResetTokenTtlMs / 60000)} minutes.
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  `;

  return sendMail({ to, subject, text, html });
};
