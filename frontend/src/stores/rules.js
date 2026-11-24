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

export const useRulesStore = defineStore('rules', {
  state: () => ({
    rulesByZone: {},
    forbiddenByZone: {},
    loading: false,
    actionLoading: false,
    error: null
  }),

  actions: {
    clearMessages() {
      this.error = null;
    },

    async fetchZoneRules(zoneId) {
      const zid = Number(zoneId);
      if (!zid) return [];
      this.loading = true;
      this.error = null;
      this.forbiddenByZone[zid] = false;
      try {
        const res = await api.get(`/zones/${zid}/rules`);
        const rules = res.data?.data?.rules || [];
        this.rulesByZone[zid] = rules;
        return rules;
      } catch (err) {
        if (err.response?.status === 403) {
          this.forbiddenByZone[zid] = true;
          this.rulesByZone[zid] = [];
          return [];
        }
        this.error = extractError(err, 'Failed to load automation rules.');
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async createRule(zoneId, payload) {
      const zid = Number(zoneId);
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.post(`/zones/${zid}/rules`, payload);
        const rule = res.data?.data?.rule;
        if (rule) {
          const list = this.rulesByZone[zid] || [];
          this.rulesByZone[zid] = [rule, ...list.filter((r) => Number(r.id) !== Number(rule.id))];
        }
        return rule;
      } catch (err) {
        this.error = extractError(err, 'Failed to create automation rule.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async updateRule(zoneId, ruleId, payload) {
      const zid = Number(zoneId);
      const rid = Number(ruleId);
      this.actionLoading = true;
      this.error = null;
      try {
        const res = await api.put(`/zones/${zid}/rules/${rid}`, payload);
        const rule = res.data?.data?.rule;
        if (rule && this.rulesByZone[zid]) {
          this.rulesByZone[zid] = this.rulesByZone[zid].map((r) => (Number(r.id) === rid ? rule : r));
        }
        return rule;
      } catch (err) {
        this.error = extractError(err, 'Failed to update automation rule.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async deleteRule(zoneId, ruleId) {
      const zid = Number(zoneId);
      const rid = Number(ruleId);
      this.actionLoading = true;
      this.error = null;
      try {
        await api.delete(`/zones/${zid}/rules/${rid}`);
        if (this.rulesByZone[zid]) {
          this.rulesByZone[zid] = this.rulesByZone[zid].filter((r) => Number(r.id) !== rid);
        }
      } catch (err) {
        this.error = extractError(err, 'Failed to delete automation rule.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    },

    async toggleRule(zoneId, ruleId, isActive) {
      const zid = Number(zoneId);
      const rid = Number(ruleId);
      this.actionLoading = true;
      this.error = null;
      try {
        const body = typeof isActive === 'boolean' ? { is_active: isActive } : {};
        const res = await api.patch(`/zones/${zid}/rules/${rid}/toggle`, body);
        const rule = res.data?.data?.rule;
        if (rule && this.rulesByZone[zid]) {
          this.rulesByZone[zid] = this.rulesByZone[zid].map((r) => (Number(r.id) === rid ? rule : r));
        }
        return rule;
      } catch (err) {
        this.error = extractError(err, 'Failed to toggle automation rule.');
        throw err;
      } finally {
        this.actionLoading = false;
      }
    }
  }
});
