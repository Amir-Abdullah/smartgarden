const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa
};

function computeAcceptKey(secWebSocketKey) {
  return crypto
    .createHash('sha1')
    .update(String(secWebSocketKey).trim() + WS_GUID)
    .digest('base64');
}

function encodeFrame(opcode, payloadBuf = Buffer.alloc(0), masked = false) {
  const payload = Buffer.isBuffer(payloadBuf) ? payloadBuf : Buffer.from(payloadBuf);
  const len = payload.length;

  let headerLen = 2;
  if (len >= 126 && len <= 0xffff) headerLen += 2;
  else if (len > 0xffff) headerLen += 8;
  if (masked) headerLen += 4;

  const out = Buffer.allocUnsafe(headerLen + len);
  out[0] = 0x80 | (opcode & 0x0f);

  let offset = 2;
  const maskBit = masked ? 0x80 : 0x00;
  if (len < 126) {
    out[1] = maskBit | len;
  } else if (len <= 0xffff) {
    out[1] = maskBit | 126;
    out.writeUInt16BE(len, 2);
    offset = 4;
  } else {
    out[1] = maskBit | 127;
    out.writeBigUInt64BE(BigInt(len), 2);
    offset = 10;
  }

  if (masked) {
    const maskKey = crypto.randomBytes(4);
    maskKey.copy(out, offset);
    offset += 4;
    for (let i = 0; i < len; i++) {
      out[offset + i] = payload[i] ^ maskKey[i & 3];
    }
  } else if (len > 0) {
    payload.copy(out, offset);
  }

  return out;
}

function tryDecodeFrame(buffer) {
  if (!buffer || buffer.length < 2) return null;

  const b0 = buffer[0];
  const b1 = buffer[1];
  const fin = (b0 & 0x80) !== 0;
  const opcode = b0 & 0x0f;
  const masked = (b1 & 0x80) !== 0;
  let len = b1 & 0x7f;
  let offset = 2;

  if (len === 126) {
    if (buffer.length < offset + 2) return null;
    len = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (len === 127) {
    if (buffer.length < offset + 8) return null;
    const bigLen = buffer.readBigUInt64BE(offset);
    if (bigLen > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('WebSocket frame payload exceeds safe integer size');
    }
    len = Number(bigLen);
    offset += 8;
  }

  let maskKey = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + len) return null;

  const payload = Buffer.from(buffer.subarray(offset, offset + len));
  if (masked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i & 3];
    }
  }

  return {
    frame: { fin, opcode, masked, payload },
    bytesConsumed: offset + len
  };
}

class PureWebSocket extends EventEmitter {
  constructor(socket, { isClient = false, initialBuffer = null } = {}) {
    super();
    this._socket = socket;
    this._isClient = Boolean(isClient);
    this._buffer = initialBuffer && initialBuffer.length > 0 ? Buffer.from(initialBuffer) : Buffer.alloc(0);
    this._fragments = [];
    this._fragmentOpcode = null;
    this._closeSent = false;
    this._closedEmitted = false;
    this._domListeners = new WeakMap();
    this._closeFallbackTimer = null;
    this.readyState = 1; // OPEN
    this.closeCode = null;
    this.closeReason = '';

    this._onData = (chunk) => this._handleIncomingData(chunk);
    this._onEnd = () => this._finalizeClose(1006, Buffer.alloc(0));
    this._onError = (err) => {
      if (this.listenerCount('error') > 0) {
        this.emit('error', err);
      }
      this._finalizeClose(1006, Buffer.alloc(0));
    };

    if (this._socket) {
      this._socket.on('data', this._onData);
      this._socket.on('end', this._onEnd);
      this._socket.on('close', this._onEnd);
      this._socket.on('error', this._onError);
    }

    if (this._buffer.length > 0) {
      this._drainFrames();
    }
  }

