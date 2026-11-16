<template>
  <div class="zone-plants-view">
    <div class="breadcrumb">
      <router-link v-if="zone && zone.garden_id" :to="`/gardens/${zone.garden_id}`">
        &larr; Back to Garden
      </router-link>
      <router-link v-else to="/gardens">&larr; Back to Gardens</router-link>
    </div>

    <div v-if="gardensStore.error" class="alert-banner alert-error">
      {{ gardensStore.error }}
    </div>
    <div v-if="gardensStore.successMessage" class="alert-banner alert-success">
      {{ gardensStore.successMessage }}
    </div>
    <div v-if="gardensStore.lastCapacityWarning" class="alert-banner alert-warning">
      <strong>⚠️ {{ gardensStore.lastCapacityWarning.warning }}:</strong>
      {{ gardensStore.lastCapacityWarning.message }}
    </div>

    <!-- Zone Header & Spatial Utilization Card -->
    <div class="zone-overview-card" v-if="zone">
      <div class="zone-header-row">
        <div>
          <h2>{{ zone.name }} — Crop Inventory</h2>
          <div class="zone-tags">
            <span class="tag">{{ zone.is_outdoor ? '☀️ Outdoor' : '🏠 Indoor' }}</span>
            <span class="tag">Soil: {{ zone.soil_type }}</span>
            <span class="tag">Light: {{ zone.sunlight_level }}</span>
            <span class="tag">Bed Area: {{ Number(zone.area_sq_m || 0).toFixed(2) }} m²</span>
          </div>
        </div>
        <button class="btn-primary" @click="openAddPlantModal">
          + Assign Plant to Zone
        </button>
      </div>

      <!-- Spatial Utilization Bar -->
      <div v-if="utilization" class="utilization-box">
        <div class="util-top">
          <span>
            <strong>Bed Space Utilization:</strong>
            {{ utilization.occupied_area_sq_m }} m² / {{ utilization.zone_area_sq_m }} m²
            ({{ Math.round((utilization.utilization_ratio || 0) * 100) }}%)
          </span>
          <span class="status-pill" :class="`util-${(utilization.status || 'OPTIMAL').toLowerCase()}`">
            {{ utilization.status || 'OPTIMAL' }}
          </span>
        </div>
        <div class="progress-track">
          <div
            class="progress-fill"
            :class="`fill-${(utilization.status || 'OPTIMAL').toLowerCase()}`"
            :style="{ width: `${Math.min(100, Math.round((utilization.utilization_ratio || 0) * 100))}%` }"
          ></div>
        </div>
      </div>

      <!-- Companion Compatibility Summary -->
      <div v-if="companions" class="companions-banner">
        <div>
          <strong>Guild Compatibility Score:</strong> {{ companions.overallCompatibilityScore }}/100
        </div>
        <div v-if="companions.synergies && companions.synergies.length" class="synergy-text">
          ✅ Synergies: {{ companions.synergies.map(s => `${s.plantA} + ${s.plantB}`).join(', ') }}
        </div>
        <div v-if="companions.conflicts && companions.conflicts.length" class="conflict-text">
          ⚠️ Conflicts: {{ companions.conflicts.map(c => `${c.plantA} vs ${c.plantB}`).join(', ') }}
        </div>
      </div>
    </div>

    <!-- Plant Inventory Grid -->
    <div v-if="gardensStore.loading" class="loading-box">
      Loading zone crop inventory...
    </div>

    <div v-else-if="gardensStore.zonePlants.length === 0" class="empty-box">
      <h3>No Plants Assigned to This Zone Yet</h3>
      <p>Select species from the botanical catalog to track growth status, spacing, and harvest countdowns.</p>
      <button class="btn-primary" @click="openAddPlantModal">+ Assign First Crop</button>
    </div>

    <div v-else class="plants-grid">
      <div v-for="zp in gardensStore.zonePlants" :key="zp.id" class="crop-card">
        <div class="crop-top">
          <div>
            <h3>{{ zp.custom_nickname || zp.common_name || `Plant #${zp.plant_catalog_id}` }}</h3>
            <span class="species-sub">{{ zp.common_name }} <em v-if="zp.scientific_name">({{ zp.scientific_name }})</em></span>
          </div>
          <span class="lifecycle-badge" :class="`st-${(zp.status || 'GROWING').toLowerCase()}`">
            {{ zp.status }}
          </span>
        </div>

        <div class="crop-stats">
          <div><strong>Quantity:</strong> {{ zp.quantity }} plants</div>
          <div><strong>Health:</strong> {{ zp.health_status || 'HEALTHY' }}</div>
          <div><strong>Planted:</strong> {{ zp.planted_date }} ({{ zp.days_since_planted || 0 }}d ago)</div>
          <div>
            <strong>Harvest Target:</strong>
            <span v-if="zp.expected_harvest_date">
              {{ zp.expected_harvest_date }}
              ({{ zp.days_until_harvest >= 0 ? `in ${zp.days_until_harvest}d` : `${Math.abs(zp.days_until_harvest)}d overdue` }})
            </span>
            <span v-else>Not set</span>
          </div>
        </div>

        <p v-if="zp.notes" class="crop-notes">{{ zp.notes }}</p>

        <div class="crop-actions">
          <button class="btn-secondary btn-sm" @click="openEditPlantModal(zp)">Update Status / Qty</button>
          <button class="btn-danger btn-sm" @click="handleRemovePlant(zp.id)">Remove</button>
        </div>
      </div>
    </div>

    <!-- Add / Edit Plant Modal -->
    <div v-if="showPlantModal" class="modal-backdrop" @click.self="showPlantModal = false">
      <div class="modal-card">
        <h3>{{ editingPlantId ? 'Update Zone Plant' : 'Assign Catalog Plant to Zone' }}</h3>
        <form @submit.prevent="handleSavePlant">
          <div class="form-group" v-if="!editingPlantId">
            <label>Catalog Species *</label>
            <select v-model.number="plantForm.plant_catalog_id" required>
              <option disabled value="">Select a plant species...</option>
              <option v-for="cat in catalogStore.plants" :key="cat.id" :value="cat.id">
                {{ cat.common_name }} ({{ cat.scientific_name }}) — {{ cat.spacing_cm }}×{{ cat.row_spacing_cm }}cm
              </option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Custom Nickname</label>
              <input v-model="plantForm.custom_nickname" type="text" placeholder="e.g. Heirloom Row A" />
            </div>
            <div class="form-group">
              <label>Quantity *</label>
              <input v-model.number="plantForm.quantity" type="number" min="1" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Lifecycle Status</label>
              <select v-model="plantForm.status">
                <option value="SEEDLING">SEEDLING</option>
                <option value="GROWING">GROWING</option>
                <option value="HARVEST_READY">HARVEST_READY</option>
                <option value="HARVESTED">HARVESTED</option>
                <option value="DEAD">DEAD</option>
              </select>
            </div>
            <div class="form-group">
              <label>Health Status</label>
              <select v-model="plantForm.health_status">
                <option value="HEALTHY">HEALTHY</option>
                <option value="NEEDS_ATTENTION">NEEDS_ATTENTION</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="DORMANT">DORMANT</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Planted Date *</label>
              <input v-model="plantForm.planted_date" type="date" required />
            </div>
            <div class="form-group">
              <label>Expected Harvest Date</label>
              <input v-model="plantForm.expected_harvest_date" type="date" />
            </div>
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea v-model="plantForm.notes" rows="2" placeholder="Soil amendment or pruning notes..."></textarea>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="showPlantModal = false">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="gardensStore.actionLoading">
              {{ editingPlantId ? 'Save Changes' : 'Add to Zone' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useGardensStore } from '../stores/gardens.js';
import { useCatalogStore } from '../stores/catalog.js';

export default {
  name: 'ZonePlantsView',
  setup() {
    const route = useRoute();
    const gardensStore = useGardensStore();
    const catalogStore = useCatalogStore();

    const showPlantModal = ref(false);
    const editingPlantId = ref(null);

    const plantForm = reactive({
      plant_catalog_id: '',
      custom_nickname: '',
      quantity: 1,
      planted_date: new Date().toISOString().slice(0, 10),
      expected_harvest_date: '',
      status: 'GROWING',
      health_status: 'HEALTHY',
      notes: ''
    });

    const zone = computed(() => gardensStore.activeZone);
    const utilization = computed(() => gardensStore.zoneUtilization);
    const companions = computed(() => gardensStore.companionAnalysis);

    onMounted(async () => {
      const zoneId = route.params.zoneId;
      gardensStore.clearMessages();
      await gardensStore.fetchZoneDetail(zoneId).catch(() => {});
      await gardensStore.fetchZonePlants(zoneId).catch(() => {});
      await catalogStore.fetchCatalog({ limit: 100 }).catch(() => {});
    });

    function openAddPlantModal() {
      editingPlantId.value = null;
      plantForm.plant_catalog_id = catalogStore.plants[0]?.id || '';
      plantForm.custom_nickname = '';
      plantForm.quantity = 4;
      plantForm.planted_date = new Date().toISOString().slice(0, 10);
      plantForm.expected_harvest_date = '';
      plantForm.status = 'SEEDLING';
      plantForm.health_status = 'HEALTHY';
      plantForm.notes = '';
      showPlantModal.value = true;
    }

    function openEditPlantModal(zp) {
      editingPlantId.value = zp.id;
      plantForm.plant_catalog_id = zp.plant_catalog_id;
      plantForm.custom_nickname = zp.custom_nickname || '';
      plantForm.quantity = zp.quantity || 1;
      plantForm.planted_date = zp.planted_date || new Date().toISOString().slice(0, 10);
      plantForm.expected_harvest_date = zp.expected_harvest_date || '';
      plantForm.status = zp.status || 'GROWING';
      plantForm.health_status = zp.health_status || 'HEALTHY';
      plantForm.notes = zp.notes || '';
      showPlantModal.value = true;
    }

    async function handleSavePlant() {
      const zoneId = route.params.zoneId;
      try {
        if (editingPlantId.value) {
          await gardensStore.updateZonePlant(zoneId, editingPlantId.value, { ...plantForm });
        } else {
          await gardensStore.addZonePlant(zoneId, { ...plantForm });
        }
        showPlantModal.value = false;
      } catch {}
    }

    async function handleRemovePlant(plantId) {
      const zoneId = route.params.zoneId;
      await gardensStore.removeZonePlant(zoneId, plantId).catch(() => {});
    }

    return {
      gardensStore,
      catalogStore,
      zone,
      utilization,
      companions,
      showPlantModal,
      editingPlantId,
      plantForm,
      openAddPlantModal,
      openEditPlantModal,
      handleSavePlant,
      handleRemovePlant
    };
  }
};
</script>

<style scoped>
.breadcrumb { margin-bottom: 1rem; }
.breadcrumb a { color: var(--primary-color); text-decoration: none; font-weight: 600; }
.zone-overview-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.zone-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.zone-header-row h2 { margin: 0 0 0.5rem; }
.zone-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.tag {
  background: #f7fafc;
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.82rem;
}
.utilization-box {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}
.util-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.progress-track {
  height: 10px;
  background: #edf2f7;
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill { height: 100%; transition: width 0.3s ease; }
.fill-optimal { background: #38a169; }
.fill-dense { background: #dd6b20; }
.fill-overcrowded { background: #e53e3e; }
.status-pill {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
}
.util-optimal { background: #e6f4ea; color: #1e7e34; }
.util-dense { background: #feebc8; color: #9c4221; }
.util-overcrowded { background: #fed7d7; color: #9b2c2c; }
.companions-banner {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.synergy-text { color: #2f855a; }
.conflict-text { color: #c53030; font-weight: 600; }
.plants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}
.crop-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
}
.crop-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}
.crop-top h3 { margin: 0; font-size: 1.05rem; }
.species-sub { font-size: 0.82rem; color: var(--text-secondary); }
.lifecycle-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: #e6f4ea;
  color: #1e7e34;
}
.crop-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
  font-size: 0.85rem;
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 8px;
}
.crop-notes { font-size: 0.85rem; color: var(--text-secondary); margin: 0.65rem 0 0; }
.crop-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}
.btn-primary {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-secondary {
  background: #edf2f7;
  color: #2d3748;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-danger {
  background: #fed7d7;
  color: #9b2c2c;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-sm { padding: 0.35rem 0.7rem; font-size: 0.8rem; }
.alert-banner { padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
.alert-error { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }
.alert-success { background: #f0fff4; color: #2f855a; border: 1px solid #9ae6b4; }
.alert-warning { background: #fffaf0; color: #9c4221; border: 1px solid #fbd38d; }
.empty-box, .loading-box {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 2.5rem;
  text-align: center;
}
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
.form-group { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.85rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.form-group input, .form-group select, .form-group textarea {
  padding: 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
</style>
