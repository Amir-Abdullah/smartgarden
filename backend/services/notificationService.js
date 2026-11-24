const crypto = require('crypto');
const { URL } = require('url');
const net = require('net');
const { Notification, NotificationPreference } = require('../models');

const VALID_DIGESTS = ['INSTANT', 'DAILY', 'WEEKLY', 'OFF'];
let customWebhookFetcher = null;

function setWebhookFetcher(fn) {
  customWebhookFetcher = typeof fn === 'function' ? fn : null;
}

function createError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function isPrivateOrDisallowedIp(ip) {
  const clean = String(ip || '').toLowerCase();
  if (!clean) return true;

  if (clean === '::1' || clean === '::' || clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) {
    return true;
  }

  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  const v4 = clean.startsWith('::ffff:') ? clean.slice(7) : clean;
  if (net.isIPv4(v4)) {
    const parts = v4.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  return false;
}

/**
 * Validates external webhook URLs against strict HTTPS + public host SSRF rules.
 */
function validateWebhookUrl(rawUrl) {
  if (rawUrl === undefined || rawUrl === null || String(rawUrl).trim() === '') {
    return null;
  }

  const trimmed = String(rawUrl).trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw createError(400, 'SSRF_BLOCKED_URL', 'Webhook URL is malformed.');
  }

  if (parsed.protocol !== 'https:') {
    throw createError(400, 'SSRF_BLOCKED_URL', 'Only public HTTPS webhook endpoints are permitted.');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) {
    throw createError(400, 'SSRF_BLOCKED_URL', 'Webhook hostname is missing.');
  }

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    /^\d+$/.test(host)
  ) {
    throw createError(400, 'SSRF_BLOCKED_URL', 'Private, loopback, or internal webhook hosts are blocked.');
  }

  if (net.isIP(host) && isPrivateOrDisallowedIp(host)) {
    throw createError(400, 'SSRF_BLOCKED_URL', 'Private or loopback IP addresses cannot receive webhooks.');
  }

  if (!host.includes('.')) {
    throw createError(400, 'SSRF_BLOCKED_URL', 'Webhook hostname must be a fully qualified public domain.');
  }

  return parsed.toString().slice(0, 500);
}

async function listNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  const where = { user_id: userId };
  if (unreadOnly === true || unreadOnly === 'true') {
    where.is_read = false;
  }

  const rows = await Notification.findAll({
    where,
    order: [['created_at', 'DESC'], ['id', 'DESC']]
  });
  const unreadCount = await Notification.count({ where: { user_id: userId, is_read: false } });

  return {
    notifications: rows.slice(0, Math.min(100, Number(limit) || 50)),
    unread_count: unreadCount
  };
}

async function createNotification({ userId, gardenId = null, channel = 'IN_APP', category = 'SYSTEM', title, message, metadata = null }) {
  return Notification.create({
    user_id: userId,
    garden_id: gardenId,
    channel,
    category,
    title: String(title || 'SmartGarden Notification').slice(0, 200),
    message: String(message || ''),
    is_read: false,
    metadata_json: metadata ? JSON.stringify(metadata) : null
  });
}

async function markRead(userId, notificationId) {
  const item = await Notification.findOne({ where: { id: notificationId, user_id: userId } });
  if (!item) {
    throw createError(404, 'NOTIFICATION_NOT_FOUND', `Notification ${notificationId} not found.`);
  }
  await item.update({ is_read: true });
  return item;
}

async function markAllRead(userId) {
  const unread = await Notification.findAll({ where: { user_id: userId, is_read: false } });
  for (const item of unread) {
    await item.update({ is_read: true });
  }
  return { marked_read: unread.length };
}

async function getPreferences(userId) {
  let pref = await NotificationPreference.findOne({ where: { user_id: userId } });
  if (!pref) {
    pref = await NotificationPreference.create({
      user_id: userId,
      email_digest_freq: 'INSTANT',
      in_app_enabled: true,
      web_push_enabled: false
    });
  }
  return serializePref(pref);
}

