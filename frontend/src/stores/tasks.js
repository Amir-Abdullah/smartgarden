import { defineStore } from 'pinia';
import api from '../services/api.js';
import { useGardensStore } from './gardens.js';

function getSafeGardensStore() {
  try {
    return useGardensStore();
  } catch {
    return null;
  }
}

function collectZonesForGarden(store, gid, existingList = [], byZone = new Map()) {
  const zonesForGarden = new Set(
    existingList.map((t) => Number(t?.zone_id)).filter(Boolean)
  );
  for (const zid of byZone.keys()) {
    if (zid) {
      zonesForGarden.add(zid);
      store.zoneGardenMap[zid] = gid;
    }
  }
  for (const [zidKey, mappedGid] of Object.entries(store.zoneGardenMap)) {
    const zid = Number(zidKey);
    if (zid && Number(mappedGid) === gid) {
      zonesForGarden.add(zid);
    }
  }
  const gardensStore = getSafeGardensStore();
  if (gardensStore) {
    if (Number(gardensStore.activeGarden?.id) === gid && Array.isArray(gardensStore.zones)) {
      for (const z of gardensStore.zones) {
        const zid = Number(z?.id);
        if (zid) {
          zonesForGarden.add(zid);
          store.zoneGardenMap[zid] = gid;
        }
      }
    }
    if (Number(gardensStore.activeZone?.garden_id) === gid && Number(gardensStore.activeZone?.id)) {
      const zid = Number(gardensStore.activeZone.id);
      zonesForGarden.add(zid);
      store.zoneGardenMap[zid] = gid;
    }
  }
  for (const [zidKey, list] of Object.entries(store.tasksByZone)) {
    if (Array.isArray(list) && list.some((t) => Number(t?.garden_id) === gid)) {
      const zid = Number(zidKey);
      if (zid) {
        zonesForGarden.add(zid);
        store.zoneGardenMap[zid] = gid;
      }
    }
  }
  return zonesForGarden;
}

function extractError(err, fallback = 'Operation failed') {
  return (
    err.response?.data?.error?.message ||
    err.response?.data?.message ||
    err.message ||
    fallback
  );
}

