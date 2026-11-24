<template>
  <UContainer class="py-12">
    <div v-if="loading" class="space-y-4">
      <USkeleton class="h-10 w-64" />
      <USkeleton class="h-72 w-full" />
    </div>

    <UAlert
      v-else-if="notFound"
      color="warning"
      variant="soft"
      icon="i-lucide-user-x"
      title="Public Grower Profile Not Found"
      description="This grower handle either does not exist or has kept their showcase private."
    />

    <div v-else-if="showcase" class="space-y-8">
      <!-- Profile Banner -->
      <UCard>
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div class="space-y-1.5">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge color="primary" variant="soft" size="sm" icon="i-lucide-globe">
                @{{ showcase.profile.handle }}
              </UBadge>
              <UBadge v-if="showcase.profile.location_region" color="neutral" variant="outline" size="xs">
                {{ showcase.profile.location_region }}
              </UBadge>
            </div>
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
              {{ showcase.profile.member_name }}
            </h1>
            <p class="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
              {{ showcase.profile.bio || 'Precision polyculture grower sharing their SmartGarden plot.' }}
            </p>
          </div>
          <UButton to="/" color="neutral" variant="outline" icon="i-lucide-arrow-left">
            SmartGarden Home
          </UButton>
        </div>
      </UCard>

      <!-- Featured Garden + 3D Twin -->
      <template v-if="showcase.featured_garden">
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="text-lg font-bold text-zinc-900 dark:text-white">
                  {{ showcase.featured_garden.name }}
                </h2>
                <p class="text-xs text-zinc-500">
                  {{ showcase.featured_garden.zones.length }} microclimate zones &bull;
                  {{ showcase.featured_garden.area_sq_m }} m² total area
                </p>
              </div>
              <UBadge color="success" variant="soft" size="xs" icon="i-lucide-box">
                Interactive 3D Digital Twin
              </UBadge>
            </div>
          </template>

          <GardenPlot3D
            :zones="showcase.featured_garden.zones"
            :latest-readings-by-zone="showcase.featured_garden.latest_readings_by_zone"
            :garden-name="showcase.featured_garden.name"
          />
        </UCard>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <UCard v-for="z in showcase.featured_garden.zones" :key="z.id">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="font-semibold text-zinc-900 dark:text-white">{{ z.name }}</span>
                <UBadge color="primary" variant="soft" size="xs">{{ z.zone_type }}</UBadge>
              </div>
            </template>
            <div class="space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
              <p>{{ z.soil_type }} &bull; {{ z.sunlight_level }} &bull; {{ z.area_sq_m }} m²</p>
              <div class="flex flex-wrap gap-1.5">
                <UBadge v-for="p in z.plants" :key="p.id" color="neutral" variant="outline" size="xs">
                  {{ p.name }} (x{{ p.quantity }})
                </UBadge>
              </div>
            </div>
          </UCard>
        </div>
      </template>
    </div>
  </UContainer>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSprint5Store } from '../../stores/sprint5.js';
import GardenPlot3D from '../../components/three/GardenPlot3D.vue';

const route = useRoute();
const sprint5Store = useSprint5Store();

const loading = ref(true);
const notFound = ref(false);
const showcase = ref(null);

onMounted(async () => {
  try {
    showcase.value = await sprint5Store.fetchPublicShowcase(route.params.handle);
  } catch {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
});
</script>
