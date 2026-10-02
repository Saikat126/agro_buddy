const nodemailer = require('nodemailer');

// Gmail SMTP + an app password (not your real Gmail password — generate one at
// https://myaccount.google.com/apppasswords, requires 2-Step Verification on
// the account). Fine for development/low volume; swap for a transactional
// email service (Resend, SendGrid, etc.) before relying on this in production.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Fails loudly but doesn't crash the request — callers decide whether a send
// failure should block the response (e.g. still tell the user "check your
// email" even if we couldn't verify the transporter ahead of time).
async function sendMail({ to, subject, html }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(`\n[mailer] GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping email to ${to}.\nSubject: ${subject}\n`);
    return;
  }
  await transporter.sendMail({
    from: `"Agro Buddy" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

function sendVerificationEmail(to, link) {
  return sendMail({
    to,
    subject: 'Verify your Agro Buddy account',
    html: `
      <p>Welcome to Agro Buddy!</p>
      <p>Click the link below to verify your email address and activate your account:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
    `,
  });
}

function sendPasswordResetEmail(to, link) {
  return sendMail({
    to,
    subject: 'Reset your Agro Buddy password',
    html: `
      <p>We received a request to reset your Agro Buddy password.</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    `,
  });
}

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail };
