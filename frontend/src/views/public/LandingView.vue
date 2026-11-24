<template>
  <div>
    <!-- Hero -->
    <UPageHero
      title="Grow Smarter. Cultivate Resilient Gardens."
      description="Plan microclimate zones, prevent crop overcrowding with real spatial capacity math, analyze companion pairings, and collaborate with your family or growing team."
      :links="heroLinks"
      :ui="{
        root: 'relative overflow-hidden border-b border-zinc-200/80 dark:border-zinc-800/80',
        title: 'text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight',
        description: 'max-w-2xl mx-auto text-base sm:text-lg'
      }"
    >
      <template #headline>
        <UBadge color="primary" variant="subtle" size="lg" icon="i-lucide-sparkles">
          Sprint 3 Live &bull; F1&ndash;F15 Horticultural Intelligence Platform
        </UBadge>
      </template>

      <template #bottom>
        <UContainer class="pb-10">
          <div class="grid grid-cols-2 gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 sm:grid-cols-4">
            <div v-for="stat in stats" :key="stat.label" class="text-center">
              <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                {{ stat.value }}
              </div>
              <div class="mt-1 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {{ stat.label }}
              </div>
            </div>
          </div>
        </UContainer>
      </template>
    </UPageHero>

    <!-- Features Grid (F1-F24) -->
    <UPageSection
      id="features"
      headline="Platform Capabilities"
      title="24 Integrated Modules — 15 Live Today, 9 in Active Development"
      description="Explore live core, IoT telemetry, and horticultural intelligence modules now and preview every upcoming journal, analytics, and AI module on our roadmap."
    >
      <template #body>
        <div class="mb-8 flex flex-wrap items-center justify-center gap-2">
          <UButton
            v-for="tab in featureFilters"
            :key="tab.value"
            size="sm"
            :color="activeFeatureFilter === tab.value ? 'primary' : 'neutral'"
            :variant="activeFeatureFilter === tab.value ? 'solid' : 'outline'"
            @click="activeFeatureFilter = tab.value"
          >
            {{ tab.label }}
          </UButton>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UPageCard
            v-for="feature in filteredFeatures"
            :key="feature.id"
            :title="feature.title"
            :description="feature.summary"
            :icon="feature.icon"
            :to="feature.status === 'live' ? feature.to : undefined"
            variant="outline"
            spotlight
            spotlight-color="primary"
            class="cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
            @click="feature.status === 'soon' ? open(feature) : undefined"
          >
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                  {{ feature.code }}
                </span>
                <UBadge
                  v-if="feature.status === 'live'"
                  color="success"
                  variant="soft"
                  size="xs"
                  icon="i-lucide-check-circle-2"
                >
                  Live
                </UBadge>
                <UBadge
                  v-else
                  color="primary"
                  variant="subtle"
                  size="xs"
                  icon="i-lucide-clock"
                >
                  Sprint {{ feature.sprint }} &bull; Soon
                </UBadge>
              </div>
            </template>
          </UPageCard>
        </div>
      </template>
    </UPageSection>

    <!-- How It Works -->
    <UPageSection
      headline="Workflow"
      title="From Blank Plot to Balanced Polyculture in Three Steps"
      description="No spreadsheets required — SmartGarden models your exact bed dimensions and botanical requirements."
      class="bg-zinc-50/70 dark:bg-zinc-900/40"
    >
      <template #body>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <UCard v-for="step in howItWorks" :key="step.step" class="relative overflow-hidden">
            <div class="mb-4 flex items-center justify-between">
              <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <UIcon :name="step.icon" class="size-5" />
              </div>
              <span class="text-3xl font-bold text-zinc-200 dark:text-zinc-800">
                0{{ step.step }}
              </span>
            </div>
            <h3 class="text-base font-semibold text-zinc-900 dark:text-white">
              {{ step.title }}
            </h3>
            <p class="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {{ step.description }}
            </p>
          </UCard>
        </div>
      </template>
    </UPageSection>

    <!-- 6-Plant Catalog Preview -->
    <UPageSection
      headline="Botanical Encyclopedia"
      title="Reference Species Preview"
      description="Every plant profile includes ideal soil moisture, temperature bounds, spacing footprint, and companion planting compatibility."
    >
      <template #body>
        <div
          v-if="!authStore.isAuthenticated || usedFallbackPreview"
          class="mb-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30 sm:flex-row sm:items-center"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-sprout" class="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p class="text-sm text-zinc-700 dark:text-zinc-300">
              Showing a curated 6-species preview. Sign in to search all <strong>32+ botanical profiles</strong> and add crops directly to your garden zones.
            </p>
          </div>
          <UButton to="/login" size="xs" color="primary" variant="soft" class="shrink-0">
            Sign in for full catalog
          </UButton>
        </div>

        <div v-if="previewLoading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UCard v-for="n in 6" :key="n">
            <USkeleton class="mb-3 h-5 w-1/2" />
            <USkeleton class="mb-4 h-3 w-1/3" />
            <USkeleton class="h-14 w-full" />
          </UCard>
        </div>

        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UPageCard
            v-for="plant in previewPlants"
            :key="plant.id || plant.scientific_name"
            :title="plant.common_name"
            :description="plant.description"
            variant="outline"
          >
            <template #header>
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-xs italic text-zinc-500 dark:text-zinc-400">
                    {{ plant.scientific_name }}
                  </p>
                </div>
                <UBadge color="primary" variant="soft" size="xs">
                  {{ plant.category }}
                </UBadge>
              </div>
            </template>

            <template #footer>
              <div class="grid w-full grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-sun" class="size-3.5 text-amber-500" />
                  <span>{{ formatSunlight(plant.sunlight_req) }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-droplets" class="size-3.5 text-sky-500" />
                  <span>{{ plant.ideal_moisture_min }}&ndash;{{ plant.ideal_moisture_max }}%</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-thermometer" class="size-3.5 text-rose-500" />
                  <span>{{ plant.ideal_temp_min }}&ndash;{{ plant.ideal_temp_max }}&deg;C</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-ruler" class="size-3.5 text-emerald-500" />
                  <span>{{ plant.spacing_cm }} cm spacing</span>
                </div>
              </div>
            </template>
          </UPageCard>
        </div>

        <div class="mt-8 flex justify-center">
          <UButton to="/catalog" size="lg" color="primary" variant="outline" icon="i-lucide-book-open">
            Explore Plant Catalog
          </UButton>
        </div>
      </template>
    </UPageSection>

    <!-- Testimonials -->
    <UPageSection
      headline="Grower Stories"
      title="Trusted by Backyard Gardeners & Community Plots"
      class="bg-zinc-50/70 dark:bg-zinc-900/40"
    >
      <template #body>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <UCard v-for="t in testimonials" :key="t.name">
            <p class="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              &ldquo;{{ t.quote }}&rdquo;
            </p>
            <template #footer>
              <div class="flex items-center gap-3">
                <UAvatar :alt="t.name" size="sm" class="bg-emerald-600 text-white" />
                <div>
                  <p class="text-sm font-semibold text-zinc-900 dark:text-white">{{ t.name }}</p>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ t.role }}</p>
                </div>
              </div>
            </template>
          </UCard>
        </div>
      </template>
    </UPageSection>

    <!-- FAQ -->
    <UPageSection
      headline="FAQ"
      title="Frequently Asked Questions"
      description="Everything you need to know about SmartGarden's live platform and upcoming sprints."
    >
      <template #body>
        <div class="mx-auto max-w-3xl">
          <UAccordion :items="faqItems" />
        </div>
      </template>
    </UPageSection>

    <!-- Bottom CTA -->
    <UContainer class="pb-16">
      <UPageCTA
        title="Ready to plan your healthiest harvest yet?"
        description="Create a free account or jump straight into the seeded demo garden to test zone capacity and companion analysis."
        variant="subtle"
        :links="[
          { label: authStore.isAuthenticated ? 'Open Dashboard' : 'Get Started Free', to: authStore.isAuthenticated ? '/dashboard' : '/register', color: 'primary', size: 'lg' },
          { label: 'View Roadmap', to: '/about#roadmap', color: 'neutral', variant: 'outline', size: 'lg' }
        ]"
      />
    </UContainer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '../../services/api.js';
