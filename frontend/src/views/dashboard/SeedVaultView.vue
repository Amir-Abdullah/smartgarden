<template>
  <UDashboardPanel id="seed-vault-view">
    <template #header>
      <UDashboardNavbar title="Seed Vault & Germination Logs">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AlertBellButton />
          <UColorModeButton />
          <UButton color="primary" size="sm" icon="i-lucide-plus" @click="isAddOpen = true">
            Add Seed Packet
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <!-- Vault Summary Stats -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <UCard>
            <p class="text-xs text-zinc-500 uppercase">Packets</p>
            <p class="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{{ sprint5Store.seedSummary.total_packets }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-zinc-500 uppercase">Seeds Remaining</p>
            <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ sprint5Store.seedSummary.total_seeds_remaining }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-zinc-500 uppercase">Expiring Soon</p>
            <p class="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{{ sprint5Store.seedSummary.expiring_or_expired_count }}</p>
          </UCard>
          <UCard>
            <p class="text-xs text-zinc-500 uppercase">Low Stock</p>
            <p class="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{{ sprint5Store.seedSummary.low_stock_count }}</p>
          </UCard>
        </div>

        <!-- Filters -->
        <UCard>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="tab in statusFilters"
                :key="tab.value"
                size="xs"
                :color="activeStatus === tab.value ? 'primary' : 'neutral'"
                :variant="activeStatus === tab.value ? 'solid' : 'outline'"
                @click="activeStatus = tab.value"
              >
                {{ tab.label }}
              </UButton>
            </div>
            <UInput v-model="searchQuery" placeholder="Filter varieties, lot #, brand..." size="sm" class="w-60" />
          </div>
        </UCard>

        <!-- Seed Packets Grid -->
        <UEmpty
          v-if="sprint5Store.seedPackets.length === 0"
          icon="i-lucide-package"
          title="No seed packets found"
          description="Catalog heirloom varieties, germination rates, and expiry dates or clear your search filter."
        />
        <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <UCard
            v-for="pkt in sprint5Store.seedPackets"
            :key="pkt.id"
            :data-testid="`seed-packet-${pkt.id}`"
          >
            <template #header>
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h3 class="text-sm font-bold text-zinc-900 dark:text-white">{{ pkt.variety_name }}</h3>
                  <p class="text-xs text-zinc-500">
                    {{ pkt.species_name || 'Custom Cultivar' }}
                    <span v-if="pkt.lot_number"> &bull; Lot {{ pkt.lot_number }}</span>
                  </p>
                </div>
                <UBadge :color="statusColor(pkt.viability_status)" variant="soft" size="xs">
                  {{ pkt.viability_status }}
                </UBadge>
              </div>
            </template>

            <div class="space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
              <div class="flex justify-between">
                <span>Seeds Remaining</span>
                <strong class="text-zinc-900 dark:text-white">{{ pkt.seeds_remaining }} seeds</strong>
              </div>
              <div class="flex justify-between">
                <span>Germination Rate</span>
                <strong class="text-emerald-600 dark:text-emerald-400">{{ pkt.germination_rate_pct }}%</strong>
              </div>
              <div class="flex justify-between">
                <span>Expiry Date</span>
                <span>{{ pkt.expiry_date || '—' }}</span>
              </div>
              <p v-if="pkt.notes" class="pt-1 text-zinc-500">{{ pkt.notes }}</p>
            </div>

            <template #footer>
              <div class="flex items-center justify-between gap-2">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-lucide-sprout"
                  :disabled="pkt.seeds_remaining < 1"
                  @click="openSowModal(pkt)"
                >
                  Sow into Zone
                </UButton>
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  aria-label="Delete seed packet"
                  @click="sprint5Store.deleteSeedPacket(pkt.id)"
                />
              </div>
            </template>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add Seed Packet Modal -->
  <UModal v-model:open="isAddOpen" title="Add Seed Packet" description="Track lot provenance, seed counts, and germination rate.">
    <template #body>
      <form id="add-seed-form" class="space-y-3" @submit.prevent="handleCreatePacket">
        <UFormField label="Variety Name" required>
          <UInput v-model="addForm.variety_name" placeholder="e.g. Cherokee Purple Heirloom" class="w-full" required />
        </UFormField>

        <UFormField label="Linked Catalog Species">
          <USelect v-model="addForm.plant_catalog_id" :items="speciesOptions" value-key="value" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Seeds Count" required>
            <UInput v-model.number="addForm.seeds_remaining" type="number" min="1" class="w-full" required />
          </UFormField>
          <UFormField label="Germination (%)">
            <UInput v-model.number="addForm.germination_rate_pct" type="number" min="0" max="100" class="w-full" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Lot Number">
            <UInput v-model="addForm.lot_number" placeholder="LOT-2026" class="w-full" />
          </UFormField>
          <UFormField label="Expiry Date">
            <UInput v-model="addForm.expiry_date" type="date" class="w-full" />
          </UFormField>
        </div>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isAddOpen = false">Cancel</UButton>
        <UButton type="submit" form="add-seed-form" color="primary" :loading="submitting">Save Packet</UButton>
      </div>
    </template>
  </UModal>

  <!-- Sow into Zone Modal -->
  <UModal
    v-model:open="isSowOpen"
    :title="`Sow ${activePacket?.variety_name || 'Seeds'}`"
    description="Allocate seeds directly from your Seed Vault into a zone crop bed."
  >
    <template #body>
      <form id="sow-seed-form" class="space-y-3" @submit.prevent="handleAllocate">
        <UFormField label="Target Garden" required>
          <USelect v-model="sowGardenId" :items="gardenOptions" value-key="value" class="w-full" />
        </UFormField>
        <UFormField label="Target Microclimate Zone" required>
          <USelect v-model="sowForm.zone_id" :items="zoneOptions" value-key="value" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Seeds Sown" required>
            <UInput v-model.number="sowForm.seeds_used" type="number" min="1" class="w-full" required />
          </UFormField>
          <UFormField label="Plant Quantity" required>
            <UInput v-model.number="sowForm.quantity" type="number" min="1" class="w-full" required />
          </UFormField>
        </div>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="isSowOpen = false">Cancel</UButton>
        <UButton type="submit" form="sow-seed-form" color="primary" :loading="sowing">Confirm Sow Allocation</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useGardensStore } from '../../stores/gardens.js';
