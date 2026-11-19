import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

export function findBrowserExecutable() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`No Edge/Chrome executable found. Checked: ${BROWSER_CANDIDATES.join(', ')}`);
}

class CDPConnection {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = (err) => reject(new Error(`CDP WebSocket error: ${err?.message || 'connection failed'}`));
      ws.onmessage = (event) => {
        const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
        if (msg.id !== undefined) {
          const entry = this.pending.get(msg.id);
          if (entry) {
            this.pending.delete(msg.id);
            if (msg.error) {
              entry.reject(new Error(`CDP ${entry.method} error: ${msg.error.message} (${msg.error.code})`));
            } else {
              entry.resolve(msg.result || {});
            }
          }
          return;
        }
        const key = `${msg.sessionId || 'browser'}:${msg.method}`;
        const listeners = this.eventListeners.get(key);
        if (listeners) {
          for (const fn of listeners) {
            fn(msg.params || {});
          }
        }
      };
      ws.onclose = () => {
        for (const [, entry] of this.pending) {
          entry.reject(new Error(`CDP connection closed before ${entry.method} completed`));
        }
        this.pending.clear();
      };
    });
  }

  send(method, params = {}, sessionId = undefined, timeoutMs = 15000) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error(`CDP socket not open for ${method}`));
        return;
      }
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); },
        method
      });
      this.ws.send(JSON.stringify(payload));
    });
  }

  on(sessionId, method, handler) {
    const key = `${sessionId || 'browser'}:${method}`;
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Set());
    }
    this.eventListeners.get(key).add(handler);
    return () => this.eventListeners.get(key)?.delete(handler);
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}

export class CDPPage {
  constructor(conn, sessionId, targetId, browserContextId) {
    this.conn = conn;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.browserContextId = browserContextId;
    this.pageErrors = [];
    this.consoleErrors = [];
    this.http5xxErrors = [];
    this.networkFailures = [];
  }

  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
    await this.send('Network.enable');
    await this.send('Log.enable');

    this.conn.on(this.sessionId, 'Runtime.exceptionThrown', (params) => {
      const details = params.exceptionDetails || {};
      const text =
        details.exception?.description ||
        details.text ||
        'Uncaught page exception';
      this.pageErrors.push(text);
    });

