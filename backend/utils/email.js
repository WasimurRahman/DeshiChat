const nodemailer = require('nodemailer');
const dns = require('dns');

const EMAIL_TIMEOUT_MS = 15000;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = SMTP_PORT === 465;

// Render frequently fails on IPv6 SMTP routes; prefer IPv4 results.
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  requireTLS: !SMTP_SECURE,
  family: 4,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: EMAIL_TIMEOUT_MS,
  greetingTimeout: EMAIL_TIMEOUT_MS,
  socketTimeout: EMAIL_TIMEOUT_MS
});

const sendEmail = async ({ to, subject, text, html }) => {
  const mailOptions = {
    from: `"DeshiChat" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html
  };

  await Promise.race([
    transporter.sendMail(mailOptions),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email send timeout')), EMAIL_TIMEOUT_MS);
    })
  ]);
};

module.exports = sendEmail;