import { useCatalogStore } from '../../stores/catalog.js';
import { useSprint5Store } from '../../stores/sprint5.js';
import AlertBellButton from '../../components/AlertBellButton.vue';

const toast = useToast();
const gardensStore = useGardensStore();
const catalogStore = useCatalogStore();
const sprint5Store = useSprint5Store();

const activeStatus = ref('ALL');
const searchQuery = ref('');
const isAddOpen = ref(false);
const submitting = ref(false);
const isSowOpen = ref(false);
const sowing = ref(false);
const activePacket = ref(null);
const sowGardenId = ref(null);

const addForm = reactive({
  variety_name: '',
  plant_catalog_id: 'NONE',
  seeds_remaining: 25,
  germination_rate_pct: 90,
  lot_number: '',
  expiry_date: ''
});

const sowForm = reactive({
  zone_id: null,
  seeds_used: 5,
  quantity: 2
});

const statusFilters = [
  { label: 'All Packets', value: 'ALL' },
  { label: 'Fresh', value: 'FRESH' },
  { label: 'Expiring Soon', value: 'EXPIRING_SOON' },
  { label: 'Low Stock', value: 'LOW_STOCK' }
];

const speciesOptions = computed(() => [
  { label: 'Unlinked Cultivar', value: 'NONE' },
  ...(catalogStore.plants || []).map((p) => ({ label: p.common_name, value: String(p.id) }))
]);

const gardenOptions = computed(() =>
  gardensStore.gardens.map((g) => ({ label: g.name, value: String(g.id) }))
);

const zoneOptions = computed(() =>
  gardensStore.zones.map((z) => ({ label: z.name, value: String(z.id) }))
);

function statusColor(st) {
  if (st === 'FRESH') return 'success';
  if (st === 'EXPIRING_SOON') return 'warning';
  if (st === 'EXPIRED' || st === 'LOW_STOCK') return 'error';
  return 'neutral';
}

async function reloadSeeds() {
  await sprint5Store.fetchSeeds({ status: activeStatus.value, search: searchQuery.value }).catch(() => {});
}

async function handleCreatePacket() {
  if (!addForm.variety_name.trim()) return;
  submitting.value = true;
  try {
    await sprint5Store.createSeedPacket({ ...addForm });
    addForm.variety_name = '';
    addForm.lot_number = '';
    isAddOpen.value = false;
    toast.add({ title: 'Seed Packet Saved', color: 'success' });
  } catch (err) {
    toast.add({
      title: 'Save Failed',
      description: err?.response?.data?.error?.message || 'Unable to add packet.',
      color: 'error'
    });
  } finally {
    submitting.value = false;
  }
}

async function openSowModal(pkt) {
  activePacket.value = pkt;
  sowForm.seeds_used = Math.min(5, pkt.seeds_remaining);
  isSowOpen.value = true;
  if (gardensStore.gardens.length > 0 && !sowGardenId.value) {
    const primary = [...gardensStore.gardens].sort((a, b) => Number(a.id) - Number(b.id))[0];
    sowGardenId.value = String(primary.id);
  }
}

async function handleAllocate() {
  if (!activePacket.value || !sowForm.zone_id) return;
  sowing.value = true;
  try {
    await sprint5Store.allocateSeedPacket(activePacket.value.id, {
      zone_id: Number(sowForm.zone_id),
      seeds_used: Number(sowForm.seeds_used),
      quantity: Number(sowForm.quantity)
    });
    isSowOpen.value = false;
    toast.add({
      title: 'Seeds Sown into Zone',
      description: `Added seedlings from ${activePacket.value.variety_name} into selected zone.`,
      color: 'success'
    });
  } catch (err) {
    toast.add({
      title: 'Allocation Failed',
      description: err?.response?.data?.error?.message || 'Unable to allocate seeds.',
      color: 'error'
    });
  } finally {
    sowing.value = false;
  }
}

watch(sowGardenId, async (gid) => {
  if (!gid) return;
  const detail = await gardensStore.fetchGardenDetail(Number(gid)).catch(() => ({ zones: [] }));
  if (detail.zones?.length > 0) {
    sowForm.zone_id = String(detail.zones[0].id);
  }
});

watch([activeStatus, searchQuery], reloadSeeds);

onMounted(async () => {
  await Promise.all([
    reloadSeeds(),
    gardensStore.fetchGardens().catch(() => []),
    catalogStore.fetchCatalog({ page: 1, limit: 100 }).catch(() => {})
  ]);
});
</script>
