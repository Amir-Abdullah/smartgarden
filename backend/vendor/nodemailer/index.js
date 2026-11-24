const net = require('node:net');
const tls = require('node:tls');
const os = require('node:os');
const crypto = require('node:crypto');

function extractEmailAddress(addr) {
  if (!addr) return '';
  const str = String(addr).trim();
  const match = str.match(/<([^>]+)>/);
  return (match ? match[1] : str).trim();
}

function normalizeRecipients(field) {
  if (!field) return [];
  const items = Array.isArray(field) ? field : String(field).split(',');
  return items.map(extractEmailAddress).filter(Boolean);
}

function generateMessageId(fromAddr) {
  const domain = (fromAddr && fromAddr.includes('@')) ? fromAddr.split('@')[1] : 'smartgarden.local';
  return `<${crypto.randomUUID()}@${domain}>`;
}

function buildRfc5322Message(mail, messageId) {
  const headers = [
    `From: ${mail.from || 'noreply@smartgarden.local'}`,
    `To: ${Array.isArray(mail.to) ? mail.to.join(', ') : (mail.to || '')}`,
    ...(mail.cc ? [`Cc: ${Array.isArray(mail.cc) ? mail.cc.join(', ') : mail.cc}`] : []),
    `Subject: ${mail.subject || ''}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0'
  ];

  let body = '';
  if (mail.html && mail.text) {
    const boundary = `----=_Part_${crypto.randomBytes(8).toString('hex')}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      String(mail.text),
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      String(mail.html),
      `--${boundary}--`
    ].join('\r\n');
  } else if (mail.html) {
    headers.push('Content-Type: text/html; charset=utf-8');
    body = String(mail.html);
  } else {
    headers.push('Content-Type: text/plain; charset=utf-8');
    body = String(mail.text || '');
  }

  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return raw.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

class SmtpClient {
  constructor(options) {
    this.options = options;
    this.socket = null;
    this.buffer = '';
    this.pendingResolve = null;
    this.pendingReject = null;
  }

  async connect() {
    const host = this.options.host || '127.0.0.1';
    const port = Number(this.options.port || (this.options.secure ? 465 : 587));
    const secure = Boolean(this.options.secure);

    return new Promise((resolve, reject) => {
      const onConnectError = (err) => {
        if (this.pendingReject) {
          const rej = this.pendingReject;
          this.pendingResolve = null;
          this.pendingReject = null;
          rej(err);
        } else {
          reject(err);
        }
      };

      const onConnect = () => {
        this.socket.off('error', onConnectError);
        this._attachSocketListeners();
        this._readResponse()
          .then((res) => {
            if (res.code >= 400) return reject(new Error(`SMTP greeting error ${res.code}: ${res.message}`));
            resolve(res);
          })
          .catch(reject);
      };

      if (secure) {
        this.socket = tls.connect({
          host,
          port,
          servername: host,
          rejectUnauthorized: this.options.tls?.rejectUnauthorized !== false
        }, onConnect);
      } else {
        this.socket = net.connect({ host, port }, onConnect);
      }

      this.socket.once('error', onConnectError);
    });
  }

  _attachSocketListeners() {
    this.socket.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      this._tryConsumeResponse();
    });
    this.socket.on('error', (err) => {
      if (this.pendingReject) {
        const rej = this.pendingReject;
        this.pendingResolve = null;
        this.pendingReject = null;
        rej(err);
      }
    });
    this.socket.on('close', () => {
      if (this.pendingReject) {
        const rej = this.pendingReject;
        this.pendingResolve = null;
        this.pendingReject = null;
        rej(new Error('SMTP connection closed unexpectedly'));
      }
    });
  }

  _tryConsumeResponse() {
    if (!this.pendingResolve) return;
    const lines = this.buffer.split(/\r?\n/);
    // Keep last incomplete line in buffer
    const completeLines = lines.slice(0, -1);
    if (completeLines.length === 0) return;

    const collected = [];
    for (let i = 0; i < completeLines.length; i++) {
      const line = completeLines[i];
      collected.push(line);
      const match = line.match(/^(\d{3})([ -])(.*)$/);
      if (match && match[2] === ' ') {
        const code = Number(match[1]);
        const remainingLines = lines.slice(i + 1);
        this.buffer = remainingLines.join('\r\n');
        const resolve = this.pendingResolve;
        this.pendingResolve = null;
        this.pendingReject = null;
        resolve({ code, message: collected.join('\n') });
        return;
      }
    }
  }

  _readResponse() {
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this._tryConsumeResponse();
    });
  }

  async command(cmd) {
    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.socket.write(`${cmd}\r\n`, (err) => {
        if (err) {
          this.pendingResolve = null;
          this.pendingReject = null;
          reject(err);
        }
      });
      this._tryConsumeResponse();
    });
  }

  async upgradeStartTls() {
    const res = await this.command('STARTTLS');
    if (res.code >= 400) {
      throw new Error(`STARTTLS failed (${res.code}): ${res.message}`);
    }
    const oldSocket = this.socket;
    oldSocket.removeAllListeners('data');
    oldSocket.removeAllListeners('close');
    oldSocket.removeAllListeners('error');
    oldSocket.on('error', () => {});

    await new Promise((resolve, reject) => {
      const onHandshakeError = (err) => reject(err);
      const tlsSocket = tls.connect({
        socket: oldSocket,
        servername: this.options.host,
        rejectUnauthorized: this.options.tls?.rejectUnauthorized !== false
      }, () => {
        tlsSocket.off('error', onHandshakeError);
        this.socket = tlsSocket;
        this.buffer = '';
        this._attachSocketListeners();
        resolve();
      });
      tlsSocket.once('error', onHandshakeError);
    });
  }

  async authenticate(user, pass) {
    const plainToken = Buffer.from(`\u0000${user}\u0000${pass}`, 'utf8').toString('base64');
    let res = await this.command(`AUTH PLAIN ${plainToken}`);
    if (res.code === 235) return;

    // Fallback to AUTH LOGIN
    res = await this.command('AUTH LOGIN');
    if (res.code !== 334) {
      throw new Error(`SMTP AUTH failed (${res.code}): ${res.message}`);
    }
    res = await this.command(Buffer.from(String(user), 'utf8').toString('base64'));
    if (res.code !== 334) {
      throw new Error(`SMTP AUTH user rejected (${res.code}): ${res.message}`);
    }
    res = await this.command(Buffer.from(String(pass), 'utf8').toString('base64'));
    if (res.code !== 235) {
      throw new Error(`SMTP AUTH password rejected (${res.code}): ${res.message}`);
    }
  }

  async close() {
    if (this.socket && !this.socket.destroyed) {
      try { this.socket.end(); } catch (_) {}
      try { this.socket.destroy(); } catch (_) {}
    }
    this.socket = null;
  }
}