  addEventListener(type, listener) {
    if (typeof listener !== 'function') return;
    let wrapped;
    if (type === 'message') {
      wrapped = (data, isBinary) => {
        listener({ data: isBinary ? data : data.toString('utf8') });
      };
    } else if (type === 'close') {
      wrapped = (code, reason) => {
        listener({ code, reason: Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason || '') });
      };
    } else if (type === 'open') {
      wrapped = () => listener({});
    } else {
      wrapped = (...args) => listener(...args);
    }
    this._domListeners.set(listener, wrapped);
    this.on(type, wrapped);
  }

  removeEventListener(type, listener) {
    const wrapped = this._domListeners.get(listener);
    if (wrapped) {
      this.off(type, wrapped);
      this._domListeners.delete(listener);
    }
  }

  _writeRaw(buf, cb) {
    if (!this._socket || this._socket.destroyed || this._socket.writableEnded) {
      if (typeof cb === 'function') cb(new Error('Socket is closed'));
      return;
    }
    this._socket.write(buf, cb);
  }

  send(data, cb) {
    if (this.readyState !== 1) {
      if (typeof cb === 'function') cb(new Error('WebSocket is not open'));
      return;
    }
    const isBinary = Buffer.isBuffer(data);
    const payload = isBinary ? data : Buffer.from(String(data), 'utf8');
    const frame = encodeFrame(isBinary ? OPCODE.BINARY : OPCODE.TEXT, payload, this._isClient);
    this._writeRaw(frame, cb);
  }

  ping(data = '') {
    if (this.readyState !== 1) return;
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    this._writeRaw(encodeFrame(OPCODE.PING, payload, this._isClient));
  }

  pong(data = '') {
    if (this.readyState !== 1) return;
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    this._writeRaw(encodeFrame(OPCODE.PONG, payload, this._isClient));
  }

  close(code = 1000, reason = '') {
    if (this.readyState >= 2) return;
    this.readyState = 2; // CLOSING
    this._closeSent = true;

    let payload = Buffer.alloc(0);
    if (typeof code === 'number' && Number.isInteger(code)) {
      const reasonBuf = Buffer.from(String(reason || ''), 'utf8').subarray(0, 123);
      payload = Buffer.allocUnsafe(2 + reasonBuf.length);
      payload.writeUInt16BE(code, 0);
      reasonBuf.copy(payload, 2);
    }

    const frame = encodeFrame(OPCODE.CLOSE, payload, this._isClient);
    if (this._socket && !this._socket.destroyed && !this._socket.writableEnded) {
      this._socket.end(frame);
    }

    this._closeFallbackTimer = setTimeout(() => {
      this._finalizeClose(typeof code === 'number' ? code : 1005, Buffer.from(String(reason || ''), 'utf8'));
    }, 50);
    if (typeof this._closeFallbackTimer.unref === 'function') {
      this._closeFallbackTimer.unref();
    }
  }

  terminate() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    if (this._socket && !this._socket.destroyed) {
      try { this._socket.destroy(); } catch (_) {}
    }
    this._finalizeClose(1006, Buffer.alloc(0));
  }

  _handleIncomingData(chunk) {
    if (this._closedEmitted) return;
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this._buffer = this._buffer.length === 0 ? buf : Buffer.concat([this._buffer, buf]);
    this._drainFrames();
  }

  _drainFrames() {
    while (this._buffer.length >= 2 && !this._closedEmitted) {
      let decoded;
      try {
        decoded = tryDecodeFrame(this._buffer);
      } catch (err) {
        if (this.listenerCount('error') > 0) this.emit('error', err);
        this.terminate();
        return;
      }
      if (!decoded) break;

      this._buffer = this._buffer.subarray(decoded.bytesConsumed);
      this._processFrame(decoded.frame);
    }
  }

  _processFrame({ fin, opcode, payload }) {
    if (opcode === OPCODE.PING) {
      this.emit('ping', payload);
      if (this.readyState === 1) {
        this._writeRaw(encodeFrame(OPCODE.PONG, payload, this._isClient));
      }
      return;
    }

    if (opcode === OPCODE.PONG) {
      this.emit('pong', payload);
      return;
    }

    if (opcode === OPCODE.CLOSE) {
      let code = 1005;
      let reasonBuf = Buffer.alloc(0);
      if (payload.length >= 2) {
        code = payload.readUInt16BE(0);
        reasonBuf = payload.subarray(2);
      }
      if (!this._closeSent && this._socket && !this._socket.destroyed && !this._socket.writableEnded) {
        this._closeSent = true;
        this.readyState = 2;
        this._socket.end(encodeFrame(OPCODE.CLOSE, payload, this._isClient));
      }
      this._finalizeClose(code, reasonBuf);
      return;
    }

    if (opcode === OPCODE.TEXT || opcode === OPCODE.BINARY) {
      if (!fin) {
        this._fragmentOpcode = opcode;
        this._fragments = [payload];
        return;
      }
      this.emit('message', payload, opcode === OPCODE.BINARY);
      return;
    }

    if (opcode === OPCODE.CONTINUATION) {
      if (this._fragmentOpcode === null) return;
      this._fragments.push(payload);
      if (fin) {
        const full = Buffer.concat(this._fragments);
        const isBinary = this._fragmentOpcode === OPCODE.BINARY;
        this._fragments = [];
        this._fragmentOpcode = null;
        this.emit('message', full, isBinary);
      }
    }
  }

  _finalizeClose(code, reasonBuf) {
    if (this._closedEmitted) return;
    this._closedEmitted = true;
    this.readyState = 3;
    this.closeCode = code;
    this.closeReason = Buffer.isBuffer(reasonBuf) ? reasonBuf.toString('utf8') : String(reasonBuf || '');

    if (this._closeFallbackTimer) {
      clearTimeout(this._closeFallbackTimer);
      this._closeFallbackTimer = null;
    }

    if (this._socket) {
      this._socket.off('data', this._onData);
      this._socket.off('end', this._onEnd);
      this._socket.off('close', this._onEnd);
      this._socket.off('error', this._onError);
    }

    this.emit('close', code, reasonBuf);
  }
}

