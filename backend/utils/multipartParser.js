const { Buffer } = require('buffer');

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const DEFAULT_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function createHttpError(statusCode, code, message, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}

function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function validateImageBuffer(
  buffer,
  declaredMime = '',
  { maxFileSize = DEFAULT_MAX_FILE_SIZE, allowedMimeTypes = DEFAULT_ALLOWED_MIMES } = {}
) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw createHttpError(400, 'IMAGE_REQUIRED', 'A non-empty image file is required.');
  }

  if (buffer.length > maxFileSize) {
    throw createHttpError(
      413,
      'PAYLOAD_TOO_LARGE',
      `Image size (${buffer.length} bytes) exceeds the maximum allowed limit of ${Math.round(maxFileSize / (1024 * 1024))} MB.`,
      { size: buffer.length, maxFileSize }
    );
  }

  const normalizedDeclared = String(declaredMime || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (
    normalizedDeclared &&
    normalizedDeclared !== 'application/octet-stream' &&
    !allowedMimeTypes.includes(normalizedDeclared)
  ) {
    throw createHttpError(
      400,
      'INVALID_FILE_TYPE',
      `Unsupported file type "${normalizedDeclared}". Allowed types: ${allowedMimeTypes.join(', ')}.`,
      { mimeType: normalizedDeclared }
    );
  }

  const detectedMime = detectImageMime(buffer);
  if (!detectedMime || !allowedMimeTypes.includes(detectedMime)) {
    throw createHttpError(
      400,
      'INVALID_FILE_TYPE',
      'File signature does not match a supported image format (JPEG, PNG, or WEBP).',
      { declaredMime: normalizedDeclared || null, detectedMime }
    );
  }

  if (
    normalizedDeclared &&
    normalizedDeclared !== 'application/octet-stream' &&
    normalizedDeclared !== detectedMime &&
    !(normalizedDeclared === 'image/jpg' && detectedMime === 'image/jpeg')
  ) {
    throw createHttpError(
      400,
      'INVALID_FILE_TYPE',
      `File header MIME (${normalizedDeclared}) does not match file signature (${detectedMime}).`,
      { declaredMime: normalizedDeclared, detectedMime }
    );
  }

  return detectedMime;
}

function extractBoundary(contentType) {
  const match = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  return match ? (match[1] || match[2]) : null;
}

function parsePartHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split(/\r\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const k = line.slice(0, colonIdx).trim().toLowerCase();
      const v = line.slice(colonIdx + 1).trim();
      headers[k] = v;
    }
  }
  return headers;
}

function parseMultipart(
  request,
  { maxFileSize = DEFAULT_MAX_FILE_SIZE, allowedMimeTypes = DEFAULT_ALLOWED_MIMES, validateImages = true } = {}
) {
  const contentType = request?.headers?.['content-type'] || request?.headers?.['Content-Type'] || '';
  const boundary = extractBoundary(contentType);
  if (!boundary) {
    throw createHttpError(400, 'INVALID_MULTIPART', 'Missing multipart boundary in Content-Type header.');
  }

  const rawBuffer = Buffer.isBuffer(request.rawBody)
    ? request.rawBody
    : Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(String(request.body || ''), 'latin1');

  const delimiter = Buffer.from(`--${boundary}`, 'latin1');
  const fields = {};
  const files = {};

  let pos = rawBuffer.indexOf(delimiter);
  while (pos !== -1) {
    pos += delimiter.length;

    // End boundary "--boundary--"
    if (rawBuffer[pos] === 0x2d && rawBuffer[pos + 1] === 0x2d) {
      break;
    }

    // Skip CRLF right after boundary
    if (rawBuffer[pos] === 0x0d && rawBuffer[pos + 1] === 0x0a) {
      pos += 2;
    } else if (rawBuffer[pos] === 0x0a) {
      pos += 1;
    }

    const nextBoundaryPos = rawBuffer.indexOf(delimiter, pos);
    if (nextBoundaryPos === -1) break;

    let partEnd = nextBoundaryPos;
    if (rawBuffer[partEnd - 2] === 0x0d && rawBuffer[partEnd - 1] === 0x0a) {
      partEnd -= 2;
    } else if (rawBuffer[partEnd - 1] === 0x0a) {
      partEnd -= 1;
    }

    const partBuf = rawBuffer.subarray(pos, partEnd);
    let headerEnd = partBuf.indexOf('\r\n\r\n');
    let sepLen = 4;
    if (headerEnd === -1) {
      headerEnd = partBuf.indexOf('\n\n');
      sepLen = 2;
    }

    if (headerEnd !== -1) {
      const headerText = partBuf.subarray(0, headerEnd).toString('utf8');
      const bodyBuf = partBuf.subarray(headerEnd + sepLen);
      const partHeaders = parsePartHeaders(headerText);
      const disposition = partHeaders['content-disposition'] || '';
      const nameMatch = disposition.match(/\bname="([^"]+)"/i);
      const filenameMatch = disposition.match(/\bfilename="([^"]*)"/i);

      if (nameMatch) {
        const fieldName = nameMatch[1];
        if (filenameMatch) {
          const filename = filenameMatch[1];
          const declaredMime = partHeaders['content-type'] || 'application/octet-stream';
          if (bodyBuf.length > 0 || filename) {
            const verifiedMime = validateImages
              ? validateImageBuffer(bodyBuf, declaredMime, { maxFileSize, allowedMimeTypes })
              : declaredMime;
            files[fieldName] = {
              filename: filename || `upload-${Date.now()}`,
              mimeType: verifiedMime,
              size: bodyBuf.length,
              buffer: Buffer.from(bodyBuf)
            };
          }
        } else {
          fields[fieldName] = bodyBuf.toString('utf8');
        }
      }
    }

    pos = nextBoundaryPos;
  }

  return { fields, files };
}

module.exports = {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_ALLOWED_MIMES,
  detectImageMime,
  validateImageBuffer,
  parseMultipart
};