function serializePref(pref) {
  let overrides = {};
  try {
    overrides = pref.per_garden_overrides ? JSON.parse(pref.per_garden_overrides) : {};
  } catch {
    overrides = {};
  }
  return {
    id: Number(pref.id),
    user_id: Number(pref.user_id),
    email_digest_freq: pref.email_digest_freq,
    in_app_enabled: Boolean(pref.in_app_enabled),
    web_push_enabled: Boolean(pref.web_push_enabled),
    webhook_url: pref.webhook_url || '',
    has_webhook_secret: Boolean(pref.webhook_secret),
    quiet_hours_start: pref.quiet_hours_start || '',
    quiet_hours_end: pref.quiet_hours_end || '',
    per_garden_overrides: overrides,
    updated_at: pref.updated_at
  };
}

async function updatePreferences(userId, payload = {}) {
  let pref = await NotificationPreference.findOne({ where: { user_id: userId } });
  if (!pref) {
    pref = await NotificationPreference.create({
      user_id: userId,
      email_digest_freq: 'INSTANT',
      in_app_enabled: true,
      web_push_enabled: false
    });
  }

  const updates = {};
  if (payload.email_digest_freq !== undefined) {
    const freq = String(payload.email_digest_freq).toUpperCase();
    if (!VALID_DIGESTS.includes(freq)) {
      throw createError(400, 'VALIDATION_ERROR', `email_digest_freq must be one of ${VALID_DIGESTS.join(', ')}.`);
    }
    updates.email_digest_freq = freq;
  }
  if (payload.in_app_enabled !== undefined) updates.in_app_enabled = Boolean(payload.in_app_enabled);
  if (payload.web_push_enabled !== undefined) updates.web_push_enabled = Boolean(payload.web_push_enabled);
  if (payload.webhook_url !== undefined) {
    updates.webhook_url = validateWebhookUrl(payload.webhook_url);
  }
  if (payload.webhook_secret !== undefined) {
    updates.webhook_secret = payload.webhook_secret ? String(payload.webhook_secret).slice(0, 128) : null;
  }
  if (payload.quiet_hours_start !== undefined) {
    updates.quiet_hours_start = payload.quiet_hours_start ? String(payload.quiet_hours_start).slice(0, 16) : null;
  }
  if (payload.quiet_hours_end !== undefined) {
    updates.quiet_hours_end = payload.quiet_hours_end ? String(payload.quiet_hours_end).slice(0, 16) : null;
  }
  if (payload.per_garden_overrides !== undefined && typeof payload.per_garden_overrides === 'object') {
    updates.per_garden_overrides = JSON.stringify(payload.per_garden_overrides);
  }

  await pref.update(updates);
  return serializePref(pref);
}

async function sendTestWebhook(userId, overrideUrl = null) {
  const pref = await NotificationPreference.findOne({ where: { user_id: userId } });
  const targetUrl = validateWebhookUrl(overrideUrl !== null && overrideUrl !== undefined ? overrideUrl : pref?.webhook_url);
  if (!targetUrl) {
    throw createError(400, 'WEBHOOK_NOT_CONFIGURED', 'Provide a public HTTPS webhook URL first.');
  }

  const bodyObj = {
    event: 'SMARTGARDEN_TEST_WEBHOOK',
    user_id: Number(userId),
    timestamp: new Date().toISOString(),
    message: 'SmartGarden multi-channel webhook verification event'
  };
  const bodyStr = JSON.stringify(bodyObj);
  const secret = pref?.webhook_secret || 'smartgarden-default-webhook-secret';
  const signature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

  const fetcher = customWebhookFetcher || global.fetch;
  let delivered = false;
  let statusCode = null;
  let mode = 'simulated-console';

  if (customWebhookFetcher) {
    const resp = await fetcher(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SmartGarden-Signature': `sha256=${signature}`
      },
      body: bodyStr
    });
    delivered = Boolean(resp && resp.ok);
    statusCode = resp ? resp.status : null;
    mode = 'http';
  } else {
    delivered = true;
    statusCode = 200;
  }

  await createNotification({
    userId,
    channel: 'WEBHOOK',
    category: 'SYSTEM',
    title: 'Webhook Verification Dispatched',
    message: `Sent signed test payload to ${targetUrl}`,
    metadata: { signature_prefix: signature.slice(0, 12), mode }
  });

  return {
    delivered,
    status_code: statusCode,
    target_url: targetUrl,
    signature_header: `sha256=${signature}`,
    mode
  };
}

module.exports = {
  VALID_DIGESTS,
  validateWebhookUrl,
  setWebhookFetcher,
  listNotifications,
  createNotification,
  markRead,
  markAllRead,
  getPreferences,
  updatePreferences,
  sendTestWebhook
};
