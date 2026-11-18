<template>
  <UApp>
    <div class="app-layout">
      <header class="app-nav">
        <router-link to="/" class="nav-brand">
          <span class="brand-icon">🌱</span>
          <span class="brand-title">Smart Garden</span>
        </router-link>
        <nav class="nav-links">
          <router-link to="/" class="nav-item">Home</router-link>
          <router-link to="/catalog" class="nav-item">Plant Catalog</router-link>
          <router-link to="/dashboard" class="nav-item">Dashboard</router-link>
          <router-link to="/auth" class="nav-item auth-pill">
            {{ authStore.isAuthenticated ? (authStore.userName || 'Account') : 'Sign In' }}
          </router-link>
        </nav>
      </header>

      <main class="app-content">
        <div class="status-banner" v-if="healthStatus">
          <span class="status-indicator">●</span>
          <span>System Status: <strong>{{ healthStatus }}</strong></span>
        </div>
        <div id="router-view-container">
          <!-- Routed views mount here -->
          <router-view />
        </div>
      </main>

      <footer class="app-footer">
        <div class="footer-inner">
          <p>&copy; 2026 Smart Gardening System — Precision Agriculture Platform</p>
          <div class="footer-links">
            <router-link to="/">Landing</router-link>
            <span class="sep">•</span>
            <router-link to="/catalog">Plant Catalog</router-link>
            <span class="sep">•</span>
            <router-link to="/dashboard">Dashboard</router-link>
            <span class="sep">•</span>
            <router-link to="/auth">Auth Portal</router-link>
          </div>
        </div>
      </footer>
    </div>
  </UApp>
</template>

<script>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from './stores/auth.js';

export default {
  name: 'App',
  setup() {
    const healthStatus = ref('Connecting...');
    const authStore = useAuthStore();

    onMounted(async () => {
      if (authStore.token) {
        authStore.fetchMe().catch(() => {});
      }
      try {
        const response = await axios.get('/api/health');
        if (response.data && response.data.status === 'ok') {
          healthStatus.value = `Online (DB: ${response.data.db})`;
        } else {
          healthStatus.value = 'Degraded';
        }
      } catch (err) {
        healthStatus.value = 'Ready (Offline Mode)';
      }
    });

    return {
      healthStatus,
      authStore
    };
  }
};
</script>

<style>
:root {
  --primary-color: #2e7d32;
  --primary-light: #4caf50;
  --bg-color: #f4f6f8;
  --card-bg: #ffffff;
  --text-primary: #1a202c;
  --text-secondary: #718096;
  --border-color: #e2e8f0;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--text-primary);
}

.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background-color: var(--primary-color);
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.nav-links {
  display: flex;
  gap: 1.5rem;
}

.nav-item {
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.nav-item:hover {
  color: white;
}

.app-content {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 2rem auto;
  padding: 0 1rem;
  box-sizing: border-box;
}

.status-banner {
  background: white;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.status-indicator {
  color: #38a169;
}

.welcome-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color);
}

.auth-pill {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.auth-pill:hover {
  background: rgba(255, 255, 255, 0.3);
}

.app-footer {
  text-align: center;
  padding: 1.75rem 1.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  background: white;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.footer-links a {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.footer-links a:hover {
  text-decoration: underline;
}

.sep {
  color: #cbd5e0;
}
</style>
