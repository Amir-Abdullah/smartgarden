let cachedTransporter = null;
let cachedConfigKey = null;

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'alerts@smartgarden.app'
  };
}

function getTransporter() {
  const cfg = getSmtpConfig();
  if (!cfg.host) {
    return null;
  }
  const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.pass}`;
  if (cachedTransporter && cachedConfigKey === key) {
    return cachedTransporter;
  }
  if (cachedTransporter && typeof cachedTransporter.close === 'function') {
    try { cachedTransporter.close(); } catch (_) {}
  }
  const nodemailer = require('nodemailer');
  const transportOpts = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure
  };
  if (cfg.user) {
    transportOpts.auth = {
      user: cfg.user,
      pass: cfg.pass
    };
  }
  cachedTransporter = nodemailer.createTransport(transportOpts);
  cachedConfigKey = key;
  return cachedTransporter;
}

async function sendAlertEmail({ to, subject, text, html }) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) {
    return { delivered: false, mode: 'console', reason: 'no_recipients' };
  }

  const cfg = getSmtpConfig();
  const transporter = getTransporter();
  if (!transporter) {
    console.log(
      '[EmailService:ConsoleFallback]',
      JSON.stringify({
        from: cfg.from,
        to: recipients,
        subject,
        text: text || ''
      })
    );
    return { delivered: false, mode: 'console' };
  }

  try {
    const info = await transporter.sendMail({
      from: cfg.from,
      to: recipients.join(', '),
      subject,
      text,
      html
    });
    return {
      delivered: true,
      mode: 'smtp',
      messageId: info && info.messageId ? info.messageId : null
    };
  } catch (err) {
    console.error('[EmailService] Failed to send alert email:', err.message);
    return {
      delivered: false,
      mode: 'smtp',
      error: err.message
    };
  }
}

function closeTransporter() {
  if (cachedTransporter && typeof cachedTransporter.close === 'function') {
    try {
      cachedTransporter.close();
    } catch (_) {
      // ignore close errors
    }
  }
  cachedTransporter = null;
  cachedConfigKey = null;
}

module.exports = {
  sendAlertEmail,
  closeTransporter,
  getSmtpConfig
};