import { useAuthStore } from '../../stores/auth.js';
import { FEATURES } from '../../config/features.js';
import { useComingSoon } from '../../composables/useComingSoon.js';

const authStore = useAuthStore();
const { open } = useComingSoon();

const activeFeatureFilter = ref('all');
const previewLoading = ref(false);
const usedFallbackPreview = ref(false);

const CURATED_PREVIEW_PLANTS = [
  {
    id: 1,
    common_name: 'Roma Tomato',
    scientific_name: 'Solanum lycopersicum',
    category: 'VEGETABLE',
    description: 'Compact determinate paste tomato prized for dense sauces and reliable container yields.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 55,
    ideal_moisture_max: 75,
    ideal_temp_min: 18,
    ideal_temp_max: 29,
    spacing_cm: 45
  },
  {
    id: 2,
    common_name: 'Sweet Basil',
    scientific_name: 'Ocimum basilicum',
    category: 'HERB',
    description: 'Aromatic culinary herb that thrives alongside tomatoes and deters aphids and whiteflies.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 50,
    ideal_moisture_max: 70,
    ideal_temp_min: 18,
    ideal_temp_max: 30,
    spacing_cm: 25
  },
  {
    id: 3,
    common_name: 'Nantes Carrot',
    scientific_name: 'Daucus carota',
    category: 'VEGETABLE',
    description: 'Crisp, sweet cylindrical root crop suited to deep, stone-free sandy loam beds.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 45,
    ideal_moisture_max: 65,
    ideal_temp_min: 10,
    ideal_temp_max: 24,
    spacing_cm: 8
  },
  {
    id: 4,
    common_name: 'English Lavender',
    scientific_name: 'Lavandula angustifolia',
    category: 'HERB',
    description: 'Drought-tolerant perennial pollinator magnet with fragrant purple flower spikes.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 25,
    ideal_moisture_max: 45,
    ideal_temp_min: 12,
    ideal_temp_max: 28,
    spacing_cm: 40
  },
  {
    id: 5,
    common_name: 'Alpine Strawberry',
    scientific_name: 'Fragaria vesca',
    category: 'FRUIT',
    description: 'Compact, runner-free woodland strawberry producing intensely sweet berries in partial shade.',
    sunlight_req: 'PART_SHADE',
    ideal_moisture_min: 55,
    ideal_moisture_max: 75,
    ideal_temp_min: 12,
    ideal_temp_max: 24,
    spacing_cm: 25
  },
  {
    id: 6,
    common_name: 'French Marigold',
    scientific_name: 'Tagetes patula',
    category: 'FLOWER',
    description: 'Vibrant companion border flower that suppresses soil nematodes and attracts hoverflies.',
    sunlight_req: 'FULL_SUN',
    ideal_moisture_min: 40,
    ideal_moisture_max: 60,
    ideal_temp_min: 15,
    ideal_temp_max: 30,
    spacing_cm: 20
  }
];

