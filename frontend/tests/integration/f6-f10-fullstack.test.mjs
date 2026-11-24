import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire, registerHooks } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');

// Ensure isolated SQLite :memory: backend before loading any backend modules
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.ENABLE_SCHEDULER = 'false';
process.env.CRON_SECRET = 'inproc_cron_secret_at_least_32_characters_long';

// 1. Register synchronous ESM loader hooks so frontend router/services/stores run cleanly in Node
globalThis.__VITE_ENV__ = {
  VITE_API_BASE_URL: '/api'
};

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.vue')) {
      return {
        shortCircuit: true,
        format: 'module',
        source: 'export default { name: "VueSfcStub" };'
      };
    }
    const result = nextLoad(url, context);
    if (
      result &&
      result.format === 'module' &&
      url.includes('/frontend/src/') &&
      url.endsWith('.js') &&
      result.source
    ) {
      const code = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
      if (code.includes('import.meta.env')) {
        return {
          ...result,
          source: code.replaceAll('import.meta.env', '(globalThis.__VITE_ENV__ ?? {})')
        };
      }
    }
    return result;
  }
});

// 2. Lightweight browser globals required by Vue Router & Pinia stores
const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};

const fakeHistory = {
  state: null,
  replaceState(state) {
    this.state = state;
  },
  pushState(state) {
    this.state = state;
  },
  go() {}
};

const fakeLocation = {
  origin: 'http://127.0.0.1:5173',
  href: 'http://127.0.0.1:5173/',
  pathname: '/',
  search: '',
  hash: ''
};

