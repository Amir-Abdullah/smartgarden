const crypto = require('crypto');
const { MediaAsset } = require('../models');

let customR2Fetcher = null;

function setR2Fetcher(fn) {
  customR2Fetcher = typeof fn === 'function' ? fn : null;
}

function getR2Config() {
  const accountId = String(process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucketName = String(process.env.R2_BUCKET_NAME || '').trim();
  const publicUrl = String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

function isR2Configured() {
  const cfg = getR2Config();
  return Boolean(cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey && cfg.bucketName);
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data, encoding = null) {
  const h = crypto.createHmac('sha256', key).update(data);
  return encoding ? h.digest(encoding) : h.digest();
}

function buildAwsSigV4Headers({ method, host, canonicalUri, payloadHash, contentType, accessKeyId, secretAccessKey, now = new Date() }) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign, 'hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    'Content-Type': contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate
  };
}

function mimeToExtension(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function generateStorageKey(folder = 'uploads', mimeType = 'image/png') {
  const cleanFolder = String(folder || 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');
  const ext = mimeToExtension(mimeType);
  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(6).toString('hex');
  return `${cleanFolder}-${stamp}-${rand}.${ext}`;
}

async function uploadImage({ buffer, mimeType, originalFilename = null, folder = 'journal', userId = null }) {
  const storageKey = generateStorageKey(folder, mimeType);
  const cfg = getR2Config();
  let provider = 'DB';
  let dataBase64 = buffer.toString('base64');
  let publicUrl = `/api/media/${storageKey}`;

  if (isR2Configured()) {
    const fetcher = customR2Fetcher || global.fetch;
    if (typeof fetcher === 'function') {
      const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
      const objectPath = `/${cfg.bucketName}/${storageKey}`;
      const endpoint = `https://${host}${objectPath}`;
      const payloadHash = sha256Hex(buffer);
      const headers = buildAwsSigV4Headers({
        method: 'PUT',
        host,
        canonicalUri: objectPath,
        payloadHash,
        contentType: mimeType,
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey
      });

      const response = await fetcher(endpoint, {
        method: 'PUT',
        headers,
        body: buffer
      });

      if (response && response.ok) {
        provider = 'R2';
        dataBase64 = null;
        if (cfg.publicUrl) {
          publicUrl = `${cfg.publicUrl}/${storageKey}`;
        }
      }
    }
  }

  const asset = await MediaAsset.create({
    storage_key: storageKey,
    provider,
    mime_type: mimeType,
    original_filename: originalFilename ? String(originalFilename).slice(0, 255) : null,
    size_bytes: buffer.length,
    data_base64: dataBase64,
    uploaded_by: userId || null
  });

  return {
    id: asset.id,
    storage_key: asset.storage_key,
    provider: asset.provider,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    url: publicUrl
  };
}

async function getMediaByKey(storageKey) {
  const cleanKey = String(storageKey || '').trim();
  if (!cleanKey) return null;
  const asset = await MediaAsset.findOne({ where: { storage_key: cleanKey } });
  if (!asset) return null;
  return {
    asset,
    buffer: asset.data_base64 ? Buffer.from(asset.data_base64, 'base64') : null
  };
}

async function deleteMediaByUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const match = url.match(/\/api\/media\/([A-Za-z0-9._-]+)$/);
  if (!match) return false;
  const asset = await MediaAsset.findOne({ where: { storage_key: match[1] } });
  if (!asset) return false;
  await asset.destroy();
  return true;
}

module.exports = {
  isR2Configured,
  setR2Fetcher,
  generateStorageKey,
  uploadImage,
  getMediaByKey,
  deleteMediaByUrl
};
