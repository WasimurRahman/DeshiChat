const nodemailer = require('nodemailer');
const dns = require('dns');

const EMAIL_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS || 12000);
const SMTP_RETRIES = Number(process.env.SMTP_RETRIES || 1);

// Render frequently fails on IPv6 SMTP routes; prefer IPv4 results.
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const buildTransporter = ({ host, port, user, pass }) => {
  const secure = Number(port) === 465;

  return nodemailer.createTransport({
    host,
    port: Number(port),
    secure,
    requireTLS: !secure,
    family: 4,
    auth: {
      user,
      pass
    },
    connectionTimeout: EMAIL_TIMEOUT_MS,
    greetingTimeout: EMAIL_TIMEOUT_MS,
    socketTimeout: EMAIL_TIMEOUT_MS
  });
};

const primaryConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS
};

const fallbackConfig = {
  host: process.env.SMTP_FALLBACK_HOST,
  port: Number(process.env.SMTP_FALLBACK_PORT || 587),
  user: process.env.SMTP_FALLBACK_USER,
  pass: process.env.SMTP_FALLBACK_PASS
};

const transports = [
  { name: 'primary', config: primaryConfig }
];

if (fallbackConfig.host && fallbackConfig.user && fallbackConfig.pass) {
  transports.push({ name: 'fallback', config: fallbackConfig });
}

const sendWithTimeout = async (transporter, mailOptions) => {
  return Promise.race([
    transporter.sendMail(mailOptions),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email send timeout')), EMAIL_TIMEOUT_MS);
    })
  ]);
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!primaryConfig.user || !primaryConfig.pass) {
    throw new Error('Email credentials are not configured');
  }

  const fromEmail = process.env.EMAIL_FROM || primaryConfig.user;
  const mailOptions = {
    from: `"DeshiChat" <${fromEmail}>`,
    to,
    subject,
    text,
    html
  };

  let lastError = null;

  for (const transportEntry of transports) {
    const { name, config } = transportEntry;
    const transporter = buildTransporter(config);

    for (let attempt = 1; attempt <= SMTP_RETRIES; attempt += 1) {
      try {
        await sendWithTimeout(transporter, mailOptions);
        return;
      } catch (error) {
        lastError = error;
        console.error(`Email send failed (${name}) attempt ${attempt}/${SMTP_RETRIES}:`, error.message);
      }
    }
  }

  throw lastError || new Error('Email send failed');
};

module.exports = sendEmail;
