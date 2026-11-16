<template>
  <div class="catalog-view">
    <div class="page-header">
      <div>
        <h2>Botanical Plant Catalog</h2>
        <p class="subtitle">
          Browse {{ catalogStore.total || 32 }} reference species with ideal moisture/temperature thresholds, spacing footprints, and companion planting compatibility.
        </p>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="filters-card">
      <div class="search-row">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search by common or scientific name (e.g. Tomato, Solanum, Basil)..."
          @keyup.enter="applyFilters(1)"
        />
        <select v-model="selectedSunlight" class="filter-select" @change="applyFilters(1)">
          <option value="">All Sunlight Levels</option>
          <option value="FULL_SUN">☀️ Full Sun (6+ hrs)</option>
          <option value="PART_SHADE">⛅ Part Shade (3–6 hrs)</option>
          <option value="FULL_SHADE">🌥️ Full Shade (&lt; 3 hrs)</option>
        </select>
        <button class="btn-primary" @click="applyFilters(1)">Search</button>
        <button class="btn-secondary" @click="resetFilters">Reset</button>
      </div>

      <div class="category-chips">
        <button
          v-for="cat in categories"
          :key="cat.value"
          class="chip-btn"
          :class="{ active: selectedCategory === cat.value }"
          @click="selectCategory(cat.value)"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <div v-if="catalogStore.error" class="alert-error">
      {{ catalogStore.error }}
    </div>

    <div v-if="catalogStore.loading" class="loading-box">
      Loading botanical encyclopedia...
    </div>

    <div v-else-if="catalogStore.plants.length === 0" class="empty-box">
      <p>No plant species match your search criteria.</p>
    </div>

    <div v-else class="catalog-grid">
      <div
        v-for="plant in catalogStore.plants"
        :key="plant.id"
        class="plant-card"
        @click="openPlantDetail(plant)"
      >
        <div class="plant-card-top">
          <div>
            <h3>{{ plant.common_name }}</h3>
            <em class="sci-name">{{ plant.scientific_name }}</em>
          </div>
          <span class="cat-badge">{{ plant.category }}</span>
        </div>

        <p v-if="plant.description" class="plant-desc">{{ plant.description }}</p>

        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">☀️ Sunlight</span>
            <strong>{{ plant.sunlight_req }}</strong>
          </div>
          <div class="metric-item">
            <span class="metric-label">💧 Moisture</span>
            <strong>{{ plant.ideal_moisture_min }}% – {{ plant.ideal_moisture_max }}%</strong>
          </div>
          <div class="metric-item">
            <span class="metric-label">🌡️ Temp</span>
            <strong>{{ plant.ideal_temp_min }}°C – {{ plant.ideal_temp_max }}°C</strong>
          </div>
          <div class="metric-item">
            <span class="metric-label">📏 Spacing</span>
            <strong>{{ plant.spacing_cm }} × {{ plant.row_spacing_cm }} cm</strong>
          </div>
        </div>

        <div class="companions-row" v-if="plant.good_companions && plant.good_companions.length">
          <span class="comp-label">🤝 Good Companions:</span>
          <span class="comp-list">{{ plant.good_companions.slice(0, 3).join(', ') }}</span>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="catalogStore.totalPages > 1" class="pagination-bar">
      <button
        class="btn-secondary"
        :disabled="catalogStore.page <= 1"
        @click="applyFilters(catalogStore.page - 1)"
      >
        &larr; Previous
      </button>
      <span>Page <strong>{{ catalogStore.page }}</strong> of <strong>{{ catalogStore.totalPages }}</strong> ({{ catalogStore.total }} species)</span>
      <button
        class="btn-secondary"
        :disabled="catalogStore.page >= catalogStore.totalPages"
        @click="applyFilters(catalogStore.page + 1)"
      >
        Next &rarr;
      </button>
    </div>

    <!-- Plant Detail Modal -->
    <div v-if="selectedPlant" class="modal-backdrop" @click.self="selectedPlant = null">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h3>{{ selectedPlant.common_name }}</h3>
            <em>{{ selectedPlant.scientific_name }}</em>
          </div>
          <span class="cat-badge">{{ selectedPlant.category }}</span>
        </div>

        <p v-if="selectedPlant.description">{{ selectedPlant.description }}</p>

        <div class="detail-grid">
          <div><strong>Sunlight Requirement:</strong> {{ selectedPlant.sunlight_req }}</div>
          <div><strong>Watering Frequency:</strong> Every {{ selectedPlant.watering_freq_days }} days</div>
          <div><strong>Fertilizing Frequency:</strong> Every {{ selectedPlant.fertilizing_freq_days }} days</div>
          <div><strong>Ideal Soil Moisture:</strong> {{ selectedPlant.ideal_moisture_min }}% – {{ selectedPlant.ideal_moisture_max }}%</div>
          <div><strong>Ideal Temperature:</strong> {{ selectedPlant.ideal_temp_min }}°C – {{ selectedPlant.ideal_temp_max }}°C</div>
          <div><strong>Plant / Row Spacing:</strong> {{ selectedPlant.spacing_cm }} cm / {{ selectedPlant.row_spacing_cm }} cm</div>
          <div><strong>Min Soil Depth:</strong> {{ selectedPlant.min_soil_depth_cm }} cm</div>
          <div><strong>Soil Preference:</strong> {{ selectedPlant.soil_pref }}</div>
        </div>

        <div class="companion-section">
          <div>
            <strong>✅ Synergistic Companions:</strong>
            <p>{{ (selectedPlant.good_companions || []).join(', ') || 'None listed' }}</p>
          </div>
          <div>
            <strong>⚠️ Antagonistic Plants (Avoid):</strong>
            <p>{{ (selectedPlant.bad_companions || []).join(', ') || 'None listed' }}</p>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-primary" @click="selectedPlant = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useCatalogStore } from '../stores/catalog.js';