PureWebSocket.CONNECTING = 0;
PureWebSocket.OPEN = 1;
PureWebSocket.CLOSING = 2;
PureWebSocket.CLOSED = 3;

function handleUpgrade(fastify, matchedRoute, request, rawReq, socket, head) {
  const headers = rawReq && rawReq.headers ? rawReq.headers : {};
  const upgradeHdr = String(headers.upgrade || headers.Upgrade || '').toLowerCase();
  const secKey = headers['sec-websocket-key'] || headers['Sec-WebSocket-Key'];

  if (upgradeHdr !== 'websocket' || !secKey) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return;
  }

  const acceptKey = computeAcceptKey(secKey);
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    ''
  ].join('\r\n');

  socket.write(responseHeaders);

  const ws = new PureWebSocket(socket, { isClient: false, initialBuffer: head });
  Promise.resolve(matchedRoute.handler(ws, request)).catch((err) => {
    if (fastify._errorHandler) {
      try { fastify._errorHandler(err, request, { code: () => ({ send: () => {} }), send: () => {} }); } catch (_) {}
    }
    try { ws.close(1011, 'Internal Server Error'); } catch (_) {}
  });
}

async function fastifyWebsocket(fastify) {
  const wsApi = {
    computeAcceptKey,
    encodeFrame,
    tryDecodeFrame,
    WebSocket: PureWebSocket,
    handleUpgrade
  };
  fastify._websocket = wsApi;
  if (!fastify.websocketServer) {
    fastify.decorate('websocketServer', wsApi);
  }
}

module.exports = fastifyWebsocket;
module.exports.default = fastifyWebsocket;
module.exports.WebSocket = PureWebSocket;
module.exports.computeAcceptKey = computeAcceptKey;
module.exports.encodeFrame = encodeFrame;
module.exports.tryDecodeFrame = tryDecodeFrame;
