import { defineStore } from 'pinia';
import api from '../services/api.js';

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    plants: [],
    selectedPlant: null,
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    filters: {
      q: '',
      category: '',
      sunlight: ''
    },
    loading: false,
    error: null
  }),

  actions: {
    setPlants(data, total) {
      this.plants = data;
      this.total = total;
    },

    setSelectedPlant(plant) {
      this.selectedPlant = plant;
    },

    async fetchCatalog(overrides = {}) {
      this.loading = true;
      this.error = null;
      const queryParams = {
        page: overrides.page !== undefined ? overrides.page : this.page,
        limit: overrides.limit !== undefined ? overrides.limit : this.limit,
        q: overrides.q !== undefined ? overrides.q : this.filters.q,
        category: overrides.category !== undefined ? overrides.category : this.filters.category,
        sunlight: overrides.sunlight !== undefined ? overrides.sunlight : this.filters.sunlight
      };

      const cleanParams = {};
      if (queryParams.page) cleanParams.page = queryParams.page;
      if (queryParams.limit) cleanParams.limit = queryParams.limit;
      if (queryParams.q && queryParams.q.trim()) cleanParams.q = queryParams.q.trim();
      if (queryParams.category) cleanParams.category = queryParams.category;
      if (queryParams.sunlight) cleanParams.sunlight = queryParams.sunlight;

      try {
        const res = await api.get('/catalog', { params: cleanParams });
        const data = res.data?.data || {};
        const meta = res.data?.meta || data;
        this.plants = data.plants || [];
        this.total = meta.total || this.plants.length;
        this.page = meta.page || 1;
        this.limit = meta.limit || queryParams.limit;
        this.totalPages = meta.totalPages || 1;
        return this.plants;
      } catch (err) {
        this.error = err.response?.data?.error?.message || err.message || 'Failed to load plant catalog.';
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchPlantById(id) {
      this.loading = true;
      this.error = null;
      try {
        const res = await api.get(`/catalog/${id}`);
        this.selectedPlant = res.data?.data?.plant || null;
        return this.selectedPlant;
      } catch (err) {
        this.error = err.response?.data?.error?.message || err.message || 'Failed to load plant details.';
        throw err;
      } finally {
        this.loading = false;
      }
    }
  }
});
