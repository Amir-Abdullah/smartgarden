<template>
  <div class="app-layout">
    <header class="app-nav">
      <div class="nav-brand">
        <span class="brand-icon">🌱</span>
        <span class="brand-title">Smart Garden</span>
      </div>
      <nav class="nav-links">
        <router-link to="/" class="nav-item">Dashboard</router-link>
        <router-link to="/gardens" class="nav-item">Gardens</router-link>
        <router-link to="/catalog" class="nav-item">Plant Catalog</router-link>
        <router-link to="/auth" class="nav-item">Account</router-link>
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
      <p>&copy; 2026 Smart Gardening System — Precision Agriculture Platform</p>
    </footer>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import axios from 'axios';

export default {
  name: 'App',
  setup() {
    const healthStatus = ref('Connecting...');

    onMounted(async () => {
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
      healthStatus
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

.app-footer {
  text-align: center;
  padding: 1.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  background: white;
}
</style>
