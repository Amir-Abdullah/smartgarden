<template>
  <UDashboardPanel id="gardens">
    <template #header>
      <UDashboardNavbar title="My Gardens">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UColorModeButton />
          <UButton color="primary" size="sm" icon="i-lucide-plus" @click="openCreateModal">
            New Garden
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Toolbar -->
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">
              Manage your gardens, coordinates, timezone schedules, and microclimate beds.
            </p>
          </div>
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Filter gardens..."
            class="w-full sm:w-64"
          />
        </div>

        <UAlert
          v-if="gardensStore.error"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="gardensStore.error"
        />

        <!-- Loading -->
        <div v-if="gardensStore.loading" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UCard v-for="n in 3" :key="n">
            <USkeleton class="mb-3 h-6 w-2/3" />
            <USkeleton class="mb-4 h-12 w-full" />
            <USkeleton class="h-8 w-full" />
          </UCard>
        </div>

        <!-- Empty State -->
        <UEmpty
          v-else-if="filteredGardens.length === 0"
          icon="i-lucide-trees"
          :title="searchQuery ? 'No matching gardens' : 'No gardens yet'"
          :description="searchQuery ? 'Try clearing your filter text.' : 'Create your first garden to organize growing zones and allocate crops.'"
          :actions="
            searchQuery
              ? [{ label: 'Clear search', color: 'neutral', variant: 'outline', onClick: () => (searchQuery = '') }]
              : [{ label: 'Create Your First Garden', color: 'primary', icon: 'i-lucide-plus', onClick: openCreateModal }]
          "
        />

        <!-- Gardens Grid -->
        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <UCard
            v-for="garden in filteredGardens"
            :key="garden.id"
            class="flex flex-col justify-between transition-shadow hover:shadow-md"
          >
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-2">
                <RouterLink
                  :to="`/dashboard/gardens/${garden.id}`"
                  class="text-lg font-semibold text-zinc-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                >
                  {{ garden.name }}
                </RouterLink>
                <UBadge :color="roleColor(garden.role)" variant="soft" size="xs">
                  {{ garden.role || 'OWNER' }}
                </UBadge>
              </div>

              <p v-if="garden.description" class="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {{ garden.description }}
              </p>

              <div class="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <UBadge color="neutral" variant="subtle" size="xs" icon="i-lucide-clock">
                  {{ garden.timezone || 'UTC' }}
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="xs" icon="i-lucide-ruler">
                  {{ Number(garden.area_sq_m || 0).toFixed(1) }} m&sup2;
                </UBadge>
                <UBadge
                  v-if="garden.location_address"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  icon="i-lucide-map-pin"
                >
                  {{ garden.location_address }}
                </UBadge>
                <UBadge
                  v-if="garden.latitude !== null && garden.latitude !== undefined && garden.longitude !== null && garden.longitude !== undefined"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                  icon="i-lucide-globe"
                >
                  {{ Number(garden.latitude).toFixed(2) }}, {{ Number(garden.longitude).toFixed(2) }}
                </UBadge>
              </div>
            </div>

            <template #footer>
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span><strong class="text-zinc-900 dark:text-white">{{ garden.zone_count || 0 }}</strong> zones</span>
                  <span><strong class="text-zinc-900 dark:text-white">{{ garden.plant_count || 0 }}</strong> crops</span>
                </div>

                <div class="flex items-center gap-1.5">
                  <UButton
                    v-if="canManageGarden(garden)"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    aria-label="Edit garden"
                    @click="openEditModal(garden)"
                  />
                  <UButton
                    v-if="canManageGarden(garden)"
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    aria-label="Delete garden"
                    @click="confirmDeleteGarden(garden)"
                  />
                  <UButton
                    :to="`/dashboard/gardens/${garden.id}`"
                    size="xs"
                    color="primary"
                    variant="soft"
                    trailing-icon="i-lucide-arrow-right"
                  >
                    Open
                  </UButton>
                </div>
              </div>
            </template>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Create / Edit Garden Modal -->
  <UModal
    v-model:open="isGardenModalOpen"
    :title="editingGardenId ? 'Edit Garden' : 'Create New Garden'"
    description="Configure garden metadata, location coordinates, timezone, and total area."
  >
    <template #body>
      <form id="garden-form" class="space-y-4" @submit.prevent="handleSaveGarden">
        <UAlert
          v-if="modalError"
          color="error"
          variant="soft"
          icon="i-lucide-alert-circle"
          :title="modalError"
        />

        <UFormField label="Garden Name" required>
          <UInput
            v-model="form.name"
            placeholder="e.g. Backyard Eden"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField label="Description">
          <UTextarea
            v-model="form.description"
            :rows="2"
            placeholder="Describe your garden layout, sunlight, or seasonal goals..."
            class="w-full"
          />
        </UFormField>

        <UFormField label="Location Address">
          <UInput
            v-model="form.location_address"
            placeholder="e.g. 124 Orchard Way, Portland, OR"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Latitude (-90 to 90)">
            <UInput
              v-model="form.latitude"
              type="number"
              step="0.0001"
              min="-90"
              max="90"
              placeholder="45.5152"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Longitude (-180 to 180)">
            <UInput
              v-model="form.longitude"
              type="number"
              step="0.0001"
              min="-180"
              max="180"
              placeholder="-122.6784"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="IANA Timezone" required>
            <USelectMenu
              v-model="form.timezone"
              :items="timezoneOptions"
              value-key="value"
              placeholder="Select timezone"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Total Area (m²)">
            <UInput
              v-model.number="form.area_sq_m"
              type="number"
              step="0.1"
              min="0"
              placeholder="25.0"
              class="w-full"
            />
          </UFormField>
        </div>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isGardenModalOpen = false">
          Cancel
        </UButton>
        <UButton
          type="submit"
          form="garden-form"
          color="primary"
          icon="i-lucide-check"
          :loading="gardensStore.actionLoading"
        >
          {{ editingGardenId ? 'Save Changes' : 'Create Garden' }}
        </UButton>
      </div>
    </template>
  </UModal>

  <!-- Delete Garden Confirmation Modal -->
  <UModal
    v-model:open="isDeleteModalOpen"
    title="Delete Garden"
    :description="`Are you sure you want to delete '${gardenToDelete?.name || ''}'? All zones and crop inventory records inside will be permanently removed.`"
  >
    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isDeleteModalOpen = false">
          Cancel
        </UButton>
        <UButton
          color="error"
          icon="i-lucide-trash-2"
          :loading="gardensStore.actionLoading"
          @click="handleDeleteGarden"
        >
          Delete Garden
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import { useAuthStore } from '../../stores/auth.js';
import { useGardensStore } from '../../stores/gardens.js';

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const gardensStore = useGardensStore();