globalThis.document = {
  title: '',
  documentElement: {
    style: {},
    scrollTop: 0,
    scrollLeft: 0,
    getBoundingClientRect: () => ({ top: 0, left: 0 })
  },
  head: { appendChild() {} },
  body: { appendChild() {}, style: {} },
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({
    content: {},
    style: {},
    setAttribute() {},
    appendChild() {},
    addEventListener() {}
  }),
  createElementNS: () => ({ style: {}, setAttribute() {} }),
  createTextNode: (t) => ({ textContent: t }),
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.location = fakeLocation;
globalThis.history = fakeHistory;
globalThis.window = {
  location: fakeLocation,
  history: fakeHistory,
  document: globalThis.document,
  pageXOffset: 0,
  pageYOffset: 0,
  scrollTo() {},
  addEventListener() {},
  removeEventListener() {}
};

// 3. Load backend app & frontend modules
const requireFromBackend = createRequire(path.join(BACKEND_DIR, 'package.json'));
const bcrypt = requireFromBackend('bcryptjs');
const dbConfig = requireFromBackend('./config/database.js');
const { runDemoSeed } = requireFromBackend('./scripts/seed-demo.js');
const { buildServer } = requireFromBackend('./server.js');
const { User, GardenMember } = requireFromBackend('./models');

const { createPinia, setActivePinia } = await import('pinia');
const { default: api } = await import('../../src/services/api.js');
const { default: router } = await import('../../src/router/index.js');
const { default: realtimeService } = await import('../../src/services/realtime.js');
const { useAuthStore } = await import('../../src/stores/auth.js');
const { useGardensStore } = await import('../../src/stores/gardens.js');
const { useTasksStore } = await import('../../src/stores/tasks.js');
const { useSensorsStore } = await import('../../src/stores/sensors.js');
const { useAlertsStore } = await import('../../src/stores/alerts.js');
const { useRulesStore } = await import('../../src/stores/rules.js');

async function waitUntil(predicate, timeoutMs = 3000, msg = 'Timed out waiting for condition') {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(msg);
}

describe('In-Process Full-Stack Integration: F6-F10 Pinia Stores + Router + WS/SSE + Fastify + SQLite', () => {
  let app;
  let pinia;
  let authStore;
  let gardensStore;
  let tasksStore;
  let sensorsStore;
  let alertsStore;
  let rulesStore;
  let zone1;
  let ownerToken;
  let rotatedDeviceKey;

  before(async () => {
    await dbConfig.connectDb();
    await runDemoSeed();
    app = buildServer({ logger: false });

    // Axios in-process adapter via app.inject()
    api.defaults.adapter = async (config) => {
      const base = String(config.baseURL || '/api').replace(/\/+$/, '');
      const rel = String(config.url || '/');
      let fullUrl = rel.startsWith('http')
        ? new URL(rel).pathname + new URL(rel).search
        : `${base}${rel.startsWith('/') ? '' : '/'}${rel}`;

      if (config.params && typeof config.params === 'object') {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(config.params)) {
          if (v !== undefined && v !== null && v !== '') {
            qs.append(k, String(v));
          }
        }
        const queryStr = qs.toString();
        if (queryStr) {
          fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryStr;
        }
      }

      const headers = {};
      const rawHeaders =
        config.headers && typeof config.headers.toJSON === 'function'
          ? config.headers.toJSON()
          : config.headers || {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (v !== undefined && v !== null) {
          headers[k.toLowerCase()] = String(v);
        }
      }

      let payload;
      if (config.data !== undefined) {
        payload = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
      }

      const res = await app.inject({
        method: String(config.method || 'GET').toUpperCase(),
        url: fullUrl,
        headers,
        payload
      });

      const rawBody = res.payload !== undefined ? res.payload : (res.body ?? '');
      let parsed = rawBody;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        // leave text as-is
      }

      const responseObj = {
        data: parsed,
        status: res.statusCode,
        statusText: String(res.statusCode),
        headers: res.headers,
        config
      };

      if (res.statusCode >= 400) {
        const err = new Error(`Request failed with status code ${res.statusCode}`);
        err.isAxiosError = true;
        err.response = responseObj;
        err.config = config;
        throw err;
      }
      return responseObj;
    };

    // Global InProcessWebSocket backed by app.injectWs()
    globalThis.__FORCE_WS_FAIL_COUNT__ = 0;
    class InProcessWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(wsUrl) {
        this.url = wsUrl;
        this.readyState = InProcessWebSocket.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        this._client = null;
        this._closedByUser = false;
        this._connect();
      }

      async _connect() {
        if (globalThis.__FORCE_WS_FAIL_COUNT__ > 0) {
          globalThis.__FORCE_WS_FAIL_COUNT__ -= 1;
          queueMicrotask(() => {
            this.readyState = InProcessWebSocket.CLOSED;
            this.onerror?.(new Error('Simulated pre-open WS failure'));
            this.onclose?.({ code: 1006, reason: 'Simulated failure' });
          });
          return;
        }

        try {
          const parsed = new URL(this.url);
          const client = await app.injectWs(`${parsed.pathname}${parsed.search}`);
          this._client = client;

          if (this._closedByUser) {
            client.close(1000, 'Client closing');
            return;
          }

          if (client.readyState === 3) {
            queueMicrotask(() => {
              this.readyState = InProcessWebSocket.CLOSED;
              this.onclose?.({
                code: client.closeCode || 1000,
                reason: client.closeReason || ''
              });
            });
            return;
          }

          this.readyState = InProcessWebSocket.OPEN;
          client.on('message', (data) => {
            const text = typeof data === 'string' ? data : data.toString('utf8');
            this.onmessage?.({ data: text });
          });
          client.on('close', (code, reason) => {
            this.readyState = InProcessWebSocket.CLOSED;
            this.onclose?.({
              code: code || 1000,
              reason: reason ? String(reason) : ''
            });
          });
          client.on('error', (err) => {
            this.onerror?.(err);
          });
          this.onopen?.({});
        } catch (err) {
          this.readyState = InProcessWebSocket.CLOSED;
          this.onerror?.(err);
          this.onclose?.({ code: 1006, reason: err.message });
        }
      }

      close(code = 1000, reason = '') {
        this._closedByUser = true;
        this.readyState = InProcessWebSocket.CLOSED;
        if (this._client) {
          try {
            this._client.close(code, reason);
          } catch {
            // ignore
          }
        }
      }
    }
    globalThis.WebSocket = InProcessWebSocket;

    // Global InProcessEventSource backed by app.inject({ stream: true })
    class InProcessEventSource {
      constructor(sseUrl) {
        this.url = sseUrl;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this._listeners = new Map();
        this._sseResp = null;
        this._closed = false;
        this._open();
      }

      addEventListener(eventName, fn) {
        if (!this._listeners.has(eventName)) {
          this._listeners.set(eventName, new Set());
        }
        this._listeners.get(eventName).add(fn);
      }

      async _open() {
        try {
          const parsed = new URL(this.url, 'http://127.0.0.1:5173');
          const sseResp = await app.inject({
            method: 'GET',
            url: `${parsed.pathname}${parsed.search}`,
            stream: true
          });
          if (this._closed) {
            sseResp.close();
            return;
          }
          if (sseResp.statusCode >= 400) {
            this.onerror?.(new Error(`SSE HTTP ${sseResp.statusCode}`));
            return;
          }
          this._sseResp = sseResp;
          this.onopen?.({});

          let buffer = '';
          sseResp.stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';
            for (const block of blocks) {
              const lines = block.split('\n');
              let eventName = 'message';
              const dataLines = [];
              for (const line of lines) {
                if (line.startsWith(':')) continue;
                if (line.startsWith('event:')) {
                  eventName = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dataLines.push(line.slice(5).trim());
                }
              }
              if (dataLines.length === 0) continue;
              const evt = { data: dataLines.join('\n') };
              const specific = this._listeners.get(eventName);
              if (specific) {
                for (const fn of specific) fn(evt);
              }
              if (eventName === 'message') {
                this.onmessage?.(evt);
              }
            }
          });
        } catch (err) {
          if (!this._closed) {
            this.onerror?.(err);
          }
        }
      }

      close() {
        this._closed = true;
        if (this._sseResp) {
          try {
            this._sseResp.close();
          } catch {
            // ignore
          }
          this._sseResp = null;
        }
      }
    }
    globalThis.EventSource = InProcessEventSource;

    pinia = createPinia();
    setActivePinia(pinia);
    authStore = useAuthStore();
    gardensStore = useGardensStore();
    tasksStore = useTasksStore();
    sensorsStore = useSensorsStore();
    alertsStore = useAlertsStore();
    rulesStore = useRulesStore();
  });

  after(async () => {
    realtimeService.disconnect();
    if (app) await app.close();
    await dbConfig.sequelize.close();
  });

  it('Journey 1: Auth + Router guards + F6-F10 live routes + Garden/Zone load', async () => {
    localStorage.clear();
    await router.push('/dashboard/care-tasks');
    assert.equal(router.currentRoute.value.path, '/login');
    assert.equal(router.currentRoute.value.query.redirect, '/dashboard/care-tasks');

    await authStore.login({
      email: 'demo@smartgarden.app',
      password: process.env.DEMO_USER_PASSWORD || 'DemoGarden123!'
    });
    ownerToken = authStore.token;
    assert.ok(ownerToken);

    for (const pathItem of [
      '/dashboard/care-tasks',
      '/dashboard/sensors',
      '/dashboard/alerts',
      '/dashboard/automations'
    ]) {
      await router.push(pathItem);
      assert.equal(router.currentRoute.value.path, pathItem);
      assert.notEqual(router.currentRoute.value.name, 'NotFound');
    }

    const gardens = await gardensStore.fetchGardens();
    assert.ok(gardens.some((g) => g.name === 'Sunny Backyard Oasis'));
    const detail = await gardensStore.fetchGardenDetail(1);
    zone1 = detail.zones.find((z) => z.name === 'South Raised Bed');
    assert.ok(zone1, 'Expected South Raised Bed in Garden 1');
  });

  it('Journey 2: Realtime WS connect, 4001 invalid-JWT close handling & automatic SSE fallback', async () => {
    realtimeService.connect(1, { zoneIds: [zone1.id] });
    await waitUntil(
      () => realtimeService.connectionStatus.value === 'connected',
      3000,
      'Expected InProcessWebSocket to reach connected state'
    );
    assert.equal(realtimeService.transportMode.value, 'ws');
    realtimeService.disconnect();

    // Invalid token triggers 4001 and must NOT enter reconnect loop
    localStorage.setItem('sg_token', 'invalid.jwt.token');
    realtimeService.connect(1, { zoneIds: [zone1.id] });
    await waitUntil(
      () =>
        realtimeService.connectionStatus.value === 'disconnected' &&
        Boolean(realtimeService.lastError.value),
      3000,
      'Expected invalid token WS to close with 4001 and stay disconnected'
    );
    assert.equal(realtimeService.connectionStatus.value, 'disconnected');
    realtimeService.disconnect();

    // Restore valid token & force 2 pre-open WS failures -> SSE fallback
    localStorage.setItem('sg_token', ownerToken);
    globalThis.__FORCE_WS_FAIL_COUNT__ = 2;
    realtimeService.connect(1, { zoneIds: [zone1.id] });
    await waitUntil(
      () =>
        realtimeService.connectionStatus.value === 'connected' &&
        realtimeService.transportMode.value === 'sse',
      5000,
      'Expected realtimeService to fall back to SSE after 2 pre-open WS failures'
    );

    // Reconnect on clean WS for subsequent live frame assertions
    realtimeService.disconnect();
    realtimeService.connect(1, { zoneIds: [zone1.id] });
    await waitUntil(
      () => realtimeService.connectionStatus.value === 'connected' && realtimeService.transportMode.value === 'ws',
      3000,
      'Expected primary WS reconnect'
    );
  });

  it('Journey 3: F6 Care Tasks CRUD + recurring next_scheduled_task_id + water log + WS TASK_UPDATED', async () => {
    await tasksStore.fetchGardenTasks(1);
    await tasksStore.fetchZoneTasks(zone1.id, {}, 1);

    const created = await tasksStore.createTask(
      zone1.id,
      {
        task_type: 'WATER',
        due_date: '2026-11-24',
        recurrence_days: 3,
        notes: 'In-process F6'
      },
      1
    );
    assert.ok(created.id);

    await waitUntil(
      () => (tasksStore.tasksByZone[zone1.id] || []).some((t) => Number(t.id) === Number(created.id)),
      2000,
      'Created task missing from tasksByZone'
    );

    const completed = await tasksStore.updateTask(
      zone1.id,
      created.id,
      {
        is_completed: true,
        water_volume_liters: 5.5,
        irrigation_method: 'DRIP_IRRIGATION'
      },
      1
    );
    assert.ok(completed.task.next_scheduled_task_id, 'Expected recurring task to spawn next_scheduled_task_id');
    assert.ok(completed.water_log, 'Expected water_log on completed WATER task');
    assert.ok(
      (tasksStore.waterLogsByGarden[1] || []).some((l) => Number(l.id) === Number(completed.water_log.id)),
      'Water log missing in waterLogsByGarden'
    );

    await tasksStore.reconcileGardenTasks(1);
    assert.ok(
      (tasksStore.tasksByZone[zone1.id] || []).some(
        (t) => Number(t.id) === Number(completed.task.next_scheduled_task_id) && !t.is_completed
      ),
      'Next recurring task missing after reconcileGardenTasks'
    );

    // Cleanup Journey 3 tasks so Zone 1 state stays tidy
    await tasksStore.deleteTask(zone1.id, completed.task.next_scheduled_task_id);
    await tasksStore.deleteTask(zone1.id, created.id);
  });

  it('Journey 4: F7 Device register + rotate + ingest + live WS SENSOR_UPDATE & F9 ALERT_TRIGGERED', async () => {
    await alertsStore.fetchGardenAlerts(1);
    alertsStore.setActiveGarden(1);
    const initialUnread = alertsStore.unreadCount;

    const reg = await sensorsStore.registerDevice(zone1.id, { device_name: 'InProc Node' });
    assert.ok(reg.api_key && reg.api_key.startsWith('sg_live_'));
    assert.equal(sensorsStore.lastCreatedApiKey, reg.api_key);
    assert.equal(reg.device.key_hash, undefined);

    await alertsStore.saveZoneAlertConfig(zone1.id, {
      metric: 'SOIL_MOISTURE',
      min_threshold: 40,
      max_threshold: 85,
      cooldown_minutes: 60
    });

    const ingestRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: {
        'x-device-key': reg.api_key,
        'content-type': 'application/json'
      },
      payload: JSON.stringify({
        soilMoisture: 18,
        temperature: 25,
        humidity: 55,
        lightLux: 12000
      })
    });
    assert.equal(ingestRes.statusCode, 201);

    await waitUntil(
      () => Number(sensorsStore.latestByZone[zone1.id]?.soil_moisture) === 18,
      3000,
      'Expected WS SENSOR_UPDATE to update sensorsStore.latestByZone'
    );
    await waitUntil(
      () => alertsStore.unreadCount === initialUnread + 1,
      3000,
      'Expected WS ALERT_TRIGGERED to increment alertsStore.unreadCount'
    );

    const newestAlert = alertsStore.unreadAlerts[0];
    assert.ok(newestAlert);
    await alertsStore.markAlertRead(newestAlert.id);
    assert.equal(alertsStore.unreadCount, initialUnread);

    // Rotate key -> old key 401, new key 201
    const rot = await sensorsStore.rotateDeviceKey(reg.device.id, zone1.id);
    rotatedDeviceKey = rot.api_key;
    assert.ok(rotatedDeviceKey.startsWith('sg_live_') && rotatedDeviceKey !== reg.api_key);

    const oldRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': reg.api_key, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: 50, temperature: 22, humidity: 55, lightLux: 10000 })
    });
    assert.equal(oldRes.statusCode, 401);

    const newRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': rotatedDeviceKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: 52, temperature: 22, humidity: 55, lightLux: 10000 })
    });
    assert.equal(newRes.statusCode, 201);

    // Reconcile replaces synthetic live-* rows with persisted DB rows without duplication
    await sensorsStore.reconcileZoneReadings([zone1.id]);
    const hasSyntheticLatest = String(sensorsStore.latestByZone[zone1.id]?.id || '').startsWith('live-');
    assert.equal(hasSyntheticLatest, false, 'Expected persisted DB reading after reconcileZoneReadings');
  });

  it('Journey 5: F10 Automation rule + cron evaluation + open-task deduplication + GUEST 403 RBAC', async () => {
    const rule = await rulesStore.createRule(zone1.id, {
      name: 'InProc Dry Rule',
      metric: 'HUMIDITY',
      operator: 'LT',
      threshold_value: 45,
      weather_condition: 'ANY',
      action_type: 'CREATE_TASK',
      task_type: 'PRUNE',
      cooldown_minutes: 0,
      max_daily_executions: 2
    });
    assert.ok(rule.id);

    const ingestRes = await app.inject({
      method: 'POST',
      url: '/api/sensors/ingest',
      headers: { 'x-device-key': rotatedDeviceKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ soilMoisture: 55, temperature: 23, humidity: 31, lightLux: 11000 })
    });
    assert.equal(ingestRes.statusCode, 201);

    const eval1 = await app.inject({
      method: 'POST',
      url: '/api/jobs/evaluate-rules',
      headers: { 'x-cron-secret': process.env.CRON_SECRET }
    });
    assert.equal(eval1.statusCode, 200);
    assert.ok(eval1.json().data.triggered >= 1);

    await waitUntil(
      () =>
        (tasksStore.tasksByZone[zone1.id] || []).some(
          (t) => t.task_type === 'PRUNE' && String(t.notes || '').includes('InProc Dry Rule')
        ),
      3000,
      'Expected RULE_ENGINE PRUNE task to propagate over WS into tasksStore'
    );

    // Second immediate evaluation skips due to open PRUNE task without burning daily cap
    const eval2 = await app.inject({
      method: 'POST',
      url: '/api/jobs/evaluate-rules',
      headers: { 'x-cron-secret': process.env.CRON_SECRET }
    });
    assert.equal(eval2.statusCode, 200);

    const fetchedRules = await rulesStore.fetchZoneRules(zone1.id);
    const updatedRule = fetchedRules.find((r) => Number(r.id) === Number(rule.id));
    assert.equal(updatedRule.executions_today, 1);

    // Switch to a GUEST member and verify rulesStore marks forbiddenByZone[zone1.id] === true cleanly
    const password_hash = await bcrypt.hash('GuestPass123!', 10);
    const guestUser = await User.create({
      name: 'InProc Guest',
      email: 'inproc_guest@smartgarden.test',
      password_hash
    });
    await GardenMember.create({
      garden_id: 1,
      user_id: guestUser.id,
      role: 'GUEST'
    });

    realtimeService.disconnect();
    await authStore.login({ email: 'inproc_guest@smartgarden.test', password: 'GuestPass123!' });
    const guestRules = await rulesStore.fetchZoneRules(zone1.id);
    assert.deepEqual(guestRules, []);
    assert.equal(rulesStore.forbiddenByZone[zone1.id], true);
  });
});