    this.conn.on(this.sessionId, 'Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        const text = (params.args || [])
          .map((a) => a.value ?? a.description ?? a.type)
          .join(' ');
        this.consoleErrors.push(text);
      }
    });

    this.conn.on(this.sessionId, 'Log.entryAdded', (params) => {
      const entry = params.entry || {};
      if (entry.level === 'error') {
        this.consoleErrors.push(`[${entry.source}] ${entry.text} (${entry.url || ''})`);
      }
    });

    this.conn.on(this.sessionId, 'Network.responseReceived', (params) => {
      const status = params.response?.status || 0;
      const url = params.response?.url || '';
      if (status >= 500) {
        this.http5xxErrors.push({ status, url });
      }
    });
  }

  send(method, params = {}) {
    return this.conn.send(method, params, this.sessionId);
  }

  clearDiagnostics() {
    this.pageErrors.length = 0;
    this.consoleErrors.length = 0;
    this.http5xxErrors.length = 0;
    this.networkFailures.length = 0;
  }

  async eval(fnOrExpr, ...args) {
    const expression =
      typeof fnOrExpr === 'function'
        ? `(${fnOrExpr.toString()})(...${JSON.stringify(args)})`
        : fnOrExpr;

    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });

    if (res.exceptionDetails) {
      const msg =
        res.exceptionDetails.exception?.description ||
        res.exceptionDetails.text ||
        'Evaluation error';
      throw new Error(`Page eval failed: ${msg}`);
    }

    return res.result?.value;
  }

  async sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async goto(url, { waitUntilReady = true } = {}) {
    await this.send('Page.navigate', { url });
    if (waitUntilReady) {
      await this.waitFor(
        () => document.readyState === 'complete' && document.body && document.body.innerText.trim().length > 0,
        { timeout: 15000, message: `Page did not finish loading: ${url}` }
      );
      await this.sleep(200);
    }
  }

  async waitFor(fn, { timeout = 12000, interval = 100, message = 'Timed out waiting for condition' } = {}, ...args) {
    const deadline = Date.now() + timeout;
    let lastErr = null;
    while (Date.now() < deadline) {
      try {
        const result = await this.eval(fn, ...args);
        if (result) return result;
      } catch (err) {
        lastErr = err;
      }
      await this.sleep(interval);
    }
    const bodyPreview = await this.eval(() => (document.body ? document.body.innerText.slice(0, 600) : '')).catch(() => '');
    const urlNow = await this.eval(() => window.location.href).catch(() => '');
    throw new Error(`${message} (url=${urlNow}${lastErr ? `, err=${lastErr.message}` : ''})\nBody preview:\n${bodyPreview}`);
  }

  async waitForText(text, timeout = 12000) {
    return this.waitFor(
      (expected) => Boolean(document.body && document.body.innerText.toLowerCase().includes(expected.toLowerCase())),
      { timeout, message: `Timed out waiting for text: "${text}"` },
      text
    );
  }

  async waitForTextGone(text, timeout = 12000) {
    return this.waitFor(
      (expected) => Boolean(document.body && !document.body.innerText.toLowerCase().includes(expected.toLowerCase())),
      { timeout, message: `Timed out waiting for text to disappear: "${text}"` },
      text
    );
  }

  async waitForUrl(substringOrRegex, timeout = 12000) {
    if (typeof substringOrRegex === 'string') {
      return this.waitFor(
        (sub) => (window.location.pathname + window.location.search).includes(sub) || window.location.href.includes(sub),
        { timeout, message: `Timed out waiting for URL containing "${substringOrRegex}"` },
        substringOrRegex
      );
    }
    const pattern = substringOrRegex.source;
    const flags = substringOrRegex.flags;
    return this.waitFor(
      (pat, flg) => new RegExp(pat, flg).test(window.location.pathname + window.location.search),
      { timeout, message: `Timed out waiting for URL matching /${pattern}/${flags}` },
      pattern,
      flags
    );
  }

  async getUrl() {
    return this.eval(() => window.location.pathname + window.location.search);
  }

  async getBodyText() {
    return this.eval(() => (document.body ? document.body.innerText : ''));
  }

  async clickPoint(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  async clickElementFromFn(findFn, errorMsg, ...args) {
    const target = await this.waitFor(
      async (fnSrc, fnArgs) => {
        const finder = eval(`(${fnSrc})`);
        const el = finder(...fnArgs);
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        const r1 = el.getBoundingClientRect();
        if (r1.width === 0 || r1.height === 0) return null;
        await new Promise((res) => setTimeout(res, 120));
        const r2 = el.getBoundingClientRect();
        if (Math.abs(r1.left - r2.left) > 2 || Math.abs(r1.top - r2.top) > 2) {
          return null;
        }
        const cx = r2.left + r2.width / 2;
        const cy = r2.top + r2.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || (!el.contains(hit) && hit !== el)) {
          return null;
        }
        return { x: cx, y: cy };
      },
      { timeout: 10000, message: errorMsg },
      findFn.toString(),
      args
    );
    await this.clickPoint(target.x, target.y);
    await this.sleep(150);
  }

  async clickSelector(selector) {
    await this.clickElementFromFn(
      (sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        return els.find((el) => {
          const s = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        }) || null;
      },
      `Element not clickable or not found: ${selector}`,
      selector
    );
  }

  async clickButton(labelText, { exact = false, within = null } = {}) {
    await this.clickElementFromFn(
      (label, isExact, scopeSel) => {
        const root = scopeSel ? document.querySelector(scopeSel) : document;
        if (!root) return null;
        const candidates = Array.from(root.querySelectorAll('button, a, [role="button"], [role="tab"]'));
        return candidates.find((el) => {
          const style = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || r.width === 0 || r.height === 0) {
            return false;
          }
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
            return false;
          }
          const txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
          return isExact ? txt === label : txt.includes(label);
        }) || null;
      },
      `Button/link "${labelText}" not found or not visible`,
      labelText,
      exact,
      within
    );
  }

  async clickByAriaLabel(ariaLabel, { index = 0, within = null } = {}) {
    await this.clickElementFromFn(
      (label, idx, scopeSel) => {
        const root = scopeSel ? document.querySelector(scopeSel) : document;
        if (!root) return null;
        const matches = Array.from(root.querySelectorAll(`[aria-label="${label}"]`)).filter((el) => {
          const style = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        });
        return matches[idx] || null;
      },
      `Element with aria-label="${ariaLabel}" (index ${index}) not found`,
      ariaLabel,
      index,
      within
    );
  }

  async fillElement(findFn, value, errorMsg, ...args) {
    const info = await this.waitFor(
      (fnSrc, fnArgs) => {
        const finder = eval(`(${fnSrc})`);
        const el = finder(...fnArgs);
        if (!el) return null;
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: el.tagName, type: el.type || '' };
      },
      { timeout: 10000, message: errorMsg },
      findFn.toString(),
      args
    );

    if (info.type === 'date') {
      await this.eval(
        (fnSrc, fnArgs, val) => {
          const finder = eval(`(${fnSrc})`);
          const el = finder(...fnArgs);
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        },
        findFn.toString(),
        args,
        String(value)
      );
      await this.sleep(100);
      return;
    }

    await this.clickPoint(info.x, info.y);
    await this.eval(
      (fnSrc, fnArgs) => {
        const finder = eval(`(${fnSrc})`);
        const el = finder(...fnArgs);
        if (el) {
          el.focus();
          if (typeof el.select === 'function') el.select();
        }
      },
      findFn.toString(),
      args
    );
    // Clear via Ctrl+A + Backspace
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });

    const strVal = String(value);
    if (strVal.length > 0) {
      await this.send('Input.insertText', { text: strVal });
    } else {
      // Ensure v-model sees empty string
      await this.eval(
        (fnSrc, fnArgs) => {
          const finder = eval(`(${fnSrc})`);
          const el = finder(...fnArgs);
          if (el) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        },
        findFn.toString(),
        args
      );
    }
    // Blur so UForm/field validation settles before subsequent clicks
    await this.eval(
      (fnSrc, fnArgs) => {
        const finder = eval(`(${fnSrc})`);
        const el = finder(...fnArgs);
        if (el && typeof el.blur === 'function') el.blur();
      },
      findFn.toString(),
      args
    );
    await this.sleep(120);
  }

  async fillInput(selector, value) {
    await this.fillElement(
      (sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        return els.find((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }) || null;
      },
      value,
      `Input not found: ${selector}`,
      selector
    );
  }

  async fillByLabel(labelText, value, { within = null } = {}) {
    await this.fillElement(
      (lbl, scopeSel) => {
        const root = scopeSel ? document.querySelector(scopeSel) : document;
        if (!root) return null;
        const labels = Array.from(root.querySelectorAll('label'));
        const matchingLabel = labels.find((l) => (l.innerText || '').includes(lbl));
        if (!matchingLabel) return null;

        const forId = matchingLabel.getAttribute('for');
        if (forId) {
          const target = document.getElementById(forId);
          if (target) return target;
        }
        const container = matchingLabel.closest('div')?.parentElement || matchingLabel.parentElement;
        return container ? container.querySelector('input, textarea') : null;
      },
      value,
      `Input with label "${labelText}" not found`,
      labelText,
      within
    );
  }

  async selectByLabel(labelText, optionText, { within = null, searchTerm = null } = {}) {
    // Click the combobox/select trigger associated with labelText
    await this.clickElementFromFn(
      (lbl, scopeSel) => {
        const root = scopeSel ? document.querySelector(scopeSel) : document;
        if (!root) return null;
        const labels = Array.from(root.querySelectorAll('label'));
        const matchingLabel = labels.find((l) => (l.innerText || '').includes(lbl));
        if (!matchingLabel) return null;

        const forId = matchingLabel.getAttribute('for');
        if (forId) {
          const target = document.getElementById(forId);
          if (target) return target;
        }
        const fieldRoot = matchingLabel.closest('[class*="space-y"]') || matchingLabel.parentElement?.parentElement || matchingLabel.parentElement;
        if (!fieldRoot) return null;
        return fieldRoot.querySelector('button[role="combobox"], button');
      },
      `Select trigger for label "${labelText}" not found`,
      labelText,
      within
    );

    if (searchTerm) {
      await this.sleep(200);
      await this.fillElement(
        () => {
          const inputs = Array.from(document.querySelectorAll('[data-reka-popper-content-wrapper] input, [role="listbox"] input, input[placeholder*="Tomato"]'));
          return inputs.find((i) => {
            const r = i.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          }) || null;
        },
        searchTerm,
        `Search input inside select menu for "${labelText}" not found`
      );
      await this.sleep(400);
    }

    await this.clickElementFromFn(
      (optText) => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        return options.find((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          return (el.innerText || el.textContent || '').includes(optText);
        }) || null;
      },
      `Select option "${optionText}" not found for "${labelText}"`,
      optionText
    );
    await this.sleep(150);
  }

  async close() {
    await this.conn.send('Target.disposeBrowserContext', { browserContextId: this.browserContextId }).catch(() => {});
  }
}

