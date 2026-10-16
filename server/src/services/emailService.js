const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = SSL, 587 = STARTTLS
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER.trim(),
            pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""), // App Passwords sometimes get pasted with spaces
          }
        : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

const clientUrl = () => String(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function deliver({ to, subject, text, html, link }) {
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email is not configured on the server (SMTP_* variables missing)");
    }
    // local development without SMTP: print the link so you can still test the flow
    console.log(`\n[DEV EMAIL - SMTP not configured]\nTo: ${to}\nSubject: ${subject}\nLink: ${link}\n`);
    return;
  }
  try {
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    console.log(`[EMAIL SENT] to=${to} id=${info.messageId}`);
  } catch (err) {
    // This is the real reason; it shows in the terminal running `npm run dev`
    console.error("[EMAIL FAILED]", err.code || "", err.responseCode || "", err.message);
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[DEV FALLBACK] Use this link to continue testing:\n${link}\n`);
    }
    throw err;
  }
}

function layout(title, intro, buttonLabel, link, footer) {
  return `<!doctype html><html><body style="margin:0;background:#f2f5fb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e8f2;">
    <div style="background:#0b1b33;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:700;">XenTwin Technologies</div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 12px;color:#0b1b33;font-size:20px;">${title}</h2>
      <p style="color:#44506a;font-size:14px;line-height:1.6;margin:0 0 22px;">${intro}</p>
      <a href="${link}" style="display:inline-block;background:#1fb6e8;color:#04202e;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px;font-size:14px;">${buttonLabel}</a>
      <p style="color:#7a859c;font-size:12px;line-height:1.6;margin:22px 0 0;">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all;">${link}</span></p>
      <p style="color:#7a859c;font-size:12px;line-height:1.6;margin:14px 0 0;">${footer}</p>
    </div>
  </div></body></html>`;
}

async function sendVerificationEmail(to, name, token) {
  const link = `${clientUrl()}/set-password?mode=verify&token=${token}`;
  await deliver({
    to,
    link,
    subject: "Verify your email - XenTwin Technologies",
    text: `Hi ${name},\n\nWelcome to XenTwin Technologies! Confirm your email and create your password here:\n${link}\n\nThis link is valid for 24 hours. If you did not sign up, ignore this email.`,
    html: layout(
      `Welcome, ${esc(name)}!`,
      "Please confirm your email address and create your password to activate your account.",
      "Verify email &amp; create password",
      link,
      "This link is valid for 24 hours. If you did not sign up, you can safely ignore this email."
    ),
  });
}

async function sendResetEmail(to, name, token) {
  const link = `${clientUrl()}/set-password?mode=reset&token=${token}`;
  await deliver({
    to,
    link,
    subject: "Reset your password - XenTwin Technologies",
    text: `Hi ${name},\n\nUse this link to set a new password:\n${link}\n\nThis link is valid for 1 hour. If you did not ask for this, ignore this email - your password stays the same.`,
    html: layout(
      "Reset your password",
      `Hi ${esc(name)}, click the button below to choose a new password.`,
      "Reset password",
      link,
      "This link is valid for 1 hour. If you did not request it, ignore this email and your password will stay the same."
    ),
  });
}

module.exports = { sendVerificationEmail, sendResetEmail };