export default {
  name: 'PlantCatalogView',
  setup() {
    const catalogStore = useCatalogStore();
    const searchQuery = ref('');
    const selectedCategory = ref('');
    const selectedSunlight = ref('');
    const selectedPlant = ref(null);

    const categories = [
      { label: 'All Plants', value: '' },
      { label: '🍅 Vegetables', value: 'VEGETABLE' },
      { label: '🌿 Herbs', value: 'HERB' },
      { label: '🍓 Fruits', value: 'FRUIT' },
      { label: '🌼 Flowers', value: 'FLOWER' },
      { label: '🪴 Foliage', value: 'FOLIAGE' },
      { label: '🌵 Succulents', value: 'SUCCULENT' }
    ];

    onMounted(() => {
      applyFilters(1);
    });

    function applyFilters(targetPage = 1) {
      catalogStore.filters.q = searchQuery.value;
      catalogStore.filters.category = selectedCategory.value;
      catalogStore.filters.sunlight = selectedSunlight.value;
      catalogStore.page = targetPage;
      catalogStore.fetchCatalog({
        page: targetPage,
        q: searchQuery.value,
        category: selectedCategory.value,
        sunlight: selectedSunlight.value
      }).catch(() => {});
    }

    function selectCategory(cat) {
      selectedCategory.value = cat;
      applyFilters(1);
    }

    function resetFilters() {
      searchQuery.value = '';
      selectedCategory.value = '';
      selectedSunlight.value = '';
      applyFilters(1);
    }

    function openPlantDetail(plant) {
      selectedPlant.value = plant;
    }

    return {
      catalogStore,
      searchQuery,
      selectedCategory,
      selectedSunlight,
      selectedPlant,
      categories,
      applyFilters,
      selectCategory,
      resetFilters,
      openPlantDetail
    };
  }
};
</script>

<style scoped>
.page-header { margin-bottom: 1.25rem; }
.subtitle { color: var(--text-secondary); margin: 0.25rem 0 0; }
.filters-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}
.search-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.search-input {
  flex: 1;
  min-width: 240px;
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.filter-select {
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.chip-btn {
  background: #f7fafc;
  border: 1px solid var(--border-color);
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  font-size: 0.85rem;
  cursor: pointer;
}
.chip-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.15rem;
}
.plant-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.2rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.plant-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.07);
}
.plant-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.plant-card-top h3 { margin: 0; font-size: 1.1rem; }
.sci-name { font-size: 0.82rem; color: var(--text-secondary); }
.cat-badge {
  font-size: 0.72rem;
  font-weight: 700;
  background: #e6f4ea;
  color: #1e7e34;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}
.plant-desc { font-size: 0.85rem; color: var(--text-secondary); margin: 0.6rem 0; }
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.8rem;
  margin-top: 0.65rem;
}
.metric-item { display: flex; flex-direction: column; }
.metric-label { color: var(--text-secondary); font-size: 0.75rem; }
.companions-row { margin-top: 0.65rem; font-size: 0.8rem; }
.comp-label { font-weight: 600; margin-right: 0.35rem; }
.pagination-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.75rem;
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
  max-width: 540px;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}
.modal-header h3 { margin: 0; }
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  font-size: 0.88rem;
  background: #f8fafc;
  padding: 0.85rem;
  border-radius: 8px;
  margin: 0.85rem 0;
}
.companion-section { font-size: 0.88rem; }
.modal-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }
</style>
