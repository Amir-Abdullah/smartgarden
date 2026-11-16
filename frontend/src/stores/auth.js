import { defineStore } from 'pinia';
import api from '../services/api.js';

export const useAuthStore = defineStore('auth', {
  state: () => {
    const savedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('sg_token') : null;
    return {
      user: null,
      token: savedToken,
      isAuthenticated: Boolean(savedToken),
      loading: false,
      error: null,
      successMessage: null
    };
  },

  getters: {
    userName: (state) => (state.user ? state.user.name : ''),
    userEmail: (state) => (state.user ? state.user.email : ''),
    isAdmin: (state) => Boolean(state.user && state.user.is_admin)
  },

  actions: {
    setAuth(user, token) {
      this.user = user;
      this.token = token;
      this.isAuthenticated = true;
      this.error = null;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sg_token', token);
      }
    },

    clearAuth() {
      this.user = null;
      this.token = null;
      this.isAuthenticated = false;
      this.error = null;
      this.successMessage = null;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('sg_token');
      }
    },

    async register(payload) {
      this.loading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.post('/auth/register', payload);
        const { user, token } = response.data.data;
        this.setAuth(user, token);
        this.successMessage = 'Account created successfully!';
        return response.data;
      } catch (err) {
        const msg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message || 'Registration failed';
        this.error = msg;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async login(credentials) {
      this.loading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.post('/auth/login', credentials);
        const { user, token } = response.data.data;
        this.setAuth(user, token);
        this.successMessage = 'Logged in successfully!';
        return response.data;
      } catch (err) {
        const msg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message || 'Login failed';
        this.error = msg;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async fetchMe() {
      if (!this.token) return null;
      this.loading = true;
      try {
        const response = await api.get('/auth/me');
        this.user = response.data.data.user;
        this.isAuthenticated = true;
        return this.user;
      } catch (err) {
        this.clearAuth();
        return null;
      } finally {
        this.loading = false;
      }
    },

    async forgotPassword(email) {
      this.loading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.post('/auth/forgot-password', { email });
        const message = (response.data.data && response.data.data.message) || 'Password reset instructions have been sent.';
        this.successMessage = message;
        return response.data;
      } catch (err) {
        const msg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message || 'Failed to request password reset';
        this.error = msg;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async resetPassword({ token, new_password }) {
      this.loading = true;
      this.error = null;
      this.successMessage = null;
      try {
        const response = await api.post('/auth/reset-password', { token, new_password });
        const message = (response.data.data && response.data.data.message) || 'Password has been reset successfully.';
        this.successMessage = message;
        return response.data;
      } catch (err) {
        const msg = (err.response && err.response.data && err.response.data.error && err.response.data.error.message) || err.message || 'Failed to reset password';
        this.error = msg;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.clearAuth();
    }
  }
});