function createTransport(options = {}) {
  const opts = options || {};
  const isFallback = Boolean(opts.jsonTransport || opts.streamTransport || !opts.host);
  const activeClients = new Set();

  return {
    options: opts,

    async verify() {
      if (isFallback) return true;
      const client = new SmtpClient(opts);
      activeClients.add(client);
      try {
        await client.connect();
        let ehlo = await client.command(`EHLO ${os.hostname() || 'localhost'}`);
        if (!opts.secure && ehlo.message.toUpperCase().includes('STARTTLS')) {
          await client.upgradeStartTls();
          ehlo = await client.command(`EHLO ${os.hostname() || 'localhost'}`);
        }
        if (opts.auth && opts.auth.user) {
          await client.authenticate(opts.auth.user, opts.auth.pass || '');
        }
        await client.command('QUIT').catch(() => {});
        return true;
      } finally {
        activeClients.delete(client);
        await client.close();
      }
    },

    async sendMail(mailOptions = {}) {
      const fromAddr = extractEmailAddress(mailOptions.from || (opts.auth && opts.auth.user) || 'noreply@smartgarden.local');
      const recipients = [
        ...normalizeRecipients(mailOptions.to),
        ...normalizeRecipients(mailOptions.cc),
        ...normalizeRecipients(mailOptions.bcc)
      ];
      const messageId = mailOptions.messageId || generateMessageId(fromAddr);
      const rawMessage = buildRfc5322Message(mailOptions, messageId);

      if (isFallback) {
        return {
          envelope: { from: fromAddr, to: recipients },
          messageId,
          accepted: recipients,
          rejected: [],
          message: opts.jsonTransport
            ? JSON.stringify({ ...mailOptions, messageId, envelope: { from: fromAddr, to: recipients } })
            : rawMessage,
          response: '250 OK (local transport)'
        };
      }

      const client = new SmtpClient(opts);
      activeClients.add(client);
      const accepted = [];
      const rejected = [];

      try {
        await client.connect();
        const ehlo = await client.command(`EHLO ${os.hostname() || 'localhost'}`);
        if (!opts.secure && ehlo.message.toUpperCase().includes('STARTTLS')) {
          await client.upgradeStartTls();
          await client.command(`EHLO ${os.hostname() || 'localhost'}`);
        }
        if (opts.auth && opts.auth.user) {
          await client.authenticate(opts.auth.user, opts.auth.pass || '');
        }

        const mailFromRes = await client.command(`MAIL FROM:<${fromAddr}>`);
        if (mailFromRes.code >= 400) {
          throw new Error(`MAIL FROM rejected (${mailFromRes.code}): ${mailFromRes.message}`);
        }

        for (const rcpt of recipients) {
          const rcptRes = await client.command(`RCPT TO:<${rcpt}>`);
          if (rcptRes.code >= 200 && rcptRes.code < 300) accepted.push(rcpt);
          else rejected.push(rcpt);
        }

        if (accepted.length === 0) {
          throw new Error('No recipients accepted by SMTP server');
        }

        const dataInit = await client.command('DATA');
        if (dataInit.code !== 354) {
          throw new Error(`DATA command rejected (${dataInit.code}): ${dataInit.message}`);
        }

        const dataDone = await client.command(`${rawMessage}\r\n.`);
        if (dataDone.code >= 400) {
          throw new Error(`Message body rejected (${dataDone.code}): ${dataDone.message}`);
        }

        await client.command('QUIT').catch(() => {});
        return {
          envelope: { from: fromAddr, to: accepted },
          messageId,
          accepted,
          rejected,
          response: dataDone.message
        };
      } finally {
        activeClients.delete(client);
        await client.close();
      }
    },

    close() {
      for (const client of activeClients) {
        client.close().catch(() => {});
      }
      activeClients.clear();
    }
  };
}

module.exports = {
  createTransport
};
