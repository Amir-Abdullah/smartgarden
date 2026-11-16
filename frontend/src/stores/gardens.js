import { defineStore } from 'pinia';
import api from '../services/api.js';

export const useGardensStore = defineStore('gardens', {
  state: () => ({
    gardens: [],
    activeGarden: null,
    zones: [],
    activeZone: null,
    zonePlants: [],
    zoneUtilization: null,
    companionAnalysis: null,
    lastCapacityWarning: null,
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

    extractError(err, fallback = 'Operation failed') {
      return (
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        fallback
      );
    },

    setGardens(list) {
      this.gardens = list;
    },

    setActiveGarden(garden) {
      this.activeGarden = garden;
    },

    async fetchGardens() {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get('/gardens');
        this.gardens = res.data?.data?.gardens || [];
        return this.gardens;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to load gardens.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchGardenDetail(gardenId) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/gardens/${gardenId}`);
        const data = res.data?.data || {};
        this.activeGarden = data.garden || null;
        this.zones = data.zones || [];
        return data;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to load garden details.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async createGarden(payload) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const res = await api.post('/gardens', payload);
        const created = res.data?.data?.garden;
        if (created) {
          this.gardens.unshift(created);
        }
        this.successMessage = `Garden "${created?.name || payload.name}" created successfully.`;
        return created;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to create garden.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async updateGarden(gardenId, payload) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const res = await api.put(`/gardens/${gardenId}`, payload);
        const updated = res.data?.data?.garden;
        if (updated) {
          this.activeGarden = { ...this.activeGarden, ...updated };
          const idx = this.gardens.findIndex(g => g.id === Number(gardenId));
          if (idx !== -1) {
            this.gardens[idx] = { ...this.gardens[idx], ...updated };
          }
        }
        this.successMessage = 'Garden updated successfully.';
        return updated;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to update garden.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async deleteGarden(gardenId) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        await api.delete(`/gardens/${gardenId}`);
        this.gardens = this.gardens.filter(g => g.id !== Number(gardenId));
        if (this.activeGarden && this.activeGarden.id === Number(gardenId)) {
          this.activeGarden = null;
        }
        this.successMessage = 'Garden deleted successfully.';
      } catch (err) {
        this.error = this.extractError(err, 'Failed to delete garden.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async createZone(gardenId, payload) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const res = await api.post(`/gardens/${gardenId}/zones`, payload);
        const zone = res.data?.data?.zone;
        if (zone) {
          this.zones.push(zone);
        }
        this.successMessage = `Zone "${zone?.name || payload.name}" created.`;
        return zone;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to create zone.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async fetchZoneDetail(zoneId) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zoneId}`);
        const data = res.data?.data || {};
        this.activeZone = data.zone || null;
        this.zonePlants = data.plants || [];
        this.zoneUtilization = data.zone_utilization || null;
        return data;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to load zone details.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async updateZone(zoneId, payload) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const res = await api.put(`/zones/${zoneId}`, payload);
        const updated = res.data?.data?.zone;
        if (updated) {
          this.activeZone = { ...this.activeZone, ...updated };
          const idx = this.zones.findIndex(z => z.id === Number(zoneId));
          if (idx !== -1) {
            this.zones[idx] = { ...this.zones[idx], ...updated };
          }
        }
        this.successMessage = 'Zone updated successfully.';
        return updated;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to update zone.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async deleteZone(zoneId) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        await api.delete(`/zones/${zoneId}`);
        this.zones = this.zones.filter(z => z.id !== Number(zoneId));
        this.successMessage = 'Zone removed successfully.';
      } catch (err) {
        this.error = this.extractError(err, 'Failed to delete zone.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async fetchZonePlants(zoneId) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zoneId}/plants`);
        const data = res.data?.data || {};
        this.zonePlants = data.plants || [];
        this.zoneUtilization = data.zone_utilization || null;
        this.companionAnalysis = data.companion_analysis || null;
        return data;
      } catch (err) {
        this.error = this.extractError(err, 'Failed to load zone inventory.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async addZonePlant(zoneId, payload) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      this.lastCapacityWarning = null;
      try {
        const res = await api.post(`/zones/${zoneId}/plants`, payload);
        const zp = res.data?.data?.zone_plant || res.data?.data?.zonePlant;
        const meta = res.data?.meta || null;
        if (meta && meta.warning) {
          this.lastCapacityWarning = meta;
        }
        await this.fetchZonePlants(zoneId);
        this.successMessage = 'Plant added to zone inventory.';
        return { zonePlant: zp, meta };
      } catch (err) {
        this.error = this.extractError(err, 'Failed to add plant to zone.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async updateZonePlant(zoneId, plantId, payload) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      this.lastCapacityWarning = null;
      try {
        const res = await api.put(`/zones/${zoneId}/plants/${plantId}`, payload);
        const zp = res.data?.data?.zone_plant || res.data?.data?.zonePlant;
        const meta = res.data?.meta || null;
        if (meta && meta.warning) {
          this.lastCapacityWarning = meta;
        }
        await this.fetchZonePlants(zoneId);
        this.successMessage = 'Plant record updated.';
        return { zonePlant: zp, meta };
      } catch (err) {
        this.error = this.extractError(err, 'Failed to update plant record.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async removeZonePlant(zoneId, plantId) {
      this.actionLoading = true;
      this.error = null;
      this.successMessage = null;
      try {
        await api.delete(`/zones/${zoneId}/plants/${plantId}`);
        await this.fetchZonePlants(zoneId);
        this.successMessage = 'Plant removed from zone inventory.';
      } catch (err) {
        this.error = this.extractError(err, 'Failed to remove plant.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    }
  }
});
