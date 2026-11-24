import { defineStore } from 'pinia';
import api from '../services/api.js';

function extractError(err, fallback) {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export const useSprint5Store = defineStore('sprint5', {
  state: () => ({
    // F21 Notifications
    notificationsLoading: false,
    notifications: [],
    unreadCount: 0,
    preferences: null,

    // F22 Sustainability
    sustainabilityLoading: false,
    sustainabilityData: null,

    // F23 Seed Vault
    seedsLoading: false,
    seedPackets: [],
    seedSummary: { total_packets: 0, total_seeds_remaining: 0, low_stock_count: 0, expiring_or_expired_count: 0 },

    // F24 Developer API Keys & Public Profile
    developerLoading: false,
    apiKeys: [],
    validScopes: [],
    lastCreatedToken: '',
    publicProfile: null,
    publicShowcase: null,

    error: null
  }),

  actions: {
    // F21 Notifications
    async fetchNotifications() {
      this.notificationsLoading = true;
      try {
        const res = await api.get('/notifications');
        this.notifications = res.data?.data?.notifications || [];
        this.unreadCount = res.data?.data?.unread_count || 0;
        return this.notifications;
      } finally {
        this.notificationsLoading = false;
      }
    },

    async markNotificationRead(id) {
      await api.patch(`/notifications/${id}/read`);
      this.notifications = this.notifications.map((n) => (Number(n.id) === Number(id) ? { ...n, is_read: true } : n));
      this.unreadCount = this.notifications.filter((n) => !n.is_read).length;
    },

    async markAllNotificationsRead() {
      await api.post('/notifications/read-all');
      this.notifications = this.notifications.map((n) => ({ ...n, is_read: true }));
      this.unreadCount = 0;
    },

    async fetchPreferences() {
      const res = await api.get('/notifications/preferences');
      this.preferences = res.data?.data || null;
      return this.preferences;
    },

    async updatePreferences(payload) {
      this.error = null;
      try {
        const res = await api.put('/notifications/preferences', payload);
        this.preferences = res.data?.data || null;
        return this.preferences;
      } catch (err) {
        this.error = extractError(err, 'Failed to save notification preferences.');
        throw err;
      }
    },

    async sendTestWebhook(webhookUrl = null) {
      this.error = null;
      try {
        const res = await api.post('/notifications/test-webhook', webhookUrl ? { webhook_url: webhookUrl } : {});
        await this.fetchNotifications().catch(() => {});
        return res.data?.data;
      } catch (err) {
        this.error = extractError(err, 'Webhook test failed.');
        throw err;
      }
    },

    // F22 Sustainability
    async fetchSustainability(gardenId) {
      this.sustainabilityLoading = true;
      this.error = null;
      try {
        const res = await api.get(`/gardens/${gardenId}/sustainability`);
        this.sustainabilityData = res.data?.data || null;
        return this.sustainabilityData;
      } catch (err) {
        this.error = extractError(err, 'Failed to load sustainability scorecard.');
        throw err;
      } finally {
        this.sustainabilityLoading = false;
      }
    },

    async addSustainabilityLog(gardenId, payload) {
      const res = await api.post(`/gardens/${gardenId}/sustainability/logs`, payload);
      await this.fetchSustainability(gardenId);
      return res.data?.data;
    },

    async deleteSustainabilityLog(gardenId, logId) {
      await api.delete(`/gardens/${gardenId}/sustainability/logs/${logId}`);
      await this.fetchSustainability(gardenId);
    },

    // F23 Seed Vault
    async fetchSeeds({ status = 'ALL', search = '' } = {}) {
      this.seedsLoading = true;
      this.error = null;
      try {
        const res = await api.get('/seeds', { params: { status, search } });
        this.seedPackets = res.data?.data?.packets || [];
        this.seedSummary = res.data?.data?.summary || this.seedSummary;
        return this.seedPackets;
      } catch (err) {
        this.error = extractError(err, 'Failed to load Seed Vault.');
        throw err;
      } finally {
        this.seedsLoading = false;
      }
    },

    async createSeedPacket(payload) {
      const res = await api.post('/seeds', payload);
      await this.fetchSeeds();
      return res.data?.data;
    },

    async deleteSeedPacket(seedId) {
      await api.delete(`/seeds/${seedId}`);
      await this.fetchSeeds();
    },

    async allocateSeedPacket(seedId, payload) {
      const res = await api.post(`/seeds/${seedId}/allocate`, payload);
      await this.fetchSeeds();
      return res.data?.data;
    },

    // F24 API Keys & Public Profiles
    async fetchDeveloperKeys() {
      this.developerLoading = true;
      try {
        const res = await api.get('/developer/keys');
        this.apiKeys = res.data?.data?.keys || [];
        this.validScopes = res.data?.data?.valid_scopes || [];
        return this.apiKeys;
      } finally {
        this.developerLoading = false;
      }
    },

    async createDeveloperKey(payload) {
      const res = await api.post('/developer/keys', payload);
      const data = res.data?.data;
      if (data?.token) {
        this.lastCreatedToken = data.token;
      }
      await this.fetchDeveloperKeys();
      return data;
    },

    async revokeDeveloperKey(keyId) {
      await api.delete(`/developer/keys/${keyId}`);
      await this.fetchDeveloperKeys();
    },

    async fetchPublicProfile() {
      const res = await api.get('/developer/public-profile');
      this.publicProfile = res.data?.data || null;
      return this.publicProfile;
    },

    async updatePublicProfile(payload) {
      const res = await api.put('/developer/public-profile', payload);
      this.publicProfile = res.data?.data || null;
      return this.publicProfile;
    },

    async fetchPublicShowcase(handle) {
      const res = await api.get(`/public/growers/${encodeURIComponent(handle)}`);
      this.publicShowcase = res.data?.data || null;
      return this.publicShowcase;
    }
  }
});
