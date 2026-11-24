import { defineStore } from 'pinia';
import api from '../services/api.js';

function extractError(err, fallback = 'Operation failed') {
  return (
    err.response?.data?.error?.message ||
    err.response?.data?.message ||
    err.message ||
    fallback
  );
}

let liveSeq = 0;

function isSyntheticLiveId(id) {
  return typeof id === 'string' && id.startsWith('live-');
}

function getNaturalKey(r) {
  if (!r || r.device_id === null || r.device_id === undefined) return null;
  if (r.recorded_at === null || r.recorded_at === undefined || r.recorded_at === '') return null;
  const ts = new Date(r.recorded_at).getTime();
  if (!Number.isFinite(ts)) return null;
  return `${r.device_id}|${ts}`;
}

function toNumericId(id) {
  if (id === null || id === undefined || typeof id === 'boolean') return NaN;
  if (typeof id === 'string' && id.trim() === '') return NaN;
  const num = Number(id);
  return Number.isFinite(num) ? num : NaN;
}

function mergeReadingsList(existing, incoming, limit = 200) {
  const byId = new Map();
  const persistedNaturals = new Set();
  const liveKeysByNatural = new Map();

  for (const r of [...incoming, ...existing]) {
    if (!r) continue;
    const idKey = r.id !== undefined && r.id !== null ? String(r.id) : `${r.device_id}-${r.recorded_at}`;
    const live = isSyntheticLiveId(r.id);
    const natKey = getNaturalKey(r);

    if (!live) {
      if (natKey) {
        persistedNaturals.add(natKey);
        const liveKeys = liveKeysByNatural.get(natKey);
        if (liveKeys) {
          for (const lk of liveKeys) {
            byId.delete(lk);
          }
          liveKeysByNatural.delete(natKey);
        }
      }
      if (!byId.has(idKey)) {
        byId.set(idKey, r);
      }
    } else {
      if (natKey && persistedNaturals.has(natKey)) {
        continue;
      }
      if (!byId.has(idKey)) {
        byId.set(idKey, r);
        if (natKey) {
          if (!liveKeysByNatural.has(natKey)) {
            liveKeysByNatural.set(natKey, new Set());
          }
          liveKeysByNatural.get(natKey).add(idKey);
        }
      }
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => {
      const timeDiff = new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime();
      if (!Number.isNaN(timeDiff) && timeDiff !== 0) return timeDiff;
      const numA = toNumericId(a.id);
      const numB = toNumericId(b.id);
      if (Number.isFinite(numA) && Number.isFinite(numB) && numB !== numA) {
        return numB - numA;
      }
      return String(b.id ?? '').localeCompare(String(a.id ?? ''));
    })
    .slice(0, limit);
}

export const useSensorsStore = defineStore('sensors', {
  state: () => ({
    devicesByZone: {},
    readingsByZone: {},
    latestByZone: {},
    dailyStatsByZone: {},
    lastCreatedApiKey: null,
    loading: false,
    actionLoading: false,
    error: null
  }),

  actions: {
    clearMessages() {
      this.error = null;
    },

    clearLastCreatedApiKey() {
      this.lastCreatedApiKey = null;
    },

    async fetchZoneDevices(zoneId) {
      const zid = Number(zoneId);
      if (!zid) return [];
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zid}/devices`);
        const devices = res.data?.data?.devices || [];
        this.devicesByZone[zid] = devices;
        return devices;
      } catch (err) {
        this.error = extractError(err, 'Failed to load zone devices.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async registerDevice(zoneId, payload) {
      const zid = Number(zoneId);
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.post(`/zones/${zid}/devices`, payload);
        const data = res.data?.data || {};
        const device = data.device;
        const apiKey = data.api_key || null;
        if (apiKey) {
          this.lastCreatedApiKey = apiKey;
        }
        if (device) {
          const list = this.devicesByZone[zid] || [];
          this.devicesByZone[zid] = [device, ...list.filter((d) => Number(d.id) !== Number(device.id))];
        }
        return { device, api_key: apiKey };
      } catch (err) {
        this.error = extractError(err, 'Failed to register device.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async claimDevice(payload) {
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.post('/devices/claim', payload);
        const data = res.data?.data || {};
        const device = data.device;
        const apiKey = data.api_key || null;
        if (apiKey) {
          this.lastCreatedApiKey = apiKey;
        }
        if (device) {
          const zid = Number(device.zone_id || payload.zoneId);
          const list = this.devicesByZone[zid] || [];
          this.devicesByZone[zid] = [device, ...list.filter((d) => Number(d.id) !== Number(device.id))];
        }
        return { device, api_key: apiKey };
      } catch (err) {
        this.error = extractError(err, 'Failed to claim device.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async rotateDeviceKey(deviceId, zoneId) {
      const did = Number(deviceId);
      const zid = Number(zoneId);
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.post(`/devices/${did}/rotate-key`);
        const data = res.data?.data || {};
        const device = data.device;
        const apiKey = data.api_key || null;
        if (apiKey) {
          this.lastCreatedApiKey = apiKey;
        }
        if (device && zid) {
          const list = this.devicesByZone[zid] || [];
          this.devicesByZone[zid] = list.map((d) => (Number(d.id) === did ? device : d));
        }
        return { device, api_key: apiKey };
      } catch (err) {
        this.error = extractError(err, 'Failed to rotate device key.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async revokeDevice(deviceId, zoneId) {
      const did = Number(deviceId);
      const zid = Number(zoneId);
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.delete(`/devices/${did}`);
        const device = res.data?.data?.device;
        if (zid && this.devicesByZone[zid]) {
          this.devicesByZone[zid] = this.devicesByZone[zid].map((d) =>
            Number(d.id) === did
              ? { ...d, ...(device || {}), is_active: false, connectivity_status: 'REVOKED' }
              : d
          );
        }
        return device;
      } catch (err) {
        this.error = extractError(err, 'Failed to revoke device.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async fetchZoneReadings(zoneId, { hours = 24, limit = 100 } = {}) {
      const zid = Number(zoneId);
      if (!zid) return [];
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zid}/readings`, {
          params: { hours, limit }
        });
        const readings = res.data?.data?.readings || [];
        this.readingsByZone[zid] = readings;
        this.latestByZone[zid] = readings[0] || null;
        return readings;
      } catch (err) {
        this.error = extractError(err, 'Failed to load sensor readings.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async reconcileZoneReadings(zoneIds = []) {
      const ids = Array.from(new Set(zoneIds.map((id) => Number(id)).filter(Boolean)));
      await Promise.all(
        ids.map(async (zid) => {
          try {
            const res = await api.get(`/zones/${zid}/readings`, {
              params: { hours: 24, limit: 1 }
            });
            const readings = res.data?.data?.readings || [];
            if (readings[0]) {
              this.latestByZone[zid] = readings[0];
              const existing = this.readingsByZone[zid] || [];
              this.readingsByZone[zid] = mergeReadingsList(existing, readings);
            }
          } catch {
            // ignore individual zone reconciliation errors
          }
        })
      );
    },

    async fetchZoneDailyStats(zoneId, { days = 30 } = {}) {
      const zid = Number(zoneId);
      if (!zid) return [];
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zid}/stats/daily`, {
          params: { days }
        });
        const stats = res.data?.data?.stats || [];
        this.dailyStatsByZone[zid] = stats;
        return stats;
      } catch (err) {
        this.error = extractError(err, 'Failed to load daily statistics.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    applyRealtimeSensorUpdate(frameData) {
      if (!frameData || !frameData.zoneId) return null;
      const zid = Number(frameData.zoneId);
      const reading = {
        id:
          frameData.readingId ||
          `live-${zid}-${frameData.deviceId ?? 'x'}-${frameData.timestamp || Date.now()}-${liveSeq++}`,
        zone_id: zid,
        device_id: frameData.deviceId ?? null,
        soil_moisture: frameData.soilMoisture,
        temperature: frameData.temperature,
        humidity: frameData.humidity,
        light_lux: frameData.lightLux,
        battery_percent: frameData.batteryPercent ?? null,
        signal_rssi: frameData.signalRssi ?? null,
        recorded_at: frameData.timestamp || new Date().toISOString()
      };

      this.latestByZone[zid] = reading;
      const existing = this.readingsByZone[zid] || [];
      this.readingsByZone[zid] = mergeReadingsList(existing, [reading]);

      if (frameData.deviceId && this.devicesByZone[zid]) {
        this.devicesByZone[zid] = this.devicesByZone[zid].map((d) =>
          Number(d.id) === Number(frameData.deviceId)
            ? { ...d, last_seen_at: reading.recorded_at, connectivity_status: 'ONLINE' }
            : d
        );
      }

      return reading;
    }
  }
});
