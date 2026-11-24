import { ref } from 'vue';
import { useSensorsStore } from '../stores/sensors.js';
import { useAlertsStore } from '../stores/alerts.js';
import { useTasksStore } from '../stores/tasks.js';

const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export const connectionStatus = ref('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
export const transportMode = ref('ws'); // 'ws' | 'sse'
export const activeGardenId = ref(null);
export const lastEventAt = ref(null);
export const lastError = ref(null);

let ws = null;
let sse = null;
let reconnectTimer = null;
let attempt = 0;
let wsFailBeforeOpenCount = 0;
let manuallyDisconnected = false;
let hasConnectedOnce = false;
let currentZoneIds = [];
let callbacks = {};
let connectionEpoch = 0;

function getToken() {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('sg_token');
}

function getWsBaseUrl() {
  const explicitWs = import.meta.env?.VITE_WS_BASE_URL;
  if (explicitWs) {
    return String(explicitWs).replace(/\/+$/, '');
  }
  const apiBase = import.meta.env?.VITE_API_BASE_URL;
  if (apiBase && /^https?:\/\//i.test(apiBase)) {
    return String(apiBase)
      .replace(/\/api\/?$/, '')
      .replace(/\/+$/, '')
      .replace(/^http/i, 'ws');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/^http/i, 'ws');
  }
  return 'ws://localhost:3000';
}

function getApiBaseUrl() {
  const rawBaseUrl = String(import.meta.env?.VITE_API_BASE_URL || '/api').trim().replace(/\/+$/, '');
  if (!rawBaseUrl) return '/api';
  return rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeSockets() {
  if (ws) {
    try {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Client closing');
      }
    } catch {
      // ignore close errors
    }
    ws = null;
  }
  if (sse) {
    try {
      sse.onopen = null;
      sse.onmessage = null;
      sse.onerror = null;
      sse.close();
    } catch {
      // ignore close errors
    }
    sse = null;
  }
}

export function setZoneIds(zoneIds = []) {
  currentZoneIds = Array.from(new Set(zoneIds.map((id) => Number(id)).filter(Boolean)));
}

export async function reconcile(gardenId = activeGardenId.value, zoneIds = currentZoneIds) {
  const gid = Number(gardenId);
  if (!gid) return;
  const sensorsStore = useSensorsStore();
  const alertsStore = useAlertsStore();
  const tasksStore = useTasksStore();

  await Promise.all([
    zoneIds && zoneIds.length > 0 ? sensorsStore.reconcileZoneReadings(zoneIds) : Promise.resolve(),
    alertsStore.reconcileGardenAlerts(gid),
    tasksStore.reconcileGardenTasks(gid)
  ]);

  if (typeof callbacks.onReconcile === 'function') {
    callbacks.onReconcile(gid);
  }
}

function handleFrame(rawData) {
  let frame;
  try {
    frame = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  } catch {
    return;
  }
  if (!frame || !frame.event) return;

  lastEventAt.value = new Date().toISOString();
  const data = frame.data || {};

  if (frame.event === 'SENSOR_UPDATE') {
    const sensorsStore = useSensorsStore();
    const reading = sensorsStore.applyRealtimeSensorUpdate(data);
    if (typeof callbacks.onSensorUpdate === 'function') {
      callbacks.onSensorUpdate(data, reading);
    }
  } else if (frame.event === 'ALERT_TRIGGERED') {
    const alertsStore = useAlertsStore();
    const alert = alertsStore.applyRealtimeAlert(data);
    if (typeof callbacks.onAlertTriggered === 'function') {
      callbacks.onAlertTriggered(data, alert);
    }
  } else if (frame.event === 'TASK_UPDATED') {
    const tasksStore = useTasksStore();
    tasksStore.applyRealtimeTaskEvent(data);
    if (typeof callbacks.onTaskUpdated === 'function') {
      callbacks.onTaskUpdated(data);
    }
  }
}

function scheduleReconnect(gardenId, epoch) {
  if (manuallyDisconnected || epoch !== connectionEpoch) return;
  clearReconnectTimer();
  const delay = BACKOFF_SCHEDULE_MS[Math.min(attempt, BACKOFF_SCHEDULE_MS.length - 1)];
  attempt += 1;
  connectionStatus.value = 'reconnecting';
  reconnectTimer = setTimeout(() => {
    if (manuallyDisconnected || epoch !== connectionEpoch) return;
    openTransport(gardenId, epoch);
  }, delay);
}

