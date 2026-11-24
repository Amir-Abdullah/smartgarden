const http = require('node:http');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Duplex, PassThrough } = require('node:stream');
const { parse: parseUrl } = require('node:url');

function createDuplexPair() {
  let clientClosed = false;
  let serverClosed = false;

  const clientSide = new Duplex({
    read() {},
    write(chunk, _enc, cb) {
      const copy = Buffer.from(chunk);
      setImmediate(() => {
        if (!serverClosed && !serverSide.destroyed) {
          serverSide.push(copy);
        }
        cb();
      });
    },
    final(cb) {
      serverClosed = true;
      setImmediate(() => {
        if (!serverSide.destroyed) serverSide.push(null);
        cb();
      });
    }
  });

  const serverSide = new Duplex({
    read() {},
    write(chunk, _enc, cb) {
      const copy = Buffer.from(chunk);
      setImmediate(() => {
        if (!clientClosed && !clientSide.destroyed) {
          clientSide.push(copy);
        }
        cb();
      });
    },
    final(cb) {
      clientClosed = true;
      setImmediate(() => {
        if (!clientSide.destroyed) clientSide.push(null);
        cb();
      });
    }
  });

  clientSide.on('close', () => {
    clientClosed = true;
    if (!serverSide.destroyed) {
      setImmediate(() => {
        if (!serverSide.destroyed) serverSide.push(null);
      });
    }
  });

  serverSide.on('close', () => {
    serverClosed = true;
    if (!clientSide.destroyed) {
      setImmediate(() => {
        if (!clientSide.destroyed) clientSide.push(null);
      });
    }
  });

  clientSide.remoteAddress = '127.0.0.1';
  serverSide.remoteAddress = '127.0.0.1';

  return { clientSide, serverSide };
}

class FastifyReply {
  constructor(res, resolveInject = null) {
    this._res = res;
    this.raw = res;
    this._resolveInject = resolveInject;
    this.statusCode = 200;
    this._headers = {};
    this._sent = false;
    this._hijacked = false;
  }

  code(code) {
    this.statusCode = code;
    return this;
  }

  status(code) {
    return this.code(code);
  }

  header(name, value) {
    this._headers[name.toLowerCase()] = value;
    return this;
  }

  type(contentType) {
    return this.header('content-type', contentType);
  }

  redirect(url, code = 302) {
    this.statusCode = code;
    this.header('location', url);
    return this.send('');
  }

  hijack() {
    this._hijacked = true;
    this._sent = true;
    return this;
  }

  send(payload) {
    if (this._sent) return this;
    this._sent = true;

    let body = payload;
    if (payload !== undefined && payload !== null && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
      if (!this._headers['content-type']) {
        this._headers['content-type'] = 'application/json; charset=utf-8';
      }
      body = JSON.stringify(payload);
    }

    if (this._resolveInject) {
      const rawPayload = Buffer.isBuffer(body)
        ? body
        : Buffer.from(body !== undefined && body !== null ? String(body) : '', 'utf8');
      this._resolveInject({
        statusCode: this.statusCode,
        headers: this._headers,
        rawPayload,
        payload: Buffer.isBuffer(body) ? body.toString('latin1') : String(body !== undefined ? body : ''),
        json: () => {
          try {
            return JSON.parse(body);
          } catch (e) {
            throw new Error(`Failed to parse response body as JSON: ${body}`);
          }
        }
      });
      return this;
    }

    if (this._res) {
      this._res.statusCode = this.statusCode;
      for (const [k, v] of Object.entries(this._headers)) {
        this._res.setHeader(k, v);
      }
      this._res.end(body);
    }
    return this;
  }
}

class FastifyRequest {
  constructor(req, params = {}, query = {}, body = null) {
    this.raw = req;
    const rawHeaders = (req && req.headers) ? req.headers : {};
    this.headers = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      this.headers[k.toLowerCase()] = v;
      this.headers[k] = v;
    }
    this.params = params;
    this.query = query;
    this.body = body;
    this.ip = (req && req.socket && req.socket.remoteAddress) || '127.0.0.1';
    this.log = {
      info: () => { },
      error: () => { },
      warn: () => { },
      debug: () => { }
    };
  }
}

