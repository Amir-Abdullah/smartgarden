<template>
  <div class="gardens-view">
    <div class="page-header">
      <div>
        <h2>My Gardens</h2>
        <p class="subtitle">Manage your gardens, timezone schedules, microclimate zones, and collaborators.</p>
      </div>
      <button class="btn-primary" @click="openCreateModal">
        + New Garden
      </button>
    </div>

    <div v-if="gardensStore.error" class="alert-banner alert-error">
      {{ gardensStore.error }}
    </div>
    <div v-if="gardensStore.successMessage" class="alert-banner alert-success">
      {{ gardensStore.successMessage }}
    </div>

    <div v-if="gardensStore.loading" class="loading-state">
      Loading your gardens...
    </div>

    <div v-else-if="gardensStore.gardens.length === 0" class="empty-state">
      <div class="empty-icon">🌿</div>
      <h3>No Gardens Yet</h3>
      <p>Create your first garden to start organizing growing beds, tracking crops, and inviting family members.</p>
      <button class="btn-primary" @click="openCreateModal">Create Your First Garden</button>
    </div>

    <div v-else class="garden-grid">
      <div
        v-for="garden in gardensStore.gardens"
        :key="garden.id"
        class="garden-card"
        @click="goToGarden(garden.id)"
      >
        <div class="card-top">
          <h3 class="garden-title">{{ garden.name }}</h3>
          <span class="role-badge" :class="`role-${(garden.role || 'OWNER').toLowerCase()}`">
            {{ garden.role || 'OWNER' }}
          </span>
        </div>

        <p v-if="garden.description" class="garden-desc">{{ garden.description }}</p>

        <div class="meta-pills">
          <span class="meta-pill">🕒 {{ garden.timezone || 'UTC' }}</span>
          <span v-if="garden.location_address" class="meta-pill">📍 {{ garden.location_address }}</span>
          <span class="meta-pill">📐 {{ Number(garden.area_sq_m || 0).toFixed(1) }} m²</span>
        </div>

        <div class="card-footer">
          <div class="stat-box">
            <strong>{{ garden.zone_count || 0 }}</strong>
            <span>Zones</span>
          </div>
          <div class="stat-box">
            <strong>{{ garden.plant_count || 0 }}</strong>
            <span>Active Crops</span>
          </div>
          <span class="view-link">Open Garden &rarr;</span>
        </div>
      </div>
    </div>

    <!-- Create Garden Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal-card">
        <h3>Create New Garden</h3>
        <form @submit.prevent="handleCreateGarden">
          <div class="form-group">
            <label>Garden Name *</label>
            <input v-model="form.name" type="text" required placeholder="e.g. Backyard Eden" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>IANA Timezone *</label>
              <select v-model="form.timezone" required>
                <option value="UTC">UTC</option>
                <option value="Asia/Dhaka">Asia/Dhaka (BST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Total Area (m²)</label>
              <input v-model.number="form.area_sq_m" type="number" step="0.1" min="0" placeholder="25.0" />
            </div>
          </div>

          <div class="form-group">
            <label>Location Address</label>
            <input v-model="form.location_address" type="text" placeholder="e.g. Dhaka, Bangladesh" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Latitude</label>
              <input v-model="form.latitude" type="number" step="0.0001" min="-90" max="90" placeholder="23.8103" />
            </div>
            <div class="form-group">
              <label>Longitude</label>
              <input v-model="form.longitude" type="number" step="0.0001" min="-180" max="180" placeholder="90.4125" />
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea v-model="form.description" rows="2" placeholder="Describe your garden layout or goals..."></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="showCreateModal = false">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="gardensStore.actionLoading">
              {{ gardensStore.actionLoading ? 'Creating...' : 'Create Garden' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useGardensStore } from '../stores/gardens.js';

export default {
  name: 'GardensView',
  setup() {
    const router = useRouter();
    const gardensStore = useGardensStore();
    const showCreateModal = ref(false);

    const form = reactive({
      name: '',
      timezone: 'UTC',
      area_sq_m: 20,
      location_address: '',
      latitude: '',
      longitude: '',
      description: ''
    });

    onMounted(() => {
      gardensStore.clearMessages();
      gardensStore.fetchGardens().catch(() => {});
    });

    function openCreateModal() {
      form.name = '';
      form.timezone = 'UTC';
      form.area_sq_m = 20;
      form.location_address = '';
      form.latitude = '';
      form.longitude = '';
      form.description = '';
      showCreateModal.value = true;
    }

    async function handleCreateGarden() {
      try {
        const created = await gardensStore.createGarden({ ...form });
        showCreateModal.value = false;
        if (created && created.id) {
          router.push(`/gardens/${created.id}`);
        }
      } catch {}
    }

    function goToGarden(id) {
      router.push(`/gardens/${id}`);
    }

    return {
      gardensStore,
      showCreateModal,
      form,
      openCreateModal,
      handleCreateGarden,
      goToGarden
    };
  }
};
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.subtitle {
  color: var(--text-secondary);
  margin: 0.25rem 0 0;
}
.garden-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}
.garden-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.garden-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}
.garden-title {
  margin: 0;
  font-size: 1.15rem;
}
.garden-desc {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0.5rem 0;
}
.role-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}
.role-owner { background: #e6f4ea; color: #1e7e34; }
.role-family { background: #e8f0fe; color: #1a73e8; }
.role-guest { background: #fef7e0; color: #b06000; }
.meta-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.85rem 0;
}
.meta-pill {
  font-size: 0.8rem;
  background: #f7fafc;
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-color);
  padding-top: 0.75rem;
  margin-top: 0.75rem;
}
.stat-box {
  display: flex;
  gap: 0.35rem;
  font-size: 0.85rem;
}
.view-link {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 0.85rem;
}
.btn-primary {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-secondary {
  background: #edf2f7;
  color: #2d3748;
  border: none;
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.empty-state, .loading-state {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2.5rem;
  text-align: center;
}
.empty-icon { font-size: 2.5rem; }
.alert-banner {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}
.alert-error { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }
.alert-success { background: #f0fff4; color: #2f855a; border: 1px solid #9ae6b4; }
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.form-group input, .form-group select, .form-group textarea {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}
</style>