export class CDPBrowser {
  constructor() {
    this.proc = null;
    this.conn = null;
    this.tmpDir = null;
  }

  async launch() {
    const executable = findBrowserExecutable();
    this.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-e2e-browser-'));

    this.proc = spawn(executable, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1440,900',
      '--remote-debugging-port=0',
      `--user-data-dir=${this.tmpDir}`,
      'about:blank'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const wsUrl = await new Promise((resolve, reject) => {
      let buffer = '';
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for DevTools WebSocket from ${executable}\nStderr:\n${buffer}`));
      }, 15000);

      const onData = (chunk) => {
        buffer += chunk.toString();
        const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          this.proc.stderr.off('data', onData);
          resolve(match[1]);
        }
      };
      this.proc.stderr.on('data', onData);
      this.proc.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Browser exited prematurely with code ${code}\nStderr:\n${buffer}`));
      });
    });

    this.conn = new CDPConnection(wsUrl);
    await this.conn.connect();
  }

  async newPage() {
    const { browserContextId } = await this.conn.send('Target.createBrowserContext');
    const { targetId } = await this.conn.send('Target.createTarget', {
      url: 'about:blank',
      browserContextId
    });
    const { sessionId } = await this.conn.send('Target.attachToTarget', {
      targetId,
      flatten: true
    });
    const page = new CDPPage(this.conn, sessionId, targetId, browserContextId);
    await page.init();
    return page;
  }

  async close() {
    if (this.conn) {
      await this.conn.send('Browser.close', {}, undefined, 2000).catch(() => {});
      this.conn.close();
      this.conn = null;
    }
    if (this.proc) {
      const pid = this.proc.pid;
      const exitPromise = new Promise((resolve) => {
        if (this.proc.exitCode !== null) {
          resolve();
          return;
        }
        this.proc.once('exit', resolve);
        setTimeout(resolve, 2000);
      });
      try {
        this.proc.stdout?.destroy();
        this.proc.stderr?.destroy();
        if (this.proc.exitCode === null) {
          this.proc.kill();
        }
      } catch {
        // ignore
      }
      await exitPromise;
      if (process.platform === 'win32' && pid && this.proc.exitCode === null) {
        try {
          const { execFileSync } = await import('node:child_process');
          execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
        } catch {
          // ignore
        }
      }
      this.proc = null;
    }
    if (this.tmpDir) {
      for (let i = 0; i < 5; i++) {
        try {
          fs.rmSync(this.tmpDir, { recursive: true, force: true });
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      this.tmpDir = null;
    }
  }
}