const previewPlants = ref(CURATED_PREVIEW_PLANTS);

const heroLinks = computed(() => {
  if (authStore.isAuthenticated) {
    return [
      { label: 'Open Dashboard', to: '/dashboard', color: 'primary', size: 'xl', icon: 'i-lucide-layout-dashboard' },
      { label: 'Browse Plant Catalog', to: '/catalog', color: 'neutral', variant: 'outline', size: 'xl', icon: 'i-lucide-book-open' }
    ];
  }
  return [
    { label: 'Get Started Free', to: '/register', color: 'primary', size: 'xl', icon: 'i-lucide-sprout' },
    { label: 'Browse Plant Catalog', to: '/catalog', color: 'neutral', variant: 'outline', size: 'xl', icon: 'i-lucide-book-open' },
    { label: 'Try Demo Account', to: '/login', color: 'neutral', variant: 'ghost', size: 'xl', icon: 'i-lucide-play' }
  ];
});

const stats = [
  { value: '32+', label: 'Botanical Species' },
  { value: '15 Live', label: 'Core, Ops & Intelligence (F1–F15)' },
  { value: '3 Tiers', label: 'RBAC Collaboration' },
  { value: '9 Soon', label: 'Journal, Analytics & AI Roadmap' }
];

const featureFilters = [
  { label: 'All (24)', value: 'all' },
  { label: 'Live Now (F1–F15)', value: 'live' },
  { label: 'Upcoming (F16–F24)', value: 'soon' }
];

const filteredFeatures = computed(() => {
  if (activeFeatureFilter.value === 'live') {
    return FEATURES.filter((f) => f.status === 'live');
  }
  if (activeFeatureFilter.value === 'soon') {
    return FEATURES.filter((f) => f.status === 'soon');
  }
  return FEATURES;
});

