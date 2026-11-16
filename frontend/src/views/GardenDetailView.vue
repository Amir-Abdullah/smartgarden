<template>
  <div class="garden-detail-view">
    <div class="breadcrumb">
      <router-link to="/gardens">&larr; Back to Gardens</router-link>
    </div>

    <div v-if="gardensStore.error || membersStore.error" class="alert-banner alert-error">
      {{ gardensStore.error || membersStore.error }}
    </div>
    <div v-if="gardensStore.successMessage || membersStore.successMessage" class="alert-banner alert-success">
      {{ gardensStore.successMessage || membersStore.successMessage }}
    </div>

    <div v-if="gardensStore.loading && !garden" class="loading-card">
      Loading garden workspace...
    </div>

    <template v-else-if="garden">
      <div class="garden-header-card">
        <div class="header-main">
          <div>
            <div class="title-row">
              <h2>{{ garden.name }}</h2>
              <span class="role-badge">{{ currentRole }}</span>
            </div>
            <p v-if="garden.description" class="desc">{{ garden.description }}</p>
            <div class="garden-meta">
              <span>🕒 Timezone: <strong>{{ garden.timezone }}</strong></span>
              <span v-if="garden.location_address">📍 {{ garden.location_address }}</span>
              <span>📐 Area: <strong>{{ Number(garden.area_sq_m || 0).toFixed(1) }} m²</strong></span>
            </div>
          </div>

          <div v-if="canManageGarden" class="header-actions">
            <button class="btn-secondary" @click="openEditGardenModal">Edit Garden</button>
            <button class="btn-danger" @click="handleDeleteGarden">Delete Garden</button>
          </div>
        </div>

        <div class="tabs-bar">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'zones' }"
            @click="activeTab = 'zones'"
          >
            🌱 Growing Zones ({{ gardensStore.zones.length }})
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'members' }"
            @click="switchToMembersTab"
          >
            👥 Collaborators & RBAC ({{ membersStore.members.length }})
          </button>
        </div>
      </div>

      <!-- ZONES TAB -->
      <div v-if="activeTab === 'zones'" class="tab-section">
        <div class="section-header">
          <h3>Growing Zones & Microclimates</h3>
          <button v-if="canEditZones" class="btn-primary" @click="openZoneModal()">
            + Add Growing Zone
          </button>
        </div>

        <div v-if="gardensStore.zones.length === 0" class="empty-card">
          <p>No growing zones defined yet. Create an outdoor raised bed, greenhouse, or indoor grow area.</p>
        </div>

        <div v-else class="zones-grid">
          <div v-for="zone in gardensStore.zones" :key="zone.id" class="zone-card">
            <div class="zone-card-header">
              <div>
                <h4>{{ zone.name }}</h4>
                <span class="env-badge" :class="zone.is_outdoor ? 'env-outdoor' : 'env-indoor'">
                  {{ zone.is_outdoor ? '☀️ Outdoor (Rain-Aware)' : '🏠 Indoor / Controlled' }}
                </span>
              </div>
              <span class="type-tag">{{ zone.zone_type }}</span>
            </div>

            <div class="zone-specs">
              <div><strong>Soil:</strong> {{ zone.soil_type }}</div>
              <div><strong>Sunlight:</strong> {{ zone.sunlight_level }}</div>
              <div><strong>Area:</strong> {{ Number(zone.area_sq_m || 0).toFixed(2) }} m²</div>
              <div><strong>Planted Crops:</strong> {{ zone.plant_count || 0 }}</div>
            </div>
            <p v-if="zone.dimensions_description" class="dim-note">{{ zone.dimensions_description }}</p>

            <div class="zone-actions">
              <router-link :to="`/zones/${zone.id}/plants`" class="btn-primary btn-sm">
                Manage Plants ({{ zone.plant_count || 0 }})
              </router-link>
              <button v-if="canEditZones" class="btn-secondary btn-sm" @click="openZoneModal(zone)">
                Edit
              </button>
              <button v-if="canManageGarden" class="btn-danger btn-sm" @click="handleDeleteZone(zone.id)">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- MEMBERS & INVITATIONS TAB (F2) -->
      <div v-if="activeTab === 'members'" class="tab-section">
        <div class="members-panel">
          <h3>Garden Members</h3>
          <table class="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in membersStore.members" :key="m.id">
                <td>{{ m.user?.name || `User #${m.user_id}` }}</td>
                <td>{{ m.user?.email || '—' }}</td>
                <td>
                  <select
                    v-if="canManageGarden"
                    :value="m.role"
                    @change="handleRoleChange(m.user_id, $event.target.value)"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="FAMILY">FAMILY</option>
                    <option value="GUEST">GUEST</option>
                  </select>
                  <span v-else class="role-badge">{{ m.role }}</span>
                </td>
                <td>
                  <button
                    v-if="canManageGarden || (authStore.user && authStore.user.id === m.user_id)"
                    class="btn-danger btn-sm"
                    @click="handleRemoveMember(m.user_id)"
                  >
                    {{ authStore.user && authStore.user.id === m.user_id ? 'Leave' : 'Remove' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="canManageGarden" class="invites-panel">
          <h3>Invite Collaborator</h3>
          <form class="invite-form" @submit.prevent="handleSendInvite">
            <input v-model="inviteForm.email" type="email" required placeholder="collaborator@example.com" />
            <select v-model="inviteForm.role">
              <option value="FAMILY">FAMILY (Co-Gardener)</option>
              <option value="GUEST">GUEST (Read-Only)</option>
            </select>
            <input v-model.number="inviteForm.expiresInDays" type="number" min="1" max="30" placeholder="Days" />
            <button type="submit" class="btn-primary" :disabled="membersStore.actionLoading">
              Send Invite
            </button>
          </form>

          <div v-if="lastInviteUrl" class="invite-link-box">
            <strong>Shareable Invitation Link:</strong>
            <code>{{ lastInviteUrl }}</code>
          </div>

          <div v-if="membersStore.pendingInvitations.length > 0" class="pending-list">
            <h4>Pending Invitations</h4>
            <div v-for="inv in membersStore.pendingInvitations" :key="inv.id" class="pending-item">
              <span><strong>{{ inv.invitee_email }}</strong> ({{ inv.role }}) — expires {{ new Date(inv.expires_at).toLocaleDateString() }}</span>
              <button class="btn-danger btn-sm" @click="membersStore.revokeInvitation(garden.id, inv.id)">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Zone Add/Edit Modal -->
    <div v-if="showZoneModal" class="modal-backdrop" @click.self="showZoneModal = false">
      <div class="modal-card">
        <h3>{{ editingZoneId ? 'Edit Growing Zone' : 'Add Growing Zone' }}</h3>
        <form @submit.prevent="handleSaveZone">
          <div class="form-group">
            <label>Zone Name *</label>
            <input v-model="zoneForm.name" type="text" required placeholder="e.g. South Raised Bed" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Zone Type</label>
              <select v-model="zoneForm.zone_type">
                <option value="OUTDOOR_BED">OUTDOOR_BED</option>
                <option value="RAISED_BED">RAISED_BED</option>
                <option value="GREENHOUSE">GREENHOUSE</option>
                <option value="INDOOR_POTS">INDOOR_POTS</option>
                <option value="HYDROPONIC">HYDROPONIC</option>
              </select>
            </div>
            <div class="form-group">
              <label>Environment</label>
              <select v-model="zoneForm.is_outdoor">
                <option :value="true">Outdoor (Exposed to Weather)</option>
                <option :value="false">Indoor / Enclosed</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Soil Type</label>
              <select v-model="zoneForm.soil_type">
                <option value="LOAM">LOAM</option>
                <option value="CLAY">CLAY</option>
                <option value="SANDY">SANDY</option>
                <option value="SILT">SILT</option>
                <option value="PEAT">PEAT</option>
                <option value="CHALKY">CHALKY</option>
              </select>
            </div>
            <div class="form-group">
              <label>Sunlight Exposure</label>
              <select v-model="zoneForm.sunlight_level">
                <option value="FULL_SUN">FULL_SUN (6+ hrs)</option>
                <option value="PART_SHADE">PART_SHADE (3–6 hrs)</option>
                <option value="FULL_SHADE">FULL_SHADE (&lt; 3 hrs)</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Usable Bed Area (m²)</label>
              <input v-model.number="zoneForm.area_sq_m" type="number" step="0.1" min="0.1" required />
            </div>
            <div class="form-group">
              <label>Dimensions Note</label>
              <input v-model="zoneForm.dimensions_description" type="text" placeholder="e.g. 3m x 1.2m" />
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="showZoneModal = false">Cancel</button>
            <button type="submit" class="btn-primary">Save Zone</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Garden Modal -->
    <div v-if="showEditGardenModal" class="modal-backdrop" @click.self="showEditGardenModal = false">
      <div class="modal-card">
        <h3>Edit Garden</h3>
        <form @submit.prevent="handleUpdateGarden">
          <div class="form-group">
            <label>Garden Name *</label>
            <input v-model="gardenForm.name" type="text" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>IANA Timezone *</label>
              <select v-model="gardenForm.timezone" required>
                <option value="UTC">UTC</option>
                <option value="Asia/Dhaka">Asia/Dhaka</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
            </div>
            <div class="form-group">
              <label>Area (m²)</label>
              <input v-model.number="gardenForm.area_sq_m" type="number" step="0.1" min="0" />
            </div>
          </div>
          <div class="form-group">
            <label>Location Address</label>
            <input v-model="gardenForm.location_address" type="text" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="gardenForm.description" rows="2"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="showEditGardenModal = false">Cancel</button>
            <button type="submit" class="btn-primary">Update Garden</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGardensStore } from '../stores/gardens.js';
import { useMembersStore } from '../stores/members.js';
import { useAuthStore } from '../stores/auth.js';

export default {
  name: 'GardenDetailView',
  setup() {
    const route = useRoute();
    const router = useRouter();
    const gardensStore = useGardensStore();
    const membersStore = useMembersStore();
    const authStore = useAuthStore();

    const activeTab = ref('zones');
    const showZoneModal = ref(false);
    const editingZoneId = ref(null);
    const showEditGardenModal = ref(false);
    const lastInviteUrl = ref('');

    const zoneForm = reactive({
      name: '',
      is_outdoor: true,
      zone_type: 'RAISED_BED',
      soil_type: 'LOAM',
      sunlight_level: 'FULL_SUN',
      area_sq_m: 4.0,
      dimensions_description: ''
    });

    const gardenForm = reactive({
      name: '',
      timezone: 'UTC',
      area_sq_m: 0,
      location_address: '',
      description: ''
    });

    const inviteForm = reactive({
      email: '',
      role: 'FAMILY',
      expiresInDays: 7
    });

    const garden = computed(() => gardensStore.activeGarden);
    const currentRole = computed(() => garden.value?.role || membersStore.currentUserRole || 'GUEST');
    const canManageGarden = computed(() => currentRole.value === 'OWNER' || currentRole.value === 'ADMIN');
    const canEditZones = computed(() => ['OWNER', 'FAMILY', 'ADMIN'].includes(currentRole.value));

    onMounted(async () => {
      const gardenId = route.params.id;
      gardensStore.clearMessages();
      membersStore.clearMessages();
      try {
        const data = await gardensStore.fetchGardenDetail(gardenId);
        if (data.members) {
          membersStore.members = data.members;
        }
      } catch {}
    });

    async function switchToMembersTab() {
      activeTab.value = 'members';
      if (garden.value) {
        await membersStore.fetchMembers(garden.value.id).catch(() => {});
        if (canManageGarden.value) {
          await membersStore.fetchInvitations(garden.value.id).catch(() => {});
        }
      }
    }

    function openZoneModal(zone = null) {
      if (zone) {
        editingZoneId.value = zone.id;
        zoneForm.name = zone.name;
        zoneForm.is_outdoor = Boolean(zone.is_outdoor);
        zoneForm.zone_type = zone.zone_type || 'RAISED_BED';
        zoneForm.soil_type = zone.soil_type || 'LOAM';
        zoneForm.sunlight_level = zone.sunlight_level || 'FULL_SUN';
        zoneForm.area_sq_m = Number(zone.area_sq_m || 4.0);
        zoneForm.dimensions_description = zone.dimensions_description || '';
      } else {
        editingZoneId.value = null;
        zoneForm.name = '';
        zoneForm.is_outdoor = true;
        zoneForm.zone_type = 'RAISED_BED';
        zoneForm.soil_type = 'LOAM';
        zoneForm.sunlight_level = 'FULL_SUN';
        zoneForm.area_sq_m = 4.0;
        zoneForm.dimensions_description = '';
      }
      showZoneModal.value = true;
    }

    async function handleSaveZone() {
      try {
        if (editingZoneId.value) {
          await gardensStore.updateZone(editingZoneId.value, { ...zoneForm });
        } else {
          await gardensStore.createZone(garden.value.id, { ...zoneForm });
        }
        showZoneModal.value = false;
      } catch {}
    }

    async function handleDeleteZone(zoneId) {
      await gardensStore.deleteZone(zoneId).catch(() => {});
    }

    function openEditGardenModal() {
      if (!garden.value) return;
      gardenForm.name = garden.value.name;
      gardenForm.timezone = garden.value.timezone || 'UTC';
      gardenForm.area_sq_m = Number(garden.value.area_sq_m || 0);
      gardenForm.location_address = garden.value.location_address || '';
      gardenForm.description = garden.value.description || '';
      showEditGardenModal.value = true;
    }

    async function handleUpdateGarden() {
      try {
        await gardensStore.updateGarden(garden.value.id, { ...gardenForm });
        showEditGardenModal.value = false;
      } catch {}
    }

    async function handleDeleteGarden() {
      try {
        await gardensStore.deleteGarden(garden.value.id);
        router.push('/gardens');
      } catch {}
    }

    async function handleRoleChange(userId, newRole) {
      await membersStore.updateMemberRole(garden.value.id, userId, newRole).catch(() => {});
    }

    async function handleRemoveMember(userId) {
      await membersStore.removeMember(garden.value.id, userId).catch(() => {});
    }

    async function handleSendInvite() {
      try {
        const res = await membersStore.createInvitation(garden.value.id, { ...inviteForm });
        lastInviteUrl.value = res?.invite_url || `/invitations/accept?token=${res?.token}`;
        inviteForm.email = '';
      } catch {}
    }

    return {
      gardensStore,
      membersStore,
      authStore,
      garden,
      currentRole,
      canManageGarden,
      canEditZones,
      activeTab,
      showZoneModal,
      editingZoneId,
      showEditGardenModal,
      zoneForm,
      gardenForm,
      inviteForm,
      lastInviteUrl,
      switchToMembersTab,
      openZoneModal,
      handleSaveZone,
      handleDeleteZone,
      openEditGardenModal,
      handleUpdateGarden,
      handleDeleteGarden,
      handleRoleChange,
      handleRemoveMember,
      handleSendInvite
    };
  }
};
</script>

<style scoped>
.breadcrumb { margin-bottom: 1rem; }
.breadcrumb a { color: var(--primary-color); text-decoration: none; font-weight: 600; }
.garden-header-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem 1.5rem 0;
  margin-bottom: 1.5rem;
}
.header-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding-bottom: 1.25rem;
}
.title-row { display: flex; align-items: center; gap: 0.75rem; }
.title-row h2 { margin: 0; }
.garden-meta { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-top: 0.5rem; font-size: 0.9rem; }
.header-actions { display: flex; gap: 0.5rem; }
.tabs-bar {
  display: flex;
  gap: 1rem;
  border-top: 1px solid var(--border-color);
}
.tab-btn {
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  padding: 0.85rem 0.5rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-secondary);
}
.tab-btn.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.zones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}
.zone-card {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
}
.zone-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.85rem;
}
.zone-card-header h4 { margin: 0 0 0.35rem; font-size: 1.1rem; }
.env-badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 600; }
.env-outdoor { background: #fefcbf; color: #975a16; }
.env-indoor { background: #e6fffa; color: #234e52; }
.type-tag { font-size: 0.75rem; background: #edf2f7; padding: 0.2rem 0.5rem; border-radius: 4px; }
.zone-specs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}
.zone-actions {
  display: flex;
  gap: 0.5rem;
  border-top: 1px solid var(--border-color);
  padding-top: 0.75rem;
}
.members-panel, .invites-panel {
  background: white;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}
.members-table { width: 100%; border-collapse: collapse; }
.members-table th, .members-table td {
  text-align: left;
  padding: 0.65rem;
  border-bottom: 1px solid var(--border-color);
}
.invite-form {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.invite-form input, .invite-form select {
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}
.invite-link-box {
  margin-top: 0.85rem;
  padding: 0.75rem;
  background: #f0fff4;
  border: 1px solid #9ae6b4;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.pending-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}
.btn-primary {
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  text-decoration: none;
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
.role-badge {
  background: #e6f4ea;
  color: #1e7e34;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}
.alert-banner { padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; }
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
.form-group { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.85rem; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.form-group input, .form-group select, .form-group textarea {
  padding: 0.55rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}
.modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
</style>