function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (Boolean(a.is_completed) !== Boolean(b.is_completed)) {
      return a.is_completed ? 1 : -1;
    }
    const dateA = String(a.due_date || '');
    const dateB = String(b.due_date || '');
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasksByGarden: {},
    tasksByZone: {},
    zoneGardenMap: {},
    waterLogsByGarden: {},
    loading: false,
    actionLoading: false,
    error: null,
    successMessage: null
  }),

  actions: {
    clearMessages() {
      this.error = null;
      this.successMessage = null;
    },

    async fetchGardenTasks(gardenId, params = {}) {
      const gid = Number(gardenId);
      if (!gid) return [];
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/gardens/${gid}/tasks`, { params });
        const tasks = res.data?.data?.tasks || [];
        const hasFilters = Object.keys(params).some((k) => params[k] !== undefined && params[k] !== '');
        if (!hasFilters) {
          const prevExisting = this.tasksByGarden[gid] || [];
          this.tasksByGarden[gid] = sortTasks(tasks);

          const nextByZone = new Map();
          for (const t of this.tasksByGarden[gid]) {
            const zid = Number(t.zone_id);
            if (!zid) continue;
            this.zoneGardenMap[zid] = gid;
            if (!nextByZone.has(zid)) nextByZone.set(zid, []);
            nextByZone.get(zid).push(t);
          }
          const zonesForGarden = collectZonesForGarden(this, gid, prevExisting, nextByZone);
          for (const zid of zonesForGarden) {
            if (Array.isArray(this.tasksByZone[zid])) {
              this.tasksByZone[zid] = sortTasks(nextByZone.get(zid) || []);
            }
          }
        } else {
          this.mergeGardenTasks(gid, tasks);
        }
        return tasks;
      } catch (err) {
        this.error = extractError(err, 'Failed to load garden tasks.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchZoneTasks(zoneId, params = {}, gardenId = null) {
      const zid = Number(zoneId);
      if (!zid) return [];
      const explicitGid = Number(gardenId);
      if (explicitGid) {
        this.zoneGardenMap[zid] = explicitGid;
      }
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zid}/tasks`, { params });
        const tasks = res.data?.data?.tasks || [];
        if (!explicitGid) {
          const inferredGid = Number(tasks.find((t) => t?.garden_id)?.garden_id);
          if (inferredGid) {
            this.zoneGardenMap[zid] = inferredGid;
          }
        }
        this.tasksByZone[zid] = sortTasks(tasks);
        return this.tasksByZone[zid];
      } catch (err) {
        this.error = extractError(err, 'Failed to load zone care tasks.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    mergeGardenTasks(gardenId, incomingTasks, replaceOpen = false) {
      const gid = Number(gardenId);
      const existing = this.tasksByGarden[gid] || [];
      for (const t of [...existing, ...incomingTasks]) {
        const zid = Number(t?.zone_id);
        if (zid) {
          this.zoneGardenMap[zid] = gid;
        }
      }
      const incomingMap = new Map(incomingTasks.map((t) => [Number(t.id), t]));
      let merged;
      if (replaceOpen) {
        const completed = existing.filter((t) => t.is_completed && !incomingMap.has(Number(t.id)));
        merged = [...completed, ...incomingTasks];
      } else {
        const byId = new Map(existing.map((t) => [Number(t.id), t]));
        for (const task of incomingTasks) {
          byId.set(Number(task.id), { ...(byId.get(Number(task.id)) || {}), ...task });
        }
        merged = Array.from(byId.values());
      }
      this.tasksByGarden[gid] = sortTasks(merged);

      // Keep loaded zone lists synced, including clearing zones whose last open task disappeared
      const byZone = new Map();
      for (const t of this.tasksByGarden[gid]) {
        const zid = Number(t.zone_id);
        if (!zid) continue;
        this.zoneGardenMap[zid] = gid;
        if (!byZone.has(zid)) byZone.set(zid, []);
        byZone.get(zid).push(t);
      }

      const zonesForGarden = replaceOpen
        ? collectZonesForGarden(this, gid, existing, byZone)
        : new Set([...existing.map((t) => Number(t?.zone_id)).filter(Boolean), ...byZone.keys()]);

      for (const zid of zonesForGarden) {
        if (Array.isArray(this.tasksByZone[zid])) {
          this.tasksByZone[zid] = sortTasks(byZone.get(zid) || []);
        }
      }
    },

    async reconcileGardenTasks(gardenId) {
      const gid = Number(gardenId);
      if (!gid) return [];
      try {
        const res = await api.get(`/gardens/${gid}/tasks`, {
          params: { is_completed: 'false' }
        });
        const openTasks = res.data?.data?.tasks || [];
        this.mergeGardenTasks(gid, openTasks, true);
        return openTasks;
      } catch {
        return this.tasksByGarden[gid] || [];
      }
    },

    async createTask(zoneId, payload, gardenId = null) {
      const zid = Number(zoneId);
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const res = await api.post(`/zones/${zid}/tasks`, payload);
        const task = res.data?.data?.task;
        if (task) {
          const zList = this.tasksByZone[zid] || [];
          this.tasksByZone[zid] = sortTasks([task, ...zList.filter((t) => Number(t.id) !== Number(task.id))]);

          if (gardenId) {
            const gid = Number(gardenId);
            if (gid && zid) this.zoneGardenMap[zid] = gid;
            const gList = this.tasksByGarden[gid] || [];
            this.tasksByGarden[gid] = sortTasks([task, ...gList.filter((t) => Number(t.id) !== Number(task.id))]);
          } else {
            for (const gidKey of Object.keys(this.tasksByGarden)) {
              const gList = this.tasksByGarden[gidKey] || [];
              if (gList.some((t) => Number(t.zone_id) === zid)) {
                this.tasksByGarden[gidKey] = sortTasks([task, ...gList.filter((t) => Number(t.id) !== Number(task.id))]);
              }
            }
          }
        }
        this.successMessage = 'Care task created.';
        return task;
      } catch (err) {
        this.error = extractError(err, 'Failed to create care task.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async updateTask(zoneId, taskId, payload, gardenId = null) {
      const zid = Number(zoneId);
      const tid = Number(taskId);
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const res = await api.patch(`/zones/${zid}/tasks/${tid}`, payload);
        const data = res.data?.data || {};
        const updatedTask = data.task;
        const waterLog = data.water_log || null;

        if (updatedTask) {
          if (this.tasksByZone[zid]) {
            this.tasksByZone[zid] = sortTasks(
              this.tasksByZone[zid].map((t) => (Number(t.id) === tid ? { ...t, ...updatedTask } : t))
            );
          }
          for (const gidKey of Object.keys(this.tasksByGarden)) {
            const gList = this.tasksByGarden[gidKey];
            if (gList && gList.some((t) => Number(t.id) === tid)) {
              this.tasksByGarden[gidKey] = sortTasks(
                gList.map((t) => (Number(t.id) === tid ? { ...t, ...updatedTask } : t))
              );
            }
          }
        }

        if (waterLog && gardenId) {
          const gid = Number(gardenId);
          const logs = this.waterLogsByGarden[gid] || [];
          this.waterLogsByGarden[gid] = [waterLog, ...logs.filter((l) => Number(l.id) !== Number(waterLog.id))];
        }

        // If recurring task spawned next task, hydrate fresh lists
        if (updatedTask?.next_scheduled_task_id) {
          if (gardenId) {
            await this.fetchGardenTasks(gardenId).catch(() => {});
          }
          if (this.tasksByZone[zid]) {
            await this.fetchZoneTasks(zid, {}, gardenId).catch(() => {});
          }
        }

        this.successMessage = updatedTask?.is_completed ? 'Task completed.' : 'Task updated.';
        return { task: updatedTask, water_log: waterLog };
      } catch (err) {
        this.error = extractError(err, 'Failed to update care task.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async deleteTask(zoneId, taskId) {
      const zid = Number(zoneId);
      const tid = Number(taskId);
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        await api.delete(`/zones/${zid}/tasks/${tid}`);
        if (this.tasksByZone[zid]) {
          this.tasksByZone[zid] = this.tasksByZone[zid].filter((t) => Number(t.id) !== tid);
        }
        for (const gidKey of Object.keys(this.tasksByGarden)) {
          if (this.tasksByGarden[gidKey]) {
            this.tasksByGarden[gidKey] = this.tasksByGarden[gidKey].filter((t) => Number(t.id) !== tid);
          }
        }
        this.successMessage = 'Care task deleted.';
      } catch (err) {
        this.error = extractError(err, 'Failed to delete care task.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async fetchGardenWaterLogs(gardenId, params = {}) {
      const gid = Number(gardenId);
      if (!gid) return [];
      try {
        const res = await api.get(`/gardens/${gid}/water-logs`, { params });
        const logs = res.data?.data?.water_logs || [];
        this.waterLogsByGarden[gid] = logs;
        return logs;
      } catch (err) {
        this.error = extractError(err, 'Failed to load water usage logs.');
        throw err;
      }
    },

    async createWaterLog(zoneId, payload, gardenId = null) {
      const zid = Number(zoneId);
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.post(`/zones/${zid}/water-logs`, payload);
        const log = res.data?.data?.water_log;
        if (log && gardenId) {
          const gid = Number(gardenId);
          const logs = this.waterLogsByGarden[gid] || [];
          this.waterLogsByGarden[gid] = [log, ...logs];
        }
        return log;
      } catch (err) {
        this.error = extractError(err, 'Failed to log water usage.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    applyRealtimeTaskEvent(frameData) {
      if (!frameData) return;
      const gid = Number(frameData.gardenId);
      const zid = Number(frameData.zoneId);
      const tid = Number(frameData.taskId);
      if (gid && zid) {
        this.zoneGardenMap[zid] = gid;
      }

      if (frameData.deleted) {
        if (gid && this.tasksByGarden[gid]) {
          this.tasksByGarden[gid] = this.tasksByGarden[gid].filter((t) => Number(t.id) !== tid);
        }
        if (zid && this.tasksByZone[zid]) {
          this.tasksByZone[zid] = this.tasksByZone[zid].filter((t) => Number(t.id) !== tid);
        }
        return;
      }

      let found = false;
      if (gid && this.tasksByGarden[gid]) {
        this.tasksByGarden[gid] = sortTasks(
          this.tasksByGarden[gid].map((t) => {
            if (Number(t.id) !== tid) return t;
            found = true;
            return {
              ...t,
              is_completed: frameData.isCompleted ?? t.is_completed,
              updated_at: frameData.timestamp || t.updated_at
            };
          })
        );
      }
      if (zid && this.tasksByZone[zid]) {
        this.tasksByZone[zid] = sortTasks(
          this.tasksByZone[zid].map((t) => {
            if (Number(t.id) !== tid) return t;
            found = true;
            return {
              ...t,
              is_completed: frameData.isCompleted ?? t.is_completed,
              updated_at: frameData.timestamp || t.updated_at
            };
          })
        );
      }

      if (!found || frameData.nextScheduledTaskId) {
        if (gid && this.tasksByGarden[gid]) {
          this.reconcileGardenTasks(gid).catch(() => {});
        }
        if (zid && this.tasksByZone[zid]) {
          this.fetchZoneTasks(zid, {}, gid || null).catch(() => {});
        }
      }
    }
  }
});