const howItWorks = [
  {
    step: 1,
    icon: 'i-lucide-map-pin',
    title: 'Define Gardens & Microclimates',
    description: 'Create gardens with location, timezone, and area, then subdivide into raised beds, greenhouses, or indoor pots with exact dimensions and soil types.'
  },
  {
    step: 2,
    icon: 'i-lucide-book-open',
    title: 'Select Species from the Catalog',
    description: 'Search 32+ reference plants by category and sun exposure to review ideal moisture, temperature, watering cadence, and spacing footprints.'
  },
  {
    step: 3,
    icon: 'i-lucide-gauge',
    title: 'Balance Capacity & Companions',
    description: 'Allocate quantities to each zone and get real-time bed utilization warnings plus automated synergistic and antagonistic companion insights.'
  }
];

const testimonials = [
  {
    name: 'Elena Vance',
    role: 'Community Garden Coordinator • Zone 7b',
    quote: 'Inviting new plot volunteers with Guest or Family permissions took seconds, and the sole-owner safeguard keeps our shared workspace safe.'
  },
  {
    name: 'Marcus Chen',
    role: 'Greenhouse Hobbyist • Zone 6a',
    quote: 'Seeing the zone utilization gauge turn red before over-planting tomatoes saved me from mid-summer blight and cramped root systems.'
  },
  {
    name: 'Priya Nair',
    role: 'Urban Balcony Grower • Zone 9b',
    quote: 'Having moisture and spacing numbers right beside companion pairings makes planning compact container guilds effortless.'
  }
];

const faqItems = [
  {
    label: 'Which features are live right now vs. under development?',
    content: 'Features F1–F15 are 100% live today: Authentication & Password Recovery (F1), Team Invitations & RBAC (F2), Gardens & Microclimate Zones (F3), the 32+ Species Plant Catalog (F4), Zone Crop Inventory (F5), Recurring Care Tasks & Watering (F6), IoT Sensor Ingestion & Telemetry (F7), Real-Time WebSocket Dashboard (F8), Smart Threshold Alerts & Quiet Hours (F9), Automation Rule Engine (F10), Weather-Aware Planning & Spatial Cache (F11), Seasonal Planting Calendar (F12), Personalized Care Plan Generator (F13), Plant Recommendation Engine (F14), and Companion Planting Advisor (F15). Features F16–F24 (Journal, Analytics, AI, Community, and Sprint 5 modules) are clearly badged with their target sprint.'
  },
  {
    label: 'How does SmartGarden detect bed overcrowding?',
    content: 'Each zone stores its physical area and each catalog species defines spacing_cm and row_spacing_cm. When you add or update plant quantities, the backend computes total footprint vs. zone capacity and raises a ZONE_OVERCROWDED warning when utilization exceeds 100%.'
  },
  {
    label: 'Can I test the platform without creating a new account?',
    content: 'Yes! Visit the Sign In page and click "Try the demo" to sign in immediately as demo@smartgarden.app with a pre-populated garden, microclimate zones, and active crops.'
  },
  {
    label: 'How do team roles work for shared gardens?',
    content: 'Garden Owners have full control over zones, plants, invitations, and member roles. Family members can manage zones and crops, while Guests have read-only access to monitor garden layouts and inventory.'
  },
  {
    label: 'Why does the full Plant Catalog ask me to sign in?',
    content: 'The live /api/catalog endpoint is protected by JWT authentication so personalized zone allocation works seamlessly. Unauthenticated visitors still see a curated preview on the landing page and catalog page with a 1-click sign-in prompt.'
  }
];

function formatSunlight(val) {
  const map = {
    FULL_SUN: 'Full Sun',
    PART_SHADE: 'Part Shade',
    FULL_SHADE: 'Full Shade'
  };
  return map[val] || val || 'Full Sun';
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    return;
  }
  previewLoading.value = true;
  try {
    const res = await api.get('/catalog', { params: { page: 1, limit: 6 } });
    const plants = res.data?.data?.plants;
    if (Array.isArray(plants) && plants.length > 0) {
      previewPlants.value = plants.slice(0, 6);
      usedFallbackPreview.value = false;
    }
  } catch {
    usedFallbackPreview.value = true;
    previewPlants.value = CURATED_PREVIEW_PLANTS;
  } finally {
    previewLoading.value = false;
  }
});
</script>