const searchQuery = ref('');
const isGardenModalOpen = ref(false);
const editingGardenId = ref(null);
const modalError = ref('');

const isDeleteModalOpen = ref(false);
const gardenToDelete = ref(null);

const form = reactive({
  name: '',
  description: '',
  location_address: '',
  latitude: '',
  longitude: '',
  timezone: 'UTC',
  area_sq_m: 20
});

const commonTimezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney'
];

const timezoneOptions = computed(() => {
  const list = [...commonTimezones];
  if (form.timezone && !list.includes(form.timezone)) {
    list.unshift(form.timezone);
  }
  return list.map((tz) => ({ label: tz, value: tz }));
});

const filteredGardens = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return gardensStore.gardens;
  return gardensStore.gardens.filter(
    (g) =>
      g.name?.toLowerCase().includes(q) ||
      g.location_address?.toLowerCase().includes(q) ||
      g.description?.toLowerCase().includes(q)
  );
});

function canManageGarden(garden) {
  return garden.role === 'OWNER' || garden.role === 'ADMIN' || authStore.isAdmin;
}

function roleColor(role) {
  if (role === 'OWNER') return 'success';
  if (role === 'FAMILY') return 'primary';
  if (role === 'ADMIN') return 'info';
  return 'warning';
}

function openCreateModal() {
  editingGardenId.value = null;
  modalError.value = '';
  form.name = '';
  form.description = '';
  form.location_address = '';
  form.latitude = '';
  form.longitude = '';
  form.timezone = 'UTC';
  form.area_sq_m = 20;
  isGardenModalOpen.value = true;
}

function openEditModal(garden) {
  editingGardenId.value = garden.id;
  modalError.value = '';
  form.name = garden.name || '';
  form.description = garden.description || '';
  form.location_address = garden.location_address || '';
  form.latitude = garden.latitude !== null && garden.latitude !== undefined ? String(garden.latitude) : '';
  form.longitude = garden.longitude !== null && garden.longitude !== undefined ? String(garden.longitude) : '';
  form.timezone = garden.timezone || 'UTC';
  form.area_sq_m = Number(garden.area_sq_m || 0);
  isGardenModalOpen.value = true;
}

async function handleSaveGarden() {
  modalError.value = '';
  if (!form.name.trim()) {
    modalError.value = 'Garden name is required.';
    return;
  }

  const latVal = form.latitude === '' || form.latitude === null ? null : Number(form.latitude);
  const lngVal = form.longitude === '' || form.longitude === null ? null : Number(form.longitude);

  if (latVal !== null && (isNaN(latVal) || latVal < -90 || latVal > 90)) {
    modalError.value = 'Latitude must be between -90 and 90.';
    return;
  }
  if (lngVal !== null && (isNaN(lngVal) || lngVal < -180 || lngVal > 180)) {
    modalError.value = 'Longitude must be between -180 and 180.';
    return;
  }

  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    location_address: form.location_address.trim() || null,
    latitude: latVal,
    longitude: lngVal,
    timezone: form.timezone || 'UTC',
    area_sq_m: Number(form.area_sq_m || 0)
  };

  try {
    if (editingGardenId.value) {
      await gardensStore.updateGarden(editingGardenId.value, payload);
      isGardenModalOpen.value = false;
      toast.add({
        title: 'Garden updated',
        description: `"${payload.name}" changes saved.`,
        icon: 'i-lucide-check-circle-2',
        color: 'success'
      });
    } else {
      const created = await gardensStore.createGarden(payload);
      isGardenModalOpen.value = false;
      toast.add({
        title: 'Garden created',
        description: `"${created?.name || payload.name}" created.`,
        icon: 'i-lucide-check-circle-2',
        color: 'success'
      });
      if (created?.id) {
        router.push(`/dashboard/gardens/${created.id}`);
      }
    }
  } catch (err) {
    modalError.value = gardensStore.error || err.message || 'Failed to save garden.';
  }
}

function confirmDeleteGarden(garden) {
  gardenToDelete.value = garden;
  isDeleteModalOpen.value = true;
}

async function handleDeleteGarden() {
  if (!gardenToDelete.value) return;
  const target = gardenToDelete.value;
  try {
    await gardensStore.deleteGarden(target.id);
    isDeleteModalOpen.value = false;
    gardenToDelete.value = null;
    toast.add({
      title: 'Garden deleted',
      description: `"${target.name}" has been removed.`,
      icon: 'i-lucide-trash-2',
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Delete failed',
      description: gardensStore.error || err.message || 'Unable to delete garden.',
      icon: 'i-lucide-alert-circle',
      color: 'error'
    });
  }
}

onMounted(() => {
  gardensStore.clearMessages();
  gardensStore.fetchGardens().catch(() => {});
});
</script>
