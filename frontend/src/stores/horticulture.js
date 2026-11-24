import { defineStore } from 'pinia';
import api from '../services/api.js';

function extractError(err, fallback) {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export const useHorticultureStore = defineStore('horticulture', {
  state: () => ({
    weatherLoading: false,
    gardenWeather: null,
    lastRainSkipResult: null,

    calendarLoading: false,
    calendarData: null,

    carePlanLoading: false,
    carePlanPreview: null,
    lastCarePlanResult: null,

    recommendationsLoading: false,
    recommendationsData: null,

    companionsLoading: false,
    companionsData: null,

    error: null
  }),

  actions: {
    async fetchGardenWeather(gardenId, { forceRefresh = false } = {}) {
      this.weatherLoading = true;
      this.error = null;
      try {
        const res = await api.get(`/gardens/${gardenId}/weather`, {
          params: forceRefresh ? { force_refresh: true } : {}
        });
        this.gardenWeather = res.data?.data || null;
        return this.gardenWeather;
      } catch (err) {
        this.error = extractError(err, 'Failed to load garden weather forecast.');
        throw err;
      } finally {
        this.weatherLoading = false;
      }
    },

    async triggerRainSkip(gardenId) {
      this.weatherLoading = true;
      this.error = null;
      try {
        const res = await api.post(`/gardens/${gardenId}/weather/rain-skip`, {});
        this.lastRainSkipResult = res.data?.data || null;
        return this.lastRainSkipResult;
      } catch (err) {
        this.error = extractError(err, 'Failed to evaluate rain-skip policy.');
        throw err;
      } finally {
        this.weatherLoading = false;
      }
    },

    async fetchCalendar(params = {}) {
      this.calendarLoading = true;
      this.error = null;
      try {
        const cleanParams = {};
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
            cleanParams[k] = v;
          }
        }
        const res = await api.get('/calendar', { params: cleanParams });
        this.calendarData = res.data?.data || null;
        return this.calendarData;
      } catch (err) {
        this.error = extractError(err, 'Failed to load seasonal planting calendar.');
        throw err;
      } finally {
        this.calendarLoading = false;
      }
    },

    async fetchIcsExport(params = {}) {
      const cleanParams = {};
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
          cleanParams[k] = v;
        }
      }
      const res = await api.get('/calendar/export.ics', {
        params: cleanParams,
        responseType: 'text'
      });
      return res.data;
    },

    async fetchCarePlanPreview(zoneId, plantId = null) {
      this.carePlanLoading = true;
      this.error = null;
      try {
        const res = await api.get(`/zones/${zoneId}/care-plans/preview`, {
          params: plantId ? { plant_id: plantId } : {}
        });
        this.carePlanPreview = res.data?.data || null;
        return this.carePlanPreview;
      } catch (err) {
        this.error = extractError(err, 'Failed to compute calibrated care plan preview.');
        throw err;
      } finally {
        this.carePlanLoading = false;
      }
    },

    async generateZoneCarePlan(zoneId, plantId = null) {
      this.carePlanLoading = true;
      this.error = null;
      try {
        const res = await api.post(
          plantId ? `/zones/${zoneId}/plants/${plantId}/care-plan` : `/zones/${zoneId}/care-plans/generate`,
          plantId ? {} : {}
        );
        this.lastCarePlanResult = res.data?.data || null;
        return this.lastCarePlanResult;
      } catch (err) {
        this.error = extractError(err, 'Failed to generate care plan tasks.');
        throw err;
      } finally {
        this.carePlanLoading = false;
      }
    },

    async fetchZoneRecommendations(zoneId, params = {}) {
      this.recommendationsLoading = true;
      this.error = null;
      try {
        const cleanParams = {};
        for (const [k, v] of Object.entries(params)) {
          if (v !== undefined && v !== null && v !== '' && v !== 'ALL') {
            cleanParams[k] = v;
          }
        }
        const res = await api.get(`/zones/${zoneId}/recommendations`, { params: cleanParams });
        this.recommendationsData = res.data?.data || null;
        return this.recommendationsData;
      } catch (err) {
        this.error = extractError(err, 'Failed to load zone plant recommendations.');
        throw err;
      } finally {
        this.recommendationsLoading = false;
      }
    },

    async fetchZoneCompanions(zoneId, candidateIds = []) {
      this.companionsLoading = true;
      this.error = null;
      try {
        const res = candidateIds.length
          ? await api.post(`/zones/${zoneId}/companions/simulate`, { candidate_catalog_ids: candidateIds })
          : await api.get(`/zones/${zoneId}/companions`);
        this.companionsData = res.data?.data || null;
        return this.companionsData;
      } catch (err) {
        this.error = extractError(err, 'Failed to load companion planting matrix.');
        throw err;
      } finally {
        this.companionsLoading = false;
      }
    }
  }
});