class FastifyInstance {
  constructor(options = {}) {
    this.options = options;
    this._routes = [];
    this._hooks = {
      onRequest: [],
      preHandler: [],
      onResponse: [],
      onError: [],
      onClose: []
    };
    this._errorHandler = null;
    this._notFoundHandler = (req, reply) => {
      reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Route ${req.raw ? req.raw.method : 'GET'}:${req.raw ? req.raw.url : '/'} not found`
      });
    };
    this._server = null;
    this._websocket = null;
    this._decorators = {};
    this._requestDecorators = {};
  }

  decorate(name, value) {
    this[name] = value;
    this._decorators[name] = value;
    return this;
  }

  decorateRequest(name, value) {
    this._requestDecorators[name] = value;
    return this;
  }

  addHook(name, fn) {
    if (this._hooks[name]) {
      this._hooks[name].push(fn);
    }
    return this;
  }

  setErrorHandler(fn) {
    this._errorHandler = fn;
    return this;
  }

  setNotFoundHandler(fn) {
    this._notFoundHandler = fn;
    return this;
  }

  async ready() {
    return this;
  }

  async register(plugin, options = {}) {
    const prefix = options.prefix || '';
    if (typeof plugin === 'function') {
      if (prefix) {
        const scoped = Object.create(this);
        scoped._addRouteWithPrefix = (method, path, opts, handler) => {
          const suffix = (path === '/' || path === '') ? '' : (path.startsWith('/') ? path : '/' + path);
          const fullPath = prefix + suffix;
          this._addRoute(method, fullPath, opts, handler);
        };
        scoped.get = (p, o, h) => { scoped._addRouteWithPrefix('GET', p, o, h); return scoped; };
        scoped.post = (p, o, h) => { scoped._addRouteWithPrefix('POST', p, o, h); return scoped; };
        scoped.put = (p, o, h) => { scoped._addRouteWithPrefix('PUT', p, o, h); return scoped; };
        scoped.delete = (p, o, h) => { scoped._addRouteWithPrefix('DELETE', p, o, h); return scoped; };
        scoped.patch = (p, o, h) => { scoped._addRouteWithPrefix('PATCH', p, o, h); return scoped; };
        scoped.options = (p, o, h) => { scoped._addRouteWithPrefix('OPTIONS', p, o, h); return scoped; };
        await plugin(scoped, options);
      } else {
        await plugin(this, options);
      }
    }
    return this;
  }

  _addRoute(method, path, opts, handler) {
    if (typeof opts === 'function') {
      handler = opts;
      opts = {};
    }
    const cleanPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
    const paramNames = [];
    const regexPath = cleanPath.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = cleanPath === '/' ? /^\/$/ : new RegExp(`^${regexPath}/?$`);

    this._routes.push({
      method: method.toUpperCase(),
      path: cleanPath,
      regex,
      paramNames,
      websocket: Boolean(opts && opts.websocket),
      preHandler: opts && opts.preHandler ? (Array.isArray(opts.preHandler) ? opts.preHandler : [opts.preHandler]) : [],
      handler
    });
  }

  get(path, opts, handler) { this._addRoute('GET', path, opts, handler); return this; }
  post(path, opts, handler) { this._addRoute('POST', path, opts, handler); return this; }
  put(path, opts, handler) { this._addRoute('PUT', path, opts, handler); return this; }
  delete(path, opts, handler) { this._addRoute('DELETE', path, opts, handler); return this; }
  patch(path, opts, handler) { this._addRoute('PATCH', path, opts, handler); return this; }
  options(path, opts, handler) { this._addRoute('OPTIONS', path, opts, handler); return this; }

  _matchRoute(method, pathname, { websocketOnly = false } = {}) {
    for (const r of this._routes) {
      if (websocketOnly && !r.websocket) continue;
      if (r.method === method || r.method === 'ALL') {
        const m = pathname.match(r.regex);
        if (m) {
          const params = {};
          r.paramNames.forEach((name, i) => {
            params[name] = decodeURIComponent(m[i + 1]);
          });
          return { route: r, params };
        }
      }
    }
    return null;
  }

  async _runHook(hook, request, reply) {
    if (hook.length >= 3) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const done = (err) => {
          if (settled) return;
          settled = true;
          if (err) reject(err);
          else resolve();
        };
        try {
          const maybePromise = hook(request, reply, done);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(
              () => { if (!settled) { settled = true; resolve(); } },
              (err) => { if (!settled) { settled = true; reject(err); } }
            );
          } else if (reply._sent && !settled) {
            settled = true;
            resolve();
          }
        } catch (err) {
          if (!settled) {
            settled = true;
            reject(err);
          }
        }
      });
    } else {
      await hook(request, reply);
    }
  }

  async _handleRequest(req, rawMethod, rawUrl, rawBody, reply) {
    const { pathname, query: queryString } = parseUrl(rawUrl, true);
    const method = rawMethod.toUpperCase();

    const query = typeof queryString === 'string' ? require('querystring').parse(queryString) : (queryString || {});

    let contentType = '';
    if (req && req.headers) {
      for (const [k, v] of Object.entries(req.headers)) {
        if (k.toLowerCase() === 'content-type' && typeof v === 'string') {
          contentType = v.toLowerCase();
          break;
        }
      }
    }
    const isJsonHeader = contentType.includes('application/json');
    const isMultipartHeader = contentType.includes('multipart/form-data');

    let rawBuffer;
    if (Buffer.isBuffer(rawBody)) {
      rawBuffer = rawBody;
    } else if (typeof rawBody === 'string') {
      rawBuffer = Buffer.from(rawBody, 'utf8');
    } else if (rawBody !== null && typeof rawBody === 'object') {
      rawBuffer = Buffer.from(JSON.stringify(rawBody), 'utf8');
    } else {
      rawBuffer = Buffer.alloc(0);
    }

    let body = rawBody;
    let bodyParseError = null;

    if (isMultipartHeader) {
      body = rawBuffer;
    } else if (Buffer.isBuffer(rawBody) || typeof rawBody === 'string') {
      const rawText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      body = rawText;
      const trimmed = rawText.trim();
      if (isJsonHeader) {
        if (trimmed.length > 0) {
          try {
            body = JSON.parse(rawText);
          } catch (parseErr) {
            bodyParseError = new Error('Invalid or malformed JSON payload');
            bodyParseError.statusCode = 400;
            bodyParseError.code = 'BAD_REQUEST';
            bodyParseError.details = {};
          }
        }
      } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          body = JSON.parse(rawText);
        } catch { }
      }
    }

    const matched = this._matchRoute(method, pathname);

    const request = new FastifyRequest(req, matched ? matched.params : {}, query, body);
    request.rawBody = rawBuffer;
    request.routerPath = matched ? matched.route.path : '';
    for (const [k, v] of Object.entries(this._requestDecorators)) {
      request[k] = typeof v === 'function' ? v.bind(request) : v;
    }

    try {
      for (const hook of this._hooks.onRequest) {
        await this._runHook(hook, request, reply);
        if (reply._sent || reply._hijacked) return;
      }

      if (bodyParseError) {
        throw bodyParseError;
      }

      if (!matched) {
        await this._notFoundHandler(request, reply);
        return;
      }

      const allPreHandlers = [...this._hooks.preHandler, ...matched.route.preHandler];
      for (const hook of allPreHandlers) {
        await this._runHook(hook, request, reply);
        if (reply._sent || reply._hijacked) return;
      }

      const res = await matched.route.handler(request, reply);
      if (!reply._sent && !reply._hijacked && res !== undefined) {
        reply.send(res);
      }
    } catch (err) {
      if (reply._hijacked) return;
      if (this._errorHandler) {
        try {
          await this._errorHandler(err, request, reply);
        } catch (handlerErr) {
          reply.code(500).send({ statusCode: 500, error: 'Internal Server Error', message: handlerErr.message });
        }
      } else {
        const statusCode = err.statusCode || 500;
        reply.code(statusCode).send({
          success: false,
          error: {
            code: err.code || (statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR'),
            message: err.message,
            details: err.details || {},
            statusCode
          }
        });
      }
    }
  }

  _handleUpgrade(req, socket, head = Buffer.alloc(0)) {
    const { pathname, query: queryString } = parseUrl(req.url || '/', true);
    const query = typeof queryString === 'string' ? require('querystring').parse(queryString) : (queryString || {});
    const matched = this._matchRoute('GET', pathname, { websocketOnly: true });

    if (!matched || !this._websocket) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }

    const request = new FastifyRequest(req, matched.params, query, null);
    request.routerPath = matched.route.path;
    for (const [k, v] of Object.entries(this._requestDecorators)) {
      request[k] = typeof v === 'function' ? v.bind(request) : v;
    }

    this._websocket.handleUpgrade(this, matched.route, request, req, socket, head);
  }

  async injectWs(url = '/', headers = {}) {
    if (!this._websocket) {
      throw new Error('WebSocket plugin (@fastify/websocket) is not registered');
    }

    const { clientSide, serverSide } = createDuplexPair();
    const secKey = crypto.randomBytes(16).toString('base64');
    const expectedAccept = this._websocket.computeAcceptKey(secKey);

    const normalizedHeaders = {};
    for (const [k, v] of Object.entries(headers || {})) {
      normalizedHeaders[k.toLowerCase()] = v;
    }
    const headerLines = [
      `GET ${url} HTTP/1.1`,
      `Host: ${normalizedHeaders.host || 'localhost'}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${secKey}`,
      'Sec-WebSocket-Version: 13'
    ];
    for (const [k, v] of Object.entries(normalizedHeaders)) {
      if (!['host', 'upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version'].includes(k)) {
        headerLines.push(`${k}: ${v}`);
      }
    }
    const rawUpgradeReq = `${headerLines.join('\r\n')}\r\n\r\n`;

    // Server-side parser reads RFC 6455 HTTP upgrade request from serverSide Duplex
    let serverBuf = Buffer.alloc(0);
    const onServerData = (chunk) => {
      serverBuf = Buffer.concat([serverBuf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      const headerEnd = serverBuf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      serverSide.off('data', onServerData);
      const rawHead = serverBuf.subarray(0, headerEnd).toString('utf8');
      const trailing = serverBuf.subarray(headerEnd + 4);
      const lines = rawHead.split('\r\n');
      const reqLineParts = (lines[0] || '').split(' ');
      const reqHeaders = {};
      for (let i = 1; i < lines.length; i++) {
        const idx = lines[i].indexOf(':');
        if (idx > 0) {
          const name = lines[i].slice(0, idx).trim().toLowerCase();
          const val = lines[i].slice(idx + 1).trim();
          reqHeaders[name] = val;
        }
      }
      const reqMock = {
        method: reqLineParts[0] || 'GET',
        url: reqLineParts[1] || url,
        headers: reqHeaders,
        socket: serverSide
      };
      this._handleUpgrade(reqMock, serverSide, trailing);
    };
    serverSide.on('data', onServerData);

    const clientPromise = new Promise((resolve, reject) => {
      let clientBuf = Buffer.alloc(0);
      const onClientData = (chunk) => {
        clientBuf = Buffer.concat([clientBuf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
        const headerEnd = clientBuf.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        clientSide.off('data', onClientData);
        clientSide.off('error', onClientError);

        const rawHead = clientBuf.subarray(0, headerEnd).toString('utf8');
        const trailing = clientBuf.subarray(headerEnd + 4);
        const lines = rawHead.split('\r\n');
        const statusMatch = (lines[0] || '').match(/^HTTP\/\S+\s+(\d+)/i);
        const statusCode = statusMatch ? Number(statusMatch[1]) : 500;
        const respHeaders = {};
        for (let i = 1; i < lines.length; i++) {
          const idx = lines[i].indexOf(':');
          if (idx > 0) {
            respHeaders[lines[i].slice(0, idx).trim().toLowerCase()] = lines[i].slice(idx + 1).trim();
          }
        }

        if (statusCode !== 101 || respHeaders['sec-websocket-accept'] !== expectedAccept) {
          clientSide.destroy();
          serverSide.destroy();
          const err = new Error(`WebSocket handshake failed with status ${statusCode}`);
          err.statusCode = statusCode;
          reject(err);
          return;
        }

        const wsClient = new this._websocket.WebSocket(clientSide, {
          isClient: true,
          initialBuffer: trailing
        });
        resolve(wsClient);
      };

      const onClientError = (err) => {
        clientSide.off('data', onClientData);
        reject(err);
      };

      clientSide.on('data', onClientData);
      clientSide.once('error', onClientError);
    });

    clientSide.write(rawUpgradeReq);
    return clientPromise;
  }

  async inject(opts = {}) {
    return new Promise((resolve) => {
      const method = (opts.method || 'GET').toUpperCase();
      const url = opts.url || '/';
      const headers = opts.headers || {};
      const payload = opts.payload || opts.body || '';

      const reqMock = new EventEmitter();
      reqMock.method = method;
      reqMock.url = url;
      reqMock.headers = { ...headers };
      reqMock.socket = { remoteAddress: '127.0.0.1' };
      reqMock.destroy = () => {
        reqMock.emit('close');
      };

      let rawResMock = null;
      if (opts.stream) {
        const stream = new PassThrough();
        let resolved = false;
        rawResMock = {
          statusCode: 200,
          _headers: {},
          writableEnded: false,
          stream,
          setHeader(k, v) {
            this._headers[String(k).toLowerCase()] = v;
          },
          writeHead(code, hdrs = {}) {
            this.statusCode = code;
            for (const [k, v] of Object.entries(hdrs)) {
              this._headers[String(k).toLowerCase()] = v;
            }
            if (!resolved) {
              resolved = true;
              resolve({
                statusCode: this.statusCode,
                headers: this._headers,
                stream,
                payload: '',
                json: () => ({}),
                close: () => {
                  reqMock.emit('close');
                  if (!stream.destroyed) stream.end();
                }
              });
            }
          },
          flushHeaders() {},
          write(chunk) {
            if (!this.writableEnded && !stream.destroyed) {
              return stream.write(chunk);
            }
            return false;
          },
          end(chunk) {
            if (this.writableEnded) return;
            this.writableEnded = true;
            if (chunk !== undefined) stream.end(chunk);
            else stream.end();
          }
        };
      }

      const reply = new FastifyReply(rawResMock, resolve);
      this._handleRequest(reqMock, method, url, payload, reply);
    });
  }

  async listen(opts = {}, callback) {
    if (typeof opts === 'number') {
      opts = { port: opts };
    }
    const port = opts.port !== undefined ? opts.port : 3000;
    const host = opts.host || '0.0.0.0';

    return new Promise((resolve, reject) => {
      this._server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', chunk => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on('end', () => {
          const reply = new FastifyReply(res);
          this._handleRequest(req, req.method, req.url, Buffer.concat(chunks), reply);
        });
      });

      this._server.on('upgrade', (req, socket, head) => {
        this._handleUpgrade(req, socket, head);
      });

      this._server.listen(port, host, () => {
        const addrInfo = this._server.address();
        const actualPort = (addrInfo && typeof addrInfo === 'object') ? addrInfo.port : port;
        const address = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${actualPort}`;
        if (typeof callback === 'function') callback(null, address);
        resolve(address);
      });

      this._server.on('error', (err) => {
        if (typeof callback === 'function') callback(err);
        reject(err);
      });
    });
  }

  async close(callback) {
    for (const hook of this._hooks.onClose) {
      try {
        await hook(this);
      } catch (_) {}
    }

    return new Promise((resolve) => {
      if (this._server) {
        this._server.close(() => {
          this._server = null;
          if (typeof callback === 'function') callback();
          resolve();
        });
      } else {
        if (typeof callback === 'function') callback();
        resolve();
      }
    });
  }
}

function fastify(options) {
  return new FastifyInstance(options);
}

module.exports = fastify;
module.exports.default = fastify;
module.exports.fastify = fastify;
