<template>
  <div class="dashboard-container">
    <!-- Top Welcome & System Telemetry Bar -->
    <div class="dashboard-banner">
      <div class="banner-content">
        <div class="user-greeting">
          <h2>Gardener Dashboard</h2>
          <p>Welcome back, <strong>{{ authStore.userName || 'Gardener' }}</strong>! Manage plots, microclimates, and crop inventory.</p>
        </div>
        <div class="banner-actions">
          <button class="btn btn-primary" @click="openCreateGardenModal">
            + New Garden
          </button>
          <router-link to="/catalog" class="btn btn-light">
            📖 Plant Reference
          </router-link>
        </div>
      </div>

      <div class="telemetry-grid">
        <div class="telemetry-item">
          <span class="telemetry-num">{{ gardensStore.gardens.length }}</span>
          <span class="telemetry-label">Active Gardens</span>
        </div>
        <div class="telemetry-item">
          <span class="telemetry-num">{{ totalZones }}</span>
          <span class="telemetry-label">Growing Beds</span>
        </div>
        <div class="telemetry-item">
          <span class="telemetry-num">{{ totalPlants }}</span>
          <span class="telemetry-label">Tracked Crops</span>
        </div>
        <div class="telemetry-item">
          <span class="telemetry-num">4</span>
          <span class="telemetry-label">RBAC Tiers</span>
        </div>
      </div>
    </div>

    <!-- Alert Messages -->
    <div v-if="gardensStore.error || membersStore.error" class="alert alert-error">
      {{ gardensStore.error || membersStore.error }}
    </div>
    <div v-if="gardensStore.successMessage || membersStore.successMessage" class="alert alert-success">
      {{ gardensStore.successMessage || membersStore.successMessage }}
    </div>

    <!-- Empty State if no gardens -->
    <div v-if="!gardensStore.loading && gardensStore.gardens.length === 0" class="empty-dashboard-card">
      <div class="empty-icon">🌱</div>
      <h3>No Gardens Registered Yet</h3>
      <p>Set up your first garden to configure microclimate beds, allocate plant instances, and invite your team.</p>
      <div class="empty-cta">
        <button class="btn btn-primary" @click="openCreateGardenModal">Create New Garden</button>
        <button class="btn btn-secondary" @click="createSampleGarden" :disabled="creatingSample">
          {{ creatingSample ? 'Setting up sample...' : '✨ Create Demo Garden with Zones' }}
        </button>
      </div>
    </div>

    <!-- Main Workspace if gardens exist -->
    <div v-else class="workspace-layout">
      <!-- Garden Selector Tabs / Rail -->
      <div class="garden-selector-strip">
        <div class="strip-header">
          <span class="strip-title">Your Gardens:</span>
          <button class="btn btn-sm btn-outline" @click="openCreateGardenModal">+ Add Garden</button>
        </div>
        <div class="garden-chips">
          <button
            v-for="g in gardensStore.gardens"
            :key="g.id"
            class="garden-chip"
            :class="{ active: selectedGardenId === g.id }"
            @click="selectGarden(g.id)"
          >
            <span class="chip-name">{{ g.name }}</span>
            <span class="chip-role">{{ g.role || 'OWNER' }}</span>
          </button>
        </div>
      </div>

      <!-- Active Garden Control Center -->
      <div v-if="activeGarden" class="active-garden-card">
        <div class="garden-info-header">
          <div>
            <div class="title-with-badge">
              <h3>{{ activeGarden.name }}</h3>
              <span class="role-badge">{{ activeGarden.role || 'OWNER' }}</span>
            </div>
            <p v-if="activeGarden.description" class="garden-desc">{{ activeGarden.description }}</p>
            <div class="garden-details">
              <span>🕒 Timezone: <strong>{{ activeGarden.timezone || 'UTC' }}</strong></span>
              <span v-if="activeGarden.location_address">📍 {{ activeGarden.location_address }}</span>
              <span>📐 Bed Area: <strong>{{ Number(activeGarden.area_sq_m || 0).toFixed(1) }} m²</strong></span>
            </div>
          </div>

          <div class="action-buttons" v-if="canManageGarden">
            <button class="btn btn-sm btn-secondary" @click="openEditGardenModal">Edit Garden</button>
            <button class="btn btn-sm btn-danger" @click="handleDeleteGarden">Delete</button>
          </div>
        </div>

        <!-- Navigation Tabs for Active Garden -->
        <div class="dashboard-tabs">
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'zones' }"
            @click="currentTab = 'zones'"
          >
            🌱 Microclimate Zones ({{ gardensStore.zones.length }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: currentTab === 'members' }"
            @click="loadMembersTab"
          >
            👥 Collaborators & RBAC ({{ membersStore.members.length }})
          </button>
        </div>

        <!-- TAB 1: ZONES & CROP ALLOCATION -->
        <div v-if="currentTab === 'zones'" class="tab-pane">
          <div class="pane-action-bar">
            <div>
              <h4>Microclimate Growing Zones</h4>
              <p>Physical plots configured with soil chemistry, light hours, and active crops.</p>
            </div>
            <button v-if="canManageGarden" class="btn btn-primary" @click="openCreateZoneModal">
              + Add Zone Bed
            </button>
          </div>

          <div v-if="gardensStore.zones.length === 0" class="empty-zones-box">
            <p>No growing beds added yet in this garden.</p>
            <button v-if="canManageGarden" class="btn btn-sm btn-primary" @click="openCreateZoneModal">
              Add First Zone
            </button>
          </div>

          <div v-else class="zones-grid">
            <div v-for="zone in gardensStore.zones" :key="zone.id" class="zone-card">
              <div class="zone-card-top">
                <h5>{{ zone.name }}</h5>
                <span class="exposure-badge">{{ zone.sunlight_exposure || 'Full Sun' }}</span>
              </div>
              <p v-if="zone.description" class="zone-desc">{{ zone.description }}</p>

              <div class="zone-meta-tags">
                <span class="tag">📐 {{ Number(zone.area_sq_m || 0).toFixed(1) }} m²</span>
                <span class="tag">🧪 {{ zone.soil_type || 'Loam' }}</span>
                <span v-if="zone.target_ph" class="tag">pH {{ zone.target_ph }}</span>
              </div>

              <div class="zone-utilization">
                <div class="util-header">
                  <span>Bed Capacity:</span>
                  <strong>{{ (zone.utilization_pct || 0).toFixed(0) }}%</strong>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    :style="{ width: `${Math.min(zone.utilization_pct || 0, 100)}%` }"
                    :class="{ 'fill-over': (zone.utilization_pct || 0) > 100 }"
                  ></div>
                </div>
              </div>

              <div class="zone-card-footer">
                <router-link :to="`/zones/${zone.id}/plants`" class="btn btn-sm btn-primary">
                  🌿 Manage Crops & Spacing
                </router-link>
                <div v-if="canManageGarden" class="zone-actions">
                  <button class="btn-icon" title="Edit Zone" @click="openEditZoneModal(zone)">✏️</button>
                  <button class="btn-icon text-red" title="Delete Zone" @click="handleDeleteZone(zone.id)">🗑️</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: COLLABORATORS & RBAC -->
        <div v-if="currentTab === 'members'" class="tab-pane">
          <div class="pane-action-bar">
            <div>
              <h4>Team Collaborators & Roles (F2)</h4>
              <p>Control who can edit beds, manage irrigation, or view garden analytics.</p>
            </div>
            <button v-if="isOwnerOrAdmin" class="btn btn-primary" @click="openInviteModal">
              + Invite Collaborator
            </button>
          </div>

          <div class="members-table-wrap">
            <table class="members-table">
              <thead>
                <tr>
                  <th>User / Email</th>
                  <th>Assigned Role</th>
                  <th>Joined Date</th>
                  <th v-if="isOwnerOrAdmin">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in membersStore.members" :key="member.id">
                  <td>
                    <strong>{{ member.user?.name || member.name || 'Member' }}</strong>
                    <div class="member-email">{{ member.user?.email || member.email }}</div>
                  </td>
                  <td>
                    <span class="role-badge" :class="`role-${(member.role || 'MEMBER').toLowerCase()}`">
                      {{ member.role }}
                    </span>
                  </td>
                  <td>{{ formatDate(member.created_at) }}</td>
                  <td v-if="isOwnerOrAdmin">
                    <button
                      v-if="member.role !== 'OWNER'"
                      class="btn btn-xs btn-danger"
                      @click="handleRemoveMember(member.id)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: Create / Edit Garden -->
    <div v-if="showGardenModal" class="modal-backdrop" @click.self="showGardenModal = false">
      <div class="modal-card">
        <h3>{{ isEditingGarden ? 'Edit Garden' : 'Create New Garden' }}</h3>
        <form @submit.prevent="handleSaveGarden">
          <div class="form-group">
            <label>Garden Name *</label>
            <input v-model="gardenForm.name" type="text" placeholder="e.g. Backyard Vegetable Patch" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="gardenForm.description" placeholder="Notes on microclimates, crops, or layout"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Timezone</label>
              <select v-model="gardenForm.timezone">
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Chicago">America/Chicago (CST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Dhaka">Asia/Dhaka (+06:00)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (+09:00)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Total Area (m²)</label>
              <input v-model.number="gardenForm.area_sq_m" type="number" step="0.1" min="0" placeholder="e.g. 50" />
            </div>
          </div>
          <div class="form-group">
            <label>Physical Address / Location</label>
            <input v-model="gardenForm.location_address" type="text" placeholder="e.g. 124 Orchard Way, Sunnyvale" />
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" @click="showGardenModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="modalLoading">
              {{ modalLoading ? 'Saving...' : 'Save Garden' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: Create / Edit Zone -->
    <div v-if="showZoneModal" class="modal-backdrop" @click.self="showZoneModal = false">
      <div class="modal-card">
        <h3>{{ isEditingZone ? 'Edit Zone Bed' : 'Create Microclimate Zone' }}</h3>
        <form @submit.prevent="handleSaveZone">
          <div class="form-group">
            <label>Zone Bed Name *</label>
            <input v-model="zoneForm.name" type="text" placeholder="e.g. North Herb Spiral" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="zoneForm.description" placeholder="Light characteristics, wind shelter, etc."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Bed Area (m²) *</label>
              <input v-model.number="zoneForm.area_sq_m" type="number" step="0.1" min="0.1" required />
            </div>
            <div class="form-group">
              <label>Sun Exposure *</label>
              <select v-model="zoneForm.sunlight_exposure" required>
                <option value="FULL_SUN">Full Sun (6+ hrs direct)</option>
                <option value="PARTIAL_SUN">Partial Sun (4-6 hrs)</option>
                <option value="PARTIAL_SHADE">Partial Shade (2-4 hrs)</option>
                <option value="FULL_SHADE">Full Shade (< 2 hrs)</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Soil Type</label>
              <select v-model="zoneForm.soil_type">
                <option value="Loam">Loam</option>
                <option value="Sandy Loam">Sandy Loam</option>
                <option value="Clay">Clay</option>
                <option value="Sandy">Sandy</option>
                <option value="Silt">Silt</option>
                <option value="Peat">Peat</option>
              </select>
            </div>
            <div class="form-group">
              <label>Target Soil pH</label>
              <input v-model.number="zoneForm.target_ph" type="number" step="0.1" min="4" max="9" placeholder="6.5" />
            </div>
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" @click="showZoneModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="modalLoading">
              {{ modalLoading ? 'Saving...' : 'Save Zone Bed' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: Invite Collaborator -->
    <div v-if="showInviteModal" class="modal-backdrop" @click.self="showInviteModal = false">
      <div class="modal-card">
        <h3>Invite Team Collaborator (F2)</h3>
        <form @submit.prevent="handleSendInvite">
          <div class="form-group">
            <label>Collaborator Email *</label>
            <input v-model="inviteForm.email" type="email" placeholder="gardener@example.com" required />
          </div>
          <div class="form-group">
            <label>Assigned Permission Role *</label>
            <select v-model="inviteForm.role" required>
              <option value="ADMIN">ADMIN (Full access: zones, crops, invites)</option>
              <option value="MEMBER">MEMBER (Operational: edit crops & irrigation)</option>
              <option value="VIEWER">VIEWER (Read-only analytics & sensors)</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button type="button" class="btn btn-secondary" @click="showInviteModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="modalLoading">
              {{ modalLoading ? 'Sending...' : 'Send Invitation' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { useGardensStore } from '../stores/gardens.js';
import { useMembersStore } from '../stores/members.js';

export default {
  name: 'DashboardView',
  setup() {
    const authStore = useAuthStore();
    const gardensStore = useGardensStore();
    const membersStore = useMembersStore();

    const selectedGardenId = ref(null);
    const currentTab = ref('zones');
    const creatingSample = ref(false);
    const modalLoading = ref(false);

    // Modals
    const showGardenModal = ref(false);
    const isEditingGarden = ref(false);
    const gardenForm = ref({
      name: '',
      description: '',
      timezone: 'UTC',
      area_sq_m: 20,
      location_address: ''
    });

    const showZoneModal = ref(false);
    const isEditingZone = ref(false);
    const activeZoneId = ref(null);
    const zoneForm = ref({
      name: '',
      description: '',
      area_sq_m: 5,
      sunlight_exposure: 'FULL_SUN',
      soil_type: 'Loam',
      target_ph: 6.5
    });

    const showInviteModal = ref(false);
    const inviteForm = ref({
      email: '',
      role: 'MEMBER'
    });

    const totalZones = computed(() => {
      return gardensStore.gardens.reduce((acc, g) => acc + (g.zone_count || 0), 0);
    });

    const totalPlants = computed(() => {
      return gardensStore.gardens.reduce((acc, g) => acc + (g.plant_count || 0), 0);
    });

    const activeGarden = computed(() => {
      return gardensStore.activeGarden;
    });

    const canManageGarden = computed(() => {
      if (!activeGarden.value) return false;
      const role = (activeGarden.value.role || 'OWNER').toUpperCase();
      return role === 'OWNER' || role === 'ADMIN';
    });

    const isOwnerOrAdmin = computed(() => canManageGarden.value);

    const selectGarden = async (gardenId) => {
      selectedGardenId.value = gardenId;
      try {
        await gardensStore.fetchGardenDetail(gardenId);
        await gardensStore.fetchZones(gardenId);
        if (currentTab.value === 'members') {
          await membersStore.fetchMembers(gardenId);
        }
      } catch (err) {
        // Handled in store
      }
    };

    const loadMembersTab = async () => {
      currentTab.value = 'members';
      if (selectedGardenId.value) {
        await membersStore.fetchMembers(selectedGardenId.value);
      }
    };

    const openCreateGardenModal = () => {
      isEditingGarden.value = false;
      gardenForm.value = {
        name: '',
        description: '',
        timezone: 'UTC',
        area_sq_m: 25,
        location_address: ''
      };
      showGardenModal.value = true;
    };

    const openEditGardenModal = () => {
      if (!activeGarden.value) return;
      isEditingGarden.value = true;
      gardenForm.value = {
        name: activeGarden.value.name,
        description: activeGarden.value.description || '',
        timezone: activeGarden.value.timezone || 'UTC',
        area_sq_m: activeGarden.value.area_sq_m || 0,
        location_address: activeGarden.value.location_address || ''
      };
      showGardenModal.value = true;
    };

    const handleSaveGarden = async () => {
      modalLoading.value = true;
      try {
        if (isEditingGarden.value) {
          await gardensStore.updateGarden(selectedGardenId.value, gardenForm.value);
        } else {
          const newGarden = await gardensStore.createGarden(gardenForm.value);
          selectedGardenId.value = newGarden.id;
          await selectGarden(newGarden.id);
        }
        showGardenModal.value = false;
      } catch (err) {
        // error handled
      } finally {
        modalLoading.value = false;
      }
    };

    const handleDeleteGarden = async () => {
      if (!confirm('Are you sure you want to delete this garden and its zones?')) return;
      try {
        await gardensStore.deleteGarden(selectedGardenId.value);
        if (gardensStore.gardens.length > 0) {
          await selectGarden(gardensStore.gardens[0].id);
        } else {
          selectedGardenId.value = null;
          gardensStore.setActiveGarden(null);
        }
      } catch (err) {}
    };

    const openCreateZoneModal = () => {
      isEditingZone.value = false;
      activeZoneId.value = null;
      zoneForm.value = {
        name: '',
        description: '',
        area_sq_m: 5,
        sunlight_exposure: 'FULL_SUN',
        soil_type: 'Loam',
        target_ph: 6.5
      };
      showZoneModal.value = true;
    };

    const openEditZoneModal = (zone) => {
      isEditingZone.value = true;
      activeZoneId.value = zone.id;
      zoneForm.value = {
        name: zone.name,
        description: zone.description || '',
        area_sq_m: zone.area_sq_m || 5,
        sunlight_exposure: zone.sunlight_exposure || 'FULL_SUN',
        soil_type: zone.soil_type || 'Loam',
        target_ph: zone.target_ph || 6.5
      };
      showZoneModal.value = true;
    };

    const handleSaveZone = async () => {
      modalLoading.value = true;
      try {
        if (isEditingZone.value) {
          await gardensStore.updateZone(selectedGardenId.value, activeZoneId.value, zoneForm.value);
        } else {
          await gardensStore.createZone(selectedGardenId.value, zoneForm.value);
        }
        showZoneModal.value = false;
      } catch (err) {
      } finally {
        modalLoading.value = false;
      }
    };

    const handleDeleteZone = async (zoneId) => {
      if (!confirm('Are you sure you want to remove this zone bed?')) return;
      try {
        await gardensStore.deleteZone(selectedGardenId.value, zoneId);
      } catch (err) {}
    };

    const openInviteModal = () => {
      inviteForm.value = {
        email: '',
        role: 'MEMBER'
      };
      showInviteModal.value = true;
    };

    const handleSendInvite = async () => {
      modalLoading.value = true;
      try {
        await membersStore.inviteMember(selectedGardenId.value, inviteForm.value);
        showInviteModal.value = false;
      } catch (err) {
      } finally {
        modalLoading.value = false;
      }
    };

    const handleRemoveMember = async (memberId) => {
      if (!confirm('Remove this collaborator from the garden?')) return;
      try {
        await membersStore.removeMember(selectedGardenId.value, memberId);
      } catch (err) {}
    };

    const createSampleGarden = async () => {
      creatingSample.value = true;
      try {
        const garden = await gardensStore.createGarden({
          name: 'Demo Precision Homestead',
          description: 'Multi-zone testing ground with companion planting beds and microclimate sensors.',
          timezone: 'America/Los_Angeles',
          area_sq_m: 80,
          location_address: 'Green Valley Organic Station'
        });
        selectedGardenId.value = garden.id;
        await gardensStore.createZone(garden.id, {
          name: 'Sunny Solanaceae Bed',
          description: 'High light raised bed for tomatoes, peppers, and basil companion guild.',
          area_sq_m: 12.0,
          sunlight_exposure: 'FULL_SUN',
          soil_type: 'Loam',
          target_ph: 6.4
        });
        await gardensStore.createZone(garden.id, {
          name: 'Cool Shaded Greens Plot',
          description: 'Moist partial shade zone for brassicas and leafy herbs.',
          area_sq_m: 8.5,
          sunlight_exposure: 'PARTIAL_SHADE',
          soil_type: 'Sandy Loam',
          target_ph: 6.8
        });
        await selectGarden(garden.id);
      } catch (err) {
      } finally {
        creatingSample.value = false;
      }
    };

    const formatDate = (isoString) => {
      if (!isoString) return '—';
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };

    onMounted(async () => {
      try {
        const gardens = await gardensStore.fetchGardens();
        if (gardens && gardens.length > 0) {
          await selectGarden(gardens[0].id);
        }
      } catch (err) {
        // unauthenticated or network error
      }
    });

    return {
      authStore,
      gardensStore,
      membersStore,
      selectedGardenId,
      currentTab,
      totalZones,
      totalPlants,
      activeGarden,
      canManageGarden,
      isOwnerOrAdmin,
      creatingSample,
      modalLoading,
      showGardenModal,
      isEditingGarden,
      gardenForm,
      showZoneModal,
      isEditingZone,
      zoneForm,
      showInviteModal,
      inviteForm,
      selectGarden,
      loadMembersTab,
      openCreateGardenModal,
      openEditGardenModal,
      handleSaveGarden,
      handleDeleteGarden,
      openCreateZoneModal,
      openEditZoneModal,
      handleSaveZone,
      handleDeleteZone,
      openInviteModal,
      handleSendInvite,
      handleRemoveMember,
      createSampleGarden,
      formatDate
    };
  }
};
</script>

<style scoped>
.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.dashboard-banner {
  background: linear-gradient(135deg, #1b4d24 0%, #2e7d32 100%);
  color: white;
  border-radius: 16px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: 0 4px 15px rgba(46, 125, 50, 0.2);
}

.banner-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.user-greeting h2 {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
}

.user-greeting p {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
}

.banner-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.telemetry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 1rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.telemetry-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.telemetry-num {
  font-size: 1.6rem;
  font-weight: 800;
  color: #a7f3d0;
}

.telemetry-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

/* Empty Dashboard */
.empty-dashboard-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-icon {
  font-size: 3rem;
}

.empty-cta {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

/* Workspace Layout */
.workspace-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.garden-selector-strip {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.strip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.strip-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #718096;
  text-transform: uppercase;
}

.garden-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.garden-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: #2d3748;
  transition: all 0.2s ease;
}

.garden-chip:hover {
  background: #edf2f7;
}

.garden-chip.active {
  background: #e8f5e9;
  border-color: #2e7d32;
  color: #1b4d24;
}

.chip-role {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
}

/* Active Garden Card */
.active-garden-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.garden-info-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid #edf2f7;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-with-badge h3 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1a202c;
  margin: 0;
}

.garden-desc {
  color: #4a5568;
  margin: 0.4rem 0 0.75rem;
  font-size: 0.95rem;
}

.garden-details {
  display: flex;
  gap: 1.25rem;
  font-size: 0.85rem;
  color: #718096;
  flex-wrap: wrap;
}

.role-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  background: #e8f5e9;
  color: #2e7d32;
  text-transform: uppercase;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

/* Tabs */
.dashboard-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #edf2f7;
}

.tab-btn {
  padding: 0.75rem 1.25rem;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  font-weight: 600;
  color: #718096;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tab-btn.active {
  color: #2e7d32;
  border-bottom-color: #2e7d32;
}

/* Tab Pane */
.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pane-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.pane-action-bar h4 {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.pane-action-bar p {
  font-size: 0.85rem;
  color: #718096;
  margin: 0;
}

/* Zones Grid */
.zones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
}

.zone-card {
  background: #fdfdfd;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.zone-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.zone-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.zone-card-top h5 {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
}

.exposure-badge {
  font-size: 0.725rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  background: #fef3c7;
  color: #92400e;
  border-radius: 9999px;
}

.zone-desc {
  font-size: 0.85rem;
  color: #4a5568;
  margin: 0;
  line-height: 1.4;
}

.zone-meta-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.tag {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  background: #edf2f7;
  border-radius: 4px;
  color: #4a5568;
}

.zone-utilization {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.util-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #718096;
}

.progress-track {
  height: 6px;
  background: #edf2f7;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #10b981;
  transition: width 0.3s ease;
}

.progress-fill.fill-over {
  background: #ef4444;
}

.zone-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 0.5rem;
}

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;
}

/* Members Table */
.members-table-wrap {
  overflow-x: auto;
}

.members-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.members-table th {
  background: #f7fafc;
  padding: 0.75rem 1rem;
  border-bottom: 2px solid #edf2f7;
  color: #718096;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.members-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #edf2f7;
  vertical-align: middle;
}

.member-email {
  font-size: 0.8rem;
  color: #718096;
}

/* Generic Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
}

.btn-xs {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
}

.btn-primary {
  background-color: #2e7d32;
  color: white;
}

.btn-primary:hover {
  background-color: #1b4d24;
}

.btn-secondary {
  background: #edf2f7;
  color: #2d3748;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-danger {
  background: #fee2e2;
  color: #991b1b;
}

.btn-danger:hover {
  background: #fecaca;
}

.btn-light {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-light:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-outline {
  background: transparent;
  border-color: #cbd5e0;
  color: #4a5568;
}

.btn-outline:hover {
  background: #f7fafc;
}

/* Alerts */
.alert {
  padding: 0.85rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.alert-error {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #f87171;
}

.alert-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 520px;
  width: 100%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
}

.modal-card h3 {
  margin: 0 0 1.25rem;
  font-size: 1.35rem;
  font-weight: 700;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #4a5568;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 0.6rem 0.8rem;
  border: 1px solid #cbd5e0;
  border-radius: 6px;
  font-size: 0.9rem;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
</style>