function openSse(gardenId, token, epoch) {
  if (typeof EventSource === 'undefined') {
    connectionStatus.value = 'disconnected';
    return;
  }
  transportMode.value = 'sse';
  connectionStatus.value = hasConnectedOnce ? 'reconnecting' : 'connecting';
  const url = `${getApiBaseUrl()}/gardens/${gardenId}/stream?token=${encodeURIComponent(token)}`;
  const source = new EventSource(url);
  sse = source;

  const onEvent = (evt) => {
    if (epoch !== connectionEpoch) return;
    handleFrame(evt.data);
  };

  source.addEventListener('SENSOR_UPDATE', onEvent);
  source.addEventListener('ALERT_TRIGGERED', onEvent);
  source.addEventListener('TASK_UPDATED', onEvent);

  source.onopen = () => {
    if (epoch !== connectionEpoch) return;
    const isReconnect = hasConnectedOnce;
    hasConnectedOnce = true;
    attempt = 0;
    lastError.value = null;
    connectionStatus.value = 'connected';
    if (isReconnect) {
      reconcile(gardenId, currentZoneIds).catch(() => {});
    }
  };

  source.onmessage = onEvent;

  source.onerror = () => {
    if (epoch !== connectionEpoch) return;
    closeSockets();
    if (!manuallyDisconnected) {
      lastError.value = 'Realtime SSE stream interrupted.';
      scheduleReconnect(gardenId, epoch);
    }
  };
}

function openWebSocket(gardenId, token, epoch) {
  if (typeof WebSocket === 'undefined') {
    openSse(gardenId, token, epoch);
    return;
  }
  transportMode.value = 'ws';
  connectionStatus.value = hasConnectedOnce ? 'reconnecting' : 'connecting';
  const url = `${getWsBaseUrl()}/ws/gardens/${gardenId}?token=${encodeURIComponent(token)}`;
  let opened = false;
  const socket = new WebSocket(url);
  ws = socket;

  socket.onopen = () => {
    if (epoch !== connectionEpoch) {
      socket.close(1000, 'Stale connection');
      return;
    }
    opened = true;
    wsFailBeforeOpenCount = 0;
    const isReconnect = hasConnectedOnce;
    hasConnectedOnce = true;
    attempt = 0;
    lastError.value = null;
    connectionStatus.value = 'connected';
    if (isReconnect) {
      reconcile(gardenId, currentZoneIds).catch(() => {});
    }
  };

  socket.onmessage = (evt) => {
    if (epoch !== connectionEpoch) return;
    handleFrame(evt.data);
  };

  socket.onerror = () => {
    if (epoch !== connectionEpoch) return;
    lastError.value = 'WebSocket connection error.';
  };

  socket.onclose = (evt) => {
    if (epoch !== connectionEpoch) return;
    ws = null;
    if (manuallyDisconnected) {
      connectionStatus.value = 'disconnected';
      return;
    }
    // Never reconnect on auth/RBAC close codes 4001 or 4003
    if (evt.code === 4001 || evt.code === 4003) {
      lastError.value = evt.reason || `Connection closed (${evt.code}).`;
      connectionStatus.value = 'disconnected';
      return;
    }

    if (!opened) {
      wsFailBeforeOpenCount += 1;
      if (wsFailBeforeOpenCount >= 2) {
        openSse(gardenId, token, epoch);
        return;
      }
    }

    scheduleReconnect(gardenId, epoch);
  };
}

function openTransport(gardenId, epoch) {
  const token = getToken();
  if (!token) {
    connectionStatus.value = 'disconnected';
    return;
  }
  const preferred = import.meta.env?.VITE_REALTIME_TRANSPORT;
  if (preferred === 'sse' || wsFailBeforeOpenCount >= 2) {
    openSse(gardenId, token, epoch);
  } else {
    openWebSocket(gardenId, token, epoch);
  }
}

export function connect(gardenId, options = {}) {
  const gid = Number(gardenId);
  if (!gid) return;

  if (Array.isArray(options.zoneIds)) {
    setZoneIds(options.zoneIds);
  }
  callbacks = {
    onSensorUpdate: options.onSensorUpdate,
    onAlertTriggered: options.onAlertTriggered,
    onTaskUpdated: options.onTaskUpdated,
    onReconcile: options.onReconcile
  };

  if (
    activeGardenId.value === gid &&
    (ws || sse) &&
    (connectionStatus.value === 'connected' || connectionStatus.value === 'connecting')
  ) {
    return;
  }

  disconnect();
  manuallyDisconnected = false;
  activeGardenId.value = gid;
  hasConnectedOnce = false;
  attempt = 0;
  wsFailBeforeOpenCount = 0;
  lastError.value = null;
  connectionEpoch += 1;
  openTransport(gid, connectionEpoch);
}

export function disconnect() {
  manuallyDisconnected = true;
  connectionEpoch += 1;
  clearReconnectTimer();
  closeSockets();
  connectionStatus.value = 'disconnected';
  activeGardenId.value = null;
}

export const realtimeService = {
  connectionStatus,
  transportMode,
  activeGardenId,
  lastEventAt,
  lastError,
  connect,
  disconnect,
  setZoneIds,
  reconcile
};

export default realtimeService;
