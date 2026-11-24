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

const SEVERITY_WEIGHT = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2
};

function sortAlerts(list) {
  return [...list].sort((a, b) => {
    const timeDiff = new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
    if (!Number.isNaN(timeDiff) && timeDiff !== 0) return timeDiff;
    const sevDiff = (SEVERITY_WEIGHT[a.severity] ?? 3) - (SEVERITY_WEIGHT[b.severity] ?? 3);
    if (sevDiff !== 0) return sevDiff;
    return String(b.id).localeCompare(String(a.id));
  });
}

function mergeAlerts(existing, incoming) {
  const byId = new Map();
  for (const item of existing) {
    if (item && item.id !== undefined && item.id !== null) {
      byId.set(String(item.id), item);
    }
  }
  for (const item of incoming) {
    if (item && item.id !== undefined && item.id !== null) {
      const key = String(item.id);
      byId.set(key, { ...(byId.get(key) || {}), ...item, id: item.id });
    }
  }
  return sortAlerts(Array.from(byId.values()));
}

export const useAlertsStore = defineStore('alerts', {
  state: () => ({
    alertsByGarden: {},
    unreadCountByGarden: {},
    activeGardenId: null,
    alertsByZone: {},
    configsByZone: {},
    loading: false,
    actionLoading: false,
    error: null
  }),

  getters: {
    alerts(state) {
      if (state.activeGardenId !== null && state.activeGardenId !== undefined) {
        return state.alertsByGarden[state.activeGardenId] || [];
      }
      const all = [];
      for (const list of Object.values(state.alertsByGarden)) {
        all.push(...list);
      }
      return sortAlerts(all);
    },

    unreadAlerts() {
      return this.alerts.filter((a) => !a.is_read);
    },

    unreadCount(state) {
      if (state.activeGardenId !== null && state.activeGardenId !== undefined) {
        return Number(state.unreadCountByGarden[state.activeGardenId] ?? 0);
      }
      const counts = Object.values(state.unreadCountByGarden);
      if (counts.length > 0) {
        return counts.reduce((sum, n) => sum + Number(n || 0), 0);
      }
      return this.unreadAlerts.length;
    }
  },

  actions: {
    setActiveGarden(gardenId) {
      if (gardenId === null || gardenId === undefined) {
        this.activeGardenId = null;
        return;
      }
      if (gardenId) {
        this.activeGardenId = Number(gardenId);
      }
    },

    async fetchGardenAlerts(gardenId, params = {}) {
      const gid = Number(gardenId);
      if (!gid) return [];
      this.loading = true;
      this.error = null;
      if (this.activeGardenId === null) {
        this.activeGardenId = gid;
      }
      try {
        const res = await api.get(`/gardens/${gid}/alerts`, { params });
        const data = res.data?.data || {};
        const incoming = data.alerts || [];
        const hasFilters = Object.keys(params).some((k) => params[k] !== undefined && params[k] !== '');

        if (!hasFilters) {
          this.alertsByGarden[gid] = sortAlerts(incoming);
        } else {
          this.alertsByGarden[gid] = mergeAlerts(this.alertsByGarden[gid] || [], incoming);
        }

        if (typeof data.unread_count === 'number') {
          this.unreadCountByGarden[gid] = data.unread_count;
        } else {
          this.unreadCountByGarden[gid] = (this.alertsByGarden[gid] || []).filter((a) => !a.is_read).length;
        }

        return this.alertsByGarden[gid];
      } catch (err) {
        this.error = extractError(err, 'Failed to load garden alerts.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async reconcileGardenAlerts(gardenId) {
      const gid = Number(gardenId);
      if (!gid) return [];
      try {
        const res = await api.get(`/gardens/${gid}/alerts`, {
          params: { is_read: 'false' }
        });
        const data = res.data?.data || {};
        const openUnread = data.alerts || [];
        const openUnreadIds = new Set(openUnread.map((a) => String(a.id)));
        const existing = (this.alertsByGarden[gid] || []).map((a) =>
          !a.is_read && !openUnreadIds.has(String(a.id)) ? { ...a, is_read: true } : a
        );
        this.alertsByGarden[gid] = mergeAlerts(existing, openUnread);
        this.unreadCountByGarden[gid] =
          typeof data.unread_count === 'number' ? data.unread_count : openUnread.length;
        return openUnread;
      } catch {
        return this.alertsByGarden[gid] || [];
      }
    },

    async fetchZoneAlertLogs(zoneId, params = {}) {
      const zid = Number(zoneId);
      if (!zid) return [];
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zid}/alerts/logs`, { params });
        const alerts = res.data?.data?.alerts || [];
        this.alertsByZone[zid] = alerts;
        return alerts;
      } catch (err) {
        this.error = extractError(err, 'Failed to load zone alert logs.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchZoneAlertConfig(zoneId) {
      const zid = Number(zoneId);
      if (!zid) return { configs: [], catalog_defaults: {} };
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zid}/alerts/config`);
        const data = res.data?.data || {};
        this.configsByZone[zid] = {
          configs: data.configs || [],
          catalog_defaults: data.catalog_defaults || {}
        };
        return this.configsByZone[zid];
      } catch (err) {
        this.error = extractError(err, 'Failed to load alert configuration.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async saveZoneAlertConfig(zoneId, payload) {
      const zid = Number(zoneId);
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.put(`/zones/${zid}/alerts/config`, payload);
        const saved = res.data?.data?.config;
        if (saved) {
          const current = this.configsByZone[zid] || { configs: [], catalog_defaults: {} };
          const idx = current.configs.findIndex((c) => c.metric === saved.metric);
          const nextConfigs = [...current.configs];
          if (idx !== -1) {
            nextConfigs[idx] = saved;
          } else {
            nextConfigs.push(saved);
          }
          this.configsByZone[zid] = {
            ...current,
            configs: nextConfigs
          };
        }
        return saved;
      } catch (err) {
        this.error = extractError(err, 'Failed to save alert configuration.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async markAlertRead(alertId) {
      const targetId = String(alertId);
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.patch(`/alerts/${encodeURIComponent(targetId)}/read`);
        const updated = res.data?.data?.alert;

        for (const gidKey of Object.keys(this.alertsByGarden)) {
          const list = this.alertsByGarden[gidKey] || [];
          let markedNow = false;
          this.alertsByGarden[gidKey] = list.map((a) => {
            if (String(a.id) === targetId) {
              if (!a.is_read) markedNow = true;
              return { ...a, ...(updated || {}), is_read: true };
            }
            return a;
          });
          if (markedNow) {
            const prevCount = Number(this.unreadCountByGarden[gidKey] || 0);
            this.unreadCountByGarden[gidKey] = Math.max(0, prevCount - 1);
          }
        }

        for (const zidKey of Object.keys(this.alertsByZone)) {
          const list = this.alertsByZone[zidKey] || [];
          this.alertsByZone[zidKey] = list.map((a) =>
            String(a.id) === targetId ? { ...a, ...(updated || {}), is_read: true } : a
          );
        }

        return updated;
      } catch (err) {
        this.error = extractError(err, 'Failed to mark alert as read.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async markAllRead(gardenId) {
      const gid = Number(gardenId || this.activeGardenId);
      if (!gid) return { updated_count: 0 };
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.post(`/gardens/${gid}/alerts/read-all`);
        if (this.alertsByGarden[gid]) {
          this.alertsByGarden[gid] = this.alertsByGarden[gid].map((a) => ({ ...a, is_read: true }));
        }
        this.unreadCountByGarden[gid] = 0;
        return res.data?.data || { updated_count: 0 };
      } catch (err) {
        this.error = extractError(err, 'Failed to mark all alerts as read.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    applyRealtimeAlert(frameData) {
      if (!frameData || frameData.alertId === undefined || frameData.alertId === null) return null;
      const gid = Number(frameData.gardenId || this.activeGardenId);
      if (!gid) return null;

      const alertIdStr = String(frameData.alertId);
      const isWatchdog = alertIdStr.startsWith('wd-') || frameData.metric === 'DEVICE_OFFLINE';

      const normalized = {
        id: frameData.alertId,
        garden_id: gid,
        zone_id: frameData.zoneId ?? null,
        zone_name: frameData.zoneName || null,
        device_id: frameData.deviceId ?? null,
        metric: frameData.metric || 'SOIL_MOISTURE',
        triggered_value: frameData.triggeredValue ?? null,
        threshold_value: frameData.thresholdValue ?? null,
        severity: frameData.severity || 'WARNING',
        message: frameData.message || 'Sensor threshold alert triggered.',
        is_read: false,
        is_suppressed: false,
        email_sent: false,
        alert_source: isWatchdog ? 'WATCHDOG' : 'THRESHOLD',
        triggered_at: frameData.timestamp || new Date().toISOString()
      };

      const existing = this.alertsByGarden[gid] || [];
      const alreadyPresent = existing.some((a) => String(a.id) === alertIdStr);
      this.alertsByGarden[gid] = mergeAlerts(existing, [normalized]);

      if (!alreadyPresent) {
        const prev = Number(this.unreadCountByGarden[gid] || 0);
        this.unreadCountByGarden[gid] = prev + 1;
      }

      return normalized;
    }
  }
});
