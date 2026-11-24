import { defineStore } from 'pinia';
import api from '../services/api.js';

function extractError(err, fallback) {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export const useSprint4Store = defineStore('sprint4', {
  state: () => ({
    // F16 Growth Journal
    journalLoading: false,
    plantJournal: null,
    gardenJournalEntries: [],

    // F17 Analytics
    analyticsLoading: false,
    exportLoading: false,
    analyticsData: null,

    // F18 AI Diagnosis
    diagnosisLoading: false,
    diagnosisResult: null,

    // F19 AI Assistant
    chatLoading: false,
    chatMessages: [],
    lastContextSummary: null,
    suggestedFollowups: [
      'Should I water my tomatoes today?',
      'Which pests should I watch for this season?',
      'How can I improve soil organic matter?'
    ],

    // F20 Community
    communityLoading: false,
    posts: [],
    pagination: { total: 0, page: 1, limit: 20, total_pages: 1 },
    commentsByPost: {},

    error: null
  }),

  actions: {
    // -------------------------------------------------------------------------
    // F16 Growth Journal
    // -------------------------------------------------------------------------
    async fetchPlantJournal(plantId) {
      this.journalLoading = true;
      this.error = null;
      try {
        const res = await api.get(`/plants/${plantId}/journal`);
        this.plantJournal = res.data?.data || null;
        return this.plantJournal;
      } catch (err) {
        this.error = extractError(err, 'Failed to load growth journal.');
        throw err;
      } finally {
        this.journalLoading = false;
      }
    },

    async fetchGardenJournal(gardenId) {
      this.journalLoading = true;
      this.error = null;
      try {
        const res = await api.get(`/gardens/${gardenId}/journal`);
        this.gardenJournalEntries = res.data?.data?.entries || [];
        return this.gardenJournalEntries;
      } catch (err) {
        this.error = extractError(err, 'Failed to load garden journal timeline.');
        throw err;
      } finally {
        this.journalLoading = false;
      }
    },

    async createJournalEntry(plantId, payloadOrFormData) {
      this.error = null;
      const res = await api.post(`/plants/${plantId}/journal`, payloadOrFormData);
      const entry = res.data?.data;
      await this.fetchPlantJournal(plantId);
      return entry;
    },

    async deleteJournalEntry(plantId, entryId) {
      this.error = null;
      await api.delete(`/plants/${plantId}/journal/${entryId}`);
      await this.fetchPlantJournal(plantId);
    },

    // -------------------------------------------------------------------------
    // F17 Analytics & Export
    // -------------------------------------------------------------------------
    async fetchAnalytics(gardenId, { range = '30d', zoneId = 'ALL' } = {}) {
      this.analyticsLoading = true;
      this.error = null;
      try {
        const params = { range };
        if (zoneId && zoneId !== 'ALL') {
          params.zone_id = zoneId;
        }
        const res = await api.get(`/gardens/${gardenId}/analytics`, { params });
        this.analyticsData = res.data?.data || null;
        return this.analyticsData;
      } catch (err) {
        this.error = extractError(err, 'Failed to load garden analytics.');
        throw err;
      } finally {
        this.analyticsLoading = false;
      }
    },

    async downloadExport(gardenId, format = 'csv', { range = '30d', zoneId = 'ALL' } = {}) {
      this.exportLoading = true;
      this.error = null;
      try {
        const ext = format === 'pdf' ? 'pdf' : 'csv';
        const params = { range };
        if (zoneId && zoneId !== 'ALL') {
          params.zone_id = zoneId;
        }
        const res = await api.get(`/gardens/${gardenId}/analytics/export.${ext}`, {
          params,
          responseType: 'blob'
        });
        const blob = res.data instanceof Blob
          ? res.data
          : new Blob([res.data], { type: ext === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `smartgarden-analytics-garden-${gardenId}.${ext}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { ok: true, filename: link.download, size: blob.size };
      } catch (err) {
        this.error = extractError(err, `Failed to export ${format.toUpperCase()}.`);
        throw err;
      } finally {
        this.exportLoading = false;
      }
    },

    // -------------------------------------------------------------------------
    // F18 AI Leaf Diagnosis
    // -------------------------------------------------------------------------
    async diagnoseLeaf(formDataOrPayload) {
      this.diagnosisLoading = true;
      this.error = null;
      try {
        const res = await api.post('/ai/diagnose-leaf', formDataOrPayload);
        this.diagnosisResult = res.data?.data || null;
        return this.diagnosisResult;
      } catch (err) {
        this.error = extractError(err, 'Failed to analyze leaf photo.');
        throw err;
      } finally {
        this.diagnosisLoading = false;
      }
    },

    // -------------------------------------------------------------------------
    // F19 AI Gardening Assistant
    // -------------------------------------------------------------------------
    async sendChatMessage({ message, gardenId = 'NONE', zoneId = 'ALL' }) {
      const clean = String(message || '').trim();
      if (!clean) return null;

      this.chatMessages.push({
        id: `u-${Date.now()}`,
        role: 'user',
        content: clean,
        timestamp: new Date().toISOString()
      });

      this.chatLoading = true;
      this.error = null;
      try {
        const history = this.chatMessages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content
        }));
        const res = await api.post('/ai/chat', {
          message: clean,
          garden_id: gardenId && gardenId !== 'NONE' ? Number(gardenId) : null,
          zone_id: zoneId && zoneId !== 'ALL' ? Number(zoneId) : null,
          history
        });
        const data = res.data?.data || {};
        this.lastContextSummary = data.context_summary || null;
        if (Array.isArray(data.suggested_followups) && data.suggested_followups.length > 0) {
          this.suggestedFollowups = data.suggested_followups;
        }
        this.chatMessages.push({
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'No response received.',
          provider: data.provider || 'deterministic-fallback',
          timestamp: data.timestamp || new Date().toISOString()
        });
        return data;
      } catch (err) {
        this.error = extractError(err, 'AI Assistant request failed.');
        throw err;
      } finally {
        this.chatLoading = false;
      }
    },

    clearChat() {
      this.chatMessages = [];
      this.lastContextSummary = null;
    },

    // -------------------------------------------------------------------------
    // F20 Community Hub
    // -------------------------------------------------------------------------
    async fetchPosts({ category = 'ALL', search = '', followingOnly = false, page = 1 } = {}) {
      this.communityLoading = true;
      this.error = null;
      try {
        const res = await api.get('/community/posts', {
          params: {
            category,
            search,
            following_only: followingOnly,
            page
          }
        });
        const data = res.data?.data || {};
        this.posts = data.posts || [];
        this.pagination = data.pagination || { total: this.posts.length, page: 1, limit: 20, total_pages: 1 };
        return data;
      } catch (err) {
        this.error = extractError(err, 'Failed to load community posts.');
        throw err;
      } finally {
        this.communityLoading = false;
      }
    },

    async createPost(payloadOrFormData) {
      this.error = null;
      const res = await api.post('/community/posts', payloadOrFormData);
      const created = res.data?.data;
      if (created) {
        this.posts = [created, ...this.posts];
      }
      return created;
    },

    async deletePost(postId) {
      this.error = null;
      await api.delete(`/community/posts/${postId}`);
      this.posts = this.posts.filter((p) => Number(p.id) !== Number(postId));
    },

    async toggleLike(postId) {
      this.error = null;
      const res = await api.post(`/community/posts/${postId}/like`);
      const data = res.data?.data;
      if (data) {
        this.posts = this.posts.map((p) =>
          Number(p.id) === Number(postId)
            ? { ...p, liked_by_me: data.liked, likes_count: data.likes_count }
            : p
        );
      }
      return data;
    },

    async fetchComments(postId) {
      const res = await api.get(`/community/posts/${postId}/comments`);
      const comments = res.data?.data?.comments || [];
      this.commentsByPost = {
        ...this.commentsByPost,
        [Number(postId)]: comments
      };
      return comments;
    },

    async addComment(postId, { content, parent_comment_id = null }) {
      const res = await api.post(`/community/posts/${postId}/comments`, {
        content,
        parent_comment_id
      });
      const comment = res.data?.data;
      await this.fetchComments(postId);
      if (comment && comment.comments_count !== undefined) {
        this.posts = this.posts.map((p) =>
          Number(p.id) === Number(postId)
            ? { ...p, comments_count: comment.comments_count }
            : p
        );
      }
      return comment;
    },

    async toggleFollow(userId, currentlyFollowing) {
      if (currentlyFollowing) {
        await api.delete(`/community/users/${userId}/follow`);
      } else {
        await api.post(`/community/users/${userId}/follow`);
      }
      const nextFollow = !currentlyFollowing;
      this.posts = this.posts.map((p) =>
        Number(p.author_id) === Number(userId)
          ? { ...p, author_followed_by_me: nextFollow }
          : p
      );
      return nextFollow;
    },

    async moderatePost(postId, patch) {
      const res = await api.patch(`/admin/community/posts/${postId}`, patch);
      const updated = res.data?.data;
      if (updated) {
        this.posts = this.posts.map((p) => (Number(p.id) === Number(postId) ? updated : p));
      }
      return updated;
    }
  }
});
